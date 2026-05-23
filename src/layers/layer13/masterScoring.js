// MODULE 13.1 — DYNAMIC WEIGHT TABLE ENGINE
function weightTableEngine({ mode = "SWING", market_regime = "NORMAL" }) {
  // Base Weights
  let weights = {
    layer1_macro: 5,
    layer2_microstructure: 10,
    layer3_technicals: 15,
    layer4_price_action: 15,
    layer5_volume_profile: 10,
    layer6_institutional: 10,
    layer7_derivatives: 10,
    layer8_fundamentals: 5,
    layer9_forensic: 5,
    layer10_valuation: 5,
    layer11_predictive: 5,
    layer15_sentiment: 5, // Sentiment & Catalysts
    layer12_risk: 0 // Risk doesn't add to conviction score, it handles sizing
  };

  // Adjustments based on Mode
  if (mode === "INTRADAY" || mode === "SCALP") {
    weights.layer2_microstructure += 10;
    weights.layer5_volume_profile += 10;
    weights.layer7_derivatives += 5;
    
    weights.layer8_fundamentals = 0;
    weights.layer9_forensic = 0;
    weights.layer10_valuation = 0;
    weights.layer4_price_action -= 5;
    weights.layer1_macro -= 5;
  } else if (mode === "INVESTMENT" || mode === "POSITIONAL") {
    weights.layer8_fundamentals += 15;
    weights.layer10_valuation += 15;
    weights.layer9_forensic += 10;
    weights.layer1_macro += 5;
    weights.layer15_sentiment += 5; // Higher weight for long term sentiment

    weights.layer2_microstructure = 0;
    weights.layer7_derivatives = 0;
    weights.layer3_technicals -= 10;
    weights.layer5_volume_profile -= 5;
    weights.layer11_predictive -= 5;
  }

  // Adjustments based on Market Regime (VIX/Macro)
  if (market_regime === "HIGH_VOLATILITY" || market_regime === "FEAR") {
    weights.layer1_macro += 5;
    weights.layer9_forensic += 5;
    // Reduce noise from fast indicators
    weights.layer3_technicals -= 5;
    weights.layer2_microstructure -= 5;
  }

  // Normalize weights to sum exactly to 100
  const total_weight = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach(k => {
    weights[k] = (weights[k] / total_weight) * 100;
  });

  return {
    ok: true,
    data: { weights, mode, market_regime },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:weightTableEngine" }
  };
}

// MODULE 13.2 — SCORE AGGREGATION ENGINE
function scoreAggregationEngine({ layer_scores = {}, weights = {} }) {
  let total_score = 0;
  const score_breakdown = {};

  for (const [layer, weight] of Object.entries(weights)) {
    // layer_scores should provide a normalized score (0 to 100) for each layer
    const layer_score = Number(layer_scores[layer]) || 0;
    const weighted_contribution = (layer_score * weight) / 100;
    
    total_score += weighted_contribution;
    score_breakdown[layer] = {
      raw_score: layer_score,
      weight_applied: weight,
      contribution: weighted_contribution
    };
  }

  return {
    ok: true,
    data: { total_score, score_breakdown },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:scoreAggregationEngine" }
  };
}

// MODULE 13.3 — VETO VERIFICATION ENGINE
function vetoVerificationEngine({ layer_vetoes = [] }) {
  // Scans all layers for any active veto triggers
  const active_vetoes = layer_vetoes.filter(v => v.active === true);
  
  const veto_triggered = active_vetoes.length > 0;
  const veto_reasons = active_vetoes.map(v => v.reason);

  return {
    ok: true,
    data: { veto_triggered, veto_reasons },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:vetoVerificationEngine" }
  };
}

// MODULE 13.4 — VERDICT CLASSIFIER
function verdictClassifierEngine({ total_score = 0, veto_data = { veto_triggered: false }, rr_valid = true }) {
  let verdict = "NO_TRADE";
  let conviction_level = "NONE";
  let action = "SIDELINED";

  if (veto_data.veto_triggered) {
    verdict = "SYSTEM_VETO";
    conviction_level = "CRITICAL_REJECTION";
    action = `DO_NOT_TRADE: ${veto_data.veto_reasons.join(", ")}`;
  } else if (!rr_valid) {
    verdict = "INVALID_RISK_REWARD";
    conviction_level = "REJECTED";
    action = "AWAIT_BETTER_ENTRY";
  } else {
    // Score based logic
    if (total_score >= 85) {
      verdict = "STRONG_CONVICTION_BUY";
      conviction_level = "MAXIMUM";
      action = "EXECUTE_IMMEDIATELY_AT_MARKET";
    } else if (total_score >= 70 && total_score < 85) {
      verdict = "BUY";
      conviction_level = "HIGH";
      action = "EXECUTE_WITH_LIMIT_ORDERS";
    } else if (total_score >= 55 && total_score < 70) {
      verdict = "ACCUMULATE_ON_DIPS";
      conviction_level = "MODERATE";
      action = "SCALE_IN_SLOWLY";
    } else if (total_score >= 40 && total_score < 55) {
      verdict = "NEUTRAL_WATCH";
      conviction_level = "LOW";
      action = "MONITOR_FOR_SETUP";
    } else if (total_score >= 25 && total_score < 40) {
      verdict = "SELL_ON_RALLIES";
      conviction_level = "MODERATE";
      action = "LOOK_FOR_SHORT_ENTRIES";
    } else if (total_score < 25) {
      verdict = "STRONG_CONVICTION_SELL";
      conviction_level = "MAXIMUM";
      action = "EXECUTE_SHORT_OR_LIQUIDATE";
    }
  }

  return {
    ok: true,
    data: { verdict, conviction_level, action, final_score: total_score },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:verdictClassifierEngine" }
  };
}

module.exports = {
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine
};
