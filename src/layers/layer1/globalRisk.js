const { fetchQuotes } = require("../../services/yahoo");

async function globalRisk() {
  try {
    const symbols = ["^VIX", "DX-Y.NYB", "GC=F", "^TNX", "ES=F"];
    const quotes = await fetchQuotes(symbols);

    const vixQuote = quotes["^VIX"];
    const dxyQuote = quotes["DX-Y.NYB"];
    const goldQuote = quotes["GC=F"];
    const us10yQuote = quotes["^TNX"];
    const sp500Quote = quotes["ES=F"];

    const vix_us = vixQuote?.regularMarketPrice || 15;
    const dxy = dxyQuote?.regularMarketPrice || 102;
    const gold_change_pct = goldQuote?.regularMarketChangePercent || 0;
    const us_10y_yield = us10yQuote?.regularMarketPrice || 4.0;
    const sp500_futures = sp500Quote?.regularMarketChangePercent || 0;

    let risk_score = 0;

    if (vix_us < 15) risk_score += 2;
    else if (vix_us >= 20) risk_score -= 2;

    if (dxy > 105) risk_score -= 1;
    else if (dxy < 100) risk_score += 1;

    if (gold_change_pct > 1.0) risk_score -= 1;
    else if (gold_change_pct < -0.5) risk_score += 1;

    if (sp500_futures > 0.5) risk_score += 2;
    else if (sp500_futures < -0.5) risk_score -= 2;

    let regime = "";
    let india_flow_expectation = "";
    let vix_india_premium = 0;

    if (risk_score >= 3) {
      regime = "STRONG_RISK_ON";
      india_flow_expectation = "FII_BUYING";
    } else if (risk_score >= 1 && risk_score < 3) {
      regime = "MILD_RISK_ON";
      india_flow_expectation = "FII_NEUTRAL";
    } else if (risk_score >= -1 && risk_score < 1) {
      regime = "RISK_NEUTRAL";
      india_flow_expectation = "FII_MIXED";
    } else if (risk_score >= -3 && risk_score < -1) {
      regime = "MILD_RISK_OFF";
      india_flow_expectation = "FII_SELLING";
      vix_india_premium = 2;
    } else if (risk_score < -3) {
      regime = "STRONG_RISK_OFF";
      india_flow_expectation = "FII_HEAVY_SELLING";
      vix_india_premium = 4;
    }

    return {
      ok: true,
      data: {
        inputs: {
          vix_us,
          dxy,
          gold_change_pct,
          us_10y_yield,
          sp500_futures
        },
        risk_score,
        regime,
        india_flow_expectation,
        vix_india_premium
      },
      meta: { fetchedAt: new Date().toISOString(), source: "yahoo:quotes" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { globalRisk };
