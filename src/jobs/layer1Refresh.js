const cron = require("node-cron");
const { cache } = require("../lib/cache");
const { fetchAllIndices, fetchAdvancesDeclines } = require("../services/nse");
const { fetchQuotes } = require("../services/yahoo");
const { logger } = require("../lib/logger");

async function refreshOnce() {
  try {
    const [indices, advdec, quotes] = await Promise.all([
      fetchAllIndices().catch((e) => ({ error: e?.message || "allIndices_failed" })),
      fetchAdvancesDeclines().catch((e) => ({ error: e?.message || "advdec_failed" })),
      fetchQuotes(["^IXIC", "^N225", "^HSI", "USDINR=X", "CL=F"]).catch((e) => ({
        error: e?.message || "quotes_failed"
      }))
    ]);

    cache.set(
      "layer1:nse:allIndices",
      { fetchedAt: new Date().toISOString(), data: indices, warmedBy: "cron" },
      30 * 1000
    );
    cache.set(
      "layer1:nse:advdec",
      { fetchedAt: new Date().toISOString(), data: advdec, warmedBy: "cron" },
      30 * 1000
    );
    cache.set(
      "layer1:yahoo:quotes",
      { fetchedAt: new Date().toISOString(), data: quotes, warmedBy: "cron" },
      20 * 1000
    );

    logger.info("layer1_refresh_ok");
  } catch (e) {
    logger.warn("layer1_refresh_failed", { message: e?.message });
  }
}

function startLayer1Jobs() {
  // Warm immediately on boot
  refreshOnce();

  // Every minute; endpoints still have their own TTL.
  cron.schedule("*/1 * * * *", () => {
    refreshOnce();
  });
}

module.exports = { startLayer1Jobs };

