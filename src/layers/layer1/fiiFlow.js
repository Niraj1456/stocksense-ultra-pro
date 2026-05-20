const { withBrowser, retry, sleep } = require("../../scrapers/browser");

async function fiiFlowMonthly() {
  const url = "https://fpi.nsdl.co.in/web/Reports/ReportDetail.aspx?ptype=0";

  // NOTE: NSDL site is dynamic and can change. We implement a robust “page text capture”
  // so the pipeline doesn’t crash; parsing can be tightened once we lock the exact report.
  const text = await retry(async () => {
    return withBrowser(async ({ page }) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Try to click into common report UI patterns if present.
      await sleep(1500);
      return await page.evaluate(() => document.body.innerText || "");
    });
  });

  // Heuristic: extract last few currency-like values.
  const nums = (text.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) || []).slice(-20);

  return {
    ok: true,
    data: { rawTextSample: text.slice(0, 2000), extractedNumbersTail: nums },
    meta: { fetchedAt: new Date().toISOString(), source: "scrape:nsdl_fpi" }
  };
}

module.exports = { fiiFlowMonthly };

