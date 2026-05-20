const axios = require("axios");

const YF_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const YF_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

function headers() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9"
  };
}

async function fetchQuotes(symbols) {
  // Try the quote endpoint first (single request).
  const resp = await axios.get(YF_QUOTE_URL, {
    headers: headers(),
    params: { symbols: symbols.join(",") },
    timeout: 20000,
    validateStatus: () => true
  });

  if (resp.status < 400) {
    const results = {};
    const list = resp.data?.quoteResponse?.result || [];
    for (const s of symbols) results[s] = { symbol: s, error: "not_returned" };

    for (const q of list) {
      const symbol = q.symbol;
      results[symbol] = {
        symbol,
        shortName: q.shortName,
        regularMarketPrice: q.regularMarketPrice,
        regularMarketChange: q.regularMarketChange,
        regularMarketChangePercent: q.regularMarketChangePercent,
        regularMarketTime: q.regularMarketTime,
        currency: q.currency
      };
    }

    return results;
  }

  // Fallback: chart endpoint often works without consent/crumb.
  const fallbackResults = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `${YF_CHART_URL}/${encodeURIComponent(symbol)}`;
        const r = await axios.get(url, {
          headers: headers(),
          params: { range: "1d", interval: "1d" },
          timeout: 20000,
          validateStatus: () => true
        });

        if (r.status >= 400) {
          fallbackResults[symbol] = {
            symbol,
            error: `yahoo_chart_failed:${r.status}`
          };
          return;
        }

        const meta = r.data?.chart?.result?.[0]?.meta;
        if (!meta) {
          fallbackResults[symbol] = { symbol, error: "yahoo_chart_missing_meta" };
          return;
        }

        const price = meta.regularMarketPrice;
        const prev = meta.previousClose;
        const change = typeof price === "number" && typeof prev === "number" ? price - prev : undefined;
        const changePct =
          typeof change === "number" && typeof prev === "number" && prev !== 0 ? (change / prev) * 100 : undefined;

        fallbackResults[symbol] = {
          symbol,
          shortName: meta.shortName || meta.symbol,
          regularMarketPrice: price,
          regularMarketChange: change,
          regularMarketChangePercent: changePct,
          regularMarketTime: meta.regularMarketTime,
          currency: meta.currency
        };
      } catch (e) {
        fallbackResults[symbol] = { symbol, error: e?.message || "yahoo_chart_failed" };
      }
    })
  );

  return fallbackResults;
}

async function fetchChart(symbol, range = "5d", interval = "1d") {
  const url = `${YF_CHART_URL}/${encodeURIComponent(symbol)}`;
  const r = await axios.get(url, {
    headers: headers(),
    params: { range, interval },
    timeout: 20000,
    validateStatus: () => true
  });

  if (r.status >= 400) {
    throw new Error(`yahoo_chart_failed: ${r.status}`);
  }

  const result = r.data?.chart?.result?.[0];
  if (!result || !result.indicators?.quote?.[0]?.close) {
    throw new Error("yahoo_chart_missing_close_data");
  }

  const closes = result.indicators.quote[0].close.filter((c) => c !== null);
  return closes;
}

module.exports = { fetchQuotes, fetchChart };

