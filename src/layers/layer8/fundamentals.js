// MODULE 8.1 — VALUATION SCORE ENGINE
// FIX RC4: industryPe is now populated from sectorPeMap.js — PE comparison is active
function valuationScoreEngine({ pe_ratio = null, industry_pe = null, pb_ratio = null, peg_ratio = null }) {
  let score = 0;
  let signal = "FAIRLY_VALUED";

  if (pe_ratio && industry_pe) {
    if (pe_ratio < industry_pe * 0.7) score += 2;    // Trading at >30% discount to sector
    else if (pe_ratio > industry_pe * 1.5) score -= 2; // Trading at >50% premium to sector
  }

  if (pb_ratio) {
    if (pb_ratio < 1.5) score += 2;
    else if (pb_ratio > 5.0) score -= 2; // FIX: Strengthened penalty from -1 to -2 for extreme PB
  }

  if (peg_ratio) {
    if (peg_ratio > 0 && peg_ratio < 1.0) score += 3; // Undervalued relative to growth
    else if (peg_ratio > 2.0) score -= 2; // Overvalued relative to growth
    // FIX: Handle negative PEG (negative earnings growth = red flag)
    else if (peg_ratio < 0) score -= 1;
  }

  if (score >= 4) signal = "DEEP_VALUE";
  else if (score >= 2 && score < 4) signal = "UNDERVALUED";
  else if (score < 0 && score > -3) signal = "OVERVALUED";
  else if (score <= -3) signal = "DANGEROUSLY_OVERVALUED";

  return {
    ok: true,
    data: { pe_ratio, industry_pe, pb_ratio, peg_ratio, valuation_score: score, signal },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:valuationScoreEngine" }
  };
}

// MODULE 8.2 — EARNINGS & GROWTH MOMENTUM
function growthMomentumEngine({ qoq_sales_growth = 0, yoy_sales_growth = 0, qoq_eps_growth = 0, yoy_eps_growth = 0, eps_surprise_pct = 0 }) {
  let score = 0;
  let label = "STAGNANT";

  // YoY Growth
  if (yoy_sales_growth > 15) score += 2;
  else if (yoy_sales_growth < 0) score -= 2;

  if (yoy_eps_growth > 20) score += 3;
  else if (yoy_eps_growth < 0) score -= 3;

  // QoQ Growth
  if (qoq_sales_growth > 10) score += 1;
  else if (qoq_sales_growth < 0) score -= 1;

  if (qoq_eps_growth > 10) score += 2;
  else if (qoq_eps_growth < 0) score -= 2;

  // Earnings Surprise
  if (eps_surprise_pct > 5) score += 2;
  else if (eps_surprise_pct < -5) score -= 3;

  if (score >= 6) label = "HYPER_GROWTH";
  else if (score >= 3 && score < 6) label = "STRONG_GROWTH";
  else if (score >= 0 && score < 3) label = "STABLE";
  else if (score < 0 && score > -4) label = "SLOWDOWN";
  else if (score <= -4) label = "CONTRACTION";

  return {
    ok: true,
    data: { qoq_sales_growth, yoy_sales_growth, qoq_eps_growth, yoy_eps_growth, eps_surprise_pct, growth_score: score, label },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:growthMomentumEngine" }
  };
}

// MODULE 8.3 — FORENSIC ACCOUNTING & HEALTH SCORE
// FIX RC2: Now receives correct D/E values (no longer /100)
// FIX RC3: Parameter renamed from 'roe' to match upstream (was mislabeled as 'roce')
function forensicHealthEngine({ debt_to_equity = null, interest_coverage = null, current_ratio = null, roe = null, ocf_to_net_income = null }) {
  let pts = 0;
  const flags = [];

  // Leverage & Solvency — NOW WORKING (D/E values are correct after RC2 fix)
  if (debt_to_equity !== null) {
    if (debt_to_equity > 2.0) { pts -= 3; flags.push("HIGH_LEVERAGE_RISK"); }
    else if (debt_to_equity < 0.5) { pts += 2; }
  }

  // Interest Coverage
  if (interest_coverage !== null) {
    if (interest_coverage < 2.0) { pts -= 4; flags.push("LOW_INTEREST_COVERAGE_DISTRESS"); }
    else if (interest_coverage > 5.0) { pts += 2; }
  }

  // Liquidity
  if (current_ratio !== null) {
    if (current_ratio < 1.0) { pts -= 2; flags.push("POOR_SHORT_TERM_LIQUIDITY"); }
    else if (current_ratio >= 1.5) { pts += 1; }
  }

  // Profitability (ROE — now correctly labeled)
  if (roe !== null) {
    if (roe > 15) { pts += 3; }
    else if (roe < 5) { pts -= 2; flags.push("LOW_RETURN_ON_EQUITY"); }
  }

  // Quality of Earnings
  if (ocf_to_net_income !== null) {
    if (ocf_to_net_income < 0.8) { pts -= 4; flags.push("WEAK_EARNINGS_QUALITY_CFO_LAGGING"); }
    else if (ocf_to_net_income >= 1.0) { pts += 2; }
  }

  let health_rating = "AVERAGE";
  let veto = false;

  if (pts >= 6) health_rating = "EXCELLENT_MOAT";
  else if (pts >= 2 && pts < 6) health_rating = "HEALTHY";
  else if (pts < -2 && pts >= -5) health_rating = "STRESSED";
  else if (pts < -5) { health_rating = "FINANCIAL_DISTRESS"; veto = true; }

  return {
    ok: true,
    data: { health_score: pts, health_rating, flags, veto },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:forensicHealthEngine" }
  };
}

module.exports = {
  valuationScoreEngine,
  growthMomentumEngine,
  forensicHealthEngine
};
