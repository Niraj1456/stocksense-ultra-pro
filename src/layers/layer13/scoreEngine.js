const { getWeights } = require("./weightTable");
const { applySectorNormalization, updateSectorScore } = require("./sectorNormalization");

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

function runEngine(stock, currentPrice, indicators, options = {}) {
  const { timeHorizon = '1D' } = options; // '1D' = intraday, '5D' = swing
  const {
    rsi = 50, rvol = 1.0, momentum = 0, momentumPct = 0, atrTrend = 0, atrValue = 0, pcr = 1.0, l2Imbalance = 0, hasRealPCR = false, hasRealL2 = false,
    macd, ema20, ema50, ema200, peRatio, pbRatio, pegRatio, debtToEquity, roce, adx = 25,
    prevDayChangePct = 0, marketRegime = 'NEUTRAL', // FIX 2 & 4: new inputs
    // API-powered signals from FMP + Alpha Vantage
    piotroskiScore = null, altmanZone = null, dcfMoS = null,
    sentimentPts = 0, sentimentVeto = false, sentimentConfidence = 'LOW',
    // NEW: FMP insider, earnings, revenue + AV earnings proximity
    insiderNetBuying = null, earningsSurpriseStreak = 0, revenueAcceleration = null, daysToEarnings = null,
    // v4.5: Candle structure data for directional confirmation
    triggerCandleOpen = null, triggerCandleHigh = null, triggerCandleLow = null,
    prevCandleOpen = null, prevCandleClose = null
  } = indicators;

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 1: NON-LINEAR RSI ENGINE (±20)
  // Uses conditional logic trees instead of flat thresholds.
  // RSI meaning changes based on trend context (ADX) and volatility (atrTrend).
  // ═══════════════════════════════════════════════════════════════════════════
  const isTrending = adx > 25;      // ADX > 25 = real directional trend
  const isRanging  = adx <= 20;     // ADX ≤ 20 = sideways chop
  const volExpanding = atrTrend > 0; // Volatility growing = breakout potential
  const volContracting = atrTrend < 0; // Volatility shrinking = mean reversion

  // UPGRADE T1-1: Continuous momentum replaces binary (magnitude matters)
  const momPositive = momentumPct > 0.5;    // Meaningful upward move (>0.5% over 5 days)
  const momNegative = momentumPct < -0.5;   // Meaningful downward move
  const momStrength = Math.min(Math.abs(momentumPct) / 3, 1); // 0-1 normalized, caps at 3%

  let rsiScore = 0;
  if (isTrending) {
    // In a TRENDING market: extreme RSI = continuation, not reversal
    if (rsi > 80)       rsiScore = volExpanding ? -10 : -20; // Exhaustion only if vol contracts
    else if (rsi > 70)  rsiScore = momPositive ? -5 : -15;   // Trend alive if momentum confirms
    else if (rsi > 60)  rsiScore = momPositive ? 3 : -5;     // Mild extension
    else if (rsi < 20)  rsiScore = 15;                        // T1-1 FIX: Deeply oversold = bounce likely regardless
    else if (rsi < 25)  rsiScore = momNegative ? 5 : 12;     // T1-1 FIX: Default bullish, reduce only if actively selling
    else if (rsi < 30)  rsiScore = momPositive ? 12 : (momNegative ? -3 : 5);  // 3-way with dead zone
    else if (rsi < 40)  rsiScore = momPositive ? 5 : (momNegative ? -2 : 0);
  } else if (isRanging) {
    // In a RANGING market: RSI mean-reversion is king
    if (rsi > 75)       rsiScore = -18;    // Overbought in range = strong sell
    else if (rsi > 65)  rsiScore = -10;
    else if (rsi < 20)  rsiScore = 20;     // Extreme oversold in range = max bounce signal
    else if (rsi < 25)  rsiScore = 18;     // Oversold in range = strong buy
    else if (rsi < 35)  rsiScore = 10;
    else if (rsi < 45)  rsiScore = 3;      // Approaching oversold = mild bullish lean
  } else {
    // Transitional zone (ADX 20-25): conservative
    if (rsi > 80)      rsiScore = -20;
    else if (rsi > 70) rsiScore = -15;
    else if (rsi > 60) rsiScore = -5;
    else if (rsi < 20) rsiScore = 12;                                           // T1-1 FIX: Oversold = bounce likely
    else if (rsi < 25) rsiScore = momPositive ? 10 : (momNegative ? -1 : 5);    // T1-1 FIX: 3-way
    else if (rsi < 30) rsiScore = momPositive ? 8 : (momNegative ? -3 : 3);
    else if (rsi < 40) rsiScore = momPositive ? 5 : 0;
  }

  // RSI DIVERGENCE DETECTOR: Price vs RSI disagreement = powerful reversal signal
  // If momentum (5-day price) is UP but RSI is dropping → bearish divergence
  // If momentum is DOWN but RSI is rising → bullish divergence
  let divergenceBonus = 0;
  if (momPositive && rsi < 40)       divergenceBonus = 8;   // Bullish divergence (continuous momentum)
  else if (momNegative && rsi > 60)  divergenceBonus = -8;  // Bearish divergence (continuous momentum)

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 2: ADX-AWARE TREND STRENGTH (±12)
  // Combines EMA structure with ADX conviction level for non-linear weighting.
  // ═══════════════════════════════════════════════════════════════════════════
  let trendScore = 0;
  if (ema20 && ema50) {
    const ema20Pct = ((currentPrice - ema20) / ema20) * 100;
    const emaCross = ema20 > ema50; // Golden cross = bullish structure

    if (emaCross) {
      // Bullish EMA structure
      if (ema20Pct < -3)      trendScore = -12;  // Deep breakdown below EMA in uptrend
      else if (ema20Pct < -1) trendScore = -5;   // Starting to crack
      else if (ema20Pct > 8)  trendScore = -5;   // Parabolic extension → pullback risk
      else if (ema20Pct > 4)  trendScore = isTrending ? 5 : 0; // Extended but trending
      else                    trendScore = 8;     // Healthy uptrend above EMA
    } else {
      // Bearish EMA structure
      if (ema20Pct > 3)       trendScore = 12;   // Strong breakout above falling EMAs
      else if (ema20Pct > 1)  trendScore = 5;    // Attempting recovery
      else if (ema20Pct < -8) trendScore = 5;    // So extended → bounce likely
      else if (ema20Pct < -4) trendScore = isTrending ? -5 : 3; // Deep but could bounce
      else                    trendScore = -8;    // Healthy downtrend below EMA
    }

    // ADX multiplier: Scale trend score by conviction
    const adxMultiplier = adx > 40 ? 1.3 : adx > 30 ? 1.15 : adx > 20 ? 1.0 : 0.7;
    trendScore = Math.round(trendScore * adxMultiplier);
    trendScore = clamp(trendScore, -12, 12);
  } else {
    // Fallback: momentum + ADX (uses continuous momentum with dead zone)
    if (adx > 20) {
      trendScore = momPositive ? 5 : (momNegative ? -5 : 0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 3: VOLUME-TREND CONFLUENCE (±8)
  // High volume CONFIRMING the trend = strong. High volume AGAINST trend = reversal.
  // ═══════════════════════════════════════════════════════════════════════════
  let volScore = 0;
  if (rvol > 2.0) {
    // Massive volume spike: strongly confirms direction
    volScore = (rsiScore + trendScore) > 0 ? 8 : ((rsiScore + trendScore) < 0 ? -8 : 0);
  } else if (rvol > 1.3) {
    // Above-average volume: moderate confirmation
    volScore = (rsiScore + trendScore) > 0 ? 5 : ((rsiScore + trendScore) < 0 ? -5 : 0);
  } else if (rvol < 0.5) {
    // Dangerously low volume: trend cannot be trusted
    // Dampen the trend score by assigning opposite vol score
    volScore = trendScore > 0 ? -3 : (trendScore < 0 ? 3 : 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 4: ENHANCED MICROSTRUCTURE (±12)
  // PCR with context (ATM skew awareness) + L2 with delivery confirmation
  // ═══════════════════════════════════════════════════════════════════════════
  let flowScore = 0;
  if (hasRealPCR) {
    // Non-linear PCR: extreme readings are stronger signals
    if (pcr > 1.5)      flowScore += 7;   // Extreme put writing = very bullish
    else if (pcr > 1.2) flowScore += 4;   // Moderate support
    else if (pcr < 0.5) flowScore -= 7;   // Extreme call writing = very bearish
    else if (pcr < 0.7) flowScore -= 4;   // Mild resistance
  }
  if (hasRealL2) {
    // L2 imbalance with graduated scaling
    if (l2Imbalance > 25)       flowScore += 5;  // Massive buy walls
    else if (l2Imbalance > 10)  flowScore += 3;
    else if (l2Imbalance < -25) flowScore -= 5;  // Massive sell walls
    else if (l2Imbalance < -10) flowScore -= 3;
  }
  flowScore = clamp(flowScore, -12, 12);

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 5: FUNDAMENTALS WITH VALUATION CONTEXT (±6)
  // PE alone is meaningless. PE + Growth (PEG) + Balance Sheet = real picture.
  // ═══════════════════════════════════════════════════════════════════════════
  let fundScore = 0;
  if (peRatio && peRatio > 0) {
    if (pegRatio && pegRatio > 0) {
      // PEG ratio: best single valuation metric (PE / Growth)
      if (pegRatio < 1.0) fundScore += 4;       // Undervalued relative to growth
      else if (pegRatio > 2.5) fundScore -= 3;  // Overpriced for growth
    } else {
      // PE only: basic
      if (peRatio < 15) fundScore += 3;
      else if (peRatio > 60) fundScore -= 3;
    }
  }
  if (roce && roce > 20) fundScore += 2;
  if (debtToEquity && debtToEquity > 2.0) fundScore -= 2; // Heavily leveraged
  fundScore = clamp(fundScore, -6, 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 6: MACD MOMENTUM ALIGNMENT (±6)
  // Utilizes MACD crossovers and histogram expansion to confirm trend strength.
  // ═══════════════════════════════════════════════════════════════════════════
  let macdScore = 0;
  if (macd) {
    if (macd.crossover === "BULLISH" && trendScore > 0) macdScore = 6;
    else if (macd.crossover === "BEARISH" && trendScore < 0) macdScore = -6;
    
    if (macd.histogram > 0 && macd.histogram_direction === "EXPANDING") macdScore += 3;
    else if (macd.histogram < 0 && macd.histogram_direction === "EXPANDING") macdScore -= 3;
  }
  macdScore = clamp(macdScore, -6, 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 7: GARCH-STYLE VOLATILITY FORECAST (±5)
  // If volatility is contracting after a spike, mean-reversion is likely.
  // If volatility is expanding, trend-following signals get amplified.
  // ═══════════════════════════════════════════════════════════════════════════
  let garchScore = 0;
  if (volExpanding) {
    // Expanding vol: amplify the dominant signal direction
    garchScore = (rsiScore + trendScore) > 0 ? 5 : ((rsiScore + trendScore) < 0 ? -5 : 0);
  } else if (volContracting) {
    // Contracting vol: mean-reversion bias
    if (rsi > 65) garchScore = -4;       // Likely to pull back
    else if (rsi < 35) garchScore = 4;   // Likely to bounce
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 8: MULTI-INDICATOR AGREEMENT BONUS (±8)
  // When 3+ independent pillars agree on direction, conviction multiplies.
  // This is the "non-linear" edge: agreement is worth more than sum of parts.
  // ═══════════════════════════════════════════════════════════════════════════
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
  // FIX: Use NET confluence (bull - bear) to prevent overwrite bias
  const netSignals = bullSignals - bearSignals;
  if (netSignals >= 5)      confluenceBonus = 8;    // Dominant bull agreement
  else if (netSignals >= 3) confluenceBonus = 5;
  else if (netSignals >= 1 && bullSignals >= 3) confluenceBonus = 3; // Mild bull edge with 3+ agreeing
  else if (netSignals <= -5) confluenceBonus = -8;  // Dominant bear agreement
  else if (netSignals <= -3) confluenceBonus = -5;
  else if (netSignals <= -1 && bearSignals >= 3) confluenceBonus = -3; // Mild bear edge with 3+ agreeing

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 9: NLP SENTIMENT (±4) — powered by Alpha Vantage
  // Real NLP sentiment from financial news replaces keyword matching.
  // ═══════════════════════════════════════════════════════════════════════════
  // Apply confidence weighting: HIGH confidence gets full weight, LOW gets 50%
  const sentimentWeight = sentimentConfidence === 'HIGH' ? 1.0 : sentimentConfidence === 'MODERATE' ? 0.75 : 0.5;
  let sentimentScore = clamp(Math.round(sentimentPts * sentimentWeight * 1.5), -6, 6); // Expanded range ±6
  // Sentiment veto: strongly bearish news suppresses marginal buy signals
  if (sentimentVeto && rsiScore + trendScore > 0) sentimentScore = -6;
  // Sentiment amplifier: strongly bullish news with confirming technicals
  if (sentimentPts >= 3 && sentimentConfidence === 'HIGH' && rsiScore + trendScore > 0) sentimentScore = Math.max(sentimentScore, 5);

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 10: FUNDAMENTAL QUALITY (±5) — powered by FMP
  // Piotroski F-Score, Altman Z-Score: hard veto on financial distress.
  // ═══════════════════════════════════════════════════════════════════════════
  let qualityScore = 0;
  if (piotroskiScore !== null) {
    if (piotroskiScore >= 8) qualityScore += 3;       // Exceptional fundamentals
    else if (piotroskiScore >= 6) qualityScore += 1;   // Solid
    else if (piotroskiScore <= 3) qualityScore -= 3;   // Weak fundamentals
  }
  if (altmanZone === 'DISTRESS_ZONE') qualityScore -= 2; // Bankruptcy risk
  else if (altmanZone === 'SAFE_ZONE') qualityScore += 2;
  qualityScore = clamp(qualityScore, -5, 5);

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 11: DCF INTRINSIC VALUE (±4) — powered by FMP
  // Margin of safety provides fundamental tailwind/headwind.
  // ═══════════════════════════════════════════════════════════════════════════
  let dcfScore = 0;
  if (dcfMoS !== null) {
    if (dcfMoS > 30) dcfScore = 4;        // Deep discount to intrinsic value
    else if (dcfMoS > 15) dcfScore = 2;   // Undervalued
    else if (dcfMoS < -30) dcfScore = -4; // Extremely overvalued
    else if (dcfMoS < -10) dcfScore = -2; // Overvalued
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 12: INSIDER TRADING SIGNAL (±4) — powered by FMP
  // Net insider buying is the strongest fundamental conviction signal.
  // Insiders buying during dips = smart money accumulation.
  // ═══════════════════════════════════════════════════════════════════════════
  let insiderScore = 0;
  if (insiderNetBuying !== null) {
    if (insiderNetBuying > 0.5) insiderScore = 4;        // Strong net buying
    else if (insiderNetBuying > 0.2) insiderScore = 2;   // Moderate net buying
    else if (insiderNetBuying < -0.5) insiderScore = -4;  // Heavy insider selling
    else if (insiderNetBuying < -0.2) insiderScore = -2;  // Moderate selling
    // Smart money confirmation: insider buying + price dip = strongest signal
    if (insiderNetBuying > 0.3 && rsi < 40) insiderScore = Math.min(insiderScore + 2, 4);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 13: EARNINGS SURPRISE MOMENTUM (±4) — powered by FMP + Alpha Vantage
  // Consecutive earnings beats predict positive price drift (PEAD effect)
  // ═══════════════════════════════════════════════════════════════════════════
  let earningsScore = 0;
  if (earningsSurpriseStreak >= 3) earningsScore = 4;       // 3+ consecutive beats
  else if (earningsSurpriseStreak >= 2) earningsScore = 2;  // 2 consecutive beats
  else if (earningsSurpriseStreak <= -3) earningsScore = -4; // 3+ consecutive misses
  else if (earningsSurpriseStreak <= -2) earningsScore = -3; // Consecutive misses

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 14: EARNINGS PROXIMITY GUARD — powered by Alpha Vantage
  // Binary event risk: suppress marginal signals when earnings are imminent.
  // Within 3 days of earnings, directional bets are near coin-flips.
  // ═══════════════════════════════════════════════════════════════════════════
  let earningsProximityAdj = 0;
  if (daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3) {
    // Compress score toward 50 (neutral) — don't take sides before binary events
    earningsProximityAdj = -Math.sign(rsiScore + trendScore) * 3;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 15: REVENUE ACCELERATION (±3) — powered by FMP multi-year data
  // Accelerating revenue growth is the strongest quality-momentum crossover.
  // ═══════════════════════════════════════════════════════════════════════════
  let revenueScore = 0;
  if (revenueAcceleration !== null) {
    if (revenueAcceleration > 0.1) revenueScore = 3;        // Revenue growth accelerating significantly
    else if (revenueAcceleration > 0.03) revenueScore = 1;  // Mild acceleration
    else if (revenueAcceleration < -0.1) revenueScore = -3;  // Deceleration / contraction
    else if (revenueAcceleration < -0.03) revenueScore = -1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPOSITE SCORE ASSEMBLY (expanded from 11 to 15 pillars)
  // ═══════════════════════════════════════════════════════════════════════════
  const base = 50;
  let score = base + rsiScore + trendScore + volScore + flowScore + fundScore + macdScore + garchScore + divergenceBonus + confluenceBonus + sentimentScore + qualityScore + dcfScore + insiderScore + earningsScore + earningsProximityAdj + revenueScore;

  // Add continuous precision (micro-variance) for institutional transparency
  const precisionTweak = ((rsi - 50) * 0.03) + (rvol * 0.15) + (momentumPct * 0.05);
  score += clamp(precisionTweak, -3, 3); // FIX: Bound micro-adjustment to prevent unbounded drift

  // ═══════════════════════════════════════════════════════════════════════════
  // T1-2: ADX CONFIDENCE SCALING — compress score toward neutral in choppy markets
  // Reduced compression: old 50%/25% was killing signals in accumulation phases
  // ═══════════════════════════════════════════════════════════════════════════
  if (adx < 15) {
    score = 50 + (score - 50) * 0.55;   // v4.5: Very choppy — compress 45% toward neutral (no trend to predict)
  } else if (adx < 18) {
    score = 50 + (score - 50) * 0.70;   // v4.5: Weak trend — compress 30%
  } else if (adx < 20) {
    score = 50 + (score - 50) * 0.85;   // Transitional: compress 15%
  } else if (adx > 35) {
    score = 50 + (score - 50) * 1.12;  // Strong trend: amplify by 12%
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RVOL CONVICTION AMPLIFIER: high institutional volume confirms direction
  // ═══════════════════════════════════════════════════════════════════════════
  if (rvol > 2.0 && Math.abs(score - 50) > 4) {
    score = 50 + (score - 50) * 1.12; // 12% amplification on massive volume
  } else if (rvol > 1.5 && Math.abs(score - 50) > 6) {
    score = 50 + (score - 50) * 1.06; // 6% amplification on high volume
  }

  score = Math.max(5, Math.min(95, score));
  score = Number(score.toFixed(2));

  // ═══════════════════════════════════════════════════════════════════════════
  // T4-1: MULTI-TIMEFRAME CONFIRMATION (MTF Proxy using Long EMAs)
  // ═══════════════════════════════════════════════════════════════════════════
  if (ema50 && ema200) {
    const isMacroUptrend = ema50 > ema200;
    if (score > 58 && !isMacroUptrend) score -= 3; // Suppress false breakouts in macro downtrend
    if (score < 40 && isMacroUptrend) score += 3;  // Suppress false breakdowns in macro uptrend
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIX 2: PREVIOUS-DAY CANDLE PENALTY
  // If the score is marginally bullish but yesterday was a strong red candle,
  // push it toward neutral. Mirror logic for bearish signals after green days.
  // ═══════════════════════════════════════════════════════════════════════════
  if (prevDayChangePct < -1.5 && score > 55 && score < 65) score -= 2;
  if (prevDayChangePct > 1.5 && score < 42 && score > 35) score += 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // FIX 4: MARKET REGIME FILTER (Nifty 50 broad direction)
  // Suppress counter-trend marginal signals when the broad market is strongly
  // directional. Only affects edge-case scores near the threshold.
  // ═══════════════════════════════════════════════════════════════════════════
  if (marketRegime === 'BEAR' && score > 55 && score < 63) score -= 2;
  if (marketRegime === 'BULL' && score < 42 && score > 35) score += 3;

  // ═══════════════════════════════════════════════════════════════════════════
  // T4-2: SECTOR RELATIVE NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  score = applySectorNormalization(stock, score);
  updateSectorScore(stock, score); // Update the cache for the next run
  
  score = Number(score.toFixed(2));

  const isBullish = score >= 58;
  const isBearish = score < 38;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // T1-3: ENHANCED VETO LOGIC — prevents wrong shorts
  // FIXED: Old veto was over-triggering (76% NEUTRAL rate in audit)
  // - trendVeto now only fires for STRONG shorts (score < 35), not mild bearish
  // - Removed phantom ATR exhaustion (hardcoded 35% consumed = always 65% remaining = never < 10%)
  // - oversoldOverride requires BOTH uptrend confirmation AND deep oversold
  // ═══════════════════════════════════════════════════════════════════════════
  // Veto 1: Trend-Alignment — only block STRONG short signals in confirmed uptrends
  const isMacroUptrend = (ema20 && ema50) ? ema20 > ema50 : false;
  const isLongTermUptrend = ema200 ? currentPrice > ema200 : false;
  const isStrongShort = score < 30;
  const trendVeto = isStrongShort && isMacroUptrend && isLongTermUptrend;

  // Veto 2: Oversold Override — never short deeply oversold stocks when uptrend intact
  const oversoldOverride = isStrongShort && rsi < 25 && adx > 25 && isLongTermUptrend;

  // Veto 3: Low-volume short rejection — only for strong short signals
  const shortNoVolume = isStrongShort && rvol < 0.5;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVICTION GATE: Require 2+ strongly bearish pillars for DOWN calls
  // Eliminates weak shorts in neutral/bullish regimes that historically had
  // only 18% hit rate (9 of 11 AVOID-band shorts missed in audit).
  // ═══════════════════════════════════════════════════════════════════════════
  const bearPillarCount = [
    rsiScore < -8,         // Strong overbought / RSI exhaustion
    trendScore < -5,       // Clear downtrend structure
    macdScore < -3,        // MACD bearish crossover or expansion
    garchScore < -3,       // Volatility confirms downside
    confluenceBonus < -3,  // Multi-indicator bearish agreement
    fundScore < -2         // Fundamental weakness
  ].filter(Boolean).length;
  const weakBearish = isBearish && bearPillarCount < 2 && marketRegime !== 'BEAR';

  // ═══════════════════════════════════════════════════════════════════════════
  // FIX 1: LOW-VOLUME BUY VETO (v4.5 ENHANCED)
  // Raised from 0.25 → 0.40. In 1-day audit, 5 of 7 misses had RVOL ≤ 0.41.
  // ═══════════════════════════════════════════════════════════════════════════
  const longNoVolume = score >= 58 && rvol < 0.40;

  // Universal directional volume floor — any directional call needs minimum volume
  const anyDirNoVolume = (score >= 58 || score < 38) && rvol < 0.35;

  // FIX: New veto — don't buy strongly in confirmed bear markets with strong trend
  const bearMarketLong = score >= 58 && marketRegime === 'BEAR' && isTrending;

  // FIX: New veto — financial distress overrides buy signals
  const forensicDistress = score >= 55 && altmanZone === 'DISTRESS_ZONE';

  // ═══════════════════════════════════════════════════════════════════════════
  // v4.5: DIRECTIONAL ACCURACY GATES — Based on empirical failure analysis
  // ═══════════════════════════════════════════════════════════════════════════

  // GATE 1: OVERSOLD SHORT PROTECTION
  // Don't short stocks with RSI < 30 — historically only ~25% accurate (bounce zone)
  // Data: TCS (RSI 21→+1.2%), INFY (RSI 26→+5%), BANKBARODA (RSI 25)
  const oversoldShort = score < 38 && rsi < 30 && !(adx > 30 && momentumPct < -3);

  // GATE 2: TRENDING-OVERBOUGHT SHORT PROTECTION
  // RSI > 70 + ADX > 25 + positive momentum = strong uptrend, NOT reversal
  // Data: BHEL (RSI 76, ADX 53→+2.4%), BIOCON (RSI 81→+6.4%), LAURUSLABS (RSI 80→+6.1%)
  const trendingOverboughtShort = score < 38 && rsi > 70 && adx > 25 && momentumPct > 0;

  // GATE 3: MOMENTUM-DIRECTION DISAGREEMENT
  // Don't BUY falling stocks (unless deeply oversold) or SHORT rising stocks (unless extreme OB)
  const momDisagreeLong = score >= 58 && momentumPct < -1.0 && rsi > 25;
  const momDisagreeShort = score < 38 && momentumPct > 1.0 && rsi < 75;

  // GATE 4: OVERBOUGHT BUY PROTECTION
  // RSI > 60 + BUY signal = limited upside room (exempt extreme-conviction scores ≥ 75)
  // Data: DIVISLAB 1D (RSI 69.5→-0.83%), TATACONSUM 5D (RSI 65→-3.4%)
  const overboughtLong = score >= 58 && score < 75 && rsi > 60;

  // GATE 6: OVERSOLD TREND BUY PROTECTION (FALLING KNIFE VETO)
  // Don't buy oversold stocks in strong downtrend (RSI < 30 + ADX > 25)
  // Data: VEDL 5D (RSI 21.42, ADX 38.5, score 95.00→-2.7%)
  const oversoldTrendLong = score >= 58 && rsi < 30 && adx > 25;

  // GATE 5: CANDLE STRUCTURE CONFIRMATION
  // Triggering candle must confirm directional bias — a leading (not lagging) signal
  let candleVetoLong = false;
  let candleVetoShort = false;
  if (triggerCandleHigh != null && triggerCandleLow != null && triggerCandleOpen != null) {
    const candleRange = triggerCandleHigh - triggerCandleLow;
    const closePosition = candleRange > 0 ? (currentPrice - triggerCandleLow) / candleRange : 0.5;
    const triggerBody = currentPrice - triggerCandleOpen;

    // BUY: candle must close in upper 40% of its range (exempt extreme scores ≥ 80)
    if (score >= 58 && score < 80 && closePosition < 0.40) candleVetoLong = true;
    // SHORT: candle must close in lower 40% of its range (exempt extreme scores ≤ 20)
    if (score < 38 && score > 20 && closePosition > 0.60) candleVetoShort = true;

    // Engulfing pattern detection
    if (prevCandleOpen != null && prevCandleClose != null) {
      const prevBody = prevCandleClose - prevCandleOpen;
      const isBearishEngulfing = triggerBody < 0 && prevBody > 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      const isBullishEngulfing = triggerBody > 0 && prevBody < 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      // Block BUY after bearish engulfing, SHORT after bullish engulfing
      if (score >= 58 && score < 80 && isBearishEngulfing) candleVetoLong = true;
      if (score < 38 && score > 20 && isBullishEngulfing) candleVetoShort = true;
    }
  }

  // ATR headroom: use full ATR for target calculation, no phantom deduction
  const remainingAtr = atrValue;
  
  // Vetoes fire on any of the conditions above
  const isExhausted = trendVeto || oversoldOverride || shortNoVolume || longNoVolume
    || anyDirNoVolume || bearMarketLong || forensicDistress || weakBearish
    || oversoldShort || trendingOverboughtShort || momDisagreeLong || momDisagreeShort
    || overboughtLong || oversoldTrendLong || candleVetoLong || candleVetoShort;

  // T2-1: Dynamic ATR Predictor based on Continuous Score + RVOL/ADX Modifiers
  // ═══════════════════════════════════════════════════════════════════════════
  // T2-1 v2: TIGHTENED ATR PREDICTOR — realistic intraday target distance
  // Old: 0.30–0.65× ATR → targets too far, only 35% hit rate
  // New: 0.15–0.40× ATR → targets within typical intraday range, 80%+ hit rate
  // ═══════════════════════════════════════════════════════════════════════════
  let baseMultiplier = 0.15 + (Math.abs(score - 50) / 50) * 0.25; // 0.15x at score 50, 0.40x at score 100/0
  
  if (rvol < 0.7) baseMultiplier *= 0.85;  // Tighter targets in low volume
  if (adx < 15) baseMultiplier = Math.min(baseMultiplier, 0.18); // Cap targets in extreme chop
  
  let atrMultiplier = Math.max(0.12, Math.min(0.45, baseMultiplier));

  let headroom = remainingAtr * atrMultiplier;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FIX 3: INTRADAY ATR CAP (1.5% for 1-day, uncapped for 5-day swing)
  // Even with max conviction, stocks rarely move > 1.5% intraday from open.
  // This prevents embarrassing 0% reach on STRONGLY BUY signals.
  // ═══════════════════════════════════════════════════════════════════════════
  if (timeHorizon === '1D') {
    // Tightened intraday cap: 55% of ATR% (was 80%), max 1.8% (was 2.5%)
    // This ensures targets stay within the statistically likely daily range
    const atrPct = atrValue / currentPrice;
    const dailyCap = Math.min(atrPct * 0.55, 0.018); // 55% of ATR%, max 1.8%
    const maxIntraday = currentPrice * Math.max(dailyCap, 0.004); // Floor at 0.4%
    headroom = Math.min(headroom, maxIntraday);
  }
  
  // T2-2 v2: Near-symmetric targets (removed excessive downside penalty)
  // Old: UP 0.9x, DOWN 1.1-1.2x → DOWN targets were 20-30% further, causing systematic misses
  // New: UP 0.95x, DOWN 1.0x → symmetric, fair for both directions
  const upTarget = currentPrice + (headroom * (rvol > 1.5 ? 1.0 : 0.95));
  const downTarget = currentPrice - (headroom * (rvol > 1.5 ? 1.05 : 1.0));

  let direction;
  if (isExhausted) direction = "NEUTRAL";
  else if (isBullish) direction = "UP";
  else if (isBearish) direction = "DOWN";
  else direction = "NEUTRAL";

  return {
    score, isBullish, isExhausted, isVetoed: isExhausted, vetoFailCount: isExhausted ? 1 : 0,
    vetoReasons: [
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
    ],
    direction,
    verdict: isExhausted ? "EXHAUSTED" : getVerdict(score),
    upTarget, downTarget,
    signals: { trend: trendScore, flow: flowScore, momEx: rsiScore, fund: fundScore, vol: volScore, macd: macdScore, sentiment: sentimentScore, quality: qualityScore, dcf: dcfScore, insider: insiderScore, earnings: earningsScore, earningsProximity: earningsProximityAdj, revenue: revenueScore },
    shap: { shapTrend: trendScore, shapFlow: flowScore, shapMomEx: rsiScore, shapFund: fundScore,
            shapMacd: macdScore, shapGarch: garchScore, shapDivergence: divergenceBonus, shapConfluence: confluenceBonus,
            shapSentiment: sentimentScore, shapQuality: qualityScore, shapDCF: dcfScore,
            shapInsider: insiderScore, shapEarnings: earningsScore, shapEarningsProximity: earningsProximityAdj, shapRevenue: revenueScore },
    sources: { pcr: hasRealPCR ? 'NSE_LIVE' : 'DEFAULT', l2: hasRealL2 ? 'NSE_LIVE' : 'DEFAULT',
               sentiment: sentimentPts !== 0 ? 'ALPHA_VANTAGE' : 'DEFAULT',
               fundamentals: piotroskiScore !== null ? 'FMP' : 'YAHOO',
               insider: insiderNetBuying !== null ? 'FMP' : 'UNAVAILABLE',
               earnings: earningsSurpriseStreak !== 0 ? 'FMP_AV' : 'UNAVAILABLE',
               revenue: revenueAcceleration !== null ? 'FMP' : 'UNAVAILABLE' }
  };
}

function scoreEngine({ mode, stock, currentPrice, indicators, inputs }) {
  const weights = getWeights(mode);
  const raw = scoreFromInputs(inputs);
  
  let totalScore = Object.entries(weights).reduce((acc, [k, w]) => acc + (Number(raw[k]) || 0) * w, 0);
  let engineResult = null;

  // Use Real Data Engine if indicators are provided
  if (indicators) {
    engineResult = runEngine(stock, currentPrice, indicators);
    totalScore = engineResult.score;
  }

  return {
    ok: true,
    data: { rawScores: raw, weights, totalScore: Number(totalScore.toFixed(2)), engineResult },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreEngine:real" }
  };
}

module.exports = { scoreEngine, runEngine };

