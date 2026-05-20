// MODULE 12.1 — KELLY CRITERION POSITION SIZER
function kellyCriterionEngine({ win_probability = 0.50, win_loss_ratio = 1.5, half_kelly = true, total_capital = 100000 }) {
  if (win_probability <= 0 || win_probability >= 1 || win_loss_ratio <= 0) {
    return { ok: false, error: "invalid_inputs" };
  }

  // Kelly Formula: K% = W - [(1 - W) / R]
  const kelly_pct = win_probability - ((1 - win_probability) / win_loss_ratio);
  
  // Cap at 0 (no trade if negative expectation)
  const raw_kelly = Math.max(0, kelly_pct);
  
  // Use Half-Kelly for risk mitigation (standard institutional practice)
  const final_kelly_pct = half_kelly ? raw_kelly / 2 : raw_kelly;
  
  // Cap max position size at 20% of capital regardless of Kelly
  const max_allowed_pct = 0.20;
  const position_pct = Math.min(final_kelly_pct, max_allowed_pct);
  
  const recommended_allocation = total_capital * position_pct;

  let risk_tier = "NO_TRADE";
  if (position_pct > 0.15) risk_tier = "HIGH_CONVICTION_MAX_SIZE";
  else if (position_pct > 0.05 && position_pct <= 0.15) risk_tier = "STANDARD_SIZE";
  else if (position_pct > 0 && position_pct <= 0.05) risk_tier = "SMALL_FEELER_SIZE";

  return {
    ok: true,
    data: { 
      raw_kelly_pct: raw_kelly * 100, 
      final_kelly_pct: final_kelly_pct * 100, 
      position_pct: position_pct * 100, 
      recommended_allocation, 
      risk_tier 
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:kellyCriterionEngine" }
  };
}

// MODULE 12.2 — VOLATILITY TARGETED SIZING
function volatilityTargetingEngine({ total_capital = 100000, target_portfolio_vol_annual = 0.15, stock_annual_volatility = 0.30, entry_price, stop_loss }) {
  if (stock_annual_volatility <= 0 || target_portfolio_vol_annual <= 0) return { ok: false, error: "invalid_volatility" };

  // Weight = Target Volatility / Stock Volatility
  const vol_weight_pct = target_portfolio_vol_annual / stock_annual_volatility;
  
  // Absolute cap based on risk limits
  const capped_weight_pct = Math.min(vol_weight_pct, 0.25);
  const capital_allocation = total_capital * capped_weight_pct;

  // Validate against stop loss risk limit (e.g., max 2% total capital at risk)
  let final_allocation = capital_allocation;
  let risk_amount = 0;
  let shares = 0;
  let adjustment_note = "NO_ADJUSTMENT";

  if (entry_price > 0 && stop_loss > 0 && entry_price > stop_loss) {
    const risk_per_share = entry_price - stop_loss;
    const max_portfolio_risk_amt = total_capital * 0.02; // Max 2% loss per trade
    const max_shares_by_risk = Math.floor(max_portfolio_risk_amt / risk_per_share);
    const max_allocation_by_risk = max_shares_by_risk * entry_price;

    if (max_allocation_by_risk < capital_allocation) {
      final_allocation = max_allocation_by_risk;
      shares = max_shares_by_risk;
      adjustment_note = "REDUCED_DUE_TO_2PCT_MAX_RISK_LIMIT";
    } else {
      shares = Math.floor(capital_allocation / entry_price);
    }
    risk_amount = shares * risk_per_share;
  }

  return {
    ok: true,
    data: { 
      target_weight_pct: capped_weight_pct * 100, 
      capital_allocation: final_allocation, 
      shares, 
      risk_amount, 
      risk_amount_pct_of_capital: (risk_amount / total_capital) * 100,
      adjustment_note 
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:volatilityTargetingEngine" }
  };
}

// MODULE 12.3 — R-MULTIPLE TRAILING STOP ENGINE
function rMultipleTrailingEngine({ entry_price, initial_stop_loss, current_price, current_atr, mode = "SWING" }) {
  if (entry_price <= initial_stop_loss) return { ok: false, error: "invalid_long_setup" };

  const initial_risk = entry_price - initial_stop_loss;
  const current_profit = current_price - entry_price;
  const current_r_multiple = current_profit / initial_risk;

  let new_stop_loss = initial_stop_loss;
  let trailing_action = "HOLD_INITIAL_STOP";

  // R-Multiple Trailing Logic
  if (current_r_multiple >= 3.0) {
    // Lock in 2R
    new_stop_loss = entry_price + (2 * initial_risk);
    trailing_action = "TRAIL_TO_2R_LOCKED";
  } else if (current_r_multiple >= 2.0) {
    // Lock in 1R
    new_stop_loss = entry_price + (1 * initial_risk);
    trailing_action = "TRAIL_TO_1R_LOCKED";
  } else if (current_r_multiple >= 1.0) {
    // Move to Breakeven
    new_stop_loss = entry_price;
    trailing_action = "MOVE_TO_BREAKEVEN";
  }

  // Dynamic ATR trailing (override if tighter depending on mode)
  if (mode === "MOMENTUM" && current_r_multiple >= 1.5) {
    const atr_trail = current_price - (current_atr * 1.5);
    if (atr_trail > new_stop_loss) {
      new_stop_loss = atr_trail;
      trailing_action = "AGGRESSIVE_ATR_TRAIL";
    }
  }

  return {
    ok: true,
    data: { 
      initial_risk, 
      current_r_multiple, 
      suggested_stop_loss: new_stop_loss, 
      trailing_action 
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:rMultipleTrailingEngine" }
  };
}

// MODULE 12.4 — CORRELATION DRAWDOWN PENALTY
function correlationDrawdownPenalty({ portfolio_correlation_to_index = 0.8, portfolio_drawdown_pct = 0, current_vix = 15 }) {
  let position_size_multiplier = 1.0;
  const flags = [];

  // Reduce size if portfolio is highly correlated to a falling market (represented by high VIX)
  if (portfolio_correlation_to_index > 0.7 && current_vix > 20) {
    position_size_multiplier -= 0.2;
    flags.push("HIGH_CORRELATION_IN_VOLATILE_MARKET");
  }

  // Reduce size if in a drawdown (Asymmetrical compounding protection)
  if (portfolio_drawdown_pct > 10) {
    position_size_multiplier -= 0.3;
    flags.push("DRAWDOWN_DEFENSE_MODE_ACTIVE");
  } else if (portfolio_drawdown_pct > 5) {
    position_size_multiplier -= 0.15;
    flags.push("MILD_DRAWDOWN_REDUCTION");
  }

  position_size_multiplier = Math.max(0.2, position_size_multiplier);

  return {
    ok: true,
    data: { position_size_multiplier, flags },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:correlationDrawdownPenalty" }
  };
}

module.exports = {
  kellyCriterionEngine,
  volatilityTargetingEngine,
  rMultipleTrailingEngine,
  correlationDrawdownPenalty
};
