// MODULE 10.1 — DISCOUNTED CASH FLOW (DCF) ENGINE
function dcfEngine({ 
  fcf = 0,               // Free Cash Flow
  shares_outstanding = 1, 
  growth_rate_1_5 = 0.10, // Growth rate years 1-5
  growth_rate_6_10 = 0.05,// Growth rate years 6-10
  terminal_growth = 0.03, // Terminal growth rate
  discount_rate = 0.10,   // WACC
  current_price = 0
}) {
  if (shares_outstanding <= 0 || fcf <= 0) return { ok: false, error: "invalid_inputs" };

  let total_pv = 0;
  let current_fcf = fcf;

  // Years 1-5
  for (let i = 1; i <= 5; i++) {
    current_fcf *= (1 + growth_rate_1_5);
    total_pv += current_fcf / Math.pow(1 + discount_rate, i);
  }

  // Years 6-10
  for (let i = 6; i <= 10; i++) {
    current_fcf *= (1 + growth_rate_6_10);
    total_pv += current_fcf / Math.pow(1 + discount_rate, i);
  }

  // Terminal Value
  const terminal_value = (current_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth);
  const pv_terminal_value = terminal_value / Math.pow(1 + discount_rate, 10);
  
  total_pv += pv_terminal_value;
  
  const intrinsic_value = total_pv / shares_outstanding;
  
  const margin_of_safety_pct = current_price > 0 ? ((intrinsic_value - current_price) / intrinsic_value) * 100 : 0;

  let valuation_status = "FAIRLY_VALUED";
  let pts = 0;
  
  if (margin_of_safety_pct > 30) {
    valuation_status = "DEEP_DISCOUNT";
    pts = 5;
  } else if (margin_of_safety_pct > 15 && margin_of_safety_pct <= 30) {
    valuation_status = "UNDERVALUED";
    pts = 3;
  } else if (margin_of_safety_pct >= -10 && margin_of_safety_pct <= 15) {
    valuation_status = "FAIRLY_VALUED";
    pts = 0;
  } else if (margin_of_safety_pct < -10 && margin_of_safety_pct >= -30) {
    valuation_status = "OVERVALUED";
    pts = -2;
  } else if (margin_of_safety_pct < -30) {
    valuation_status = "EXTREMELY_OVERVALUED";
    pts = -5;
  }

  return {
    ok: true,
    data: { intrinsic_value, current_price, margin_of_safety_pct, valuation_status, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:dcfEngine" }
  };
}

// MODULE 10.2 — GRAHAM NUMBER ENGINE
function grahamNumberEngine({ eps = 0, bvps = 0, current_price = 0 }) {
  if (eps <= 0 || bvps <= 0) return { ok: false, error: "negative_earnings_or_book_value" };

  // Graham Number = sqrt(22.5 * EPS * BVPS)
  const graham_number = Math.sqrt(22.5 * eps * bvps);
  
  const premium_pct = current_price > 0 ? ((current_price - graham_number) / graham_number) * 100 : 0;

  let defensive_status = "NO_MARGIN_OF_SAFETY";
  let pts = 0;

  if (current_price < graham_number * 0.8) {
    defensive_status = "CLASSIC_GRAHAM_VALUE";
    pts = 4;
  } else if (current_price <= graham_number) {
    defensive_status = "GRAHAM_FAIR_VALUE";
    pts = 2;
  } else if (premium_pct > 50) {
    defensive_status = "HIGH_PREMIUM_TO_GRAHAM";
    pts = -2;
  }

  return {
    ok: true,
    data: { graham_number, premium_pct, defensive_status, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:grahamNumberEngine" }
  };
}

// MODULE 10.3 — REVERSE DCF ENGINE
function reverseDcfEngine({ current_price = 0, fcf_per_share = 0, discount_rate = 0.10, terminal_growth = 0.03, historical_growth_rate = 0 }) {
  if (fcf_per_share <= 0 || current_price <= 0) return { ok: false, error: "invalid_inputs" };

  // Iteratively find implied growth rate (simplified binary search)
  let low = -0.20;
  let high = 1.0;
  let implied_growth = 0;
  let best_diff = Infinity;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    
    let total_pv = 0;
    let current_fcf = fcf_per_share;
    for (let j = 1; j <= 10; j++) {
      current_fcf *= (1 + mid);
      total_pv += current_fcf / Math.pow(1 + discount_rate, j);
    }
    const terminal_val = (current_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth);
    total_pv += terminal_val / Math.pow(1 + discount_rate, 10);

    const diff = total_pv - current_price;
    if (Math.abs(diff) < best_diff) {
      best_diff = Math.abs(diff);
      implied_growth = mid;
    }

    if (diff > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const implied_growth_pct = implied_growth * 100;
  
  let expectation_gap = "INLINE";
  let pts = 0;

  if (implied_growth_pct > historical_growth_rate * 1.5) {
    expectation_gap = "PRICED_FOR_PERFECTION";
    pts = -3;
  } else if (implied_growth_pct < historical_growth_rate * 0.5) {
    expectation_gap = "PESSIMISTICALLY_PRICED";
    pts = 4;
  } else {
    expectation_gap = "REASONABLY_PRICED";
    pts = 0;
  }

  return {
    ok: true,
    data: { implied_growth_pct, expectation_gap, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:reverseDcfEngine" }
  };
}

// MODULE 10.4 — EARNINGS YIELD SPREAD ENGINE (EQUITY RISK PREMIUM)
function earningsYieldEngine({ pe_ratio = 0, gsec_10yr_yield = 7.0 }) {
  if (pe_ratio <= 0) return { ok: false, error: "invalid_pe" };

  const earnings_yield = (1 / pe_ratio) * 100;
  const yield_spread = earnings_yield - gsec_10yr_yield;

  let equity_attractiveness = "NEUTRAL";
  let pts = 0;

  if (yield_spread > 2.0) {
    equity_attractiveness = "HIGHLY_ATTRACTIVE_VS_BONDS";
    pts = 3;
  } else if (yield_spread > 0 && yield_spread <= 2.0) {
    equity_attractiveness = "FAIRLY_ATTRACTIVE";
    pts = 1;
  } else if (yield_spread < 0 && yield_spread >= -2.0) {
    equity_attractiveness = "BONDS_MORE_ATTRACTIVE";
    pts = -2;
  } else if (yield_spread < -2.0) {
    equity_attractiveness = "SIGNIFICANT_EQUITY_RISK";
    pts = -4;
  }

  return {
    ok: true,
    data: { earnings_yield, yield_spread, equity_attractiveness, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:earningsYieldEngine" }
  };
}

module.exports = {
  dcfEngine,
  grahamNumberEngine,
  reverseDcfEngine,
  earningsYieldEngine
};
