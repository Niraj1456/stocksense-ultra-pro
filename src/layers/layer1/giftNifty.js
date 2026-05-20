const { withBrowser, retry } = require("../../scrapers/browser");
const { fetchAllIndices } = require("../../services/nse");
const { fetchQuotes } = require("../../services/yahoo");

async function scrapeGiftNifty() {
  const url = "https://www.nseifsc.com/";
  const result = await retry(async () => {
    return withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return await page.evaluate(() => document.body.innerText || "");
    });
  });

  const idx = result.toUpperCase().indexOf("GIFT");
  const snippet = idx >= 0 ? result.slice(idx, idx + 500) : result.slice(0, 500);
  const m = snippet.match(/(\d{4,6}(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

async function giftNifty() {
  try {
    const gift_nifty_current = await scrapeGiftNifty();

    if (!gift_nifty_current || !Number.isFinite(gift_nifty_current)) {
      return { ok: false, error: "gift_nifty_price_not_found" };
    }

    const rawIndices = await fetchAllIndices();
    const arr = Array.isArray(rawIndices?.data) ? rawIndices.data : Array.isArray(rawIndices?.data?.data) ? rawIndices.data.data : Array.isArray(rawIndices?.data?.data?.data) ? rawIndices.data.data.data : [];
    const nifty = arr.find((r) => r?.index === "NIFTY 50");

    if (!nifty) {
      return { ok: false, error: "nifty_50_previous_close_not_found" };
    }

    const nifty_prev_close = nifty.previousClose;

    // Fetch Nasdaq Futures
    const quotes = await fetchQuotes(["NQ=F"]);
    const nasdaqQuote = quotes["NQ=F"];
    let nasdaq_futures_change = 0;
    if (nasdaqQuote && !nasdaqQuote.error) {
      nasdaq_futures_change = nasdaqQuote.regularMarketChangePercent || 0;
    }

    // CALCULATIONS
    const premium_pts = gift_nifty_current - nifty_prev_close;
    const premium_pct = (premium_pts / nifty_prev_close) * 100;

    let prediction = "";
    let entry_strategy = "";
    let orb_adjustment = "";
    let gap_fill_level = null;
    let intraday_longs_suppressed = false;

    if (premium_pct > 1.5) {
      prediction = "STRONG_GAP_UP";
      entry_strategy = "BUY_ON_OPEN";
      orb_adjustment = "STANDARD";
    } else if (premium_pct > 0.5 && premium_pct <= 1.5) {
      prediction = "GAP_UP_LIKELY";
      entry_strategy = "BUY_ON_OPEN_OR_ORB";
      orb_adjustment = "STANDARD";
    } else if (premium_pct >= -0.5 && premium_pct <= 0.5) {
      prediction = "FLAT_OPEN";
      entry_strategy = "WAIT_FOR_ORB";
      orb_adjustment = "STANDARD";
    } else if (premium_pct < -0.5 && premium_pct >= -1.5) {
      prediction = "GAP_DOWN_LIKELY";
      entry_strategy = "WAIT_FOR_GAP_FILL_THEN_ORB";
      orb_adjustment = "ABOVE_GAP_FILL_LEVEL";
      gap_fill_level = nifty_prev_close;
    } else if (premium_pct < -1.5) {
      prediction = "STRONG_GAP_DOWN";
      entry_strategy = "SWING_ABOVE_PREV_CLOSE_ONLY";
      intraday_longs_suppressed = true;
    }

    let global_risk_off = false;
    let vix_add = 0;

    if (nasdaq_futures_change < -1.0 && premium_pct < -0.5) {
      global_risk_off = true;
      vix_add = 3;
    }

    return {
      ok: true,
      data: {
        inputs: {
          gift_nifty_current,
          nifty_prev_close,
          nasdaq_futures_change
        },
        premium_pts,
        premium_pct,
        prediction,
        entry_strategy,
        orb_adjustment,
        gap_fill_level,
        intraday_longs_suppressed,
        global_risk_off,
        vix_add
      },
      meta: { fetchedAt: new Date().toISOString(), source: "scrape:nseifsc + nse:/api/allIndices" }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { giftNifty };
