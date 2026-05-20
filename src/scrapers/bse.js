const { withBrowser, retry, sleep } = require("./browser");

async function scrapeBseAnnouncements(symbol) {
  const url = "https://www.bseindia.com/corporates/ann.html";
  const text = await retry(async () => {
    return withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(1200);
      return await page.evaluate(() => document.body.innerText || "");
    });
  });

  return {
    ok: true,
    data: {
      symbol,
      rawSample: text.slice(0, 4000)
    },
    meta: { source: "scrape:bse_announcements", fetchedAt: new Date().toISOString() }
  };
}

module.exports = { scrapeBseAnnouncements };

