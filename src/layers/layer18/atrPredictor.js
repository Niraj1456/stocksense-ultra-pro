// ═══════════════════════════════════════════════════════════════════════════
// LAYER 18 — ADVANCED ATR PREDICTOR
// Institutional-grade forward volatility prediction engine.
// Models ATR as a dynamic distribution, not a static lagged indicator.
// ═══════════════════════════════════════════════════════════════════════════

// ── HELPERS ──────────────────────────────────────────────────────────────
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function percentile(arr, pct) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeTrueRanges(highs, lows, closes) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  return trs;
}

function ewma(arr, lambda) {
  if (!arr || arr.length === 0) return 0;
  let val = arr[0];
  for (let i = 1; i < arr.length; i++) {
    val = lambda * arr[i] + (1 - lambda) * val;
  }
  return val;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 18.1 — VOLATILITY REGIME CLASSIFIER
// Classifies current regime: COMPRESSION, EXPANSION, TRANSITION, MEAN_REVERSION
// Uses ATR percentile rank, ATR rate-of-change, and BB width compression.
// ═══════════════════════════════════════════════════════════════════════════
function volatilityRegimeClassifier({ true_ranges, atr_current, bb_width_pct = null }) {
  if (!true_ranges || true_ranges.length < 30) {
    return { ok: false, error: "insufficient_tr_data" };
  }

  // ATR percentile rank over lookback
  const lookback60 = true_ranges.slice(-60);
  const atrRank = lookback60.filter(tr => tr < atr_current).length / lookback60.length * 100;

  // ATR rate of change: compare recent 5-day ATR to 20-day ATR
  const recent5 = mean(true_ranges.slice(-5));
  const recent20 = mean(true_ranges.slice(-20));
  const atrRoc = recent20 > 0 ? ((recent5 - recent20) / recent20) * 100 : 0;

  // ATR acceleration: is the rate of change itself increasing?
  const mid10 = mean(true_ranges.slice(-15, -5));
  const atrAccel = recent20 > 0 ? ((recent5 - mid10) / recent20) * 100 : 0;

  // Compression detection: ATR in bottom 20th percentile AND declining
  const isCompressed = atrRank < 20 && atrRoc < -5;
  // Expansion detection: ATR in top 30th percentile AND rising
  const isExpanding = atrRank > 70 && atrRoc > 10;
  // Mean-reversion: ATR was extreme but now reversing
  const isMeanReverting = (atrRank > 80 && atrRoc < -10) || (atrRank < 15 && atrRoc > 10);

  let regime = "NORMAL";
  let regime_confidence = 50;

  if (isCompressed) {
    regime = "COMPRESSION";
    regime_confidence = Math.min(95, 60 + Math.abs(atrRoc));
  } else if (isMeanReverting) {
    regime = "MEAN_REVERSION";
    regime_confidence = Math.min(90, 55 + Math.abs(atrRoc) * 0.8);
  } else if (isExpanding) {
    regime = "EXPANSION";
    regime_confidence = Math.min(90, 55 + atrRoc * 0.5);
  } else if (Math.abs(atrRoc) > 15) {
    regime = "TRANSITION";
    regime_confidence = Math.min(80, 50 + Math.abs(atrRoc) * 0.4);
  }

  // Breakout spike magnitude prediction (only in compression)
  let predicted_breakout_atr = null;
  if (regime === "COMPRESSION") {
    // When compressed, breakout ATR tends to reach the 80th percentile of recent range
    predicted_breakout_atr = percentile(lookback60, 80);
  }

  return {
    ok: true,
    data: {
      regime,
      regime_confidence,
      atr_percentile_rank: +atrRank.toFixed(1),
      atr_roc_pct: +atrRoc.toFixed(2),
      atr_acceleration: +atrAccel.toFixed(2),
      predicted_breakout_atr: predicted_breakout_atr ? +predicted_breakout_atr.toFixed(4) : null
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:volatilityRegimeClassifier" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 18.2 — GARCH(1,1) VOLATILITY CLUSTERING ENGINE
// Detects volatility clustering precursors and predicts forward variance.
// Uses exponentially weighted variance with persistence parameter.
// ═══════════════════════════════════════════════════════════════════════════
function garchVolatilityEngine({ daily_returns, true_ranges }) {
  if (!daily_returns || daily_returns.length < 30) {
    return { ok: false, error: "insufficient_returns_data" };
  }

  // GARCH(1,1) parameters calibrated for Indian equity markets
  // sigma²(t+1) = omega + alpha * epsilon²(t) + beta * sigma²(t)
  // alpha + beta < 1 for stationarity; typical equity: alpha=0.08, beta=0.88
  const alpha = 0.08;
  const beta = 0.88;
  const omega_scale = 1 - alpha - beta; // = 0.04

  const returns = daily_returns;
  const unconditionalVar = returns.reduce((s, r) => s + r * r, 0) / returns.length;
  const omega = omega_scale * unconditionalVar;

  // Forward variance estimation via recursive GARCH
  let sigma2 = unconditionalVar;
  for (let i = 0; i < returns.length; i++) {
    sigma2 = omega + alpha * (returns[i] * returns[i]) + beta * sigma2;
  }

  const predicted_daily_vol = Math.sqrt(sigma2);
  const predicted_annual_vol = predicted_daily_vol * Math.sqrt(252);

  // Persistence: how long shocks last (alpha + beta)
  const persistence = alpha + beta;
  const half_life = persistence < 1 ? Math.log(0.5) / Math.log(persistence) : Infinity;

  // Volatility clustering score: recent realized vol vs long-term
  const recent_vol = stddev(returns.slice(-5));
  const long_vol = stddev(returns.slice(-60));
  const clustering_ratio = long_vol > 0 ? recent_vol / long_vol : 1;

  let clustering_signal = "STABLE";
  if (clustering_ratio > 1.5) clustering_signal = "HIGH_CLUSTER_ACTIVE";
  else if (clustering_ratio > 1.2) clustering_signal = "ELEVATED_CLUSTERING";
  else if (clustering_ratio < 0.6) clustering_signal = "VOLATILITY_SUPPRESSED";

  // Predicted forward ATR from GARCH variance (proxy: daily_vol * sqrt(2) ≈ ATR for typical stocks)
  const predicted_atr = predicted_daily_vol * mean(true_ranges.slice(-20)) / (long_vol > 0 ? long_vol : predicted_daily_vol);

  return {
    ok: true,
    data: {
      predicted_daily_vol: +predicted_daily_vol.toFixed(6),
      predicted_annual_vol: +(predicted_annual_vol * 100).toFixed(2),
      predicted_atr: +predicted_atr.toFixed(4),
      persistence: +persistence.toFixed(3),
      half_life_days: half_life !== Infinity ? +half_life.toFixed(1) : null,
      clustering_ratio: +clustering_ratio.toFixed(3),
      clustering_signal,
      unconditional_vol: +(Math.sqrt(unconditionalVar) * 100 * Math.sqrt(252)).toFixed(2)
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:garchVolatilityEngine" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 18.3 — IV/RV BRIDGE (Options-Implied Volatility Integration)
// Uses IV percentile rank and IV/RV ratio to predict ATR direction.
// When IV expands ahead of RV → predict ATR expansion.
// When IV compresses below RV → predict ATR mean reversion.
// ═══════════════════════════════════════════════════════════════════════════
function ivRvBridge({ current_iv = null, iv_percentile = null, realized_vol_20d = null, atr_current }) {
  // Graceful degradation: if no IV data, reduce confidence proportionally
  if (current_iv == null || realized_vol_20d == null || realized_vol_20d <= 0) {
    return {
      ok: true,
      data: {
        iv_rv_ratio: null,
        iv_premium_pct: null,
        atr_direction_bias: "UNKNOWN",
        atr_adjustment_factor: 1.0,
        confidence: 0,
        data_available: false
      },
      meta: { fetchedAt: new Date().toISOString(), source: "calc:ivRvBridge" }
    };
  }

  const iv_rv_ratio = current_iv / realized_vol_20d;
  const iv_premium_pct = (iv_rv_ratio - 1) * 100;

  let atr_direction_bias = "NEUTRAL";
  let atr_adjustment_factor = 1.0;
  let confidence = 40; // Base confidence with IV data

  if (iv_percentile != null) confidence += 20; // Better data = more confidence

  if (iv_rv_ratio > 1.3) {
    // IV significantly above RV: market expects expansion
    atr_direction_bias = "EXPANSION_EXPECTED";
    atr_adjustment_factor = 1.0 + Math.min(0.3, (iv_rv_ratio - 1.3) * 0.5);
    confidence = Math.min(85, confidence + 15);
  } else if (iv_rv_ratio > 1.1) {
    atr_direction_bias = "MILD_EXPANSION_EXPECTED";
    atr_adjustment_factor = 1.0 + (iv_rv_ratio - 1.1) * 0.3;
  } else if (iv_rv_ratio < 0.8) {
    // IV well below RV: volatility crush likely, ATR will compress
    atr_direction_bias = "COMPRESSION_EXPECTED";
    atr_adjustment_factor = Math.max(0.7, 1.0 - (0.8 - iv_rv_ratio) * 0.5);
    confidence = Math.min(80, confidence + 10);
  } else if (iv_rv_ratio < 0.95) {
    atr_direction_bias = "MILD_COMPRESSION_EXPECTED";
    atr_adjustment_factor = Math.max(0.85, 1.0 - (0.95 - iv_rv_ratio) * 0.3);
  }

  // IV percentile extremes provide additional edge
  if (iv_percentile != null) {
    if (iv_percentile > 85 && atr_direction_bias.includes("EXPANSION")) {
      confidence = Math.min(90, confidence + 10);
    } else if (iv_percentile < 15 && atr_direction_bias.includes("COMPRESSION")) {
      // Extremely low IV percentile means vol is already crushed; expect mean reversion UP
      atr_direction_bias = "MEAN_REVERSION_UP";
      atr_adjustment_factor = 1.1;
    }
  }

  return {
    ok: true,
    data: {
      iv_rv_ratio: +iv_rv_ratio.toFixed(3),
      iv_premium_pct: +iv_premium_pct.toFixed(1),
      atr_direction_bias,
      atr_adjustment_factor: +atr_adjustment_factor.toFixed(3),
      confidence,
      data_available: true
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:ivRvBridge" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 18.4 — EVENT-DRIVEN ATR ADJUSTMENT
// Adjusts ATR prediction for known catalysts: earnings, F&O expiry,
// RBI policy, index rebalancing. Post-event, models vol crush.
// ═══════════════════════════════════════════════════════════════════════════
function eventAtrAdjustment({
  days_to_earnings = null,
  days_to_expiry = null,
  days_to_rbi_policy = null,
  is_index_rebalance_week = false,
  post_event_days = null
}) {
  let event_premium = 1.0;
  let event_label = "NO_EVENT";
  const events_active = [];

  // Earnings: typically +40-80% ATR expansion within 3 days
  if (days_to_earnings != null && days_to_earnings >= 0 && days_to_earnings <= 5) {
    const earnings_mult = days_to_earnings <= 1 ? 1.6 : days_to_earnings <= 3 ? 1.35 : 1.15;
    event_premium *= earnings_mult;
    events_active.push({ type: "EARNINGS", days: days_to_earnings, multiplier: earnings_mult });
    event_label = "EARNINGS_PROXIMITY";
  }

  // F&O Expiry: typically +20-40% ATR on expiry day and day before
  if (days_to_expiry != null && days_to_expiry >= 0 && days_to_expiry <= 3) {
    const expiry_mult = days_to_expiry <= 1 ? 1.3 : 1.15;
    event_premium *= expiry_mult;
    events_active.push({ type: "FNO_EXPIRY", days: days_to_expiry, multiplier: expiry_mult });
    if (event_label === "NO_EVENT") event_label = "EXPIRY_PROXIMITY";
  }

  // RBI Policy: typically +15-30% for rate-sensitive stocks
  if (days_to_rbi_policy != null && days_to_rbi_policy >= 0 && days_to_rbi_policy <= 2) {
    const rbi_mult = days_to_rbi_policy <= 0 ? 1.25 : 1.12;
    event_premium *= rbi_mult;
    events_active.push({ type: "RBI_POLICY", days: days_to_rbi_policy, multiplier: rbi_mult });
  }

  // Index rebalance: mild but persistent vol increase
  if (is_index_rebalance_week) {
    event_premium *= 1.1;
    events_active.push({ type: "INDEX_REBALANCE", days: null, multiplier: 1.1 });
  }

  // Post-event vol crush: predictable compression after catalyst passes
  if (post_event_days != null && post_event_days >= 1 && post_event_days <= 5) {
    const crush_factor = Math.max(0.7, 1.0 - (0.06 * post_event_days)); // 6% crush per day
    event_premium *= crush_factor;
    event_label = "POST_EVENT_CRUSH";
    events_active.push({ type: "VOL_CRUSH", days: post_event_days, multiplier: crush_factor });
  }

  event_premium = Math.max(0.6, Math.min(2.0, event_premium));

  return {
    ok: true,
    data: {
      event_premium: +event_premium.toFixed(3),
      event_label,
      events_active
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:eventAtrAdjustment" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 18.5 — MASTER ATR PREDICTOR (COMPOSITE)
// Aggregates all sub-engines into a single confidence-weighted ATR forecast.
// Outputs predicted ATR, prediction band (low/high), confidence score,
// and prediction horizon validity.
// ═══════════════════════════════════════════════════════════════════════════
function predictATR({
  highs, lows, closes, volumes = [],
  current_iv = null, iv_percentile = null,
  days_to_earnings = null, days_to_expiry = null,
  days_to_rbi_policy = null, is_index_rebalance_week = false,
  post_event_days = null,
  prediction_horizon_days = 1
}) {
  if (!highs || !lows || !closes || closes.length < 40) {
    return { ok: false, error: "insufficient_price_data" };
  }

  // ── STEP 1: Compute raw true ranges and base ATR ──
  const true_ranges = computeTrueRanges(highs, lows, closes);
  if (true_ranges.length < 20) return { ok: false, error: "insufficient_tr_data" };

  const atr14 = mean(true_ranges.slice(-14));
  const atr5 = mean(true_ranges.slice(-5));

  // ── STEP 2: Daily returns for GARCH ──
  const daily_returns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) daily_returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  // ── STEP 3: Run sub-engines ──
  const regimeOut = volatilityRegimeClassifier({ true_ranges, atr_current: atr14 });
  const garchOut = garchVolatilityEngine({ daily_returns, true_ranges });

  // Realized vol for IV bridge
  const rv20d = stddev(daily_returns.slice(-20)) * Math.sqrt(252);
  const ivBridgeOut = ivRvBridge({
    current_iv,
    iv_percentile,
    realized_vol_20d: rv20d,
    atr_current: atr14
  });

  const eventOut = eventAtrAdjustment({
    days_to_earnings, days_to_expiry, days_to_rbi_policy,
    is_index_rebalance_week, post_event_days
  });

  // ── STEP 4: Composite prediction ──
  // Start with GARCH-predicted ATR if available, else use EWMA-weighted recent ATR
  let base_predicted_atr = garchOut.ok ? garchOut.data.predicted_atr : ewma(true_ranges.slice(-20), 0.15);

  // Regime adjustment
  if (regimeOut.ok) {
    const regime = regimeOut.data.regime;
    if (regime === "COMPRESSION" && regimeOut.data.predicted_breakout_atr) {
      // In compression, blend toward breakout ATR (don't fully jump)
      base_predicted_atr = base_predicted_atr * 0.6 + regimeOut.data.predicted_breakout_atr * 0.4;
    } else if (regime === "EXPANSION") {
      // In expansion, increase prediction toward recent high vol
      base_predicted_atr = base_predicted_atr * 0.7 + atr5 * 0.3;
    } else if (regime === "MEAN_REVERSION") {
      // Mean-reverting: blend toward long-term average
      const longTermAtr = mean(true_ranges.slice(-60));
      base_predicted_atr = base_predicted_atr * 0.5 + longTermAtr * 0.5;
    }
  }

  // IV/RV bridge adjustment
  if (ivBridgeOut.ok && ivBridgeOut.data.data_available) {
    base_predicted_atr *= ivBridgeOut.data.atr_adjustment_factor;
  }

  // Event premium
  if (eventOut.ok) {
    base_predicted_atr *= eventOut.data.event_premium;
  }

  // ── STEP 5: Confidence scoring ──
  let confidence = 60; // Base confidence

  // Data quality contributions
  if (closes.length >= 120) confidence += 10; // Good history
  if (garchOut.ok) confidence += 10;
  if (regimeOut.ok && regimeOut.data.regime_confidence > 70) confidence += 5;
  if (ivBridgeOut.ok && ivBridgeOut.data.data_available) confidence += 10;

  // Horizon decay: confidence drops ~8% per day beyond day 1
  const horizon_decay = Math.max(0.4, 1.0 - (prediction_horizon_days - 1) * 0.08);
  confidence *= horizon_decay;
  confidence = Math.min(95, Math.max(10, Math.round(confidence)));

  // ── STEP 6: Prediction band ──
  const tr_stddev = stddev(true_ranges.slice(-20));
  const band_width = tr_stddev * (1 + (prediction_horizon_days - 1) * 0.15);
  const predicted_atr_low = Math.max(0, base_predicted_atr - band_width);
  const predicted_atr_high = base_predicted_atr + band_width;

  // ── STEP 7: Price-relative metrics ──
  const lastClose = closes[closes.length - 1];
  const predicted_range_pct = lastClose > 0 ? (base_predicted_atr / lastClose) * 100 : 0;

  return {
    ok: true,
    data: {
      predicted_atr: +base_predicted_atr.toFixed(4),
      predicted_atr_low: +predicted_atr_low.toFixed(4),
      predicted_atr_high: +predicted_atr_high.toFixed(4),
      predicted_range_pct: +predicted_range_pct.toFixed(3),
      current_atr14: +atr14.toFixed(4),
      current_atr5: +atr5.toFixed(4),
      confidence,
      prediction_horizon_days,
      regime: regimeOut.ok ? regimeOut.data : null,
      garch: garchOut.ok ? garchOut.data : null,
      iv_bridge: ivBridgeOut.ok ? ivBridgeOut.data : null,
      event: eventOut.ok ? eventOut.data : null
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:predictATR" }
  };
}

module.exports = {
  volatilityRegimeClassifier,
  garchVolatilityEngine,
  ivRvBridge,
  eventAtrAdjustment,
  predictATR
};
