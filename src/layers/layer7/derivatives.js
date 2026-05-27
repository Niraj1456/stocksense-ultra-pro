const { extractChainRows, summarizeOi } = require("./optionsChain");

// MODULE 7.1 — PUT-CALL RATIO (PCR) SCORING
function pcrEngine({ raw_chain }) {
  const { callOi, putOi, pcr } = summarizeOi(raw_chain);

  let signal = "NEUTRAL";
  let pts = 0;
  let contrarian_flag = null;

  if (pcr > 1.4) {
    signal = "EXTREME_BULLISH";
    pts = 2;
    contrarian_flag = "OVERBOUGHT_REVERSAL_RISK";
  } else if (pcr >= 1.0 && pcr <= 1.4) {
    signal = "BULLISH_SUPPORT";
    pts = 4;
  } else if (pcr >= 0.7 && pcr < 1.0) {
    signal = "NEUTRAL";
    pts = 0;
  } else if (pcr >= 0.5 && pcr < 0.7) {
    signal = "BEARISH_RESISTANCE";
    pts = -4;
  } else if (pcr < 0.5) {
    signal = "EXTREME_BEARISH";
    pts = -2;
    contrarian_flag = "OVERSOLD_REVERSAL_RISK";
  }

  return {
    ok: true,
    data: { callOi, putOi, pcr, signal, pts, contrarian_flag },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:pcrEngine" }
  };
}

// MODULE 7.2 — MAX PAIN LEVEL ESTIMATOR
function maxPainEngine({ raw_chain }) {
  const rows = extractChainRows(raw_chain);
  if (rows.length === 0) return { ok: false, error: "no_option_chain_data" };

  const strikes = [];
  for (const r of rows) {
    if (r.strikePrice) strikes.push(r.strikePrice);
  }

  if (strikes.length === 0) return { ok: false, error: "no_strikes_found" };

  // Determine intrinsic value loss at each strike
  let min_pain_value = Infinity;
  let max_pain_strike = null;

  for (const evaluation_strike of strikes) {
    let total_pain = 0;

    for (const r of rows) {
      const strike = r.strikePrice;
      const ce_oi = Number(r?.CE?.openInterest) || 0;
      const pe_oi = Number(r?.PE?.openInterest) || 0;

      // Call option writers lose if evaluation_strike > strike
      if (evaluation_strike > strike) {
        total_pain += (evaluation_strike - strike) * ce_oi;
      }

      // Put option writers lose if evaluation_strike < strike
      if (evaluation_strike < strike) {
        total_pain += (strike - evaluation_strike) * pe_oi;
      }
    }

    if (total_pain < min_pain_value) {
      min_pain_value = total_pain;
      max_pain_strike = evaluation_strike;
    }
  }

  return {
    ok: true,
    data: { max_pain_strike, min_pain_value },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:maxPainEngine" }
  };
}

// MODULE 7.3 — OI DELTA CLASSIFIER
function oiDeltaEngine({ current_price, prev_price, current_oi, prev_oi }) {
  const price_change_pct = prev_price > 0 ? ((current_price - prev_price) / prev_price) * 100 : 0;
  const oi_change_pct = prev_oi > 0 ? ((current_oi - prev_oi) / prev_oi) * 100 : 0;

  let buildup_type = "NEUTRAL";
  let pts = 0;

  if (price_change_pct > 0 && oi_change_pct > 0) {
    buildup_type = "LONG_BUILDUP";
    pts = 4;
  } else if (price_change_pct < 0 && oi_change_pct > 0) {
    buildup_type = "SHORT_BUILDUP";
    pts = -4;
  } else if (price_change_pct > 0 && oi_change_pct < 0) {
    buildup_type = "SHORT_COVERING";
    pts = 2; // Bullish relief
  } else if (price_change_pct < 0 && oi_change_pct < 0) {
    buildup_type = "LONG_UNWINDING";
    pts = -2; // Bearish relief
  }

  const signal_strength = Math.abs(oi_change_pct) > 10 ? "STRONG" : Math.abs(oi_change_pct) > 3 ? "MODERATE" : "WEAK";

  return {
    ok: true,
    data: { price_change_pct, oi_change_pct, buildup_type, signal_strength, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:oiDeltaEngine" }
  };
}

// MODULE 7.4 — IV PERCENTILE (IVP) REGIME
function ivPercentileEngine({ current_iv, iv_history_1yr = [] }) {
  if (iv_history_1yr.length === 0 || !current_iv) {
    return { ok: false, error: "insufficient_iv_data" };
  }

  const lower_count = iv_history_1yr.filter(iv => iv < current_iv).length;
  const ivp = (lower_count / iv_history_1yr.length) * 100;

  let iv_regime = "NORMAL";
  let option_strategy_bias = "NEUTRAL";

  if (ivp > 80) {
    iv_regime = "EXTREME_HIGH";
    option_strategy_bias = "CREDIT_SPREADS_OR_SELLING";
  } else if (ivp >= 60 && ivp <= 80) {
    iv_regime = "ELEVATED";
    option_strategy_bias = "PREMIUM_SELLING_FAVORED";
  } else if (ivp >= 30 && ivp < 60) {
    iv_regime = "NORMAL";
    option_strategy_bias = "DIRECTIONAL_DEBIT_SPREADS";
  } else if (ivp < 30) {
    iv_regime = "COMPRESSED";
    option_strategy_bias = "NAKED_BUYING_OR_DEBIT_SPREADS";
  }

  return {
    ok: true,
    data: { current_iv, iv_percentile: ivp, iv_regime, option_strategy_bias },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:ivPercentileEngine" }
  };
}

// MODULE 7.5 — OPTIONS MARKET-MAKER GAMMA EXPOSURE (GEX) ENGINE
function gammaExposureEngine({ current_price, raw_chain }) {
  const rows = extractChainRows(raw_chain);
  if (rows.length === 0 || !current_price) {
    return { ok: false, error: "insufficient_data" };
  }

  const spot = Number(current_price);
  const std_dev = spot * 0.05; // 5% spot volatility band standard deviation
  let net_gex = 0;
  let call_gex_sum = 0;
  let put_gex_sum = 0;

  for (const r of rows) {
    const strike = Number(r.strikePrice);
    if (!strike) continue;

    const ce_oi = Number(r?.CE?.openInterest) || 0;
    const pe_oi = Number(r?.PE?.openInterest) || 0;

    // Proximity factor (x-score)
    const x = (strike - spot) / std_dev;

    // Approximate Call Delta using standard sigmoid: 1 / (1 + exp(2x))
    const ce_delta = 1 / (1 + Math.exp(x * 2));
    const pe_delta = ce_delta - 1;

    // Approximate Gamma using standard Gaussian PDF: exp(-0.5 * x^2) / (std_dev * sqrt(2 * pi))
    const gamma = Math.exp(-0.5 * x * x) / (std_dev * Math.sqrt(2 * Math.PI));

    // Strike-level Gamma Exposure (GEX) in dollar/rupee terms per 1% move
    const strike_ce_gex = ce_oi * ce_delta * gamma * spot * 0.01;
    const strike_pe_gex = pe_oi * pe_delta * gamma * spot * 0.01;

    call_gex_sum += strike_ce_gex;
    put_gex_sum += strike_pe_gex;
  }

  // Net GEX is Call GEX (positive) + Put GEX (negative)
  net_gex = call_gex_sum + put_gex_sum;

  const gamma_regime = net_gex >= 0 ? "POSITIVE" : "NEGATIVE";
  let pts = 0;
  let flag = null;

  if (gamma_regime === "POSITIVE") {
    pts = 3;
    flag = "POSITIVE_GAMMA_STABILITY";
  } else {
    pts = -3;
    flag = "NEGATIVE_GAMMA_TAIL_RISK";
  }

  return {
    ok: true,
    data: {
      net_gex: +net_gex.toFixed(2),
      call_gex: +call_gex_sum.toFixed(2),
      put_gex: +put_gex_sum.toFixed(2),
      gamma_regime,
      pts,
      flag
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:gammaExposureEngine" }
  };
}

// MODULE 7.6 — OPTION VOLUME-TO-OI VELOCITY ENGINE
function optionVolumeVelocityEngine({ raw_chain }) {
  const rows = extractChainRows(raw_chain);
  if (rows.length === 0) {
    return { ok: false, error: "insufficient_data" };
  }

  let total_ce_vol = 0;
  let total_ce_oi = 0;
  let total_pe_vol = 0;
  let total_pe_oi = 0;

  for (const r of rows) {
    total_ce_vol += Number(r?.CE?.totalTradedVolume) || 0;
    total_ce_oi += Number(r?.CE?.openInterest) || 0;
    total_pe_vol += Number(r?.PE?.totalTradedVolume) || 0;
    total_pe_oi += Number(r?.PE?.openInterest) || 0;
  }

  const ce_velocity = total_ce_oi > 0 ? total_ce_vol / total_ce_oi : 0;
  const pe_velocity = total_pe_oi > 0 ? total_pe_vol / total_pe_oi : 0;
  const velocity_ratio = pe_velocity > 0 ? ce_velocity / pe_velocity : 1.0;

  let pts = 0;
  let flag = "NEUTRAL";

  // Thresholds: if CE velocity is high and Ratio > 1.5, indicates bullish speculative buying surge
  if (ce_velocity > 2.0 && velocity_ratio > 1.5) {
    pts = 4;
    flag = "BULLISH_SPECULATIVE_VOLUME_SURGE";
  } else if (pe_velocity > 2.0 && velocity_ratio < 0.67) {
    pts = -4;
    flag = "BEARISH_SPECULATIVE_PUT_BUYING_PANIC";
  }

  return {
    ok: true,
    data: {
      ce_velocity: +ce_velocity.toFixed(3),
      pe_velocity: +pe_velocity.toFixed(3),
      velocity_ratio: +velocity_ratio.toFixed(3),
      total_ce_vol,
      total_ce_oi,
      total_pe_vol,
      total_pe_oi,
      pts,
      flag
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:optionVolumeVelocityEngine" }
  };
}

module.exports = {
  pcrEngine,
  maxPainEngine,
  oiDeltaEngine,
  ivPercentileEngine,
  gammaExposureEngine,
  optionVolumeVelocityEngine
};
