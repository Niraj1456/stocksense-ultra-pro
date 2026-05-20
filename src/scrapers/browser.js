const puppeteer = require("puppeteer");

async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    return await fn({ browser, page });
  } finally {
    await browser.close();
  }
}

async function retry(fn, { retries = 3 } = {}) {
  let last;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const wait = Math.min(5000, 300 * Math.pow(2, i - 1));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

module.exports = { withBrowser, retry, sleep };

