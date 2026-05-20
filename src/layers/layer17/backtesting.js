// MODULE 17.1 — TRADE EXPECTANCY ENGINE
function tradeExpectancyEngine({ trades = [] }) {
  if (trades.length === 0) return { ok: false, error: "no_trades_provided" };

  let total_wins = 0;
  let total_losses = 0;
  let sum_win_r_multiple = 0;
  let sum_loss_r_multiple = 0;

  for (const t of trades) {
    const r = Number(t.r_multiple) || 0;
    if (r > 0) {
      total_wins++;
      sum_win_r_multiple += r;
    } else {
      total_losses++;
      sum_loss_r_multiple += r; // Usually negative
    }
  }

  const win_rate = trades.length > 0 ? total_wins / trades.length : 0;
  const avg_win_r = total_wins > 0 ? sum_win_r_multiple / total_wins : 0;
  const avg_loss_r = total_losses > 0 ? sum_loss_r_multiple / total_losses : 0;

  // Expectancy = (Win Rate * Avg Win) + (Loss Rate * Avg Loss)
  const expectancy = (win_rate * avg_win_r) + ((1 - win_rate) * avg_loss_r);

  let system_edge = "NEGATIVE_EXPECTANCY";
  if (expectancy > 0.5) system_edge = "EXCEPTIONAL_EDGE";
  else if (expectancy > 0.2) system_edge = "SOLID_EDGE";
  else if (expectancy > 0) system_edge = "MARGINAL_EDGE";

  return {
    ok: true,
    data: { 
      total_trades: trades.length, 
      win_rate: win_rate * 100, 
      avg_win_r, 
      avg_loss_r, 
      expectancy, 
      system_edge 
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:tradeExpectancyEngine" }
  };
}

// MODULE 17.2 — DRAWDOWN & RECOVERY ENGINE
function drawdownEngine({ daily_portfolio_values = [] }) {
  if (daily_portfolio_values.length === 0) return { ok: false, error: "no_equity_curve" };

  let max_drawdown_pct = 0;
  let current_peak = daily_portfolio_values[0];
  let ulcer_index_sum = 0;

  for (let i = 0; i < daily_portfolio_values.length; i++) {
    const value = daily_portfolio_values[i];
    if (value > current_peak) {
      current_peak = value;
    }
    
    const drawdown_pct = ((current_peak - value) / current_peak) * 100;
    if (drawdown_pct > max_drawdown_pct) {
      max_drawdown_pct = drawdown_pct;
    }

    // Ulcer index measures depth and duration of drawdowns
    ulcer_index_sum += (drawdown_pct * drawdown_pct);
  }

  const ulcer_index = Math.sqrt(ulcer_index_sum / daily_portfolio_values.length);

  let risk_profile = "HIGH_RISK";
  if (max_drawdown_pct < 10 && ulcer_index < 5) risk_profile = "CONSERVATIVE";
  else if (max_drawdown_pct < 20 && ulcer_index < 10) risk_profile = "MODERATE";

  return {
    ok: true,
    data: { max_drawdown_pct, ulcer_index, risk_profile },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:drawdownEngine" }
  };
}

// MODULE 17.3 — SHARPE & SORTINO RATIO ENGINE
function riskAdjustedReturnsEngine({ daily_returns_pct = [], risk_free_rate_annual = 5.0 }) {
  if (daily_returns_pct.length === 0) return { ok: false, error: "no_returns_provided" };

  const daily_risk_free_rate = risk_free_rate_annual / 252;
  let sum_excess_returns = 0;
  let sum_excess_returns_sq = 0;
  let sum_downside_returns_sq = 0;

  for (const ret of daily_returns_pct) {
    const excess = ret - daily_risk_free_rate;
    sum_excess_returns += excess;
    sum_excess_returns_sq += (excess * excess);
    if (excess < 0) {
      sum_downside_returns_sq += (excess * excess);
    }
  }

  const avg_excess_return = sum_excess_returns / daily_returns_pct.length;
  
  // Standard Deviation of excess returns
  const variance = (sum_excess_returns_sq / daily_returns_pct.length) - (avg_excess_return * avg_excess_return);
  const std_dev = Math.sqrt(Math.max(0, variance));

  // Downside Deviation
  const downside_variance = sum_downside_returns_sq / daily_returns_pct.length;
  const downside_deviation = Math.sqrt(Math.max(0, downside_variance));

  // Annualize
  const annualized_return = avg_excess_return * 252;
  const annualized_std_dev = std_dev * Math.sqrt(252);
  const annualized_downside_dev = downside_deviation * Math.sqrt(252);

  const sharpe_ratio = annualized_std_dev > 0 ? annualized_return / annualized_std_dev : 0;
  const sortino_ratio = annualized_downside_dev > 0 ? annualized_return / annualized_downside_dev : 0;

  let performance_grade = "POOR";
  if (sharpe_ratio > 2.0) performance_grade = "EXCEPTIONAL";
  else if (sharpe_ratio > 1.0) performance_grade = "GOOD";
  else if (sharpe_ratio > 0.5) performance_grade = "ACCEPTABLE";

  return {
    ok: true,
    data: { sharpe_ratio, sortino_ratio, annualized_return, annualized_std_dev, performance_grade },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:riskAdjustedReturnsEngine" }
  };
}

// MODULE 17.4 — SYSTEM DEGRADATION DETECTOR (Alpha Decay)
function alphaDecayEngine({ recent_win_rate = 0, historical_win_rate = 0, recent_expectancy = 0, historical_expectancy = 0 }) {
  const win_rate_delta = recent_win_rate - historical_win_rate;
  const expectancy_delta = recent_expectancy - historical_expectancy;

  let decay_status = "SYSTEM_HEALTHY";
  let action = "CONTINUE_AS_NORMAL";
  let flag = null;

  if (expectancy_delta < -0.3 && win_rate_delta < -10) {
    decay_status = "SEVERE_ALPHA_DECAY";
    action = "HALT_TRADING_REVIEW_MODELS";
    flag = "EDGE_LOST_OR_REGIME_CHANGE";
  } else if (expectancy_delta < -0.1 || win_rate_delta < -5) {
    decay_status = "MILD_DEGRADATION";
    action = "REDUCE_POSITION_SIZES_BY_HALF";
  }

  return {
    ok: true,
    data: { win_rate_delta, expectancy_delta, decay_status, action, flag },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:alphaDecayEngine" }
  };
}

module.exports = {
  tradeExpectancyEngine,
  drawdownEngine,
  riskAdjustedReturnsEngine,
  alphaDecayEngine
};
