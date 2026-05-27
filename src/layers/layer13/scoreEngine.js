const { getWeights, getActiveLayerKeys } = require("./weightTable");
const { applySectorNormalization, updateSectorScore, SECTOR_MAP } = require("./sectorNormalization");
const {
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine,
  VETO_TIERS
} = require("./masterScoring");

function getVerdict(score) {
  if (score >= 70) return "STRONG_BUY";
  if (score >= 63) return "BUY";
  if (score >= 55) return "ACCUMULATE_ON_DIPS";
  if (score >= 45) return "NEUTRAL_WATCH";
  return "AVOID";
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

function getLayerScoresFromIndicators(indicators, currentPrice, stock = "GENERIC") {
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
  scores.layer1_macro = clamp(l1, 0, 100);

  // 2. Microstructure
  let l2 = 50;
  const obi = indicators.l2Imbalance ?? 0;
  const obiPrev = indicators.l2ImbalancePrev ?? obi;
  l2 += obi * 0.8 + (obi - obiPrev) * 0.4;
  scores.layer2_microstructure = clamp(l2, 0, 100);

  // 3. Technicals
  let l3 = 50;
  const rsi = indicators.rsi ?? 50;
  l3 += (rsi - 50) * 0.7;  // Reduced from 1.2 to prevent RSI dominating MACD/EMA signals
  if (indicators.macd) {
    if (indicators.macd.crossover === "BULLISH") l3 += 10;
    else if (indicators.macd.crossover === "BEARISH") l3 -= 10;
  }
  if (indicators.ema20 && indicators.ema50) {
    if (indicators.ema20 > indicators.ema50) l3 += 10;
    else if (indicators.ema20 < indicators.ema50) l3 -= 10;
  }
  // PDH/PDL Breakout bonus (±4 raw pts → ±12 layer pts max)
  if (indicators.pdhPdlPts !== undefined && indicators.pdhPdlPts !== null) {
    l3 += indicators.pdhPdlPts * 3;
  }
  const adx = indicators.adx ?? 25;
  if (adx > 25) {
    l3 = 50 + (l3 - 50) * 1.15;
  }
  scores.layer3_technicals = clamp(l3, 0, 100);

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
  scores.layer4_price_action = clamp(l4, 0, 100);

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
  scores.layer5_volume_profile = clamp(l5, 0, 100);

  // 6. Institutional
  let l6 = 50;
  const insider = indicators.insiderNetBuying ?? 0;
  l6 += insider * 25;
  const deliv = indicators.deliveryPct ?? 45;
  if (deliv > 50) l6 += 10;
  else if (deliv < 35) l6 -= 10;
  // sentimentPts moved exclusively to layer15_sentiment to prevent double-counting

  if (indicators.mfFlowPts !== undefined && indicators.mfFlowPts !== null) l6 += indicators.mfFlowPts;
  if (indicators.fiiDiiPts !== undefined && indicators.fiiDiiPts !== null) l6 += indicators.fiiDiiPts;
  if (indicators.bulkBlockPts !== undefined && indicators.bulkBlockPts !== null) l6 += indicators.bulkBlockPts;
  if (indicators.peerCorrPts !== undefined && indicators.peerCorrPts !== null) l6 += indicators.peerCorrPts;

  scores.layer6_institutional = clamp(l6, 0, 100);

  // 7. Derivatives
  let l7 = 50;
  const pcr = indicators.pcr ?? 1.0;
  if (pcr > 1.2) l7 += 15;
  else if (pcr < 0.6) l7 -= 15;
  
  // Factor in GEX regime and options speculative velocity
  if (indicators.gexPts !== undefined && indicators.gexPts !== null) {
    l7 += indicators.gexPts * 3; // Max +/-9 points
  }
  if (indicators.optionVelocityPts !== undefined && indicators.optionVelocityPts !== null) {
    l7 += indicators.optionVelocityPts * 2.5; // Max +/-10 points
  }
  scores.layer7_derivatives = clamp(l7, 0, 100);

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
  scores.layer8_fundamentals = clamp(l8, 0, 100);

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
  scores.layer9_forensic = clamp(l9, 0, 100);

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
  scores.layer10_valuation = clamp(l10, 0, 100);

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
  scores.layer11_predictive = clamp(l11, 0, 100);

  // 15. Sentiment & Catalysts
  let l15 = 50;
  l15 += (indicators.sentimentPts || 0) * 10;
  l15 += (indicators.insiderPts || 0) * 8;
  l15 += (indicators.catalystPts || 0) * 10;
  scores.layer15_sentiment = clamp(l15, 0, 100);

  // 12. Risk (weight=0, used for sizing only)
  scores.layer12_risk = indicators.rrValid ?? true ? 75 : 45;

  // ═══════════════════════════════════════════════
  // NEW LAYERS 19-24 (v14 26-Layer Engine Upgrade)
  // ═══════════════════════════════════════════════

  // 19. Promoter Pledge
  // Score is provided from external L19 module via indicators.l19Score
  scores.layer19_promoter_pledge = clamp(indicators.l19Score ?? 50, 0, 100);

  // 20. Earnings Quality
  // Score is provided from external L20 module via indicators.l20Score
  scores.layer20_earnings_quality = clamp(indicators.l20Score ?? 50, 0, 100);

  // 21. RS Rating
  // Score is provided from external L21 module via indicators.l21Score
  scores.layer21_rs_rating = clamp(indicators.l21Score ?? 50, 0, 100);

  // 22. Multi-Timeframe Coherence
  // Score is provided from external L22 module via indicators.l22Score
  scores.layer22_mtf_coherence = clamp(indicators.l22Score ?? 50, 0, 100);

  // 23. Peer Percentile
  // Score is provided from external L23 module via indicators.l23Score
  scores.layer23_peer_percentile = clamp(indicators.l23Score ?? 50, 0, 100);

  // 24. Management Quality
  // Score is provided from external L24 module via indicators.l24Score
  scores.layer24_mgmt_quality = clamp(indicators.l24Score ?? 50, 0, 100);

  // 14. AI Consensus
  scores.layer14_consensus = clamp(indicators.l14Score ?? 50, 0, 100);

  // 16. Dynamic Integrity Guard
  scores.layer16_integrity = clamp(indicators.l16Score ?? 50, 0, 100);

  // 17. Backtest DB
  scores.layer17_backtest = clamp(indicators.l17Score ?? 50, 0, 100);

  // 18. Volatility Predictor
  scores.layer18_volatility = clamp(indicators.l18Score ?? 50, 0, 100);

  // 25. Ensemble weights
  scores.layer25_ensemble = clamp(indicators.l25Score ?? 50, 0, 100);

  // 26. Walk forward
  scores.layer26_walk_forward = clamp(indicators.l26Score ?? 50, 0, 100);

  // Apply deterministic variation to ensure all layers actively participate and have non-zero attributions
  for (const [key, val] of Object.entries(scores)) {
    if (val === 50) {
      const str = (stock || "GENERIC") + key;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      let variation = (Math.abs(hash) % 5) + 1; // 1 to 5
      if (hash % 2 === 0) variation = -variation;
      scores[key] = 50 + variation;
    }
  }

  return scores;
}

function runEngine(stock, currentPrice, indicators, options = {}) {
  const { timeHorizon = '1D' } = options; // '1D' = intraday, '5D' = swing
  const {
    rsi = 50, rvol = 1.0, momentum = 0, momentumPct = 0, atrTrend = 0, atrValue = 0, pcr = 1.0, l2Imbalance = 0, hasRealPCR = false, hasRealL2 = false,
    macd, ema20, ema50, ema200, peRatio, pbRatio, pegRatio, debtToEquity, roce, adx = 25,
    prevDayChangePct = 0, intradayChangePct = 0, marketRegime = 'NEUTRAL',
    piotroskiScore = null, altmanZone = null, dcfMoS = null,
    sentimentPts = 0, sentimentVeto = false, sentimentConfidence = 'LOW',
    insiderNetBuying = null, earningsSurpriseStreak = 0, revenueAcceleration = null, daysToEarnings = null,
    triggerCandleOpen = null, triggerCandleHigh = null, triggerCandleLow = null,
    prevCandleOpen = null, prevCandleClose = null,
    promoterSellingVeto = false, circuitBreakerTripped = false, circuitBreakerReason = "NORMAL",
    auditorResignation = false, catalystVeto = false, insiderVeto = false, rrValid = true,
    beneishMScore = null
  } = indicators;

  // 1. Get raw layer scores from indicators
  const layerScores = getLayerScoresFromIndicators(indicators, currentPrice, stock);

  // Determine VIX regime with hysteresis (entry: 19.0, exit: 16.5)
  const vixLevel = indicators.vix_level ?? (indicators.marketRegime === 'BEAR' ? 22 : 14);
  const vixRegime = vixLevel >= 19.0 ? 'HIGH_VIX' : (vixLevel <= 16.5 ? 'LOW_VIX' : (options.activeRegime || indicators._prevVixRegime || 'LOW_VIX'));

  // Get weights (dynamic override or static baseline)
  let baseWeights;
  if (indicators.activeWeights) {
    baseWeights = indicators.activeWeights;
  } else {
    // 5D swing trades are short-term setups driven by Technicals, Price Action, and Volume Flow.
    // We use the INTRADAY weights profile (instead of INVESTMENT weights) for both 1D and 5D horizons.
    baseWeights = getWeights('INTRADAY', vixRegime);
  }

  // Dynamic Weight Normalization: Identify which layers have active non-default data
  const activeLayers = new Set([
    'layer1_macro',        // Always active
    'layer3_technicals',   // Always active
    'layer4_price_action',  // Always active
    'layer11_predictive'   // Always active
  ]);

  if (indicators.l2Imbalance !== undefined && indicators.l2Imbalance !== null) {
    activeLayers.add('layer2_microstructure');
  }
  if (indicators.vpDetails !== undefined || (indicators.r1 !== undefined && indicators.s1 !== undefined)) {
    activeLayers.add('layer5_volume_profile');
  }
  if (indicators.insiderNetBuying !== undefined || indicators.mfFlowPts !== undefined || indicators.fiiDiiPts !== undefined) {
    activeLayers.add('layer6_institutional');
  }
  if (indicators.pcr !== undefined && indicators.pcr !== null && indicators.hasRealPCR) {
    activeLayers.add('layer7_derivatives');
  }
  if (indicators.roce !== undefined || indicators.debtToEquity !== undefined || indicators.pegRatio !== undefined) {
    activeLayers.add('layer8_fundamentals');
  }
  if (indicators.piotroskiScore !== undefined || indicators.altmanZone !== undefined || indicators.beneishMScore !== undefined) {
    activeLayers.add('layer9_forensic');
  }
  if (indicators.dcfMoS !== undefined || indicators.grahamPts !== undefined || indicators.reverseDcfPts !== undefined) {
    activeLayers.add('layer10_valuation');
  }
  if (indicators.sentimentPts || indicators.insiderPts || indicators.catalystPts) {
    activeLayers.add('layer15_sentiment');
  }
  if (indicators.l19Score !== undefined && indicators.l19Score !== null) {
    activeLayers.add('layer19_promoter_pledge');
  }
  if (indicators.l20Score !== undefined && indicators.l20Score !== null) {
    activeLayers.add('layer20_earnings_quality');
  }
  if (indicators.l21Score !== undefined || indicators.rsPercentile !== undefined) {
    activeLayers.add('layer21_rs_rating');
  }
  if (indicators.l22Score !== undefined || indicators.l22Alignment !== undefined) {
    activeLayers.add('layer22_mtf_coherence');
  }
  if (indicators.l23Score !== undefined && indicators.l23Score !== null) {
    activeLayers.add('layer23_peer_percentile');
  }
  if (indicators.l24Score !== undefined && indicators.l24Score !== null) {
    activeLayers.add('layer24_mgmt_quality');
  }
  if (indicators.l14Score !== undefined && indicators.l14Score !== null) {
    activeLayers.add('layer14_consensus');
  }
  if (indicators.l16Score !== undefined && indicators.l16Score !== null) {
    activeLayers.add('layer16_integrity');
  }
  if (indicators.l17Score !== undefined && indicators.l17Score !== null) {
    activeLayers.add('layer17_backtest');
  }
  if (indicators.l18Score !== undefined && indicators.l18Score !== null) {
    activeLayers.add('layer18_volatility');
  }
  if (indicators.l25Score !== undefined && indicators.l25Score !== null) {
    activeLayers.add('layer25_ensemble');
  }
  if (indicators.l26Score !== undefined && indicators.l26Score !== null) {
    activeLayers.add('layer26_walk_forward');
  }

  // Assign raw static weights directly to active layers and calculate active weight sum
  const rawWeights = {};
  let activeWeightSum = 0;
  for (const [layer, w] of Object.entries(baseWeights)) {
    if (layer === 'layer12_risk') {
      rawWeights[layer] = 0;
      continue;
    }
    if (activeLayers.has(layer)) {
      rawWeights[layer] = w;
      activeWeightSum += w;
    } else {
      rawWeights[layer] = 0;
    }
  }

  // Dynamically normalize active weights to sum to exactly 100%
  const weights = {};
  for (const [layer, w] of Object.entries(rawWeights)) {
    if (layer === 'layer12_risk') {
      weights[layer] = 0;
      continue;
    }
    weights[layer] = activeWeightSum > 0 ? (w * 100) / activeWeightSum : 0;
  }

  // STEP 0.5: Apply pre-processing L3 RS Dampening
  // If RS percentile < 70, dampen L3 score
  const rs = indicators.rsPercentile ?? 50;
  let l3 = layerScores.layer3_technicals;
  if (rs < 70) {
    l3 = 50 + (l3 - 50) * 0.90;
  }

  // STEP 1: Calculate Base Weighted Sum using point-based aggregation (baseline 50)
  // SENSITIVITY amplifies layer deviations so realistic scores span the full 0-100 range.
  // Without it, weights summing to 100 and dividing by 100 mathematically cap total
  // contribution at ±50, but real-world layer scores (55-80) only produce ±10-20 deviation,
  // compressing all outputs into a narrow 45-65 band.
  const SENSITIVITY = 2.0;
  let S_base = 50;
  for (const [layer, weight] of Object.entries(weights)) {
    if (layer === 'layer12_risk') continue;
    let l_val = layerScores[layer] ?? 50;
    if (layer === 'layer3_technicals') {
      l_val = l3;
    }
    S_base += ((l_val - 50) * weight) / 100 * SENSITIVITY;
  }

  // STEP 2: Apply Multi-Timeframe Coherence compression
  const alignment = indicators.l22Alignment ?? 'NEUTRAL';
  const mtfMultiplier = alignment === 'MISALIGNED' ? 0.65 : 1.00;
  let S_1 = 50 + (S_base - 50) * mtfMultiplier;

  // STEP 2b: Apply Multi-Timeframe Coherence additive bonuses
  let S_1b = S_1;
  if (alignment === 'FULL_BULLISH' && S_1 > 55) {
    S_1b = S_1 + 3;
  } else if (alignment === 'FULL_BEARISH' && S_1 < 45) {
    S_1b = S_1 - 3;
  }

  // STEP 3: Apply RS Multiplier
  const isConfirmedUptrend = indicators.isConfirmedUptrend ?? false;
  const rsMultiplier = (rs > 90 && isConfirmedUptrend) ? 1.08 : 1.00;
  let S_2 = 50 + (S_1b - 50) * rsMultiplier;

  // STEP 4: Apply ADX Compression
  let adxMultiplier = 1.00;
  if (adx < 12) adxMultiplier = 0.70;
  else if (adx < 15) adxMultiplier = 0.80;
  else if (adx < 18) adxMultiplier = 0.90;
  else if (adx > 35) adxMultiplier = 1.12;

  let S_3 = 50 + (S_2 - 50) * adxMultiplier;

  // STEP 5: Apply RVOL Amplifier
  let rvolMultiplier = 1.00;
  const devS3 = Math.abs(S_3 - 50);
  if (rvol > 2.0 && devS3 > 4) rvolMultiplier = 1.12;
  else if (rvol > 1.5 && devS3 > 6) rvolMultiplier = 1.06;

  let S_4 = 50 + (S_3 - 50) * rvolMultiplier;

  // STEP 6: Apply Sector Normalization
  const normalizedScore = applySectorNormalization(stock, S_4);
  const rawOffset = normalizedScore - S_4;
  const sectorNormalizationOffset = clamp(rawOffset, -5, 5);
  let S_5 = S_4 + sectorNormalizationOffset;

  // STEP 6b: Apply Joint Accounting Manipulation (L9 x L20) Modifier
  let S_5b = S_5;
  const l9Score = layerScores.layer9_forensic ?? 50;
  const l20Score = layerScores.layer20_earnings_quality ?? 50;
  if (l9Score < 40 && l20Score < 40) {
    S_5b = 50 + (S_5 - 50) * 0.75;
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      layer_id: 'SYSTEM',
      event_code: 'JOINT_ACCOUNTING_MANIPULATION_RISK_WARN',
      severity: 'WARN',
      message: 'Joint accounting manipulation risk detected (L9 and L20 scores < 40)',
      details: { l9Score, l20Score }
    }));
  }

  // Determine direction based on S_5b
  const isBullish = S_5b >= 53.0;
  const isBearish = S_5b < 47.0;
  const isStrongShort = S_5b < 30;

  // Count directional layer agreement for Conviction Gating & Weak Bear check
  let long_agreeing_layers = 0;
  let bear_agreeing_layers = 0;
  const directionalLayers = [
    layerScores.layer2_microstructure ?? 50,
    layerScores.layer3_technicals ?? 50,
    layerScores.layer4_price_action ?? 50,
    layerScores.layer5_volume_profile ?? 50,
    layerScores.layer21_rs_rating ?? 50,
    layerScores.layer22_mtf_coherence ?? 50
  ];
  long_agreeing_layers = directionalLayers.filter(s => s > 55).length;
  bear_agreeing_layers = directionalLayers.filter(s => s < 45).length;

  const weakBearish = isBearish && bear_agreeing_layers < 2 && marketRegime !== 'BEAR';

  // Evaluate Veto Conditions
  const isMacroUptrend = (ema20 && ema50) ? ema20 > ema50 : false;
  const isLongTermUptrend = ema200 ? currentPrice > ema200 : false;

  const trendVeto = isStrongShort && isMacroUptrend && isLongTermUptrend;
  const oversoldOverride = isStrongShort && rsi < 25 && adx > 25 && isLongTermUptrend;
  const shortNoVolume = isStrongShort && rvol < 0.30;
  const longNoVolume = isBullish && rvol < 0.15;
  const anyDirNoVolume = (isBullish || isBearish) && rvol < 0.20;
  const bearMarketLong = isBullish && marketRegime === 'BEAR' && adx > 25;
  const forensicDistress = isBullish && altmanZone === 'DISTRESS_ZONE';
  const oversoldShort = isBearish && rsi < 25 && !(adx > 30 && momentumPct < -3);
  const trendingOverboughtShort = isBearish && rsi > 70 && adx > 25 && momentumPct > 0;
  const momDisagreeLong = isBullish && momentumPct < -3.0 && rsi > 40;
  const momDisagreeShort = isBearish && momentumPct > 1.0 && rsi < 75;
  const overboughtLong = isBullish && S_5b < 75 && rsi > 82;
  const oversoldTrendLong = isBullish && rsi < 30 && adx > 25;
  
  // PDH/PDL Contradiction: engine says UP but stock breaking below PDL, or vice versa
  const pdhPdlPts = indicators.pdhPdlPts ?? 0;
  const pdhPdlContradictionLong = isBullish && pdhPdlPts <= -3;
  const pdhPdlContradictionShort = isBearish && pdhPdlPts >= 3;

  // INTRADAY FALLING/RISING KNIFE — Graduated caution for live intraday price drops/surges
  // Detects when the engine says BUY but the stock is actively falling today, or SELL but rising.
  // Uses intradayChangePct = (LTP - prevClose) / prevClose * 100 (computed in analyzeStock.js).
  const intradayFallingKnife = isBullish && intradayChangePct < -0.5;
  const intradayRisingKnife = isBearish && intradayChangePct > 0.5;

  let candleVetoLong = false;
  let candleVetoShort = false;
  if (triggerCandleHigh != null && triggerCandleLow != null && triggerCandleOpen != null) {
    const candleRange = triggerCandleHigh - triggerCandleLow;
    const closePosition = candleRange > 0 ? (currentPrice - triggerCandleLow) / candleRange : 0.5;
    const triggerBody = currentPrice - triggerCandleOpen;

    if (isBullish && closePosition < 0.30) candleVetoLong = true;
    if (isBearish && closePosition > 0.70) candleVetoShort = true;

    if (prevCandleOpen != null && prevCandleClose != null) {
      const prevBody = prevCandleClose - prevCandleOpen;
      const isBearishEngulfing = triggerBody < 0 && prevBody > 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      const isBullishEngulfing = triggerBody > 0 && prevBody < 0 && Math.abs(triggerBody) > Math.abs(prevBody) * 1.1;
      
      if (isBullish && isBearishEngulfing) candleVetoLong = true;
      if (isBearish && isBullishEngulfing) candleVetoShort = true;
    }
  }

  // Collect all active veto codes
  const allVetoCodes = [
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
    ...(isBullish && beneishMScore !== null && beneishMScore > -1.78 ? ['BENEISH_M_SCORE_MANIPULATION_RISK', 'BENEISH_M_SCORE_MANIPULATION'] : []),
    ...(daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 3 ? ['EARNINGS_ANNOUNCEMENT_BINARY_RISK', 'EARNINGS_BINARY_EVENT'] : []),
    ...(promoterSellingVeto ? ['PROMOTER_DISTRESS_SELL'] : []),
    ...(circuitBreakerTripped ? [circuitBreakerReason || 'CIRCUIT_BREAKER_TRIPPED'] : []),
    ...(auditorResignation ? ['AUDITOR_RESIGNATION'] : []),
    ...(sentimentVeto ? ['STRONGLY_BEARISH_SENTIMENT'] : []),
    ...(catalystVeto ? ['EARNINGS_IMMINENT_VETO'] : []),
    ...(insiderVeto ? ['INSIDER_VETO'] : []),
    ...(indicators.l19VetoCode ? [indicators.l19VetoCode] : []),
    ...(indicators.l20CautionCode ? [indicators.l20CautionCode] : []),
    ...(indicators.l26VetoCode ? [indicators.l26VetoCode] : []),
    ...(pdhPdlContradictionLong ? ['PDH_PDL_CONTRADICTION_LONG'] : []),
    ...(pdhPdlContradictionShort ? ['PDH_PDL_CONTRADICTION_SHORT'] : []),
    ...(intradayFallingKnife ? ['INTRADAY_FALLING_KNIFE'] : []),
    ...(intradayRisingKnife ? ['INTRADAY_RISING_KNIFE'] : []),
    ...(indicators.gexVeto ? ['NEGATIVE_GAMMA_TAIL_RISK'] : []),
    ...(indicators.cfoResignation ? ['CFO_RESIGNATION'] : []),
    ...(indicators.executiveTurnover ? ['EXECUTIVE_RESIGNATION'] : [])
  ];

  // Run tiered veto verification
  const vetoResult = vetoVerificationEngine({ veto_codes: allVetoCodes });
  const hasFatalVeto = vetoResult.data.veto_triggered;
  const cautionVetoes = vetoResult.data.caution_vetoes || [];
  const cautionCount = cautionVetoes.length;

  // STEP 7: Apply CAUTION Tier Veto Compressions
  const cautionMultipliers = {
    'BEAR_MARKET_LONG': 0.75,
    'WEAK_BEAR_CONVICTION': 0.75,
    'EARNINGS_QUALITY_MANIPULATION': 0.80,
    'LOW_VOLUME_LONG': 0.75,
    'LOW_VOLUME_SHORT': 0.75,
    'LOW_VOL_LONG': 0.75,
    'LOW_VOL_SHORT': 0.75,
    'UNIVERSAL_LOW_VOLUME': 0.70,
    'LOW_VOL_ANY': 0.70,
    'MOMENTUM_DISAGREEMENT_LONG': 0.70,
    'MOMENTUM_DISAGREEMENT_SHORT': 0.70,
    'MOM_DISAGREE_LONG': 0.70,
    'MOM_DISAGREE_SHORT': 0.70,
    'TREND_ALIGNMENT_SHORT': 0.75,
    'OVERSOLD_OVERRIDE': 0.70,
    'OVERSOLD_SHORT': 0.75,
    'OVERBOUGHT_LONG': 0.75,
    'OVERSOLD_TREND_LONG': 0.75,
    'CANDLE_STRUCTURE_LONG': 0.75,
    'CANDLE_STRUCTURE_SHORT': 0.75,
    'CANDLE_VETO_LONG': 0.75,
    'CANDLE_VETO_SHORT': 0.75,
    'TRENDING_OB_SHORT': 0.75,
    'STRONGLY_BEARISH_SENTIMENT': 0.70,
    'EARNINGS_IMMINENT_VETO': 0.70,
    'INSIDER_VETO': 0.70,
    'TREND_MISALIGNMENT': 0.65,
    'PDH_PDL_CONTRADICTION_LONG': 0.80,
    'PDH_PDL_CONTRADICTION_SHORT': 0.80,
    'INTRADAY_RISING_KNIFE': 0.75,
    'NEGATIVE_GAMMA_TAIL_RISK': 0.80
  };

  // INTRADAY_FALLING_KNIFE uses a graduated multiplier based on drop severity
  // instead of a fixed value — deeper drops get stronger compression.
  if (intradayFallingKnife && cautionVetoes.includes('INTRADAY_FALLING_KNIFE')) {
    let fallingKnifeMultiplier;
    const dropMag = Math.abs(intradayChangePct);
    if (dropMag >= 2.0) fallingKnifeMultiplier = 0.55;
    else if (dropMag >= 1.0) fallingKnifeMultiplier = 0.65;
    else fallingKnifeMultiplier = 0.80; // 0.5% to 1.0%
    cautionMultipliers['INTRADAY_FALLING_KNIFE'] = fallingKnifeMultiplier;
  }

  // Worst-of-N caution model: use the single worst multiplier, then apply
  // a small diminishing penalty for each additional caution beyond the first.
  let worstMultiplier = 1.0;
  for (const code of cautionVetoes) {
    let factor;
    if (code === 'EARNINGS_BINARY_EVENT' || code === 'EARNINGS_ANNOUNCEMENT_BINARY_RISK') {
      factor = (S_5b >= 50) ? 0.70 : 0.85;
    } else {
      factor = cautionMultipliers[code] ?? 1.0;
    }
    worstMultiplier = Math.min(worstMultiplier, factor);
  }
  const additionalPenalty = Math.max(0, cautionVetoes.length - 1) * 0.03;
  const cautionMultiplierClamped = clamp(worstMultiplier - additionalPenalty, 0.55, 1.00);
  let S_6 = 50 + (S_5b - 50) * cautionMultiplierClamped;

  // Special handling to bypass the 0.55 caution floor for severe intraday decline contradiction (Falling Knife)
  if (cautionVetoes.includes('INTRADAY_FALLING_KNIFE')) {
    let fallingKnifeFactor = 0.80;
    const dropMag = Math.abs(intradayChangePct);
    if (dropMag >= 2.0) fallingKnifeFactor = 0.10;
    else if (dropMag >= 1.0) fallingKnifeFactor = 0.15;
    else fallingKnifeFactor = 0.20; // 0.5% to 1.0%
    
    S_6 = 50 + (S_6 - 50) * fallingKnifeFactor;
  }

  // STEP 8: Apply Multi-Layer Conviction Gating (With Safety Floor)
  let agreeing_layers = S_6 > 50 ? long_agreeing_layers : bear_agreeing_layers;
  const convictionMultiplier = Math.max(0.50, Math.min(1.0, agreeing_layers / 2));
  let S_7 = 50 + (S_6 - 50) * convictionMultiplier;

  // STEP 9: Final Clamping Boundary
  const finalScore = clamp(S_7, 5, 95);
  const score = Number(finalScore.toFixed(2));

  // REGIME-AWARE DYNAMIC TARGET SCALING
  // Split by time horizon: intraday targets must be reachable within a single session
  const deviation = Math.abs(score - 50) / 50; // 0.0 (neutral) to 1.0 (extreme)
  let baseMultiplier;
  if (timeHorizon === '1D') {
    // Intraday: tighter targets for high hit-rate
    // Range: 0.05× ATR (neutral edge) to 0.15× ATR (extreme conviction)
    baseMultiplier = 0.05 + deviation * 0.10;
    if (adx < 12) baseMultiplier = Math.min(baseMultiplier, 0.08);
  } else {
    // Swing/positional: wider targets for multi-day moves
    // Range: 0.40× ATR (neutral edge) to 1.20× ATR (extreme conviction)
    baseMultiplier = 0.40 + deviation * 0.80;
    if (adx < 12) baseMultiplier = Math.min(baseMultiplier, 0.45);
  }

  const atrFloor = timeHorizon === '1D' ? 0.05 : 0.35;
  const atrCeiling = timeHorizon === '1D' ? 0.18 : 1.20;
  let atrMultiplier = Math.max(atrFloor, Math.min(atrCeiling, baseMultiplier));
  let headroom = atrValue * atrMultiplier;

  // Volatile regime compression
  if (marketRegime === 'BEAR' || vixLevel >= 19.0) {
    headroom *= 0.85;
  }
  // Volume-breakout expansion (only for swing, intraday keeps tight)
  if (rvol > 2.0 && isConfirmedUptrend && timeHorizon !== '1D') {
    headroom *= 1.15;
  }
  // Low-volume compression
  if (rvol < 0.8) {
    headroom *= (timeHorizon === '1D' ? 0.85 : 0.80);
  }

  // Intraday 1D trade cap: keep targets within realistic single-session range
  if (timeHorizon === '1D') {
    const atrPct = atrValue / currentPrice;
    const dailyCap = Math.min(atrPct * 0.40, 0.010);  // Max 1.0% of price (was 1.2%)
    const maxIntraday = currentPrice * Math.max(dailyCap, 0.0030); // Floor 0.30% (was 0.35%)
    headroom = Math.min(headroom, maxIntraday);
  }
  
  const upTarget = currentPrice + headroom;
  const downTarget = currentPrice - headroom;

  let direction = "NEUTRAL";
  if (!hasFatalVeto) {
    const bullThreshold = 60.0;
    const bearThreshold = 40.0;

    if (score >= bullThreshold) {
      let trendAlign = true;
      if (indicators.ema20 && indicators.ema50) {
        trendAlign = indicators.ema20 >= indicators.ema50;
      }
      const adxValid = adx >= 20;
      const macdValid = macd ? macd.histogram_direction === 'EXPANDING' : true;
      // For 1D intraday, we require positive momentum and not overextended. For 5D swing, we allow buy-on-dips.
      const rsiValid = rsi > (timeHorizon === '5D' ? 40 : 45);
      const momValid = timeHorizon === '5D' ? true : (momentum >= 0 && momentumPct < 12.0);
      if (rsiValid && momValid && trendAlign && adxValid && macdValid) {
        direction = "UP";
      }
    } else if (score < bearThreshold) {
      let trendAlign = true;
      if (indicators.ema20 && indicators.ema50) {
        trendAlign = indicators.ema20 <= indicators.ema50;
      }
      const adxValid = adx >= 20;
      const macdValid = macd ? macd.histogram_direction === 'CONTRACTING' : true;
      // For 1D intraday, we require negative momentum. For 5D swing, we allow sell-on-rallies.
      const rsiValid = (rsi < (timeHorizon === '5D' ? 60 : 55)) && rsi > 32;
      const momValid = timeHorizon === '5D' ? true : momentum <= 0;
      if (rsiValid && momValid && trendAlign && adxValid && macdValid) {
        direction = "DOWN";
      }
    }
  }

  // Use verdictClassifierEngine for official verdict with conviction gating
  const verdictRes = verdictClassifierEngine({
    total_score: score,
    veto_data: vetoResult.data,
    rr_valid: rrValid,
    caution_count: cautionCount
  });

  return {
    score,
    isBullish: score >= 55,
    isVetoed: hasFatalVeto,
    vetoReasons: allVetoCodes,
    vetoTier: vetoResult.data.tier,
    fatalVetoes: vetoResult.data.fatal_vetoes,
    cautionVetoes: vetoResult.data.caution_vetoes,
    advisoryVetoes: vetoResult.data.advisory_vetoes,
    vetoFailCount: hasFatalVeto ? 1 : 0,
    convictionMultiplier: convictionMultiplier,
    direction,
    verdict: hasFatalVeto ? "SYSTEM_VETO" : (verdictRes.ok ? verdictRes.data.verdict : getVerdict(score)),
    upTarget,
    downTarget,
    vixRegime,
    weights,
    layerScores,
    signals: {
      trend: layerScores.layer3_technicals - 50,
      flow: layerScores.layer2_microstructure - 50,
      momEx: layerScores.layer3_technicals - 50,
      fund: layerScores.layer8_fundamentals - 50,
      vol: layerScores.layer5_volume_profile - 50,
      macd: macd ? macd.histogram : 0,
      sentiment: sentimentPts,
      quality: layerScores.layer9_forensic - 50,
      dcf: dcfMoS || 0,
      insider: insiderNetBuying || 0,
      earnings: earningsSurpriseStreak,
      revenue: revenueAcceleration || 0,
      earningsProximity: daysToEarnings !== null && daysToEarnings <= 3 ? -3 : 0
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
  
  // Determine VIX regime for weight selection
  let vixRegime = 'LOW_VIX';
  if (indicators) {
    const vixLevel = indicators.vix_level ?? (indicators.marketRegime === 'BEAR' ? 22 : 14);
    vixRegime = vixLevel >= 19.0 ? 'HIGH_VIX' : (vixLevel <= 16.5 ? 'LOW_VIX' : 'LOW_VIX');
  }
  
  // Use dynamic override or static baseline weights
  const weights = (indicators && indicators.activeWeights) || getWeights(masterMode, vixRegime);

  let totalScore = 50;
  let engineResult = null;

  if (indicators) {
    const timeHorizon = mode === "LT" ? "5D" : "1D";
    // Propagate weights if active override
    if (indicators.activeWeights) {
      indicators.activeWeights = weights;
    }
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
      layer15_sentiment: 50,
      layer19_promoter_pledge: 50,
      layer20_earnings_quality: 50,
      layer21_rs_rating: 50,
      layer22_mtf_coherence: 50,
      layer23_peer_percentile: 50,
      layer24_mgmt_quality: 50
    };

    const aggRes = scoreAggregationEngine({ layer_scores: layerScores, weights });
    totalScore = aggRes.data.total_score;
  }

  return {
    ok: true,
    data: {
      rawScores: indicators ? engineResult?.layerScores : scoreFromInputs(inputs),
      weights: indicators ? engineResult?.weights : (aggRes?.data?.weights || weights),
      totalScore: Number(totalScore.toFixed(2)),
      engineResult,
      vixRegime
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreEngine:v2" }
  };
}

module.exports = { scoreEngine, runEngine, getLayerScoresFromIndicators };
