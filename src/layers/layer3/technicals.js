const { EMA, RSI, MACD, ATR, ADX } = require("technicalindicators");

// Helpers
function findSwingHighs(prices, window = 5) {
  const swings = [];
  for (let i = window; i < prices.length - window; i++) {
    const isHigh = prices.slice(i - window, i).every(p => prices[i] > p) &&
                   prices.slice(i + 1, i + window + 1).every(p => prices[i] > p);
    if (isHigh) swings.push({ index: i, price: prices[i] });
  }
  return swings;
}

function findSwingLows(prices, window = 5) {
  const swings = [];
  for (let i = window; i < prices.length - window; i++) {
    const isLow = prices.slice(i - window, i).every(p => prices[i] < p) &&
                  prices.slice(i + 1, i + window + 1).every(p => prices[i] < p);
    if (isLow) swings.push({ index: i, price: prices[i] });
  }
  return swings;
}

// MODULE 3.1 — RSI CALCULATION & DIVERGENCE DETECTION
function rsiEngine({ close_prices }) {
  if (!close_prices || close_prices.length < 28) return { ok: false, error: "insufficient_data" };
  
  const rsi_arr = RSI.calculate({ period: 14, values: close_prices });
  const rsi_value = rsi_arr[rsi_arr.length - 1];
  
  let zone = "NEUTRAL";
  let pts = 0;
  let flag = null;

  if (rsi_value < 20) { zone = "EXTREME_OVERSOLD"; pts = 5; }
  else if (rsi_value >= 20 && rsi_value < 30) { zone = "OVERSOLD"; pts = 4; }
  else if (rsi_value >= 30 && rsi_value < 40) { zone = "APPROACHING_OVERSOLD"; pts = 3; }
  else if (rsi_value >= 40 && rsi_value < 60) { zone = "NEUTRAL"; pts = 3; }
  else if (rsi_value >= 60 && rsi_value < 70) { zone = "MOMENTUM"; pts = 6; }
  else if (rsi_value >= 70 && rsi_value < 80) { zone = "OVERBOUGHT"; pts = 4; flag = "OVERBOUGHT_RISK"; }
  else if (rsi_value >= 80) { zone = "EXTREME_OVERBOUGHT"; pts = 2; flag = "OVERBOUGHT_EXTREME"; }

  // Divergence Detection
  const price_highs = findSwingHighs(close_prices, 5);
  const price_lows = findSwingLows(close_prices, 5);
  
  let bearish_divergence = false;
  let bullish_divergence = false;
  let divergence_confidence = null;

  // Align RSI array index with close_prices index (RSI array is shorter by 14)
  const getRSI = (idx) => {
    const rsiIdx = idx - 14;
    return rsiIdx >= 0 && rsiIdx < rsi_arr.length ? rsi_arr[rsiIdx] : null;
  };

  if (price_highs.length >= 2) {
    const last = price_highs[price_highs.length - 1];
    const prev = price_highs[price_highs.length - 2];
    if (last.price > prev.price) {
      const rsiLast = getRSI(last.index);
      const rsiPrev = getRSI(prev.index);
      if (rsiLast !== null && rsiPrev !== null && rsiLast < rsiPrev) {
        bearish_divergence = true;
        pts = Math.max(0, pts - 4);
        flag = "BEARISH_DIVERGENCE_DETECTED";
      }
    }
  }

  if (price_lows.length >= 2) {
    const last = price_lows[price_lows.length - 1];
    const prev = price_lows[price_lows.length - 2];
    if (last.price < prev.price) {
      const rsiLast = getRSI(last.index);
      const rsiPrev = getRSI(prev.index);
      if (rsiLast !== null && rsiPrev !== null && rsiLast > rsiPrev) {
        bullish_divergence = true;
        pts += 3;
        flag = "BULLISH_DIVERGENCE_DETECTED";
      }
    }
  }

  return {
    ok: true,
    data: { rsi_value, zone, pts, bearish_divergence, bullish_divergence, flag, divergence_confidence },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:rsiEngine" }
  };
}

// MODULE 3.2 — MACD CALCULATION & SIGNAL LOGIC
function macdEngine({ close_prices }) {
  if (!close_prices || close_prices.length < 35) return { ok: false, error: "insufficient_data" };
  
  const macd_arr = MACD.calculate({
    values: close_prices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false
  });

  const last = macd_arr[macd_arr.length - 1];
  const prev = macd_arr[macd_arr.length - 2];
  
  const macd_line = last.MACD;
  const signal_line = last.signal;
  const histogram = last.histogram;

  let histogram_direction = (histogram > prev.histogram) ? "EXPANDING" : "CONTRACTING";
  
  let crossover = null;
  let pts = 0;
  let flag = null;
  let composite_deduction = 0;
  let label = null;
  
  if (prev.MACD < prev.signal && last.MACD > last.signal) crossover = "BULLISH";
  if (prev.MACD > prev.signal && last.MACD < last.signal) crossover = "BEARISH";

  if (crossover === "BULLISH") pts += 2;

  if (histogram > 0 && histogram_direction === "EXPANDING") pts += 6;
  if (histogram > 0 && histogram_direction === "CONTRACTING") { pts += 2; flag = "MOMENTUM_EXHAUSTION"; }
  if (histogram < 0 && histogram_direction === "CONTRACTING") { pts += 1; label = "POTENTIAL_REVERSAL"; }
  if (histogram < 0 && histogram_direction === "EXPANDING") { pts = 0; composite_deduction = -2; }

  // MACD Divergence
  const price_highs = findSwingHighs(close_prices, 5);
  let macd_bearish_divergence = false;
  
  const getMACD = (idx) => {
    const mIdx = idx - 26 - 9 + 1; // Approx alignment
    return mIdx >= 0 && mIdx < macd_arr.length ? macd_arr[mIdx].MACD : null;
  };

  if (price_highs.length >= 2) {
    const h1 = price_highs[price_highs.length - 1];
    const h2 = price_highs[price_highs.length - 2];
    if (h1.price > h2.price) {
      const m1 = getMACD(h1.index);
      const m2 = getMACD(h2.index);
      if (m1 !== null && m2 !== null && m1 < m2) {
        macd_bearish_divergence = true;
        pts = Math.max(0, pts - 3);
        flag = "BEARISH_MACD_DIVERGENCE";
      }
    }
  }

  return {
    ok: true,
    data: { macd_line, signal_line, histogram, histogram_direction, crossover, pts, macd_bearish_divergence, flag, label, composite_deduction },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:macdEngine" }
  };
}

// MODULE 3.3 — EMA CALCULATION & POSITION LOGIC
function emaEngine({ close_prices, current_price }) {
  if (!close_prices || close_prices.length < 200) return { ok: false, error: "insufficient_data" };
  
  const ema20_arr = EMA.calculate({ period: 20, values: close_prices });
  const ema50_arr = EMA.calculate({ period: 50, values: close_prices });
  const ema200_arr = EMA.calculate({ period: 200, values: close_prices });

  const ema20 = ema20_arr[ema20_arr.length - 1];
  const ema50 = ema50_arr[ema50_arr.length - 1];
  const ema200 = ema200_arr[ema200_arr.length - 1];

  const slope20 = ema20_arr[ema20_arr.length - 1] - ema20_arr[ema20_arr.length - 5];
  const slope50 = ema50_arr[ema50_arr.length - 1] - ema50_arr[ema50_arr.length - 5];
  const slope200 = ema200_arr[ema200_arr.length - 1] - ema200_arr[ema200_arr.length - 5];

  let total_ema_pts = 0;
  let target_reduction = 0;
  let labels = [];

  if (current_price > ema20 && slope20 > 0) { labels.push("PRICE_ABOVE_RISING_EMA20"); total_ema_pts += 5; }
  else if (current_price > ema20 && current_price < ema20_arr[ema20_arr.length - 3]) { labels.push("EMA_RECLAIM"); total_ema_pts += 7; }
  else if (current_price < ema20) { labels.push("PRICE_BELOW_EMA20"); target_reduction = 0.10; }

  if (current_price > ema50) total_ema_pts += 3;
  if (current_price > ema200) total_ema_pts += 2;

  let golden_cross = false;
  let death_cross = false;
  let cross_imminent = false;
  let alert = null;
  
  const e50_prev = ema50_arr[ema50_arr.length - 2];
  const e200_prev = ema200_arr[ema200_arr.length - 2];

  if (e50_prev < e200_prev && ema50 > ema200) { golden_cross = true; total_ema_pts += 5; }
  if (e50_prev > e200_prev && ema50 < ema200) { death_cross = true; total_ema_pts -= 5; }

  const gap_pct = Math.abs(ema50 - ema200) / ema200 * 100;
  if (gap_pct < 1.0 && !golden_cross && !death_cross) {
    cross_imminent = true;
    alert = "CROSS_IMMINENT";
  }

  return {
    ok: true,
    data: { ema20, ema50, ema200, slope20, slope50, slope200, total_ema_pts, golden_cross, death_cross, cross_imminent, target_reduction, labels, alert },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:emaEngine" }
  };
}

// MODULE 3.4 — ATR CALCULATION & RISK LEVELS
function atrEngine({ high_prices, low_prices, close_prices, entry_price, vix_regime }) {
  if (!close_prices || close_prices.length < 15) return { ok: false, error: "insufficient_data" };
  
  const atr_arr = ATR.calculate({ period: 14, high: high_prices, low: low_prices, close: close_prices });
  const atr_current = atr_arr[atr_arr.length - 1];
  
  const atr_10d = atr_arr.slice(-10);
  const atr_10d_avg = atr_10d.reduce((a, b) => a + b, 0) / atr_10d.length;

  let atr_regime = "STABLE";
  let breakout_confirmation = false;
  let reversal_warning = false;

  if (atr_current > atr_10d_avg * 1.2) { atr_regime = "EXPANDING"; breakout_confirmation = true; }
  if (atr_current < atr_10d_avg * 0.8) { atr_regime = "CONTRACTING"; reversal_warning = true; }

  let sl_mult = 1.5;
  if (vix_regime === "CAUTION") sl_mult = 1.75;
  if (vix_regime === "FEAR") sl_mult = 2.0;
  if (vix_regime === "HIGH_FEAR" || vix_regime === "VETO") sl_mult = 2.5;

  const stop_loss = entry_price - (atr_current * sl_mult);
  const target_1 = entry_price + (atr_current * 1.5);
  const target_2 = entry_price + (atr_current * 2.25);
  const rr_ratio = (target_2 - entry_price) / (entry_price - stop_loss);

  let valid_setup = true;
  let action = null;
  if (rr_ratio < 1.5) { valid_setup = false; action = "DO_NOT_TRADE"; }

  const trail_stages = {
    stage_1: { trigger: entry_price + atr_current * 1.0, sl: entry_price },
    stage_2: { trigger: entry_price + atr_current * 2.0, sl: entry_price + atr_current * 0.5 },
    stage_3: { trigger: entry_price + atr_current * 3.0, sl: entry_price + atr_current * 1.0 }
  };

  return {
    ok: true,
    data: { atr: atr_current, atr_regime, stop_loss, target_1, target_2, rr_ratio, valid_setup, action, trail_stages, breakout_confirmation, reversal_warning },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:atrEngine" }
  };
}

// MODULE 3.5 — RVOL CALCULATION
function rvolEngine({ volume_today, volume_history, session_time_pct, total_day_volume, vol_90d_avg }) {
  const avg_hist_vol = volume_history.reduce((a, b) => a + b, 0) / Math.max(1, volume_history.length);
  const expected_volume_by_now = avg_hist_vol * (session_time_pct / 100);
  
  const rvol_current = expected_volume_by_now > 0 ? volume_today / expected_volume_by_now : 0;
  const rvol_daily = avg_hist_vol > 0 ? total_day_volume / avg_hist_vol : 0;
  const rvol_90d = vol_90d_avg > 0 ? total_day_volume / vol_90d_avg : 0;

  let pts = 0;
  let signal = "";
  let badge = null;
  let flag = null;
  let veto_trigger = null;

  if (rvol_current > 2.5) { pts = 15; badge = "VOLUME_SURGE_CONFIRMED"; signal = "INSTITUTIONAL_SURGE"; }
  else if (rvol_current >= 2.0 && rvol_current <= 2.5) { pts = 12; signal = "STRONG_INSTITUTIONAL"; }
  else if (rvol_current >= 1.5 && rvol_current < 2.0) { pts = 8; signal = "VALID_BREAKOUT_VOLUME"; }
  else if (rvol_current >= 1.0 && rvol_current < 1.5) { pts = 4; signal = "WEAK_CONVICTION"; }
  else if (rvol_current >= 0.8 && rvol_current < 1.0) { pts = 0; flag = "LOW_VOLUME_SIGNAL_UNRELIABLE"; }
  else if (rvol_current < 0.8) { pts = 0; veto_trigger = "V5"; }

  return {
    ok: true,
    data: { rvol_current, rvol_daily, rvol_90d, pts, signal, badge, flag, veto_trigger },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:rvolEngine" }
  };
}

// MODULE 3.6 — ADX TREND STRENGTH
function adxEngine({ high_prices, low_prices, close_prices }) {
  if (!close_prices || close_prices.length < 15) return { ok: false, error: "insufficient_data" };
  
  const adx_arr = ADX.calculate({ period: 14, high: high_prices, low: low_prices, close: close_prices });
  const latest = adx_arr[adx_arr.length - 1];

  const adx = latest.adx;
  const plus_di = latest.pdi;
  const minus_di = latest.mdi;

  let strength = "";
  let signal_reliability = "";
  let suppress_momentum_signals = false;
  let flag = null;

  if (adx > 40) { strength = "VERY_STRONG_TREND"; signal_reliability = "HIGH"; }
  else if (adx >= 25 && adx <= 40) { strength = "STRONG_TREND"; signal_reliability = "HIGH"; }
  else if (adx >= 20 && adx < 25) { strength = "DEVELOPING_TREND"; signal_reliability = "MODERATE"; }
  else if (adx < 20) { strength = "CHOPPY_NO_TREND"; signal_reliability = "LOW"; suppress_momentum_signals = true; flag = "CHOPPY_MARKET_SIGNALS_UNRELIABLE"; }

  let direction = "SIDEWAYS";
  if (plus_di > minus_di && adx > 20) direction = "BULLISH_TREND";
  if (minus_di > plus_di && adx > 20) direction = "BEARISH_TREND";

  return {
    ok: true,
    data: { adx, plus_di, minus_di, strength, direction, signal_reliability, suppress_momentum_signals, flag },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:adxEngine" }
  };
}

// MODULE 3.7 — VOLUME PROFILE ENGINE
function volumeProfileEngine({ price_volume_pairs, price_bins = 100, current_price, rvol, atr_target_2 }) {
  if (!price_volume_pairs || price_volume_pairs.length === 0) return { ok: false, error: "no_data" };

  const price_min = Math.min(...price_volume_pairs.map(p => p.price));
  const price_max = Math.max(...price_volume_pairs.map(p => p.price));
  const bin_size = (price_max - price_min) / price_bins;

  const volume_at_price = new Array(price_bins).fill(0);
  
  price_volume_pairs.forEach(c => {
    let bin = Math.floor((c.price - price_min) / bin_size);
    if (bin >= price_bins) bin = price_bins - 1;
    volume_at_price[bin] += c.volume;
  });

  const max_vol = Math.max(...volume_at_price);
  const poc_bin = volume_at_price.indexOf(max_vol);
  const poc = price_min + (poc_bin * bin_size) + (bin_size / 2);

  const total_volume = volume_at_price.reduce((a, b) => a + b, 0);
  const target_volume = total_volume * 0.70;
  
  let accumulated = volume_at_price[poc_bin];
  let upper_bin = poc_bin;
  let lower_bin = poc_bin;

  while (accumulated < target_volume && (upper_bin < price_bins - 1 || lower_bin > 0)) {
    const upper_add = upper_bin < price_bins - 1 ? volume_at_price[upper_bin + 1] : -1;
    const lower_add = lower_bin > 0 ? volume_at_price[lower_bin - 1] : -1;
    
    if (upper_add >= lower_add && upper_add >= 0) {
      upper_bin += 1;
      accumulated += upper_add;
    } else if (lower_add >= 0) {
      lower_bin -= 1;
      accumulated += lower_add;
    } else {
      break;
    }
  }

  const vah = price_min + (upper_bin * bin_size) + bin_size;
  const val = price_min + (lower_bin * bin_size);

  const mean_vol = total_volume / price_bins;
  const lvn_threshold = mean_vol * 0.3;
  const hvn_threshold = mean_vol * 1.5;

  const bin_to_price = (i) => price_min + (i * bin_size) + (bin_size / 2);
  const lvn_zones = [];
  const hvn_zones = [];
  
  for (let i = 0; i < price_bins; i++) {
    if (volume_at_price[i] < lvn_threshold) lvn_zones.push(bin_to_price(i));
    if (volume_at_price[i] > hvn_threshold) hvn_zones.push(bin_to_price(i));
  }

  let signal = "NEUTRAL";
  let pts = 0;

  if (current_price > vah && rvol > 1.5) { signal = "VALUE_AREA_BREAKOUT"; pts = 5; }
  else if (current_price < val && rvol > 1.5) { signal = "VALUE_AREA_BREAKDOWN"; pts = -5; }
  else if (Math.abs(current_price - poc) < bin_size) { signal = "AT_FAIR_VALUE_POC"; pts = 0; }
  else if (current_price > poc) { signal = "ABOVE_VALUE_AREA"; pts = 4; }

  let extend_target = 0;
  if (atr_target_2) {
    const lvn_between = lvn_zones.some(z => z > current_price && z < atr_target_2);
    if (lvn_between) extend_target = (atr_target_2 - current_price) * 0.3; // Approx ATR extension
  }

  return {
    ok: true,
    data: { poc, vah, val, lvn_zones, hvn_zones, signal, pts, extend_target },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:volumeProfileEngine" }
  };
}

// MODULE 3.8 — SUPPORT & RESISTANCE ZONE BUILDER
function supportResistanceEngine({ high_prices, low_prices, close_prices, current_price, hvn_zones = [] }) {
  if (!close_prices || close_prices.length < 10) return { ok: false, error: "insufficient_data" };

  const swing_highs = findSwingHighs(high_prices, 3);
  const swing_lows = findSwingLows(low_prices, 3);

  const cluster_threshold = current_price * 0.005;

  const clusterZones = (swings) => {
    const zones = [];
    swings.forEach(s => {
      let found = false;
      for (const z of zones) {
        if (Math.abs(z.price - s.price) < cluster_threshold) {
          z.touches += 1;
          z.prices.push(s.price);
          z.price = z.prices.reduce((a, b) => a + b, 0) / z.prices.length; // Average price in cluster
          found = true;
          break;
        }
      }
      if (!found) zones.push({ price: s.price, touches: 1, prices: [s.price] });
    });
    return zones;
  };

  const high_zones = clusterZones(swing_highs);
  const low_zones = clusterZones(swing_lows);

  const all_zones = [...high_zones, ...low_zones].map(z => {
    const nearest_hvn_dist = hvn_zones.length > 0 ? Math.min(...hvn_zones.map(h => Math.abs(h - z.price))) : Infinity;
    const hvn_proximity = nearest_hvn_dist < cluster_threshold;
    const round_number = (z.price % 50 === 0 || z.price % 100 === 0);
    
    z.strength = (z.touches * 2) + (hvn_proximity ? 3 : 0) + (round_number ? 2 : 0);
    z.type = z.price > current_price ? "RESISTANCE" : "SUPPORT";
    return z;
  });

  const resistance_zones = all_zones.filter(z => z.type === "RESISTANCE").sort((a, b) => a.price - b.price);
  const support_zones = all_zones.filter(z => z.type === "SUPPORT").sort((a, b) => b.price - a.price);

  return {
    ok: true,
    data: {
      resistance_zones,
      support_zones,
      r1: resistance_zones[0]?.price || null,
      r2: resistance_zones[1]?.price || null,
      r3: resistance_zones[2]?.price || null,
      s1: support_zones[0]?.price || null,
      s2: support_zones[1]?.price || null,
      s3: support_zones[2]?.price || null,
      zone_strength: all_zones.map(z => ({ price: z.price, strength: z.strength, type: z.type }))
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:supportResistanceEngine" }
  };
}

module.exports = {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  rvolEngine,
  adxEngine,
  supportResistanceEngine
};
