const { dbQuery } = require("../../lib/db");

async function financials(symbol) {
  try {
    const symbolNS = `${symbol}.NS`;
    const yahooFinance = (await import("yahoo-finance2")).default;
    const result = await yahooFinance.quoteSummary(symbolNS, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "price"]
    });

    const fd = result.financialData || {};
    const dks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const price = result.price || {};

    const payload = {
      roce: fd.returnOnEquity ? fd.returnOnEquity * 100 : null,
      debtToEquity: fd.debtToEquity ? fd.debtToEquity / 100 : null,
      currentRatio: fd.currentRatio || null,
      peRatio: sd.trailingPE || sd.forwardPE || null,
      pbRatio: dks.priceToBook || null,
      pegRatio: dks.pegRatio || null,
      marketCap: price.marketCap || null,
      industryPe: null, // Hard to get from yahoo finance directly without more modules
      dividendYield: sd.dividendYield ? sd.dividendYield * 100 : null,
    };

    try {
      await dbQuery(
        "INSERT INTO fundamentals(symbol, period, ts, source, json) VALUES($1,$2,now(),$3,$4::jsonb)",
        [symbol, "latest", "yahoo", JSON.stringify(payload)]
      );
    } catch {
      // DB optional in hybrid mode.
    }

    return {
      ok: true,
      data: payload,
      meta: { fetchedAt: new Date().toISOString(), source: "layer8:financials (yahoo)" }
    };
  } catch (err) {
    return { ok: false, error: err.message, meta: { source: "layer8:financials (yahoo)" } };
  }
}

module.exports = { financials };

