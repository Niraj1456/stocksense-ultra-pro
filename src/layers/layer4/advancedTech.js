// Helper functions
function rollingMax(arr, period) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) {
      result.push(Math.max(...arr.slice(0, i + 1)));
    } else {
      result.push(Math.max(...arr.slice(i - period + 1, i + 1)));
    }
  }
  return result;
}

function rollingMin(arr, period) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) {
      result.push(Math.min(...arr.slice(0, i + 1)));
    } else {
      result.push(Math.min(...arr.slice(i - period + 1, i + 1)));
    }
  }
  return result;
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Helper: Identify major swings (requires minimum percentage move)
function identifyMajorSwings(prices, min_move_pct = 5) {
  const swings = [];
  if (prices.length === 0) return swings;
  
  let current_dir = 0; // 1 for up, -1 for down
  let extreme_price = prices[0];
  let extreme_idx = 0;
  
  for (let i = 1; i < prices.length; i++) {
    const p = prices[i];
    if (current_dir === 0) {
      const move = ((p - extreme_price) / extreme_price) * 100;
      if (move >= min_move_pct) {
        current_dir = 1;
        swings.push({ type: "LOW", price: extreme_price, index: extreme_idx });
        extreme_price = p; extreme_idx = i;
      } else if (move <= -min_move_pct) {
        current_dir = -1;
        swings.push({ type: "HIGH", price: extreme_price, index: extreme_idx });
        extreme_price = p; extreme_idx = i;
      } else {
        // Expand the initial search extreme
        if (p > extreme_price) { extreme_price = p; extreme_idx = i; }
        else if (p < extreme_price) { extreme_price = p; extreme_idx = i; }
      }
    } else if (current_dir === 1) {
      if (p > extreme_price) {
        extreme_price = p; extreme_idx = i;
      } else {
        const move = ((p - extreme_price) / extreme_price) * 100;
        if (move <= -min_move_pct) {
          swings.push({ type: "HIGH", price: extreme_price, index: extreme_idx });
          current_dir = -1;
          extreme_price = p; extreme_idx = i;
        }
      }
    } else if (current_dir === -1) {
      if (p < extreme_price) {
        extreme_price = p; extreme_idx = i;
      } else {
        const move = ((p - extreme_price) / extreme_price) * 100;
        if (move >= min_move_pct) {
          swings.push({ type: "LOW", price: extreme_price, index: extreme_idx });
          current_dir = 1;
          extreme_price = p; extreme_idx = i;
        }
      }
    }
  }
  return swings;
}

// MODULE 4.1 — WYCKOFF PHASE CLASSIFIER
function wyckoffClassifier({ close_prices, high_prices, low_prices, volume, prior_trend, dates = [] }) {
  if (!close_prices || close_prices.length < 120) return { ok: false, error: "insufficient_data" };
  
  const c120 = close_prices.slice(-120);
  const h120 = high_prices.slice(-120);
  const l120 = low_prices.slice(-120);
  const v120 = volume.slice(-120);
  const d120 = dates.length >= 120 ? dates.slice(-120) : [];

  const rMax20 = rollingMax(h120, 20);
  const rMin20 = rollingMin(l120, 20);
  
  const range_width = rMax20[rMax20.length - 1] - rMin20[rMin20.length - 1];
  const range_width_pct = (range_width / rMin20[rMin20.length - 1]) * 100;
  
  const in_trading_range = range_width_pct < 15;
  
  // Find range start (simplistic: how far back has it been in this narrow band)
  let range_start_idx = 0;
  for (let i = 119; i >= 0; i--) {
    const rw = rMax20[i] - rMin20[i];
    const rp = (rw / rMin20[i]) * 100;
    if (rp >= 15) {
      range_start_idx = Math.min(i + 1, 119);
      break;
    }
  }

  const range_len = 120 - range_start_idx;
  const early_range_vol = mean(v120.slice(range_start_idx, range_start_idx + 10));
  const late_range_vol = mean(v120.slice(-10));
  const vol_expansion_recent = early_range_vol > 0 ? (late_range_vol / early_range_vol) - 1 : 0;

  const range_high = Math.max(...h120.slice(range_start_idx));
  const range_low = Math.min(...l120.slice(range_start_idx));
  
  let phase = "UNKNOWN";
  let acc_score = 0;
  let dist_score = 0;
  
  const early_down_vols = [];
  const early_up_vols = [];
  for (let i = range_start_idx + 1; i < Math.min(range_start_idx + 20, 120); i++) {
    if (c120[i] < c120[i - 1]) early_down_vols.push(v120[i]);
    if (c120[i] > c120[i - 1]) early_up_vols.push(v120[i]);
  }
  const early_down_vol = mean(early_down_vols);
  const early_up_vol = mean(early_up_vols);

  if (prior_trend === "DOWN" && in_trading_range) {
    if (early_down_vol > early_up_vol * 1.3) acc_score += 2;
    
    const late_down_vols = [];
    for (let i = range_start_idx + 41; i < 120; i++) {
      if (c120[i] < c120[i - 1]) late_down_vols.push(v120[i]);
    }
    const late_down_vol = mean(late_down_vols);
    if (late_down_vol < early_down_vol * 0.7) acc_score += 2;

    const lows_in_range = l120.slice(range_start_idx);
    if (lows_in_range.length > 0 && lows_in_range[lows_in_range.length - 1] > lows_in_range[0]) {
      acc_score += 2;
    }

    if (acc_score >= 4) phase = "ACCUMULATION";
  }

  if (prior_trend === "UP" && in_trading_range) {
    if (early_up_vol > mean(v120) * 1.3) dist_score += 2;

    const highs_in_range = h120.slice(range_start_idx);
    if (highs_in_range.length > 0 && highs_in_range[highs_in_range.length - 1] < highs_in_range[0]) {
      dist_score += 2;
    }

    if (dist_score >= 3) phase = "DISTRIBUTION";
  }

  const slope_60 = (c120[119] - c120[59]) / c120[59];
  const volume_trend_positive = mean(v120.slice(-30)) > mean(v120.slice(-60, -30));

  if (!in_trading_range) {
    if (slope_60 > 0.10 && volume_trend_positive) {
      phase = prior_trend === "ACCUMULATION" ? "MARKUP" : "MARKUP_LATE";
    }
  }

  if (slope_60 < -0.10) {
    phase = "MARKDOWN";
  }

  let spring_detected = false;
  let spring_pts = 0;
  let spring_date = null;
  
  let upthrust_detected = false;
  let upthrust_pts = 0;

  for (let i = 90; i < 120; i++) {
    // Spring
    if (l120[i] < range_low * 0.998 && c120[i] > range_low && v120[i] > mean(v120) * 1.5) {
      spring_detected = true;
      spring_pts = 8;
      spring_date = d120[i] || null;
    }
    // Upthrust
    if (h120[i] > range_high * 1.002 && c120[i] < range_high && v120[i] > mean(v120) * 1.5) {
      upthrust_detected = true;
      upthrust_pts = -8;
    }
  }

  let volume_climax = false;
  for (let i = 100; i < 120; i++) {
    const vol_spike = v120[i] > mean(v120) * 3.0;
    const down_day = c120[i] < (c120[i-1] || c120[i]); // proxy for open
    const recovery = c120[i] > (l120[i] + (h120[i] - l120[i]) * 0.5);
    if (vol_spike && down_day && recovery) {
      volume_climax = true;
    }
  }

  const accumulation_range_width = range_high - range_low;
  const markup_target_min = range_high + accumulation_range_width * 1.5;
  const markup_target_max = range_high + accumulation_range_width * 2.5;

  return {
    ok: true,
    data: {
      phase,
      phase_confidence: in_trading_range ? (acc_score > 0 ? acc_score/8 : dist_score/8) : 1.0,
      spring_detected,
      spring_pts,
      spring_date,
      upthrust_detected,
      upthrust_pts,
      volume_climax,
      markup_target_min,
      markup_target_max
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:wyckoffClassifier" }
  };
}

// MODULE 4.2 — ELLIOTT WAVE POSITION CLASSIFIER
function elliottWaveClassifier({ close_prices }) {
  if (!close_prices || close_prices.length < 250) return { ok: false, error: "insufficient_data" };
  
  const c250 = close_prices.slice(-250);
  
  const wave_start_price = Math.min(...c250);
  const wave_start_idx = c250.indexOf(wave_start_price);

  const major_swings = identifyMajorSwings(c250.slice(wave_start_idx), 5);
  
  const waves = [];
  let expected_type = "HIGH";
  for (const s of major_swings) {
    if (s.type === expected_type) {
      waves.push(s.price);
      expected_type = expected_type === "HIGH" ? "LOW" : "HIGH";
    }
  }

  let count_invalid = false;
  let invalidation_reason = null;

  // Wave 2 Rule
  if (waves.length >= 2) {
    const wave_1_end = waves[0];
    const wave_2_end = waves[1];
    const retracement = (wave_1_end - wave_2_end) / (wave_1_end - wave_start_price);
    if (retracement > 1.0) {
      count_invalid = true;
      invalidation_reason = "WAVE_2_EXCEEDED_WAVE_1_START";
    }
  }

  // Wave 3 Rule (Not shortest)
  if (waves.length >= 4) {
    const w1_length = waves[0] - wave_start_price;
    const w3_length = waves[2] - waves[1];
    const w5_length = c250[c250.length - 1] - waves[3];
    if (w3_length < w1_length && w3_length < w5_length) {
      count_invalid = true;
      invalidation_reason = "WAVE_3_IS_SHORTEST";
    }
  }

  // Wave 4 Rule (No overlap with Wave 1)
  if (waves.length >= 4) {
    if (waves[3] < waves[0]) {
      count_invalid = true;
      invalidation_reason = "WAVE_4_OVERLAPS_WAVE_1";
    }
  }

  let current_position = null;
  let wave_type = "UNKNOWN";
  let pts = 0;
  let label = "WAVE_COUNT_UNCLEAR";
  let warning = null;
  let action = null;
  let fibonacci_target = null;

  if (!count_invalid && waves.length < 5) {
    current_position = waves.length + 1;
    if ([1, 3, 5].includes(current_position)) wave_type = "IMPULSIVE";
    if ([2, 4].includes(current_position)) wave_type = "CORRECTIVE";

    if (current_position === 1) {
      pts = 3; label = "WAVE_1_EARLY_ENTRY";
      warning = "Highest failure rate";
    } else if (current_position === 2) {
      const w1_len = waves[0] - wave_start_price;
      const ret_pct = (waves[0] - c250[c250.length - 1]) / w1_len;
      if (ret_pct >= 0.50 && ret_pct <= 0.618) {
        pts = 5; label = "WAVE_2_PRIME_ENTRY";
      } else {
        pts = 3; label = "WAVE_2_IN_PROGRESS";
      }
      fibonacci_target = wave_start_price + w1_len * 1.618;
    } else if (current_position === 3) {
      pts = 6; label = "WAVE_3_RIDE_WITH_TRAIL";
    } else if (current_position === 4) {
      pts = -2; label = "WAVE_4_AVOID_CHOP"; action = "WAIT_FOR_WAVE_5_SETUP";
    } else if (current_position === 5) {
      pts = 4; label = "WAVE_5_LATE_STAGE";
      const w1_len = waves[0] - wave_start_price;
      fibonacci_target = waves[2] + w1_len * 1.0;
    }
  } else {
    action = "USE_WYCKOFF_PHASE_ONLY";
  }

  return {
    ok: true,
    data: {
      wave_position: current_position,
      wave_type,
      pts,
      label,
      count_valid: !count_invalid,
      invalidation_reason,
      fibonacci_target,
      warning,
      action
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:elliottWaveClassifier" }
  };
}

// MODULE 4.3 — FIBONACCI CONFLUENCE ENGINE
function fibonacciConfluence({ swing_high, swing_low, current_price, ema_levels, poc, vah, val, max_pain, buy_wall_price, atr_target_2, wave_target }) {
  if (!swing_high || !swing_low || swing_high <= swing_low) return { ok: false, error: "invalid_swing_points" };

  const swing_range = swing_high - swing_low;
  
  const fib_retracements = {
    "23.6": swing_high - swing_range * 0.236,
    "38.2": swing_high - swing_range * 0.382,
    "50.0": swing_high - swing_range * 0.500,
    "61.8": swing_high - swing_range * 0.618,
    "78.6": swing_high - swing_range * 0.786,
    "100.0": swing_low
  };

  const fib_extensions = {
    "100.0": swing_low + swing_range * 1.000,
    "127.2": swing_low + swing_range * 1.272,
    "161.8": swing_low + swing_range * 1.618,
    "261.8": swing_low + swing_range * 2.618
  };

  const confluence_threshold = current_price * 0.005;

  const all_levels = [];
  Object.entries(fib_retracements).forEach(([k, v]) => all_levels.push({ name: `Fib Ret ${k}`, price: v }));
  Object.entries(fib_extensions).forEach(([k, v]) => all_levels.push({ name: `Fib Ext ${k}`, price: v }));
  
  if (ema_levels?.ema20) all_levels.push({ name: "EMA 20", price: ema_levels.ema20 });
  if (ema_levels?.ema50) all_levels.push({ name: "EMA 50", price: ema_levels.ema50 });
  if (ema_levels?.ema200) all_levels.push({ name: "EMA 200", price: ema_levels.ema200 });
  
  if (poc) all_levels.push({ name: "VP POC", price: poc });
  if (vah) all_levels.push({ name: "VP VAH", price: vah });
  if (val) all_levels.push({ name: "VP VAL", price: val });
  if (max_pain) all_levels.push({ name: "Max Pain", price: max_pain });
  if (buy_wall_price) all_levels.push({ name: "Buy Wall", price: buy_wall_price });
  if (atr_target_2) all_levels.push({ name: "ATR T2", price: atr_target_2 });
  if (wave_target) all_levels.push({ name: "Wave Target", price: wave_target });
  
  all_levels.push({ name: "Round 50", price: Math.round(current_price / 50) * 50 });
  all_levels.push({ name: "Round 100", price: Math.round(current_price / 100) * 100 });

  const confluence_zones = {};

  for (let i = 0; i < all_levels.length; i++) {
    for (let j = i + 1; j < all_levels.length; j++) {
      const a = all_levels[i];
      const b = all_levels[j];
      
      if (Math.abs(a.price - b.price) < confluence_threshold) {
        const zone_key = Math.round((a.price + b.price) / 2);
        if (!confluence_zones[zone_key]) {
          confluence_zones[zone_key] = { price: zone_key, factors: [], count: 0 };
        }
        const factorStr = `${a.name} + ${b.name}`;
        if (!confluence_zones[zone_key].factors.includes(factorStr)) {
          confluence_zones[zone_key].factors.push(factorStr);
        }
        confluence_zones[zone_key].count += 1; // Simplistic count
      }
    }
  }

  const sorted_zones = Object.values(confluence_zones).map(z => {
    // Normalizing count based on unique sources would be better, but we stick to pairs count heuristic
    if (z.count >= 4) { z.rating = "EXTREME"; z.pts = 6; z.label = "INSTITUTIONAL_PRICE_MAGNET"; }
    else if (z.count === 3) { z.rating = "STRONG"; z.pts = 4; z.label = "TRIPLE_CONFLUENCE"; }
    else if (z.count <= 2) { z.rating = "MODERATE"; z.pts = 2; z.label = "DOUBLE_CONFLUENCE"; }
    return z;
  }).sort((a, b) => b.count - a.count);

  const best_support = sorted_zones.find(z => z.price < current_price) || null;
  const best_resistance = sorted_zones.find(z => z.price > current_price) || null;
  const best_target = atr_target_2 ? sorted_zones.find(z => Math.abs(z.price - atr_target_2) / atr_target_2 <= 0.03) || null : null;

  const max_confluence_pts = sorted_zones.length > 0 ? sorted_zones[0].pts : 0;

  return {
    ok: true,
    data: {
      fib_retracements,
      fib_extensions,
      confluence_zones: sorted_zones,
      best_support,
      best_resistance,
      best_target,
      max_confluence_pts
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:fibonacciConfluence" }
  };
}

module.exports = {
  wyckoffClassifier,
  elliottWaveClassifier,
  fibonacciConfluence
};
