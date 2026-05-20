// ═══════════════════════════════════════════════════════════════════════════
// SMART SHORT ENTRY ADVISOR
// Institutional-grade short entry detection with distribution phase
// recognition, momentum exhaustion scoring, squeeze risk assessment,
// and regime-adaptive conviction classification.
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

function linearSlope(arr) {
  // Least-squares slope normalized to mean (rate of change per bar)
  if (!arr || arr.length < 3) return 0;
  const n = arr.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += arr[i]; sumXY += i * arr[i]; sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const avg = sumY / n;
  return avg > 0 ? slope / avg : 0; // Normalized slope
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.1 — DISTRIBUTION PHASE DETECTOR
// Identifies institutional distribution: rising price on declining volume,
// narrowing spread, failed breakout attempts, and breadth divergence.
// ═══════════════════════════════════════════════════════════════════════════
function distributionPhaseDetector({ closes, highs, lows, volumes, lookback = 20 }) {
  if (!closes || closes.length < lookback + 10) {
    return { ok: false, error: "insufficient_data" };
  }

  const n = closes.length;
  const pSlice = closes.slice(-lookback);
  const vSlice = volumes.slice(-lookback);
  const hSlice = highs.slice(-lookback);
  const lSlice = lows.slice(-lookback);

  // 1. Price slope vs Volume slope divergence
  const priceSlope = linearSlope(pSlice);
  const volumeSlope = linearSlope(vSlice);

  // Distribution fingerprint: price rising BUT volume declining
  let priceVolDivergence = 0;
  if (priceSlope > 0.001 && volumeSlope < -0.005) {
    // Rising price, declining volume — classic distribution
    priceVolDivergence = clamp(Math.abs(volumeSlope) * 200, 0, 30);
  }

  // 2. Spread narrowing: range compression at highs
  const spreads = hSlice.map((h, i) => h - lSlice[i]);
  const earlySpread = mean(spreads.slice(0, Math.floor(lookback / 2)));
  const lateSpread = mean(spreads.slice(-Math.floor(lookback / 3)));
  let spreadNarrowing = 0;
  if (earlySpread > 0 && lateSpread < earlySpread * 0.7 && priceSlope >= 0) {
    spreadNarrowing = clamp((1 - lateSpread / earlySpread) * 40, 0, 20);
  }

  // 3. Failed breakout attempts: count highs that exceeded prior high then closed below
  let failedBreakouts = 0;
  const rollingHigh20 = Math.max(...hSlice.slice(0, -3));
  for (let i = lookback - 3; i < lookback; i++) {
    if (hSlice[i] > rollingHigh20 && pSlice[i] < rollingHigh20) {
      failedBreakouts++;
    }
  }
  const failedBreakoutScore = failedBreakouts * 10;

  // 4. Up-day volume vs Down-day volume ratio
  let upDayVol = 0, downDayVol = 0, upCount = 0, downCount = 0;
  for (let i = 1; i < pSlice.length; i++) {
    if (pSlice[i] > pSlice[i - 1]) { upDayVol += vSlice[i]; upCount++; }
    else if (pSlice[i] < pSlice[i - 1]) { downDayVol += vSlice[i]; downCount++; }
  }
  const avgUpVol = upCount > 0 ? upDayVol / upCount : 0;
  const avgDownVol = downCount > 0 ? downDayVol / downCount : 0;
  let volumeConviction = 0;
  if (avgUpVol > 0 && avgDownVol > avgUpVol * 1.2) {
    // Down days have more volume than up days — distribution
    volumeConviction = clamp((avgDownVol / avgUpVol - 1) * 30, 0, 20);
  }

  // Composite score (0-100)
  const rawScore = priceVolDivergence + spreadNarrowing + failedBreakoutScore + volumeConviction;
  const score = clamp(rawScore, 0, 100);

  let phase = "NO_DISTRIBUTION";
  if (score >= 60) phase = "ACTIVE_DISTRIBUTION";
  else if (score >= 35) phase = "EARLY_DISTRIBUTION";
  else if (score >= 15) phase = "POSSIBLE_DISTRIBUTION";

  return {
    ok: true,
    data: {
      distribution_score: +score.toFixed(1),
      phase,
      components: {
        price_volume_divergence: +priceVolDivergence.toFixed(1),
        spread_narrowing: +spreadNarrowing.toFixed(1),
        failed_breakouts: failedBreakouts,
        failed_breakout_score: failedBreakoutScore,
        volume_conviction: +volumeConviction.toFixed(1)
      }
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:distributionPhaseDetector" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.2 — MOMENTUM EXHAUSTION ENGINE
// Computes rate-of-change of momentum (momentum derivative), detecting
// when momentum is decelerating into resistance on thinning participation.
// ═══════════════════════════════════════════════════════════════════════════
function momentumExhaustionEngine({ closes, volumes, rsi, rsi_history = [], ema20, adx }) {
  if (!closes || closes.length < 20) {
    return { ok: false, error: "insufficient_data" };
  }

  const n = closes.length;

  // 1. Rate of change of momentum (momentum derivative)
  // ROC of 5-day momentum
  const mom5 = [];
  for (let i = 5; i < n; i++) {
    mom5.push(((closes[i] - closes[i - 5]) / closes[i - 5]) * 100);
  }
  const momSlope = mom5.length >= 5 ? linearSlope(mom5.slice(-10)) : 0;

  // Exhaustion: price still going up but momentum is decelerating
  let momentumDeceleration = 0;
  if (mom5.length >= 2) {
    const recentMom = mom5[mom5.length - 1];
    const prevMom = mom5[mom5.length - 3] || mom5[mom5.length - 2];
    if (recentMom > 0 && recentMom < prevMom) {
      // Positive momentum but declining — exhaustion
      momentumDeceleration = clamp((prevMom - recentMom) * 5, 0, 30);
    }
  }

  // 2. RSI divergence: price making higher highs, RSI making lower highs
  let rsiDivergence = 0;
  if (rsi_history.length >= 10) {
    const priceRecent5 = closes.slice(-5);
    const pricePrev5 = closes.slice(-10, -5);
    const rsiRecent5 = rsi_history.slice(-5);
    const rsiPrev5 = rsi_history.slice(-10, -5);

    const priceHigh1 = Math.max(...pricePrev5);
    const priceHigh2 = Math.max(...priceRecent5);
    const rsiHigh1 = Math.max(...rsiPrev5);
    const rsiHigh2 = Math.max(...rsiRecent5);

    if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1) {
      // Classic bearish divergence
      rsiDivergence = clamp((rsiHigh1 - rsiHigh2) * 1.5, 5, 30);
    }
  }

  // 3. Overbought exhaustion: RSI > 70 with declining momentum
  let overboughtExhaustion = 0;
  if (rsi > 70 && momSlope < -0.005) {
    overboughtExhaustion = clamp((rsi - 70) * 1.5 + Math.abs(momSlope) * 200, 0, 25);
  }

  // 4. Volume thinning at highs
  let volumeThinning = 0;
  if (volumes && volumes.length >= 10) {
    const volRecent5 = mean(volumes.slice(-5));
    const volPrev10 = mean(volumes.slice(-15, -5));
    const priceAtHigh = closes[n - 1] > closes[n - 6]; // Price is up over 5 days
    if (priceAtHigh && volRecent5 < volPrev10 * 0.7) {
      volumeThinning = clamp((1 - volRecent5 / volPrev10) * 40, 0, 20);
    }
  }

  const rawScore = momentumDeceleration + rsiDivergence + overboughtExhaustion + volumeThinning;
  const score = clamp(rawScore, 0, 100);

  let signal = "NO_EXHAUSTION";
  if (score >= 55) signal = "STRONG_EXHAUSTION";
  else if (score >= 35) signal = "MODERATE_EXHAUSTION";
  else if (score >= 15) signal = "EARLY_EXHAUSTION";

  return {
    ok: true,
    data: {
      exhaustion_score: +score.toFixed(1),
      signal,
      momentum_slope: +momSlope.toFixed(5),
      components: {
        momentum_deceleration: +momentumDeceleration.toFixed(1),
        rsi_divergence: +rsiDivergence.toFixed(1),
        overbought_exhaustion: +overboughtExhaustion.toFixed(1),
        volume_thinning: +volumeThinning.toFixed(1)
      }
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:momentumExhaustionEngine" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.3 — SQUEEZE RISK DETECTOR
// Evaluates probability of a short squeeze that would invalidate the setup.
// Uses short interest proxy, liquidity, sector momentum, and OI data.
// ═══════════════════════════════════════════════════════════════════════════
function squeezeRiskDetector({
  rvol, atr_value, current_price,
  pcr = null, has_real_pcr = false,
  recent_returns = [], sector_momentum_pct = 0,
  adx = 25, delivery_pct = null
}) {
  let squeezeScore = 0;
  const flags = [];

  // 1. Low liquidity amplifies squeeze risk
  if (rvol != null && rvol < 0.5) {
    squeezeScore += 20;
    flags.push("LOW_LIQUIDITY");
  } else if (rvol != null && rvol < 0.7) {
    squeezeScore += 10;
    flags.push("THIN_VOLUME");
  }

  // 2. Strong sector momentum against short direction
  if (sector_momentum_pct > 2) {
    squeezeScore += clamp(sector_momentum_pct * 5, 0, 25);
    flags.push("SECTOR_TAILWIND");
  }

  // 3. PCR indicating heavy put writing (contrarian squeeze fuel)
  if (has_real_pcr && pcr != null) {
    if (pcr > 1.5) {
      squeezeScore += 15;
      flags.push("EXTREME_PUT_WRITING_SQUEEZE_FUEL");
    } else if (pcr > 1.2) {
      squeezeScore += 8;
    }
  }

  // 4. Mean reversion probability: consecutive down days increase bounce risk
  if (recent_returns.length >= 5) {
    const consecutiveDown = recent_returns.slice(-5).filter(r => r < 0).length;
    if (consecutiveDown >= 4) {
      squeezeScore += 20;
      flags.push("OVERSOLD_BOUNCE_RISK");
    } else if (consecutiveDown >= 3) {
      squeezeScore += 10;
    }
  }

  // 5. High delivery percentage suggests real buying, not just trading
  if (delivery_pct != null && delivery_pct > 50) {
    squeezeScore += 15;
    flags.push("HIGH_DELIVERY_BUYING");
  }

  // 6. Low ADX in "squeeze" means choppy — stops get hunted
  if (adx < 18) {
    squeezeScore += 10;
    flags.push("CHOPPY_STOP_HUNT_RISK");
  }

  squeezeScore = clamp(squeezeScore, 0, 100);

  let risk_level = "LOW";
  let veto = false;
  if (squeezeScore >= 65) { risk_level = "CRITICAL"; veto = true; }
  else if (squeezeScore >= 45) { risk_level = "HIGH"; }
  else if (squeezeScore >= 25) { risk_level = "MODERATE"; }

  return {
    ok: true,
    data: {
      squeeze_score: squeezeScore,
      risk_level,
      veto,
      flags
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:squeezeRiskDetector" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.4 — REGIME-ADAPTIVE SHORT THRESHOLD
// Dynamically adjusts the conviction threshold required for a short entry
// based on the current market regime. Bull regimes require higher evidence;
// bear/distribution regimes lower the bar.
// ═══════════════════════════════════════════════════════════════════════════
function regimeShortThreshold({ ema20, ema50, ema200, current_price, adx, vix_level = null }) {
  // Base threshold: 50 (on a 0-100 conviction scale)
  let threshold = 50;
  let regime_label = "NEUTRAL";

  // EMA structure analysis
  const isBullStructure = ema20 && ema50 && ema200 ? (ema20 > ema50 && ema50 > ema200) : false;
  const isBearStructure = ema20 && ema50 && ema200 ? (ema20 < ema50 && ema50 < ema200) : false;
  const priceAbove200 = ema200 ? current_price > ema200 : null;

  if (isBullStructure && priceAbove200) {
    // Strong bull: require very high conviction to short
    regime_label = "STRONG_BULL";
    threshold = 72;
  } else if (isBullStructure) {
    regime_label = "BULL";
    threshold = 62;
  } else if (isBearStructure && !priceAbove200) {
    // Confirmed bear: lower threshold
    regime_label = "BEAR";
    threshold = 35;
  } else if (isBearStructure) {
    regime_label = "EARLY_BEAR";
    threshold = 42;
  } else {
    // Transitional
    regime_label = "TRANSITION";
    threshold = 50;
  }

  // ADX adjustment: strong trends are harder to short against, easier to short with
  if (adx > 35 && isBullStructure) threshold += 5; // Very strong bull — raise bar
  if (adx > 35 && isBearStructure) threshold -= 5; // Very strong bear — lower bar

  // VIX adjustment: high fear = short squeezes more likely
  if (vix_level != null) {
    if (vix_level > 25) threshold += 8; // Fear regime: harder to short
    else if (vix_level < 12) threshold -= 3; // Complacency: slightly easier
  }

  threshold = clamp(threshold, 25, 85);

  return {
    ok: true,
    data: {
      short_threshold: threshold,
      regime_label,
      ema_structure: isBullStructure ? "BULL" : isBearStructure ? "BEAR" : "MIXED"
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:regimeShortThreshold" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.5 — OPTIMAL SHORT ENTRY LOCATOR
// Identifies the point of maximum asymmetry — where reward/risk ratio
// on the short side is highest. Uses resistance proximity, ATR headroom,
// and micro-structure positioning.
// ═══════════════════════════════════════════════════════════════════════════
function optimalShortEntry({
  current_price, atr_value, ema20, ema50,
  recent_high, support_level = null,
  sell_wall_price = null
}) {
  if (!current_price || !atr_value || atr_value <= 0) {
    return { ok: false, error: "insufficient_data" };
  }

  // Optimal short entry is NEAR resistance, not in the middle of nowhere
  let entry_quality = "POOR";
  let entry_score = 0;
  let optimal_entry = current_price;
  let stop_loss = null;
  let target = null;

  // Resistance proximity (how close to recent high)
  if (recent_high && recent_high > 0) {
    const distToHigh = ((recent_high - current_price) / current_price) * 100;

    if (distToHigh < 0.3) {
      // AT or above resistance — ideal short entry
      entry_score += 35;
      optimal_entry = recent_high; // Enter at resistance
      stop_loss = recent_high + atr_value * 0.5; // Stop above resistance + 0.5 ATR
    } else if (distToHigh < 1.0) {
      // Near resistance — good entry
      entry_score += 20;
      optimal_entry = current_price + (recent_high - current_price) * 0.5; // Enter on push toward resistance
      stop_loss = recent_high + atr_value * 0.5;
    } else if (distToHigh < 2.5) {
      entry_score += 8;
      stop_loss = current_price + atr_value * 1.0;
    } else {
      // Far from resistance — poor timing
      entry_score += 0;
      stop_loss = current_price + atr_value * 1.5;
    }
  } else {
    stop_loss = current_price + atr_value * 1.2;
  }

  // EMA as dynamic resistance
  if (ema20 && current_price > ema20 * 0.99 && current_price < ema20 * 1.005) {
    // Price testing EMA from below — EMA acting as resistance
    entry_score += 15;
  }

  // Sell wall as resistance confirmation
  if (sell_wall_price && sell_wall_price > current_price && sell_wall_price < current_price * 1.02) {
    entry_score += 12;
  }

  // Target calculation: next support or 2x ATR
  if (support_level && support_level < current_price) {
    target = support_level;
  } else if (ema50 && ema50 < current_price) {
    target = ema50; // Revert to EMA50
  } else {
    target = current_price - atr_value * 2.0;
  }

  // R:R ratio
  const risk = stop_loss ? Math.abs(stop_loss - optimal_entry) : atr_value;
  const reward = target ? Math.abs(optimal_entry - target) : atr_value * 2;
  const rr_ratio = risk > 0 ? reward / risk : 0;

  if (rr_ratio >= 2.5) entry_score += 20;
  else if (rr_ratio >= 1.5) entry_score += 10;

  entry_score = clamp(entry_score, 0, 100);

  if (entry_score >= 55) entry_quality = "EXCELLENT";
  else if (entry_score >= 40) entry_quality = "GOOD";
  else if (entry_score >= 25) entry_quality = "FAIR";

  return {
    ok: true,
    data: {
      entry_score,
      entry_quality,
      optimal_entry: +optimal_entry.toFixed(2),
      stop_loss: stop_loss ? +stop_loss.toFixed(2) : null,
      target: target ? +target.toFixed(2) : null,
      rr_ratio: +rr_ratio.toFixed(2)
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:optimalShortEntry" }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE S.6 — MASTER SHORT ADVISOR (COMPOSITE)
// Aggregates all sub-engines into a single conviction-weighted short advisory.
// Outputs: short_conviction (0-100), signal, entry params, and veto status.
// ═══════════════════════════════════════════════════════════════════════════
function adviseShortEntry({
  closes, highs, lows, volumes,
  current_price, rsi, rsi_history = [],
  rvol, atr_value, ema20, ema50, ema200, adx,
  pcr = null, has_real_pcr = false,
  vix_level = null, delivery_pct = null,
  sell_wall_price = null, support_level = null,
  sector_momentum_pct = 0
}) {
  if (!closes || closes.length < 25 || !current_price || current_price <= 0) {
    return { ok: false, error: "insufficient_data" };
  }

  // ── STEP 1: Run sub-engines ──
  const distOut = distributionPhaseDetector({ closes, highs, lows, volumes });
  const exhaustOut = momentumExhaustionEngine({ closes, volumes, rsi, rsi_history, ema20, adx });

  const recent_returns = [];
  for (let i = Math.max(1, closes.length - 10); i < closes.length; i++) {
    if (closes[i - 1] > 0) recent_returns.push((closes[i] - closes[i - 1]) / closes[i - 1] * 100);
  }

  const squeezeOut = squeezeRiskDetector({
    rvol, atr_value, current_price,
    pcr, has_real_pcr, recent_returns,
    sector_momentum_pct, adx, delivery_pct
  });

  const thresholdOut = regimeShortThreshold({ ema20, ema50, ema200, current_price, adx, vix_level });

  const recent_high = highs ? Math.max(...highs.slice(-10)) : current_price;
  const entryOut = optimalShortEntry({
    current_price, atr_value, ema20, ema50,
    recent_high, support_level, sell_wall_price
  });

  // ── STEP 2: Composite conviction scoring ──
  const dist_score = distOut.ok ? distOut.data.distribution_score : 0;
  const exhaust_score = exhaustOut.ok ? exhaustOut.data.exhaustion_score : 0;
  const entry_score = entryOut.ok ? entryOut.data.entry_score : 0;

  // Weighted composite — distribution and exhaustion are primary signals
  let raw_conviction = (
    dist_score * 0.35 +
    exhaust_score * 0.35 +
    entry_score * 0.30
  );

  // Squeeze penalty (reduces conviction)
  const squeeze_penalty = squeezeOut.ok ? squeezeOut.data.squeeze_score * 0.3 : 0;
  raw_conviction -= squeeze_penalty;

  const conviction = clamp(Math.round(raw_conviction), 0, 100);

  // ── STEP 3: Threshold gate ──
  const threshold = thresholdOut.ok ? thresholdOut.data.short_threshold : 50;
  const exceeds_threshold = conviction >= threshold;
  const squeezed_out = squeezeOut.ok && squeezeOut.data.veto;

  let signal = "NO_SHORT";
  let action = "STAND_ASIDE";

  if (squeezed_out) {
    signal = "SQUEEZE_VETO";
    action = "DO_NOT_SHORT";
  } else if (exceeds_threshold && conviction >= 60) {
    signal = "STRONG_SHORT";
    action = "INITIATE_SHORT";
  } else if (exceeds_threshold && conviction >= 45) {
    signal = "SHORT_SETUP";
    action = "PREPARE_SHORT_WATCH_TRIGGER";
  } else if (conviction >= 30) {
    signal = "WEAK_SHORT_DEVELOPING";
    action = "MONITOR_ONLY";
  }

  // ── STEP 4: Confidence ──
  let confidence = 40;
  if (distOut.ok && distOut.data.distribution_score > 30) confidence += 15;
  if (exhaustOut.ok && exhaustOut.data.exhaustion_score > 30) confidence += 15;
  if (has_real_pcr) confidence += 10;
  if (delivery_pct != null) confidence += 5;
  if (rsi_history.length >= 10) confidence += 5;
  confidence = clamp(confidence, 10, 95);

  return {
    ok: true,
    data: {
      short_conviction: conviction,
      signal,
      action,
      threshold_required: threshold,
      exceeds_threshold,
      confidence,
      regime: thresholdOut.ok ? thresholdOut.data.regime_label : "UNKNOWN",
      distribution: distOut.ok ? distOut.data : null,
      exhaustion: exhaustOut.ok ? exhaustOut.data : null,
      squeeze_risk: squeezeOut.ok ? squeezeOut.data : null,
      entry: entryOut.ok ? entryOut.data : null
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:adviseShortEntry" }
  };
}

module.exports = {
  distributionPhaseDetector,
  momentumExhaustionEngine,
  squeezeRiskDetector,
  regimeShortThreshold,
  optimalShortEntry,
  adviseShortEntry
};
