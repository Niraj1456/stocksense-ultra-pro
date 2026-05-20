// MODULE 9.1 — ALTMAN Z-SCORE (Bankruptcy Risk Engine)
function altmanZScoreEngine({ working_capital = 0, retained_earnings = 0, ebit = 0, market_value_equity = 0, total_liabilities = 0, sales = 0, total_assets = 1 }) {
  if (total_assets === 0 || total_liabilities === 0) return { ok: false, error: "invalid_inputs" };

  const x1 = working_capital / total_assets;
  const x2 = retained_earnings / total_assets;
  const x3 = ebit / total_assets;
  const x4 = market_value_equity / total_liabilities;
  const x5 = sales / total_assets;

  // Formula for public non-financial companies
  const z_score = (1.2 * x1) + (1.4 * x2) + (3.3 * x3) + (0.6 * x4) + (1.0 * x5);

  let zone = "UNKNOWN";
  let veto = false;
  let flag = null;

  if (z_score >= 2.99) {
    zone = "SAFE_ZONE";
  } else if (z_score >= 1.81 && z_score < 2.99) {
    zone = "GREY_ZONE";
    flag = "MODERATE_BANKRUPTCY_RISK";
  } else if (z_score < 1.81) {
    zone = "DISTRESS_ZONE";
    flag = "HIGH_BANKRUPTCY_RISK";
    veto = true;
  }

  return {
    ok: true,
    data: { z_score, zone, flag, veto, metrics: { x1, x2, x3, x4, x5 } },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:altmanZScoreEngine" }
  };
}

// MODULE 9.2 — BENEISH M-SCORE (Earnings Manipulation)
function beneishMScoreEngine({ 
  dsri = 1.0, // Days Sales in Receivables Index
  gmi = 1.0,  // Gross Margin Index
  aqi = 1.0,  // Asset Quality Index
  sgi = 1.0,  // Sales Growth Index
  depi = 1.0, // Depreciation Index
  sgai = 1.0, // Sales, General and Administrative expenses Index
  lvgi = 1.0, // Leverage Index
  tata = 0.0  // Total Accruals to Total Assets
}) {
  const m_score = -4.84 + (0.92 * dsri) + (0.528 * gmi) + (0.404 * aqi) + (0.892 * sgi) + (0.115 * depi) - (0.172 * sgai) + (4.679 * tata) - (0.327 * lvgi);

  let manipulator_probability = "LOW";
  let veto = false;
  let flag = null;

  // M-Score greater than -1.78 indicates high probability of earnings manipulation
  if (m_score > -1.78) {
    manipulator_probability = "HIGH";
    veto = true;
    flag = "POTENTIAL_EARNINGS_MANIPULATION";
  } else if (m_score > -2.22 && m_score <= -1.78) {
    manipulator_probability = "ELEVATED";
    flag = "ELEVATED_MANIPULATION_RISK";
  }

  return {
    ok: true,
    data: { m_score, manipulator_probability, flag, veto },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:beneishMScoreEngine" }
  };
}

// MODULE 9.3 — PIOTROSKI F-SCORE (Fundamental Strength)
function piotroskiFScoreEngine({
  net_income_positive = false,
  cfo_positive = false,
  roce_improving = false,
  cfo_greater_than_net_income = false,
  long_term_debt_decreasing = false,
  current_ratio_improving = false,
  no_new_shares_issued = false,
  gross_margin_improving = false,
  asset_turnover_improving = false
}) {
  let f_score = 0;

  // Profitability
  if (net_income_positive) f_score += 1;
  if (cfo_positive) f_score += 1;
  if (roce_improving) f_score += 1;
  if (cfo_greater_than_net_income) f_score += 1;

  // Leverage, Liquidity and Source of Funds
  if (long_term_debt_decreasing) f_score += 1;
  if (current_ratio_improving) f_score += 1;
  if (no_new_shares_issued) f_score += 1;

  // Operating Efficiency
  if (gross_margin_improving) f_score += 1;
  if (asset_turnover_improving) f_score += 1;

  let quality_rating = "AVERAGE";
  let pts = 0;
  let flag = null;

  if (f_score >= 8) {
    quality_rating = "EXCEPTIONAL_QUALITY";
    pts = 5;
  } else if (f_score >= 6 && f_score <= 7) {
    quality_rating = "STRONG_QUALITY";
    pts = 3;
  } else if (f_score >= 4 && f_score <= 5) {
    quality_rating = "AVERAGE";
    pts = 0;
  } else if (f_score <= 3) {
    quality_rating = "WEAK_QUALITY";
    pts = -4;
    flag = "POOR_FUNDAMENTAL_STRENGTH";
  }

  return {
    ok: true,
    data: { f_score, quality_rating, pts, flag },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:piotroskiFScoreEngine" }
  };
}

module.exports = {
  altmanZScoreEngine,
  beneishMScoreEngine,
  piotroskiFScoreEngine
};
