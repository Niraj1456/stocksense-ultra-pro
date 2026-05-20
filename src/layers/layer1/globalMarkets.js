const { fetchQuotes } = require("../../services/yahoo");

async function globalMarkets() {
  const symbols = ["^IXIC", "^N225", "^HSI", "USDINR=X", "CL=F", "GC=F"];
  const data = await fetchQuotes(symbols);
  return {
    ok: true,
    data,
    meta: { fetchedAt: new Date().toISOString(), source: "yahoo:chart_fallback" }
  };
}

module.exports = { globalMarkets };

