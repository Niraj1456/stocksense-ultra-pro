// MODULE 2.1 — ORDER BOOK IMBALANCE SCORE
function orderBookImbalance({ depth }) {
  if (!depth) return { ok: false, error: "depth_missing" };
  
  const bids = depth?.buy || depth?.bids || [];
  const asks = depth?.sell || depth?.asks || [];
  
  // Normalize fields
  const parsedBids = bids.map((b, i) => ({
    price: Number(b?.price || 0),
    quantity: Number(b?.quantity ?? b?.qty ?? 0)
  }));
  const parsedAsks = asks.map((a, i) => ({
    price: Number(a?.price || 0),
    quantity: Number(a?.quantity ?? a?.qty ?? 0)
  }));

  const total_bid_qty = parsedBids.reduce((s, b) => s + b.quantity, 0);
  const total_ask_qty = parsedAsks.reduce((s, a) => s + a.quantity, 0);
  const total_qty = total_bid_qty + total_ask_qty;
  
  const raw_obi = total_qty > 0 ? ((total_bid_qty - total_ask_qty) / total_qty) * 100 : 0;

  // Weighted OBI
  let weighted_bid = 0;
  let weighted_ask = 0;
  
  parsedBids.forEach((b, i) => {
    const weight = 1 / (i + 1);
    weighted_bid += b.quantity * weight;
  });
  
  parsedAsks.forEach((a, i) => {
    const weight = 1 / (i + 1);
    weighted_ask += a.quantity * weight;
  });

  const total_weighted = weighted_bid + weighted_ask;
  const weighted_obi = total_weighted > 0 ? ((weighted_bid - weighted_ask) / total_weighted) * 100 : 0;

  let signal = "BALANCED";
  let pts = 0;

  if (weighted_obi > 40) {
    signal = "STRONG_BUY_PRESSURE";
    pts = 3;
  } else if (weighted_obi > 15 && weighted_obi <= 40) {
    signal = "MILD_BUY_PRESSURE";
    pts = 1;
  } else if (weighted_obi >= -15 && weighted_obi <= 15) {
    signal = "BALANCED";
    pts = 0;
  } else if (weighted_obi < -15 && weighted_obi >= -40) {
    signal = "MILD_SELL_PRESSURE";
    pts = -1;
  } else if (weighted_obi < -40) {
    signal = "STRONG_SELL_PRESSURE";
    pts = -3;
  }

  return {
    ok: true,
    data: {
      inputs: { total_bid_qty, total_ask_qty },
      raw_obi,
      weighted_obi,
      signal,
      pts
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:orderBookImbalance" }
  };
}

// MODULE 2.2 — WALL DETECTION LOGIC
function wallDetection({ depth, current_price }) {
  if (!depth) return { ok: false, error: "depth_missing" };

  const bids = depth?.buy || depth?.bids || [];
  const asks = depth?.sell || depth?.asks || [];

  const parsedBids = bids.map((b) => ({ price: Number(b?.price || 0), quantity: Number(b?.quantity ?? b?.qty ?? 0) }));
  const parsedAsks = asks.map((a) => ({ price: Number(a?.price || 0), quantity: Number(a?.quantity ?? a?.qty ?? 0) }));

  const allLevels = [...parsedBids, ...parsedAsks];
  if (allLevels.length === 0) return { ok: false, error: "no_levels_data" };

  const avg_level_qty = allLevels.reduce((s, x) => s + x.quantity, 0) / allLevels.length;
  const wall_threshold_multiplier = 3.0;
  const wall_threshold = avg_level_qty * wall_threshold_multiplier;

  const sell_walls = parsedAsks.filter(a => a.quantity > wall_threshold).map(a => ({
    price: a.price,
    quantity: a.quantity,
    strength: a.quantity / avg_level_qty
  }));

  const buy_walls = parsedBids.filter(b => b.quantity > wall_threshold).map(b => ({
    price: b.price,
    quantity: b.quantity,
    strength: b.quantity / avg_level_qty
  }));

  // Nearest sell wall (lowest price above current_price)
  const valid_sell_walls = current_price ? sell_walls.filter(w => w.price > current_price) : sell_walls;
  const nearest_sell_wall = valid_sell_walls.length > 0 ? valid_sell_walls.reduce((prev, curr) => prev.price < curr.price ? prev : curr) : null;

  // Nearest buy wall (highest price below current_price)
  const valid_buy_walls = current_price ? buy_walls.filter(w => w.price < current_price) : buy_walls;
  const nearest_buy_wall = valid_buy_walls.length > 0 ? valid_buy_walls.reduce((prev, curr) => prev.price > curr.price ? prev : curr) : null;

  let sell_wall_signal = null;
  let set_target_below_wall = false;
  let target_ceiling = null;

  if (nearest_sell_wall && nearest_sell_wall.strength > 5) {
    sell_wall_signal = "MAJOR_RESISTANCE";
    set_target_below_wall = true;
    target_ceiling = nearest_sell_wall.price * 0.998;
  }

  let buy_wall_signal = null;
  let tighten_sl_to = null;

  if (nearest_buy_wall && nearest_buy_wall.strength > 5) {
    buy_wall_signal = "STRONG_SUPPORT";
    tighten_sl_to = nearest_buy_wall.price * 0.998;
  }

  return {
    ok: true,
    data: {
      inputs: { avg_level_qty, current_price },
      sell_walls,
      buy_walls,
      nearest_sell_wall,
      nearest_buy_wall,
      sell_wall_signal,
      set_target_below_wall,
      target_ceiling,
      buy_wall_signal,
      tighten_sl_to
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:wallDetection" }
  };
}

// MODULE 2.3 — WALL ABSORPTION TRACKER
function wallAbsorption({ wall_price, wall_qty_initial, wall_qty_current, time_elapsed_secs, price_at_wall }) {
  const qty_absorbed = wall_qty_initial - wall_qty_current;
  const absorption_pct = wall_qty_initial > 0 ? (qty_absorbed / wall_qty_initial) * 100 : 0;

  const qty_per_minute = time_elapsed_secs > 0 ? qty_absorbed / (time_elapsed_secs / 60) : 0;
  
  let time_remaining_mins = null;
  if (qty_per_minute > 0) {
    time_remaining_mins = wall_qty_current / qty_per_minute;
  }

  let signal = "WALL_HOLDING";
  let pts = 0;
  let urgency = null;

  if (absorption_pct >= 70 && price_at_wall) {
    signal = "BREAKOUT_IMMINENT";
    urgency = "CRITICAL";
    pts = 5;
  } else if (absorption_pct >= 50 && absorption_pct < 70) {
    signal = "ABSORPTION_STRONG";
    pts = 3;
  } else if (absorption_pct >= 25 && absorption_pct < 50) {
    signal = "ABSORPTION_MODERATE";
    pts = 1;
  }

  return {
    ok: true,
    data: {
      absorption_pct,
      absorption_speed: qty_per_minute,
      time_to_break_estimate: time_remaining_mins,
      signal,
      pts,
      urgency
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:wallAbsorption" }
  };
}

// Helper math for algo vs retail
function variance(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
}

function stddev(arr) {
  return Math.sqrt(variance(arr));
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// MODULE 2.4 — ALGO vs RETAIL CLASSIFIER
function algoRetailClassifier({ tick_series = [], spread_series = [], volume_per_candle = [], tick_intervals = [] }) {
  const avg_spread = mean(spread_series);
  const avg_tick = mean(tick_series);
  const spread_pct = avg_tick > 0 ? (avg_spread / avg_tick) * 100 : Number.MAX_VALUE;

  const avg_vol = mean(volume_per_candle);
  const volume_cv = avg_vol > 0 ? stddev(volume_per_candle) / avg_vol : Number.MAX_VALUE;

  const avg_tick_interval = mean(tick_intervals);
  const tick_cv = avg_tick_interval > 0 ? stddev(tick_intervals) / avg_tick_interval : Number.MAX_VALUE;

  let algo_score = 0;
  if (spread_pct < 0.05) algo_score += 2;
  if (spread_pct < 0.03) algo_score += 1;
  if (volume_cv < 0.3) algo_score += 2;
  if (tick_cv < 0.4) algo_score += 2;

  let type = "RETAIL_DRIVEN";
  let sl_adjustment = 0.3;
  let sl_note = "More volatile. Widen SL by 0.3× ATR.";

  if (algo_score >= 5) {
    type = "ALGO_DOMINANT";
    sl_adjustment = 0;
    sl_note = "Trade with trend only. Do not fade.";
  } else if (algo_score >= 3 && algo_score < 5) {
    type = "MIXED";
    sl_adjustment = 0;
    sl_note = "Standard approach.";
  }

  return {
    ok: true,
    data: {
      type,
      algo_score,
      sl_adjustment,
      sl_note,
      metrics: { spread_pct, volume_cv, tick_cv }
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:algoRetailClassifier" }
  };
}

// MODULE 2.5 — ICEBERG DETECTION LOGIC
function icebergDetection({ level_qty_history = [], trades_at_level = [], level_price, current_price }) {
  let replenishment_events = 0;
  let estimated_total_size = 0;

  for (let i = 1; i < level_qty_history.length; i++) {
    const qty_drop = level_qty_history[i - 1] - level_qty_history[i];
    const trade_vol = trades_at_level[i] || 0;
    if (qty_drop > 0 && trade_vol > 0) {
      // Check if replenished in the current or next step (simplifying to current step logic mapped from pseudo)
      if (level_qty_history[i] >= level_qty_history[i - 1] * 0.8) {
        replenishment_events += 1;
      }
    }
  }

  let iceberg_detected = false;
  let side = null;
  let confidence = null;
  let interpretation = null;

  if (replenishment_events >= 3) {
    iceberg_detected = true;
    const total_trades = trades_at_level.reduce((a, b) => a + b, 0);
    const last_qty = level_qty_history.length > 0 ? level_qty_history[level_qty_history.length - 1] : 0;
    estimated_total_size = total_trades + last_qty;
    
    confidence = Math.min((replenishment_events / 5) * 100, 95);

    if (level_price > current_price) {
      side = "ASK";
      interpretation = "HIDDEN_DISTRIBUTION";
    } else {
      side = "BID";
      interpretation = "HIDDEN_ACCUMULATION";
    }
  }

  return {
    ok: true,
    data: {
      iceberg_detected,
      side,
      estimated_total_size: iceberg_detected ? estimated_total_size : null,
      confidence,
      interpretation
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:icebergDetection" }
  };
}

module.exports = {
  orderBookImbalance,
  wallDetection,
  wallAbsorption,
  algoRetailClassifier,
  icebergDetection
};
