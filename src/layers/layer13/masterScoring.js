const { getWeights } = require("./weightTable");

// MODULE 13.1 — DYNAMIC WEIGHT TABLE ENGINE
// Updated to use the 4-regime static weight table from weightTable.js
function weightTableEngine({ mode = "SWING", market_regime = "NORMAL" }) {
  // Map market_regime to VIX regime
  let vixRegime = 'LOW_VIX';
  if (market_regime === 'HIGH_VOLATILITY' || market_regime === 'FEAR' || market_regime === 'BEAR' || market_regime === 'HIGH_VIX') {
    vixRegime = 'HIGH_VIX';
  }

  // Map mode to standard format
  let normalizedMode = 'INTRADAY';
  if (mode === 'INVESTMENT' || mode === 'POSITIONAL' || mode === 'LT') {
    normalizedMode = 'INVESTMENT';
  }

  // Fetch weights from the 26-layer static weight table
  const weights = { ...getWeights(normalizedMode, vixRegime) };

  return {
    ok: true,
    data: { weights, mode: normalizedMode, market_regime, vix_regime: vixRegime },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:weightTableEngine:v2" }
  };
}

// MODULE 13.2 — SCORE AGGREGATION ENGINE
// Updated to use point-based aggregation (baseline 50) and un-normalized weights
function scoreAggregationEngine({ layer_scores = {}, weights = {} }) {
  let total_score = 50;
  const score_breakdown = {};
  const normalized_weights = {};

  // Calculate active weights sum (excluding risk)
  let activeWeightSum = 0;
  for (const [layer, weight] of Object.entries(weights)) {
    if (layer === 'layer12_risk') continue;
    activeWeightSum += weight;
  }

  for (const [layer, weight] of Object.entries(weights)) {
    if (layer === 'layer12_risk') {
      normalized_weights[layer] = 0;
      continue;
    }
    
    // Normalize weight dynamically
    const normalizedWeight = activeWeightSum > 0 ? (weight * 100) / activeWeightSum : 0;
    normalized_weights[layer] = normalizedWeight;

    // layer_scores should provide a normalized score (0 to 100) for each layer
    const layer_score = Number(layer_scores[layer]) || 50; // Default neutral if missing
    const points = ((layer_score - 50) * normalizedWeight) / 100;
    
    total_score += points;
    score_breakdown[layer] = {
      raw_score: layer_score,
      weight_applied: Number(normalizedWeight.toFixed(2)),
      contribution: Number(points.toFixed(2))
    };
  }

  return {
    ok: true,
    data: { 
      total_score: Number(total_score.toFixed(2)), 
      score_breakdown, 
      weights: normalized_weights 
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreAggregationEngine:v2" }
  };
}

// MODULE 13.3 — TIERED VETO VERIFICATION ENGINE
// Replaces flat veto system with FATAL/CAUTION/ADVISORY tiers
const VETO_TIERS = {
  FATAL: [
    'CIRCUIT_BREAKER_TRIPPED',
    'PROMOTER_PLEDGE_DISTRESS_VETO',
    'ALPHA_DECAY_HALT_VETO',
    'ALPHA_DECAY_HALT',
    'AUDITOR_RESIGNATION',
    'BENEISH_M_SCORE_MANIPULATION_RISK',
    'BENEISH_M_SCORE_MANIPULATION',
    'PROMOTER_DISTRESS_SELL'
  ],
  CAUTION: [
    'TRENDING_OB_SHORT',
    'BEAR_MARKET_LONG',
    'WEAK_BEAR_CONVICTION',
    'EARNINGS_ANNOUNCEMENT_BINARY_RISK',
    'EARNINGS_BINARY_EVENT',
    'EARNINGS_QUALITY_MANIPULATION',
    'STRONGLY_BEARISH_SENTIMENT',
    'EARNINGS_IMMINENT_VETO',
    'INSIDER_VETO',
    'TREND_MISALIGNMENT',
    'LOW_VOLUME_LONG',
    'LOW_VOLUME_SHORT',
    'UNIVERSAL_LOW_VOLUME',
    'LOW_VOL_LONG',
    'LOW_VOL_SHORT',
    'LOW_VOL_ANY',
    'MOMENTUM_DISAGREEMENT_LONG',
    'MOMENTUM_DISAGREEMENT_SHORT',
    'MOM_DISAGREE_LONG',
    'MOM_DISAGREE_SHORT',
    'TREND_ALIGNMENT_SHORT',
    'OVERSOLD_OVERRIDE',
    'OVERSOLD_SHORT',
    'OVERBOUGHT_LONG',
    'OVERSOLD_TREND_LONG',
    'CANDLE_STRUCTURE_LONG',
    'CANDLE_STRUCTURE_SHORT',
    'CANDLE_VETO_LONG',
    'CANDLE_VETO_SHORT',
    'PDH_PDL_CONTRADICTION_LONG',
    'PDH_PDL_CONTRADICTION_SHORT'
  ],
  ADVISORY: [
    'TREND_VETO',
    'FORENSIC_DISTRESS',
    'PEER_PERCENTILE_FALLBACK'
  ]
};

function vetoVerificationEngine({ layer_vetoes = [], veto_codes = [] }) {
  // Support both legacy array-of-objects and new string-code arrays
  const activeCodes = [];
  
  // Legacy format: [{ active: true, reason: 'CODE' }]
  if (layer_vetoes.length > 0) {
    const active = layer_vetoes.filter(v => v.active === true);
    activeCodes.push(...active.map(v => v.reason));
  }
  
  // New format: string array of veto codes
  if (veto_codes.length > 0) {
    activeCodes.push(...veto_codes);
  }
  
  const uniqueCodes = [...new Set(activeCodes)];
  
  // Classify into tiers
  const fatalVetoes = uniqueCodes.filter(c => VETO_TIERS.FATAL.includes(c));
  const cautionVetoes = uniqueCodes.filter(c => VETO_TIERS.CAUTION.includes(c));
  const advisoryVetoes = uniqueCodes.filter(c => 
    VETO_TIERS.ADVISORY.includes(c) || 
    (!VETO_TIERS.FATAL.includes(c) && !VETO_TIERS.CAUTION.includes(c))
  );
  
  const hasFatalVeto = fatalVetoes.length > 0;
  const hasCautionVeto = cautionVetoes.length > 0;
  
  return {
    ok: true,
    data: {
      veto_triggered: hasFatalVeto,
      caution_triggered: hasCautionVeto,
      fatal_vetoes: fatalVetoes,
      caution_vetoes: cautionVetoes,
      advisory_vetoes: advisoryVetoes,
      all_veto_codes: uniqueCodes,
      veto_reasons: uniqueCodes, // backward compat
      tier: hasFatalVeto ? 'FATAL' : (hasCautionVeto ? 'CAUTION' : (advisoryVetoes.length > 0 ? 'ADVISORY' : 'CLEAR'))
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:vetoVerificationEngine:v2" }
  };
}

// MODULE 13.4 — CONVICTION-GATED VERDICT CLASSIFIER
// Updated with conviction floor of 0.33 and caution penalty
// Thresholds recalibrated to match compressed scores range (Strong Buy >= 68, Buy >= 60, etc.)
function verdictClassifierEngine({ total_score = 0, veto_data = { veto_triggered: false }, rr_valid = true, caution_count = 0 }) {
  let verdict = "NO_TRADE";
  let conviction_level = "NONE";
  let action = "SIDELINED";
  let conviction_multiplier = 1.0;

  if (veto_data.veto_triggered) {
    verdict = "SYSTEM_VETO";
    conviction_level = "CRITICAL_REJECTION";
    action = `DO_NOT_TRADE: ${(veto_data.veto_reasons || []).join(", ")}`;
    conviction_multiplier = 0.0;
  } else if (!rr_valid) {
    verdict = "INVALID_RISK_REWARD";
    conviction_level = "REJECTED";
    action = "AWAIT_BETTER_ENTRY";
    conviction_multiplier = 0.0;
  } else {
    // Apply caution penalty: each CAUTION veto reduces conviction by 10%
    const cautionPenalty = Math.min(0.40, caution_count * 0.10);
    conviction_multiplier = Math.max(0.33, 1.0 - cautionPenalty);
    
    // Score based logic with conviction gating
    if (total_score >= 68) {
      verdict = "STRONG_CONVICTION_BUY";
      conviction_level = "MAXIMUM";
      action = "EXECUTE_IMMEDIATELY_AT_MARKET";
    } else if (total_score >= 60 && total_score < 68) {
      verdict = "BUY";
      conviction_level = "HIGH";
      action = "EXECUTE_WITH_LIMIT_ORDERS";
    } else if (total_score >= 53 && total_score < 60) {
      verdict = "ACCUMULATE_ON_DIPS";
      conviction_level = "MODERATE";
      action = "SCALE_IN_SLOWLY";
    } else if (total_score >= 47 && total_score < 53) {
      verdict = "NEUTRAL_WATCH";
      conviction_level = "LOW";
      action = "MONITOR_FOR_SETUP";
    } else if (total_score >= 40 && total_score < 47) {
      verdict = "SELL_ON_RALLIES";
      conviction_level = "MODERATE";
      action = "LOOK_FOR_SHORT_ENTRIES";
    } else if (total_score < 40) {
      verdict = "STRONG_CONVICTION_SELL";
      conviction_level = "MAXIMUM";
      action = "EXECUTE_SHORT_OR_LIQUIDATE";
    }
    
    // Downgrade verdict if conviction is floored
    if (conviction_multiplier <= 0.33 && (verdict === "STRONG_CONVICTION_BUY" || verdict === "BUY")) {
      verdict = "ACCUMULATE_ON_DIPS";
      conviction_level = "REDUCED_BY_CAUTIONS";
      action = "SCALE_IN_SLOWLY_WITH_CAUTION";
    }
  }

  return {
    ok: true,
    data: { verdict, conviction_level, action, final_score: total_score, conviction_multiplier },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:verdictClassifierEngine:v2" }
  };
}

module.exports = {
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine,
  VETO_TIERS
};
