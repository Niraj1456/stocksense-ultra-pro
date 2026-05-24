const { getWeights } = require("./weightTable");
const { applySectorNormalization, updateSectorScore, SECTOR_MAP } = require("./sectorNormalization");
const {
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine
} = require("./masterScoring");

function getVerdict(score) {
  if (score >= 75) return "STRONGLY BUY";
  if (score >= 58) return "BUY";
  if (score >= 50) return "NEUTRAL";
  if (score >= 38) return "HOLD";
  if (score >= 28) return "AVOID";
  return "STRONGLY AVOID";
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function scoreFromInputs(inputs) {
  const scores = {};
  scores.l1 = inputs.l1RiskBand === "LOW" ? 80 : inputs.l1RiskBand === "MODERATE" ? 60 : 35;
  scores.l3 = Number.isFinite(inputs.rsi) ? (inputs.rsi > 55 && inputs.rsi < 75 ? 75 : inputs.rsi < 35 ? 55 : 45) : 50;
  scores.l7 = Number.isFinite(inputs.pcr) ? (inputs.pcr >= 0.8 && inputs.pcr <= 1.3 ? 70 : 50) : 50;
  scores.l8 = Number.isFinite(inputs.roce) ? clamp(inputs.roce * 3, 20, 90) : 50;
  scores.l9 = 100 - clamp((inputs.forensicRiskScore || 0) * 100, 0, 100);
  scores.l10 = inputs.valuationBand === "CHEAP" ? 80 : inputs.valuationBand === "FAIR" ? 65 : 40;
  scores.l11 = Array.isArray(inputs.predictiveHints) ? clamp(50 + inputs.predictiveHints.length * 8, 35, 90) : 50;
  scores.l12 = inputs.rrValid ? 75 : 45;
  return scores;
}

function getLayerScoresFromIndicators(indicators, currentPrice) {
  const scores = {};
  
  // 1. Macro
  let l1 = 50;
  if (indicators.marketRegime === 'BULL') l1 = 70;
  else if (indicators.marketRegime === 'BEAR') l1 = 30;
  const vix = indicators.vix_level ?? (indicators.marketRegime === 'BEAR' ? 22 : 14);
  if (vix <= 12) l1 += 10;
  else if (vix > 20) l1 -= 15;
  if (indicators.sectorRegime === 'BULL') l1 += 10;
  else if (indicators.sectorRegime === 'BEAR') l1 -= 10;
  scores.layer1_macro = clamp(l1, 10, 90);

  // 2. Microstructure
  let l2 = 50;
  const obi = indicators.l2Imbalance ?? 0;
  const obiPrev = indicators.l2ImbalancePrev ?? obi;
  l2 += obi * 0.8 + (obi - obiPrev) * 0.4;
  scores.layer2_microstructure = clamp(l2, 10, 90);

  // 3. Technicals
  let l3 = 50;
  const rsi = indicators.rsi ?? 50;
  l3 += (rsi - 50) * 1.2;
  if (indicators.macd) {
    if (indicators.macd.crossover === "BULLISH") l3 += 10;
    else if (indicators.macd.crossover === "BEARISH") l3 -= 10;
  }
  if (indicators.ema20 && indicators.ema50) {
    if (indicators.ema20 > indicators.ema50) l3 += 10;
    else if (indicators.ema20 < indicators.ema50) l3 -= 10;
  }
  const adx = indicators.adx ?? 25;
  if (adx > 25) {
    l3 = 50 + (l3 - 50) * 1.15;
  }
  scores.layer3_technicals = clamp(l3, 10, 90);

  // 4. Price Action
  let l4 = 50;
  const wyckoff = indicators.wyckoffPhase || (indicators.momentumPct > 0 ? "ACCUMULATION" : "DISTRIBUTION");
  if (wyckoff === "ACCUMULATION" || wyckoff === "MARKUP") l4 += 15;
  else if (wyckoff === "DISTRIBUTION" || wyckoff === "MARKDOWN") l4 -= 15;
  
  if (indicators.wavePosition) {
    if ([1, 3, 5].includes(indicators.wavePosition)) l4 += 10;
    else if ([2, 4].includes(indicators.wavePosition)) l4 -= 5;
  }
  if (indicators.maxConfluencePts) {
    l4 += indicators.maxConfluencePts * 3;
  }
  scores.layer4_price_action = clamp(l4, 10, 90);

  // 5. Volume Profile
  let l5 = 50;
  const rvol = indicators.rvol ?? 1.0;
  if (indicators.vpDetails) {
    const pts = indicators.vpDetails.pts ?? 0;
    l5 += pts * 10;
  } else {
    if (currentPrice > (indicators.r1 || currentPrice * 1.02)) l5 += 15;
    else if (currentPrice < (indicators.s1 || currentPrice * 0.98)) l5 -= 15;
  }
  if (rvol > 1.5) {
    l5 = 50 + (l5 - 50) * 1.3;
  }
  scores.layer5_volume_profile = clamp(l5, 10, 90);

  // 6. Institutional
  let l6 = 50;
  const insider = indicators.insiderNetBuying ?? 0;
  l6 += insider * 25;
  const deliv = indicators.deliveryPct ?? 45;
  if (deliv > 50) l6 += 10;
  else if (deliv < 35) l6 -= 10;
  if (indicators.sentimentPts > 0) l6 += 10;
  else if (indicators.sentimentPts < 0) l6 -= 10;

  // Add direct contributions from actual Layer 6 modules:
  if (indicators.mfFlowPts !== undefined && indicators.mfFlowPts !== null) l6 += indicators.mfFlowPts;
  if (indicators.fiiDiiPts !== undefined && indicators.fiiDiiPts !== null) l6 += indicators.fiiDiiPts;
  if (indicators.bulkBlockPts !== undefined && indicators.bulkBlockPts !== null) l6 += indicators.bulkBlockPts;
  if (indicators.peerCorrPts !== undefined && indicators.peerCorrPts !== null) l6 += indicators.peerCorrPts;

  scores.layer6_institutional = clamp(l6, 10, 90);

  // 7. Derivatives
  let l7 = 50;
  const pcr = indicators.pcr ?? 1.0;
  if (pcr > 1.2) l7 += 15;
  else if (pcr < 0.6) l7 -= 15;
  scores.layer7_derivatives = clamp(l7, 10, 90);

  // 8. Fundamentals
  let l8 = 50;
  const de = indicators.debtToEquity;
  if (de !== undefined && de !== null) {
    if (de > 1.5) l8 -= 10;
    else if (de < 0.8) l8 += 5;
  }
  const roce = indicators.roce;
  if (roce !== undefined && roce !== null) {
    if (roce > 20) l8 += 10;
    else if (roce < 8) l8 -= 10;
  }
  const peg = indicators.pegRatio;
  if (peg !== undefined && peg !== null) {
    if (peg < 1.0) l8 += 10;
    else if (peg > 2.0) l8 -= 10;
  }
  scores.layer8_fundamentals = clamp(l8, 10, 90);

  // 9. Forensic
  let l9 = 50;
  const pF = indicators.piotroskiScore;
  if (pF !== undefined && pF !== null) {
    if (pF >= 7) l9 += 15;
    else if (pF <= 3) l9 -= 15;
  }
  const aZ = indicators.altmanZone;
  if (aZ === "SAFE_ZONE") l9 += 10;
  else if (aZ === "DISTRESS_ZONE") l9 -= 15;
  const bM = indicators.beneishMScore;
  if (bM !== undefined && bM !== null && bM > -1.78) {
    l9 -= 20;
  }
  scores.layer9_forensic = clamp(l9, 10, 90);

  // 10. Valuation
  let l10 = 50;
  const mos = indicators.dcfMoS;
  if (mos !== undefined && mos !== null) {
    l10 += mos * 0.5;
  }
  if (indicators.grahamPts !== undefined && indicators.grahamPts !== null) {
    l10 += indicators.grahamPts * 4;
  }
  if (indicators.reverseDcfPts !== undefined && indicators.reverseDcfPts !== null) {
    l10 += indicators.reverseDcfPts * 4;
  }
  if (indicators.earningsYieldPts !== undefined && indicators.earningsYieldPts !== null) {
    l10 += indicators.earningsYieldPts * 4;
  }
  scores.layer10_valuation = clamp(l10, 10, 90);

  // 11. Predictive
  let l11 = 50;
  let basePredictiveCount = 0;
  if (indicators.predictiveHints && Array.isArray(indicators.predictiveHints)) {
    basePredictiveCount += indicators.predictiveHints.length;
  }
  l11 += basePredictiveCount * 5;

  if (indicators.meanReversionPts !== undefined && indicators.meanReversionPts !== null) {
    l11 += indicators.meanReversionPts * 3;
  }
  if (indicators.breakoutPts !== undefined && indicators.breakoutPts !== null) {
    l11 += indicators.breakoutPts * 3;
  }
  if (indicators.markovPts !== undefined && indicators.markovPts !== null) {
    l11 += indicators.markovPts * 3;
  }

  if (l11 === 50) {
    if (indicators.momentum > 0) {
      l11 += 15;
    } else if (indicators.momentum < 0) {
      l11 -= 15;
    }
  }
  scores.layer11_predictive = clamp(l11, 10, 90);

  // 15. Sentiment & Catalysts
  let l15 = 50;
  l15 += (indicators.sentimentPts || 0) * 10;
  l15 += (indicators.insiderPts || 0) * 8;
  l15 += (indicators.catalystPts || 0) * 10;
  scores.layer15_sentiment = clamp(l15, 10, 90);

  // 12. Risk
  scores.layer12_risk = indicators.rrValid ?? true ? 75 : 45;

  return scores;
}

function runEngine(stock, currentPrice, indicators, options = {}) {
  const { timeHorizon = '1D' } = options; // '1D' = intraday, '5D' = swing
  const {
    rsi = 50, rvol = 1.0, momentum = 0, momentumPct = 0, atrTrend = 0, atrValue = 0, pcr = 1.0, l2Imbalance = 0, hasRealPCR = false, hasRealL2 = false,
    macd, ema20, ema50, ema200, peRatio, pbRatio, pegRatio, debtToEquity, roce, adx = 25,
    prevDayChangePct = 0, marketRegime = 'NEUTRAL', sectorRegime = 'NEUTRAL',
    piotroskiScore = null, altmanZone = null, dcfMoS = null, beneishMScore = null,
    sentimentPts = 0, sentimentVeto = false, sentimentConfidence = 'LOW',
    insiderNetBuying = null, earningsSurpriseStreak = 0, revenueAcceleration = null, daysToEarnings = null,
    triggerCandleOpen = null, triggerCandleHigh = null, triggerCandleLow = null,
    prevCandleOpen = null, prevCandleClose = null,
    promoterSellingVeto = false, circuitBreakerTripped = false, circuitBreakerReason = "NORMAL",
    auditorResignation = false, catalystPts = 0, catalystVeto = false, insiderVeto = false,
    systemicConfidence = 100, isExhausted: indicatorExhausted = false, rrValid = true,
    s1 = null, r1 = null
  } = indicators;

  // 15-PILLAR NON-LINEAR SCORING ENGINE
  // PILLAR 1: NON-LINEAR RSI ENGINE (±20)
  const isTrending = adx > 25;      // ADX > 25 = real directional trend
  const isRanging  = adx <= 20;     // ADX ≤ 20 = sideways chop
  const volExpanding = atrTrend > 0; // Volatility growing = breakout potential
  const volContracting = atrTrend < 0; // Volatility shrinking = mean reversion

  const momPositive = momentumPct > 0.5;    // Meaningful upward move (>0.5% over 5 days)
  const momNegative = momentumPct < -0.5;   // Meaningful downward move

  let rsiScore = 0;
  if (isTrending) {
    if (rsi > 80)       rsiScore = volExpanding ? -10 : -20; // Exhaustion only if vol contracts
    else if (rsi > 70)  rsiScore = momPositive ? -5 : -15;   // Trend alive if momentum confirms
    else if (rsi > 60)  rsiScore = momPositive ? 3 : -5;     // Mild extension
    else if (rsi < 20)  rsiScore = 15;                        // Deeply oversold = bounce likely regardless
    else if (rsi < 25)  rsiScore = momNegative ? 5 : 12;     // Default bullish, reduce only if actively selling
    else if (rsi < 30)  rsiScore = momPositive ? 12 : (momNegative ? -3 : 5);  // 3-way with dead zone
    else if (rsi < 40)  rsiScore = momPositive ? 5 : (momNegative ? -2 : 0);
  } else if (isRanging) {
    if (rsi > 75)       rsiScore = -18;    // Overbought in range = strong sell
    else if (rsi > 65)  rsiScore = -10;
    else if (rsi < 20)  rsiScore = 20;     // Extreme oversold in range = max bounce signal
    else if (rsi < 25)  rsiScore = 18;     // Oversold in range = strong buy
    else if (rsi < 35)  rsiScore = 10;
    else if (rsi < 45)  rsiScore = 3;      // Approaching oversold = mild bullish lean
  } else {
    if (rsi > 80)      rsiScore = -20;
    else if (rsi > 70) rsiScore = -15;
    else if (rsi > 60) rsiScore = -5;
    else if (rsi < 20) rsiScore = 12;                                           
    else if (rsi < 25) rsiScore = momPositive ? 10 : (momNegative ? -1 : 5);    
    else if (rsi < 30) rsiScore = momPositive ? 8 : (momNegative ? -3 : 3);
    else if (rsi < 40) rsiScore = momPositive ? 5 : 0;
  }

  // RSI DIVERGENCE DETECTOR
  let divergenceBonus = 0;
  if (momPositive && rsi < 40)       divergenceBonus = 8;   // Bullish divergence
  else if (momNegative && rsi > 60)  divergenceBonus = -8;  // Bearish divergence

  // PILLAR 2: ADX-AWARE TREND STRENGTH (±12)
  let trendScore = 0;
  if (ema20 && ema50) {
    const ema20Pct = ((currentPrice - ema20) / ema20) * 100;
    const emaCross = ema20 > ema50; // Golden cross = bullish structure

    if (emaCross) {
      if (ema20Pct < -3)      trendScore = -12;  // Deep breakdown below EMA in uptrend
      else if (ema20Pct < -1) trendScore = -5;   // Starting to crack
      else if (ema20Pct > 8)  trendScore = -5;   // Parabolic extension
      else if (ema20Pct > 4)  trendScore = isTrending ? 5 : 0;
      else                    trendScore = 8;     // Healthy uptrend above EMA
    } else {
      if (ema20Pct > 3)       trendScore = 12;   // Strong breakout above falling EMAs
      else if (ema20Pct > 1)  trendScore = 5;    // Attempting recovery
      else if (ema20Pct < -8) trendScore = 5;    // So extended → bounce likely
      else if (ema20Pct < -4) trendScore = isTrending ? -5 : 3;
      else                    trendScore = -8;    // Healthy downtrend below EMA
    }

    const adxMultiplier = adx > 40 ? 1.3 : adx > 30 ? 1.15 : adx > 20 ? 1.0 : 0.7;
    trendScore = Math.round(trendScore * adxMultiplier);
    trendScore = clamp(trendScore, -12, 12);
  } else {
    if (adx > 20) {
      trendScore = momPositive ? 5 : (momNegative ? -5 : 0);
    }
  }

  // PILLAR 3: VOLUME-TREND CONFLUENCE (±8)
  let volScore = 0;
  if (rvol > 2.0) {
    volScore = (rsiScore + trendScore) > 0 ? 8 : ((rsiScore + trendScore) < 0 ? -8 : 0);
  } else if (rvol > 1.3) {
    volScore = (rsiScore + trendScore) > 0 ? 5 : ((rsiScore + trendScore) < 0 ? -5 : 0);
  } else if (rvol < 0.5) {
    volScore = trendScore > 0 ? -3 : (trendScore < 0 ? 3 : 0);
  }

  // PILLAR 4: ENHANCED MICROSTRUCTURE (±12)
  let flowScore = 0;
  if (hasRealPCR) {
    if (pcr > 1.5)      flowScore += 7;   // Extreme put writing = very bullish
    else if (pcr > 1.2) flowScore += 4;   // Moderate support
    else if (pcr < 0.5) flowScore -= 7;   // Extreme call writing = very bearish
    else if (pcr < 0.7) flowScore -= 4;   // Mild resistance
  }
  if (hasRealL2) {
    if (l2Imbalance > 25)       flowScore += 5;  // Massive buy walls
    else if (l2Imbalance > 10)  flowScore += 3;
    else if (l2Imbalance < -25) flowScore -= 5;  // Massive sell walls
    else if (l2Imbalance < -10) flowScore -= 3;
  }
  flowScore = clamp(flowScore, -12, 12);

  // PILLAR 5: FUNDAMENTALS WITH VALUATION CONTEXT (±6)
  let fundScore = 0;
  if (peRatio && peRatio > 0) {
    if (pegRatio && pegRatio > 0) {
      if (pegRatio < 1.0) fundScore += 4;       // Undervalued relative to growth
      else if (pegRatio > 2.5) fundScore -= 3;  // Overpriced for growth
    } else {
      if (peRatio < 15) fundScore += 3;
      else if (peRatio > 60) fundScore -= 3;
    }
  }
  if (roce && roce > 20) fundScore += 2;
  if (debtToEquity && debtToEquity > 2.0) fundScore -= 2; // Heavily leveraged
  fundScore = clamp(fundScore, -6, 6);

  // PILLAR 6: MACD MOMENTUM ALIGNMENT (±6)
  let macdScore = 0;
  if (macd) {
    if (macd.crossover === "BULLISH" && trendScore > 0) macdScore = 6;
    else if (macd.crossover === "BEARISH" && trendScore < 0) macdScore = -6;
    
    if (macd.histogram > 0 && macd.histogram_direction === "EXPANDING") macdScore += 3;
    else if (macd.histogram < 0 && macd.histogram_direction === "EXPANDING") macdScore -= 3;
  }
  macdScore = clamp(macdScore, -6, 6);

  // PILLAR 7: GARCH-STYLE VOLATILITY FORECAST (±5)
  let garchScore = 0;
  if (volExpanding) {
    garchScore = (rsiScore + trendScore) > 0 ? 5 : ((rsiScore + trendScore) < 0 ? -5 : 0);
  } else if (volContracting) {
    if (rsi > 65) garchScore = -4;       
    else if (rsi < 35) garchScore = 4;   
  }

  // PILLAR 8: MULTI-INDICATOR AGREEMENT BONUS (±8)
  const bullSignals = [
    rsiScore > 3, trendScore > 3, volScore > 0, flowScore > 2,
    fundScore > 1, macdScore > 2, garchScore > 0, divergenceBonus > 0,
    insiderNetBuying !== null && insiderNetBuying > 0.2,
    earningsSurpriseStreak >= 2,
    revenueAcceleration !== null && revenueAcceleration > 0.03
  ].filter(Boolean).length;
  const bearSignals = [
    rsiScore < -3, trendScore < -3, volScore < 0, flowScore < -2,
    fundScore < -1, macdScore < -2, garchScore < 0, divergenceBonus < 0,
    insiderNetBuying !== null && insiderNetBuying < -0.2,
    earningsSurpriseStreak <= -2,
    revenueAcceleration !== null && revenueAcceleration < -0.03
  ].filter(Boolean).length;

  let confluenceBonus = 0;
  const netSignals = bullSignals - bearSignals;
  if (netSignals >= 5)      confluenceBonus = 8;    // Dominant bull agreement
  else if (netSignals >= 3) confluenceBonus = 5;
  else if (netSignals >= 1 && bullSignals >= 3) confluenceBonus = 3; 
  else if (netSignals <= -5) confluenceBonus = -8;  // Dominant bear agreement
  else if (netSignals <= -3) confluenceBonus = -5;
  else if (netSignals <= -1 && bearSignals >= 3) confluenceBonus = -3; 

  // PILLAR 9: NLP SENTIMENT (±6)
  const sentimentWeight = sentimentConfidence === 'HIGH' ? 1.0 : sentimentConfidence === 'MODERATE' ? 0.75 : 0.5;
  let sentimentScore = clamp(Math.round(sentimentPts * sentimentWeight * 1.5), -6, 6); 
  if (sentimentVeto && rsiScore + trendScore > 0) sentimentScore = -6;
  if (sentimentPts >= 3 && sentimentConfidence === 'HIGH' && rsiScore + trendScore > 0) sentimentScore = Math.max(sentimentScore, 5);

  // PILLAR 10: FUNDAMENTAL QUALITY (±5)
  let qualityScore = 0;
  if (piotroskiScore !== null) {
    if (piotroskiScore >= 8) qualityScore += 3;       
    else if (piotroskiScore >= 6) qualityScore += 1;   
    else if (piotroskiScore <= 3) qualityScore -= 3;   
  }
  if (altmanZone === 'DISTRESS_ZONE') qualityScore -= 2; 
  else if (altmanZone === 'SAFE_ZONE') qualityScore += 2;
  qualityScore = clamp(qualityScore, -5, 5);

  // PILLAR 11: DCF INTRINSIC VALUE (±4)
  let dcfScore = 0;
  if (dcfMoS !== null) {
    if (dcfMoS > 30) dcfScore = 4;        
    else if (dcfMoS > 15) dcfScore = 2;   
    else if (dcfMoS < -30) dcfScore = -4; 
    else if (dcfMoS < -10) dcfScore = -2; 
  }

  // PILLAR 12: INSIDER TRADING SIGNAL (±4)
  let insiderScore = 0;
  if (insiderNetBuying !== null) {
    if (insiderNetBuying > 0.5) insiderScore = 4;        
    else if (insiderNetBuying > 0.2) insiderScore = 2;   
    else if (insiderNetBuying < -0.5) insiderScore = -4;  
    else if (insiderNetBuying < -0.2) insiderScore = -2;  
    if (insiderNetBuying > 0.3 && rsi < 40) insiderScore = Math.min(insiderScore + 2, 4);
  }

  // PILLAR 13: EARNINGS SURPRISE MOMENTUM (±4)
  let earningsScore = 0;
  if (earningsSurpriseStreak >= 3) earningsScore = 4;       
  else if (earningsSurpriseStreak >= 2) earningsScore = 2;  
  else if (earningsSurpriseStreak <= -3) earningsScore = -4; 
  else if (earningsSurpriseStreak <= -2) earningsScore = -3; 

  // PILLAR 14: EARNINGS PROXIMITY GUARD
  let earningsProximityAdj = 0;
  if (daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3) {
    earningsProximityAdj = -Math.sign(rsiScore + trendScore) * 3;
  }

  // PILLAR 15: REVENUE ACCELERATION (±3)
  let revenueScore = 0;
  if (revenueAcceleration !== null) {
    if (revenueAcceleration > 0.1) revenueScore = 3;        
    else if (revenueAcceleration > 0.03) revenueScore = 1;  
    else if (revenueAcceleration < -0.1) revenueScore = -3;  
    else if (revenueAcceleration < -0.03) revenueScore = -1;
  }

  // COMPOSITE ADDITIVE SCORE ASSEMBLY
  const base = 50;
  let score = base + rsiScore + trendScore + volScore + flowScore + fundScore + macdScore + garchScore + divergenceBonus + confluenceBonus + sentimentScore + qualityScore + dcfScore + insiderScore + earningsScore + earningsProximityAdj + revenueScore;

  // Add continuous precision (micro-variance)
  const precisionTweak = ((rsi - 50) * 0.03) + (rvol * 0.15) + (momentumPct * 0.05);
  score += clamp(precisionTweak, -3, 3); 

  // ADX CONFIDENCE SCALING
  if (adx < 15) {
    score = 50 + (score - 50) * 0.55;   
  } else if (adx < 18) {
    score = 50 + (score - 50) * 0.70;   
  } else if (adx < 20) {
    score = 50 + (score - 50) * 0.85;   
  } else if (adx > 35) {
    score = 50 + (score - 50) * 1.12;  
  }

  // RVOL CONVICTION AMPLIFIER
  if (rvol > 2.0 && Math.abs(score - 50) > 4) {
    score = 50 + (score - 50) * 1.12; 
  } else if (rvol > 1.5 && Math.abs(score - 50) > 6) {
    score = 50 + (score - 50) * 1.06; 
  }

  score = Math.max(5, Math.min(95, score));
  score = Number(score.toFixed(2));

  // MULTI-TIMEFRAME CONFIRMATION
  if (ema50 && ema200) {
    const isMacroUptrend = ema50 > ema200;
    if (score > 58 && !isMacroUptrend) score -= 3; 
    if (score < 40 && isMacroUptrend) score += 3;  
  }

  // PREVIOUS-DAY CANDLE PENALTY
  if (prevDayChangePct < -1.5 && score > 55 && score < 65) score -= 2;
  if (prevDayChangePct > 1.5 && score < 42 && score > 35) score += 2;

  // MARKET REGIME FILTER
  if (marketRegime === 'BEAR' && score > 55 && score < 63) score -= 2;
  if (marketRegime === 'BULL' && score < 42 && score > 35) score += 3;

  // Layer 16 systemic confidence dampening
  score = 50 + (score - 50) * clamp(systemicConfidence / 100, 0.4, 1.0);
  score = Math.max(5, Math.min(95, score));
  score = Number(score.toFixed(2));

  // SECTOR RELATIVE NORMALIZATION
  score = applySectorNormalization(stock, score);
  updateSectorScore(stock, score); // Update the cache for the next run
  
  score = Number(score.toFixed(2));

  const isBullish = score >= 58;
  const isBearish = score < 38;

  // DIRECTIONAL ACCURACY GATES & VETOES
  // Veto 1: Trend-Alignment 
  const isMacroUptrend = (ema20 && ema50) ? ema20 > ema50 : false;
  const isLongTermUptrend = ema200 ? currentPrice > ema200 : false;
  const isStrongShort = score < 30;
  const trendVeto = isStrongShort && isMacroUptrend && isLongTermUptrend;

  // Veto 2: Oversold Override 
  const oversoldOverride = isStrongShort && rsi < 25 && adx > 25 && isLongTermUptrend;

  // Veto 3: Low-volume short rejection 
  const shortNoVolume = isStrongShort && rvol < 0.5;

  // Veto 4: Low-volume buy veto
  const longNoVolume = score >= 58 && rvol < 0.40;

  // Universal directional volume floor 
  const anyDirNoVolume = (score >= 58 || score < 38) && rvol < 0.35;

  // Veto 6: bearMarketLong
  const bearMarketLong = score >= 58 && marketRegime === 'BEAR' && isTrending;

  // Veto 7: forensicDistress
  const forensicDistress = score >= 55 && altmanZone === 'DISTRESS_ZONE';

  // Veto 8: weakBearish
  const weakBearish = isBearish && bearSignals < 2 && marketRegime !== 'BEAR';

  // GATE 1: OVERSOLD SHORT PROTECTION
  const oversoldShort = score < 38 && rsi < 30 && !(adx > 30 && momentumPct < -3);

  // GATE 2: TRENDING-OVERBOUGHT SHORT PROTECTION
  const trendingOverboughtShort = score < 38 && rsi > 70 && adx > 25 && momentumPct > 0;

  // GATE 3: MOMENTUM-DIRECTION DISAGREEMENT
  const momDisagreeLong = score >= 58 && momentumPct < -1.0 && rsi > 25;
  const momDisagreeShort = score < 38 && momentumPct > 1.0 && rsi < 75;

  // GATE 4: OVERBOUGHT BUY PROTECTION
  const overboughtLong = score >= 58 && score < 75 && rsi > 60;

  // GATE 6: OVERSOLD TREND BUY PROTECTION (FALLING KNIFE VETO)
  const oversoldTrendLong = score >= 58 && rsi < 30 && adx > 25;

  // GATE 5: CANDLE STRUCTURE CONFIRMATION
  let candleVetoLong = false;
  let candleVetoShort = false;
  if (triggerCandleHigh != null && triggerCandleLow != null && triggerCandleOpen != null) {
    const candleRange = triggerCandleHigh - triggerCandleLow;
    const closePosition = candleRange > 0 ? (currentPrice - triggerCandleLow) / candleRange : 0.5;
    const triggerBody = currentPrice - triggerCandleOpen;

    if (score >= 58 && score < 80 && closePosition < 0.40) candleVetoLong = true;
    if (score < 38 && score > 20 && closePosition > 0.60) candleVetoShort = true;

    if (prevCandleOpen != null && prevCandleClose != null) {
      const prevBody = prevCandleClose - prevCandleOpen;
      const isBearishEngulfing = triggerBody < 0 && prevBody > 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      const isBullishEngulfing = triggerBody > 0 && prevBody < 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      if (score >= 58 && score < 80 && isBearishEngulfing) candleVetoLong = true;
      if (score < 38 && score > 20 && isBullishEngulfing) candleVetoShort = true;
    }
  }

  // Multi-timeframe trend veto and event checks
  const isVetoed = trendVeto || oversoldOverride || shortNoVolume || longNoVolume
    || anyDirNoVolume || bearMarketLong || forensicDistress || weakBearish
    || oversoldShort || trendingOverboughtShort || momDisagreeLong || momDisagreeShort
    || overboughtLong || oversoldTrendLong || candleVetoLong || candleVetoShort
    || (isBullish && beneishMScore !== null && beneishMScore > -1.78)
    || (daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3)
    || promoterSellingVeto || circuitBreakerTripped || auditorResignation || sentimentVeto || catalystVeto || insiderVeto;

  const vetoReasons = [
    ...(trendVeto ? ['TREND_VETO'] : []),
    ...(oversoldOverride ? ['OVERSOLD_OVERRIDE'] : []),
    ...(shortNoVolume ? ['LOW_VOL_SHORT'] : []),
    ...(longNoVolume ? ['LOW_VOL_LONG'] : []),
    ...(anyDirNoVolume ? ['LOW_VOL_ANY'] : []),
    ...(bearMarketLong ? ['BEAR_MARKET_LONG'] : []),
    ...(forensicDistress ? ['FORENSIC_DISTRESS'] : []),
    ...(weakBearish ? ['WEAK_BEAR_CONVICTION'] : []),
    ...(oversoldShort ? ['OVERSOLD_SHORT'] : []),
    ...(trendingOverboughtShort ? ['TRENDING_OB_SHORT'] : []),
    ...(momDisagreeLong ? ['MOM_DISAGREE_LONG'] : []),
    ...(momDisagreeShort ? ['MOM_DISAGREE_SHORT'] : []),
    ...(overboughtLong ? ['OVERBOUGHT_LONG'] : []),
    ...(oversoldTrendLong ? ['OVERSOLD_TREND_LONG'] : []),
    ...(candleVetoLong ? ['CANDLE_VETO_LONG'] : []),
    ...(candleVetoShort ? ['CANDLE_VETO_SHORT'] : []),
    ...(isBullish && beneishMScore !== null && beneishMScore > -1.78 ? ['BENEISH_M_SCORE_MANIPULATION_RISK'] : []),
    ...(daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3 ? ['EARNINGS_ANNOUNCEMENT_BINARY_RISK'] : []),
    ...(promoterSellingVeto ? ['PROMOTER_DISTRESS_SELL'] : []),
    ...(circuitBreakerTripped ? [circuitBreakerReason || 'CIRCUIT_BREAKER_TRIPPED'] : []),
    ...(auditorResignation ? ['AUDITOR_RESIGNATION'] : []),
    ...(sentimentVeto ? ['STRONGLY_BEARISH_SENTIMENT'] : []),
    ...(catalystVeto ? ['EARNINGS_IMMINENT_VETO'] : []),
    ...(insiderVeto ? ['INSIDER_VETO'] : [])
  ];

  // TIGHTENED ATR TARGET PREDICTOR (0.12 - 0.45x ATR headroom)
  let baseMultiplier = 0.15 + (Math.abs(score - 50) / 50) * 0.25; 
  if (rvol < 0.7) baseMultiplier *= 0.85;  
  if (adx < 15) baseMultiplier = Math.min(baseMultiplier, 0.18); 
  
  let atrMultiplier = Math.max(0.12, Math.min(0.45, baseMultiplier));
  let headroom = atrValue * atrMultiplier;
  
  if (timeHorizon === '1D') {
    const atrPct = atrValue / currentPrice;
    const dailyCap = Math.min(atrPct * 0.55, 0.018); 
    const maxIntraday = currentPrice * Math.max(dailyCap, 0.004); 
    headroom = Math.min(headroom, maxIntraday);
  }
  
  const upTarget = currentPrice + (headroom * (rvol > 1.5 ? 1.0 : 0.95));
  const downTarget = currentPrice - (headroom * (rvol > 1.5 ? 1.05 : 1.0));

  let direction = "NEUTRAL";
  if (!isVetoed) {
    if (isBullish) direction = "UP";
    else if (isBearish) direction = "DOWN";
  }

  // Call weightTableEngine to fetch weights for compatibility in return
  const weightRes = weightTableEngine({ mode: timeHorizon === '5D' ? 'INVESTMENT' : 'INTRADAY', market_regime: marketRegime });
  const weights = weightRes.data.weights;

  // Use verdictClassifierEngine for official verdict
  const verdictRes = verdictClassifierEngine({
    total_score: score,
    veto_data: { veto_triggered: isVetoed, veto_reasons: vetoReasons },
    rr_valid: rrValid
  });

  return {
    score,
    isBullish,
    isVetoed,
    vetoReasons,
    vetoFailCount: vetoReasons.length,
    direction,
    verdict: isVetoed ? "VETOED (TRAP)" : (indicatorExhausted ? "EXHAUSTED" : (verdictRes.ok ? verdictRes.data.verdict : getVerdict(score))),
    upTarget,
    downTarget,
    signals: {
      trend: trendScore,
      flow: flowScore,
      momEx: rsiScore,
      fund: fundScore,
      vol: rvol,
      macd: macd ? macd.histogram : 0,
      sentiment: sentimentPts,
      quality: qualityScore,
      dcf: dcfMoS || 0,
      insider: insiderNetBuying || 0,
      earnings: earningsSurpriseStreak,
      revenue: revenueAcceleration || 0,
      earningsProximity: earningsProximityAdj
    },
    sources: {
      pcr: hasRealPCR ? 'NSE_LIVE' : 'DEFAULT',
      l2: hasRealL2 ? 'NSE_LIVE' : 'DEFAULT',
      fundamentals: piotroskiScore !== null ? 'FMP' : 'YAHOO'
    }
  };
}

function scoreEngine({ mode, stock, currentPrice, indicators, inputs }) {
  const masterMode = mode === "LT" ? "INVESTMENT" : "INTRADAY";
  const weightRes = weightTableEngine({ mode: masterMode, market_regime: indicators?.marketRegime || "NORMAL" });
  const weights = weightRes.data.weights;

  let totalScore = 50;
  let engineResult = null;

  if (indicators) {
    const timeHorizon = mode === "LT" ? "5D" : "1D";
    engineResult = runEngine(stock, currentPrice, indicators, { timeHorizon });
    totalScore = engineResult.score;
  } else {
    const raw = scoreFromInputs(inputs);
    
    const layerScores = {
      layer1_macro: raw.l1 ?? 50,
      layer2_microstructure: 50,
      layer3_technicals: raw.l3 ?? 50,
      layer4_price_action: 50,
      layer5_volume_profile: 50,
      layer6_institutional: 50,
      layer7_derivatives: raw.l7 ?? 50,
      layer8_fundamentals: raw.l8 ?? 50,
      layer9_forensic: raw.l9 ?? 50,
      layer10_valuation: raw.l10 ?? 50,
      layer11_predictive: raw.l11 ?? 50,
      layer12_risk: raw.l12 ?? 50,
      layer15_sentiment: 50
    };

    const aggRes = scoreAggregationEngine({ layer_scores: layerScores, weights });
    totalScore = aggRes.data.total_score;
  }

  return {
    ok: true,
    data: {
      rawScores: indicators ? getLayerScoresFromIndicators(indicators, currentPrice) : scoreFromInputs(inputs),
      weights,
      totalScore: Number(totalScore.toFixed(2)),
      engineResult
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreEngine:real" }
  };
}

module.exports = { scoreEngine, runEngine };
