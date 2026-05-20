const axios = require("axios");
const { requestWithRetry } = require("../../lib/http");

async function gdpDataIndia() {
  // World Bank API: free, no key.
  const url = "https://api.worldbank.org/v2/country/IND/indicator/NY.GDP.MKTP.KD.ZG";
  const resp = await requestWithRetry({
    method: "GET",
    url,
    params: { format: "json", per_page: 60 }
  });

  // WorldBank returns [meta, data[]]
  const series = Array.isArray(resp.data?.[1]) ? resp.data[1] : [];
  const latest = series.find((r) => r?.value !== null) || null;

  return {
    ok: Boolean(latest),
    data: { latest, series: series.slice(0, 20) },
    meta: { fetchedAt: new Date().toISOString(), source: "worldbank:NY.GDP.MKTP.KD.ZG" },
    error: latest ? undefined : "gdp_series_empty"
  };
}

module.exports = { gdpDataIndia };

