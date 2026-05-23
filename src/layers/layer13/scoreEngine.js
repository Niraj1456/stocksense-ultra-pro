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
    l10 += mos * 0.8;
  }
  scores.layer10_valuation = clamp(l10, 10, 90);

  // 11. Predictive
  let l11 = 50;
  if (indicators.predictiveHints) {
    const count = Array.isArray(indicators.predictiveHints) ? indicators.predictiveHints.length : 0;
    l11 += count * 8;
  } else if (indicators.momentum > 0) {
    l11 += 15;
  } else if (indicators.momentum < 0) {
    l11 -= 15;
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
  const { timeHorizon = '1D' } = options;
  const masterMode = timeHorizon === '5D' ? 'INVESTMENT' : 'INTRADAY';

  const rsi = indicators.rsi ?? 50;
  const rvol = indicators.rvol ?? 1.0;
  const l2Imbalance = indicators.l2Imbalance ?? 0;
  const l2ImbalancePrev = indicators.l2ImbalancePrev ?? l2Imbalance;
  const hasRealL2 = indicators.hasRealL2 ?? false;
  const prevDayChangePct = indicators.prevDayChangePct ?? 0;
  const marketRegime = indicators.marketRegime ?? 'NEUTRAL';
  const sectorRegime = indicators.sectorRegime ?? 'NEUTRAL';
  const deliveryPct = indicators.deliveryPct ?? null;
  const beneishMScore = indicators.beneishMScore ?? null;
  const daysToEarnings = indicators.daysToEarnings ?? null;
  const triggerCandleHigh = indicators.triggerCandleHigh ?? null;
  const triggerCandleLow = indicators.triggerCandleLow ?? null;
  const triggerCandleOpen = indicators.triggerCandleOpen ?? null;
  const atrValue = indicators.atrValue ?? 0;
  const s1 = indicators.s1 ?? null;
  const r1 = indicators.r1 ?? null;

  // Call weightTableEngine
  const weightRes = weightTableEngine({ mode: masterMode, market_regime: marketRegime });
  const weights = weightRes.data.weights;

  // Calculate layer scores
  const layerScores = getLayerScoresFromIndicators(indicators, currentPrice);

  // Aggregate scores
  const aggRes = scoreAggregationEngine({ layer_scores: layerScores, weights });
  let totalScore = aggRes.data.total_score;

  // Apply continuous precision micro-variance
  const precisionTweak = ((rsi - 50) * 0.03) + (rvol * 0.12) + ((indicators.momentumPct || 0) * 0.05);
  totalScore += clamp(precisionTweak, -2.5, 2.5);

  const adx = indicators.adx ?? 25;
  const isTrending = adx > 25;
  const isChoppy = marketRegime === 'CHOP' || adx < 15;

  // Regime score compression
  if (isChoppy) {
    totalScore = 50 + (totalScore - 50) * 0.50;
  } else if (adx < 20) {
    totalScore = 50 + (totalScore - 50) * 0.75;
  } else if (adx > 35) {
    totalScore = 50 + (totalScore - 50) * 1.10;
  }

  totalScore = Math.max(5, Math.min(95, totalScore));
  totalScore = Number(totalScore.toFixed(2));

  // Multi-timeframe trend check
  if (indicators.ema50 && indicators.ema200) {
    const isMacroUptrend = indicators.ema50 > indicators.ema200;
    if (totalScore > 58 && !isMacroUptrend) totalScore -= 3.5;
    if (totalScore < 40 && isMacroUptrend) totalScore += 3.5;
  }

  // Layer 16 systemic confidence dampening
  const systemicConfidence = indicators.systemicConfidence ?? 100;
  totalScore = 50 + (totalScore - 50) * clamp(systemicConfidence / 100, 0.4, 1.0);
  totalScore = Math.max(5, Math.min(95, totalScore));
  totalScore = Number(totalScore.toFixed(2));

  // Sector relative normalization
  totalScore = applySectorNormalization(stock, totalScore);
  updateSectorScore(stock, totalScore);
  totalScore = Number(totalScore.toFixed(2));

  const isBullish = totalScore >= 58;
  const isBearish = totalScore < 38;

  let rsiScore = 0;
  if (isTrending) {
    if (rsi > 80) rsiScore = -5;
    else if (rsi > 70) rsiScore = 8;
    else if (rsi > 60) rsiScore = 12;
    else if (rsi < 20) rsiScore = 18;
    else if (rsi < 30) rsiScore = -10;
    else if (rsi < 40) rsiScore = -5;
  } else {
    if (rsi > 75) rsiScore = -20;
    else if (rsi > 65) rsiScore = -12;
    else if (rsi < 25) rsiScore = 20;
    else if (rsi < 35) rsiScore = 12;
  }

  let trendScore = 0;
  if (indicators.ema20 && indicators.ema50) {
    const ema20Pct = ((currentPrice - indicators.ema20) / indicators.ema20) * 100;
    const emaCross = indicators.ema20 > indicators.ema50;
    if (emaCross) {
      if (ema20Pct < -3) trendScore = -12;
      else if (ema20Pct < -1) trendScore = -4;
      else if (ema20Pct > 8) trendScore = -3;
      else trendScore = 10;
    } else {
      if (ema20Pct > 3) trendScore = 12;
      else if (ema20Pct > 1) trendScore = 4;
      else if (ema20Pct < -8) trendScore = 3;
      else trendScore = -10;
    }
    const adxMultiplier = adx > 40 ? 1.3 : adx > 30 ? 1.15 : adx > 20 ? 1.0 : 0.6;
    trendScore = clamp(Math.round(trendScore * adxMultiplier), -12, 12);
  }

  // Build the veto list
  const vetoes = [
    { active: isBullish && beneishMScore !== null && beneishMScore > -1.78, reason: 'BENEISH_M_SCORE_MANIPULATION_RISK' },
    { active: daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3, reason: 'EARNINGS_ANNOUNCEMENT_BINARY_RISK' },
    { active: indicators.promoterSellingVeto === true, reason: 'PROMOTER_DISTRESS_SELL' },
    { active: indicators.circuitBreakerTripped === true, reason: indicators.circuitBreakerReason || 'CIRCUIT_BREAKER_TRIPPED' },
    { active: indicators.auditorResignation === true, reason: 'AUDITOR_RESIGNATION' },
    { active: indicators.sentimentVeto === true, reason: 'STRONGLY_BEARISH_SENTIMENT' },
    { active: indicators.catalystVeto === true, reason: 'EARNINGS_IMMINENT_VETO' },
    { active: indicators.insiderVeto === true, reason: 'INSIDER_VETO' }
  ];

  const vetoRes = vetoVerificationEngine({ layer_vetoes: vetoes });
  const isVetoed = vetoRes.data.veto_triggered;
  const vetoReasons = vetoRes.data.veto_reasons;

  const rrValid = indicators.rrValid ?? true;
  const verdictRes = verdictClassifierEngine({
    total_score: totalScore,
    veto_data: vetoRes.data,
    rr_valid: rrValid
  });

  let upTarget = currentPrice;
  let downTarget = currentPrice;
  if (timeHorizon === '1D') {
    const baseTargetDist = atrValue * 0.25;
    upTarget = currentPrice + baseTargetDist;
    downTarget = currentPrice - baseTargetDist;
    if (isBullish && r1 !== null && upTarget > r1) upTarget = r1;
    if (isBearish && s1 !== null && downTarget < s1) downTarget = s1;
  } else {
    const targetDist = atrValue * 4.0;
    upTarget = currentPrice + targetDist;
    downTarget = currentPrice - targetDist;
  }

  let direction = "NEUTRAL";
  if (!isVetoed) {
    if (isBullish) direction = "UP";
    else if (isBearish) direction = "DOWN";
  }

  return {
    score: totalScore,
    isBullish,
    isVetoed,
    vetoReasons,
    vetoFailCount: vetoReasons.length,
    direction,
    verdict: isVetoed ? "VETOED (TRAP)" : (indicators.isExhausted ? "EXHAUSTED" : (verdictRes.ok ? verdictRes.data.verdict : getVerdict(totalScore))),
    upTarget,
    downTarget,
    signals: {
      trend: trendScore,
      flow: l2Imbalance,
      momEx: rsiScore,
      fund: layerScores.layer8_fundamentals || 50,
      vol: rvol,
      macd: indicators.macd ? indicators.macd.histogram : 0,
      sentiment: indicators.sentimentPts || 0,
      quality: layerScores.layer9_forensic || 50,
      dcf: indicators.dcfMoS || 0,
      insider: indicators.insiderNetBuying || 0,
      earnings: indicators.earningsSurpriseStreak || 0,
      revenue: indicators.revenueAcceleration || 0
    },
    sources: {
      pcr: indicators.hasRealPCR ? 'NSE_LIVE' : 'DEFAULT',
      l2: hasRealL2 ? 'NSE_LIVE' : 'DEFAULT',
      fundamentals: indicators.piotroskiScore !== null ? 'FMP' : 'YAHOO'
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
      layer12_risk: raw.l12 ?? 50
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
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreEngine:v6" }
  };
}

module.exports = { scoreEngine, runEngine };


module.exports = { scoreEngine, runEngine };
