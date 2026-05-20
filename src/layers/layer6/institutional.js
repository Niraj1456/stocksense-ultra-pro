// MODULE 6.1 — MF FLOW SCORING
function mfFlowScoring({ mf_buy_volume = 0, mf_sell_volume = 0, mf_holding_pct = 0 }) {
  const net_flow = mf_buy_volume - mf_sell_volume;
  const total_volume = mf_buy_volume + mf_sell_volume;
  const flow_ratio = total_volume > 0 ? (net_flow / total_volume) * 100 : 0;

  let signal = "NEUTRAL";
  let pts = 0;

  if (flow_ratio > 20) {
    signal = "SMART_MONEY_ACCUMULATING";
    pts = 3;
  } else if (flow_ratio < -20) {
    signal = "SMART_MONEY_DISTRIBUTING";
    pts = -3;
  }

  return {
    ok: true,
    data: { net_flow, flow_ratio, mf_holding_pct, signal, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:mfFlowScoring" }
  };
}

// MODULE 6.2 — FII/DII CONVICTION SCORE
function fiiDiiConviction({ fii_net_flow = 0, dii_net_flow = 0, vix_us = 15 }) {
  let conviction = "MIXED_FLOWS";
  let market_support = "NEUTRAL";
  let pts = 0;

  if (fii_net_flow > 0 && dii_net_flow > 0) {
    conviction = "DUAL_ENGINE_BUYING";
    market_support = "STRONG";
    pts = 4;
  } else if (fii_net_flow < 0 && dii_net_flow > Math.abs(fii_net_flow)) {
    conviction = "DII_ABSORBING_FII_SELLING";
    market_support = "MODERATE";
    pts = 2;
  } else if (fii_net_flow < 0 && dii_net_flow < 0) {
    conviction = "INSTITUTIONAL_EXIT";
    market_support = "WEAK";
    pts = -4;
  } else if (fii_net_flow > 0 && dii_net_flow < 0) {
    conviction = "FII_BUYING_DII_PROFIT_BOOKING";
    market_support = "MODERATE";
    pts = 1;
  }

  return {
    ok: true,
    data: { fii_net_flow, dii_net_flow, vix_us, conviction, market_support, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:fiiDiiConviction" }
  };
}

// Helper functions for matching client types
function isPromoter(clientName) {
  if (!clientName) return false;
  const name = clientName.toUpperCase();
  // Very basic heuristic for promoter identifiers, usually this would come from a DB
  const keywords = ["PROMOTER", "HOLDINGS", "FOUNDATION", "TRUST", "FAMILY"];
  return keywords.some(kw => name.includes(kw));
}

function isInstitution(clientName) {
  if (!clientName) return false;
  const name = clientName.toUpperCase();
  const keywords = ["FUND", "CAPITAL", "MANAGEMENT", "ASSET", "INVESTMENT", "BANK", "SECURITIES", "PARTNERS"];
  return keywords.some(kw => name.includes(kw));
}

// MODULE 6.3 — BULK/BLOCK DEAL ANALYZER
function bulkBlockAnalyzer({ deals = [], avg_daily_volume = 1000000 }) {
  let promoter_selling = 0;
  let institutional_buying = 0;

  for (const deal of deals) {
    const qty = Number(deal.quantity) || 0;
    const type = deal.type ? deal.type.toUpperCase() : "UNKNOWN";
    
    if (type === "SELL" && isPromoter(deal.client)) {
      promoter_selling += qty;
    }
    if (type === "BUY" && isInstitution(deal.client)) {
      institutional_buying += qty;
    }
  }

  let signal = "NO_MAJOR_ACTION";
  let veto = false;
  let pts = 0;

  if (promoter_selling > avg_daily_volume * 0.05) {
    signal = "PROMOTER_DISTRESS_SELL";
    veto = true;
  } else if (institutional_buying > avg_daily_volume * 0.05) {
    signal = "INSTITUTIONAL_URGENCY_BUY";
    pts = 4;
  }

  return {
    ok: true,
    data: { promoter_selling, institutional_buying, signal, veto, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:bulkBlockAnalyzer" }
  };
}

// Helper: Pearson correlation
function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  
  const sumX2 = x.reduce((a, b) => a + (b * b), 0);
  const sumY2 = y.reduce((a, b) => a + (b * b), 0);
  
  const sumXY = x.reduce((a, b, i) => a + (b * y[i]), 0);
  
  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// MODULE 6.4 — PEER CORRELATION ENGINE
function peerCorrelationEngine({ stock_returns = [], peer_returns = [] }) {
  if (stock_returns.length === 0 || peer_returns.length === 0 || stock_returns.length !== peer_returns.length) {
    return { ok: false, error: "invalid_return_arrays", meta: { fetchedAt: new Date().toISOString(), source: "calc:peerCorrelationEngine" } };
  }

  const correlation = pearsonCorrelation(stock_returns, peer_returns);
  
  const stock_returns_avg = stock_returns.reduce((a, b) => a + b, 0) / stock_returns.length;
  const peer_returns_avg = peer_returns.reduce((a, b) => a + b, 0) / peer_returns.length;

  let alpha_status = "CORRELATED_TO_PEER";
  let pts = 0;

  if (correlation < 0.3 && stock_returns_avg > peer_returns_avg) {
    alpha_status = "STOCK_SPECIFIC_ALPHA";
    pts = 2;
  }

  return {
    ok: true,
    data: { correlation, stock_returns_avg, peer_returns_avg, alpha_status, pts },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:peerCorrelationEngine" }
  };
}

module.exports = {
  mfFlowScoring,
  fiiDiiConviction,
  bulkBlockAnalyzer,
  peerCorrelationEngine
};
