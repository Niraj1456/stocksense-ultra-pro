const cheerio = require("cheerio");
const { withBrowser, retry, sleep } = require("./browser");

function toNumber(x) {
  if (x === null || x === undefined) return null;
  const cleaned = String(x).replace(/[,₹%\s]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function scrapeScreenerBasics(symbol) {
  const url = `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`;
  const html = await retry(async () => {
    return withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(1000);
      return await page.content();
    });
  });

  const $ = cheerio.load(html);
  const kv = {};
  $(".company-ratios li").each((_, li) => {
    const k = $(li).find(".name").text().trim();
    const v = $(li).find(".value").text().trim();
    if (k) kv[k] = v;
  });

  const data = {
    symbol,
    marketCap: toNumber(kv["Market Cap"]),
    currentPrice: toNumber(kv["Current Price"]),
    highLow: kv["High / Low"] || null,
    stockPE: toNumber(kv["Stock P/E"]),
    bookValue: toNumber(kv["Book Value"]),
    dividendYield: toNumber(kv["Dividend Yield"]),
    roce: toNumber(kv["ROCE"]),
    roe: toNumber(kv["ROE"])
  };

  return { ok: true, data, meta: { source: "scrape:screener", fetchedAt: new Date().toISOString() } };
}

module.exports = { scrapeScreenerBasics };

