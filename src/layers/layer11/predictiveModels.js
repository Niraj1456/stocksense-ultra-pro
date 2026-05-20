// MODULE 11.1 — PROBABILITY OF TOUCH (POT) CALCULATOR
function probabilityOfTouchEngine({ current_price, target_price, days_to_target, historical_volatility_annualized }) {
  if (current_price <= 0 || target_price <= 0 || days_to_target <= 0) return { ok: false, error: "invalid_inputs" };

  const daily_volatility = historical_volatility_annualized / Math.sqrt(252);
  const distance_pct = Math.abs(target_price - current_price) / current_price;
  
  // Rough estimate based on normal distribution of returns
  const std_devs_away = distance_pct / (daily_volatility * Math.sqrt(days_to_target));
  
  // Approximation of complementary error function for standard normal distribution
  const pot_estimate = Math.exp(-0.5 * std_devs_away * std_devs_away);
  const probability_pct = Math.min(100, Math.max(0, pot_estimate * 100));

  let likelihood = "IMPROBABLE";
  let pts = 0;

  if (probability_pct > 80) { likelihood = "HIGHLY_PROBABLE"; pts = 4; }
  else if (probability_pct >= 50 && probability_pct <= 80) { likelihood = "LIKELY"; pts = 2; }
  else if (probability_pct >= 20 && probability_pct < 50) { likelihood = "POSSIBLE"; pts = 0; }
  else if (probability_pct < 20) { likelihood = "IMPROBABLE"; pts = -2; }

  return {
    ok: true,
    data: { probability_pct, std_devs_away, likelihood, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:probabilityOfTouchEngine" }
  };
}

// MODULE 11.2 — MEAN REVERSION ENGINE
function meanReversionEngine({ current_price, sma_50 = 0, sma_200 = 0, atr_14 = 0 }) {
  if (sma_50 === 0 || sma_200 === 0 || atr_14 === 0) return { ok: false, error: "invalid_inputs" };

  const distance_50 = current_price - sma_50;
  const z_score_50 = distance_50 / atr_14;

  const distance_200 = current_price - sma_200;
  const z_score_200 = distance_200 / atr_14;

  let reversion_risk = "NORMAL";
  let action = "HOLD";
  let pts = 0;
  let flag = null;

  if (z_score_50 > 3.0 || z_score_200 > 5.0) {
    reversion_risk = "EXTREME_OVERBOUGHT";
    action = "TAKE_PROFITS";
    pts = -4;
    flag = "HIGH_MEAN_REVERSION_RISK";
  } else if (z_score_50 > 2.0 || z_score_200 > 3.0) {
    reversion_risk = "OVERBOUGHT";
    action = "TRAIL_STOPS_TIGHTLY";
    pts = -2;
  } else if (z_score_50 < -3.0 || z_score_200 < -5.0) {
    reversion_risk = "EXTREME_OVERSOLD";
    action = "LOOK_FOR_REVERSAL_ENTRY";
    pts = 4;
    flag = "RUBBER_BAND_STRETCHED";
  } else if (z_score_50 < -2.0 || z_score_200 < -3.0) {
    reversion_risk = "OVERSOLD";
    action = "WATCH_FOR_SUPPORT";
    pts = 2;
  }

  return {
    ok: true,
    data: { z_score_50, z_score_200, reversion_risk, action, pts, flag },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:meanReversionEngine" }
  };
}

// MODULE 11.3 — BREAKOUT PROBABILITY ENGINE (Squeeze Detector)
function breakoutProbabilityEngine({ bb_upper, bb_lower, keltner_upper, keltner_lower, current_price, volume_trend_pct }) {
  if (!bb_upper || !bb_lower || !keltner_upper || !keltner_lower) return { ok: false, error: "invalid_bands" };

  // Squeeze condition: Bollinger Bands are inside Keltner Channels
  const is_squeeze_on = (bb_upper < keltner_upper) && (bb_lower > keltner_lower);
  
  const bb_width = (bb_upper - bb_lower) / current_price * 100;

  let squeeze_status = "NO_SQUEEZE";
  let breakout_direction_bias = "NEUTRAL";
  let pts = 0;

  if (is_squeeze_on) {
    squeeze_status = "SQUEEZE_ACTIVE";
    pts = 2; // Energy storing

    if (volume_trend_pct > 20) {
      breakout_direction_bias = "BULLISH_BREAKOUT_LIKELY";
      pts = 5;
    } else if (volume_trend_pct < -20) {
      breakout_direction_bias = "BEARISH_BREAKDOWN_LIKELY";
      pts = -2;
    }
  } else if (bb_width > 15) {
    squeeze_status = "VOLATILITY_EXPANDED";
    pts = 0;
  }

  return {
    ok: true,
    data: { is_squeeze_on, bb_width, squeeze_status, breakout_direction_bias, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:breakoutProbabilityEngine" }
  };
}

// MODULE 11.4 — MARKOV CHAIN TREND PREDICTOR
function markovTrendPredictor({ recent_daily_returns = [] }) {
  if (recent_daily_returns.length < 20) return { ok: false, error: "insufficient_history" };

  let up_to_up = 0, up_to_down = 0;
  let down_to_up = 0, down_to_down = 0;

  for (let i = 1; i < recent_daily_returns.length; i++) {
    const prev = recent_daily_returns[i - 1];
    const curr = recent_daily_returns[i];

    if (prev >= 0 && curr >= 0) up_to_up++;
    if (prev >= 0 && curr < 0) up_to_down++;
    if (prev < 0 && curr >= 0) down_to_up++;
    if (prev < 0 && curr < 0) down_to_down++;
  }

  const total_up = up_to_up + up_to_down;
  const total_down = down_to_up + down_to_down;

  const prob_up_given_up = total_up > 0 ? up_to_up / total_up : 0;
  const prob_down_given_up = total_up > 0 ? up_to_down / total_up : 0;
  const prob_up_given_down = total_down > 0 ? down_to_up / total_down : 0;
  const prob_down_given_down = total_down > 0 ? down_to_down / total_down : 0;

  const last_return = recent_daily_returns[recent_daily_returns.length - 1];
  const next_day_up_prob = last_return >= 0 ? prob_up_given_up : prob_up_given_down;

  let prediction = "NEUTRAL_DRIFT";
  let pts = 0;

  if (next_day_up_prob > 0.65) {
    prediction = "HIGH_PROBABILITY_CONTINUATION_UP";
    pts = 3;
  } else if (next_day_up_prob < 0.35) {
    prediction = "HIGH_PROBABILITY_CONTINUATION_DOWN";
    pts = -3;
  } else if (prob_up_given_down > 0.6 && prob_down_given_up > 0.6) {
    prediction = "CHOPPY_MEAN_REVERTING";
    pts = 0;
  }

  return {
    ok: true,
    data: { 
      next_day_up_prob: next_day_up_prob * 100, 
      prediction, 
      pts,
      transition_matrix: { prob_up_given_up, prob_down_given_up, prob_up_given_down, prob_down_given_down }
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:markovTrendPredictor" }
  };
}

module.exports = {
  probabilityOfTouchEngine,
  meanReversionEngine,
  breakoutProbabilityEngine,
  markovTrendPredictor
};
