// MODULE 16.1 — DATA FRESHNESS DECAY ENGINE
function freshnessDecayEngine({ layer_timestamps = {}, current_time = new Date().toISOString() }) {
  const now = new Date(current_time).getTime();
  const decay_status = {};
  let overall_freshness_score = 100;
  let critical_stale_data = false;
  let stale_layers = [];

  for (const [layer_name, timestamp] of Object.entries(layer_timestamps)) {
    if (!timestamp) {
      decay_status[layer_name] = { age_seconds: null, status: "MISSING", penalty: 100 };
      overall_freshness_score -= 10;
      critical_stale_data = true;
      stale_layers.push(layer_name);
      continue;
    }

    const fetched_time = new Date(timestamp).getTime();
    const age_seconds = (now - fetched_time) / 1000;
    
    let penalty = 0;
    let status = "FRESH";

    // Decay thresholds based on layer criticality (assuming ~5min max for fast layers, ~1 day for slow ones)
    // Simplified for the deterministic engine:
    if (age_seconds > 300) { // 5 minutes
      status = "STALE";
      penalty = 5;
    }
    if (age_seconds > 3600) { // 1 hour
      status = "VERY_STALE";
      penalty = 15;
    }
    if (age_seconds > 86400) { // 24 hours
      status = "EXPIRED";
      penalty = 50;
    }

    // Specific layer overrides (e.g. microstructure MUST be < 1 minute)
    if (layer_name.includes("layer2") && age_seconds > 60) {
      status = "CRITICAL_DECAY";
      penalty = 30;
      critical_stale_data = true;
      stale_layers.push(layer_name);
    }

    decay_status[layer_name] = { age_seconds, status, penalty };
    overall_freshness_score -= penalty;
  }

  overall_freshness_score = Math.max(0, overall_freshness_score);

  return {
    ok: true,
    data: { overall_freshness_score, critical_stale_data, stale_layers, decay_status },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:freshnessDecayEngine" }
  };
}

// MODULE 16.2 — OUTLIER & BAD TICK DETECTION ENGINE
function outlierDetectionEngine({ current_price, previous_close, high, low, standard_deviation_annual = 0.20 }) {
  let data_integrity_status = "VALID";
  let corruption_flag = false;
  const anomalies = [];

  if (current_price <= 0 || previous_close <= 0) {
    data_integrity_status = "CORRUPT_ZERO_PRICE";
    corruption_flag = true;
    anomalies.push("ZERO_OR_NEGATIVE_PRICE_DETECTED");
  } else {
    // Check for impossible intraday moves (e.g., > 30% jump in an index or large cap without a split)
    const daily_move_pct = Math.abs((current_price - previous_close) / previous_close) * 100;
    if (daily_move_pct > 30) {
      data_integrity_status = "SUSPECTED_BAD_TICK";
      corruption_flag = true;
      anomalies.push(`IMPROBABLE_DAILY_MOVE_${daily_move_pct.toFixed(2)}_PCT`);
    }

    // Check for broken High/Low bounds
    if (current_price > high * 1.05 || current_price < low * 0.95) {
      data_integrity_status = "BOUNDS_VIOLATION";
      corruption_flag = true;
      anomalies.push("PRICE_OUTSIDE_DAILY_HIGH_LOW");
    }
  }

  return {
    ok: true,
    data: { data_integrity_status, corruption_flag, anomalies },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:outlierDetectionEngine" }
  };
}

// MODULE 16.3 — CONFIDENCE INTERVAL AGGREGATOR
function confidenceAggregatorEngine({ layer_confidences = [] }) {
  // Averages the internal confidence scores of previous layers
  if (layer_confidences.length === 0) return { ok: false, error: "no_confidence_data" };

  const total = layer_confidences.reduce((a, b) => a + b, 0);
  const systemic_confidence = total / layer_confidences.length;

  let reliability_tier = "UNKNOWN";

  if (systemic_confidence >= 85) reliability_tier = "INSTITUTIONAL_GRADE_RELIABILITY";
  else if (systemic_confidence >= 65) reliability_tier = "STANDARD_RELIABILITY";
  else if (systemic_confidence >= 40) reliability_tier = "DEGRADED_RELIABILITY";
  else reliability_tier = "UNRELIABLE_DATA_STATE";

  return {
    ok: true,
    data: { systemic_confidence, reliability_tier },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:confidenceAggregatorEngine" }
  };
}

// MODULE 16.4 — CIRCUIT BREAKER ENGINE
function circuitBreakerEngine({ freshness_data, outlier_data, systemic_confidence }) {
  let circuit_breaker_tripped = false;
  let halt_reason = null;

  if (outlier_data.corruption_flag) {
    circuit_breaker_tripped = true;
    halt_reason = `DATA_CORRUPTION: ${outlier_data.anomalies.join(", ")}`;
  } else if (freshness_data.critical_stale_data) {
    circuit_breaker_tripped = true;
    halt_reason = `STALE_DATA_TIMEOUT: Layers [${freshness_data.stale_layers.join(", ")}] have decayed past tolerance.`;
  } else if (systemic_confidence < 40) {
    circuit_breaker_tripped = true;
    halt_reason = "SYSTEMIC_CONFIDENCE_COLLAPSE";
  }

  return {
    ok: true,
    data: { circuit_breaker_tripped, halt_reason },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:circuitBreakerEngine" }
  };
}

module.exports = {
  freshnessDecayEngine,
  outlierDetectionEngine,
  confidenceAggregatorEngine,
  circuitBreakerEngine
};
