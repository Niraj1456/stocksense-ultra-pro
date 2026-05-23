/**
 * Stocksense Ultra Pro - Background Cache Hydrator Worker
 * Handles slow, heavy API and DB queries in the background and saves parsed results to Redis.
 */

const { cacheSet } = require("../lib/cacheRedis");
const { createQueue } = require("../lib/queue");

const Layer1 = require("../layers/layer1");
const Layer6 = require("../layers/layer6");
const Layer7 = require("../layers/layer7");
const Layer8 = require("../layers/layer8");
const Layer15 = require("../layers/layer15");
const Layer17 = require("../layers/layer17");
const { getCandles } = require("../layers/layer3/candles");
const { fetchMarketDepth } = require("../services/nseDerivatives");
const fmp = require("../services/fmpService");
const av = require("../services/alphaVantageService");
const kiteService = require("../services/kiteService");
const { SECTOR_MAP } = require("../layers/layer13/sectorNormalization");

const SECTOR_INDEX_MAP = {
  'IT': 'NIFTY IT',
  'FIN': 'NIFTY BANK',
  'AUTO': 'NIFTY AUTO',
  'METAL': 'NIFTY METAL',
  'PHARMA': 'NIFTY PHARMA',
  'FMCG': 'NIFTY FMCG',
  'ENERGY': 'NIFTY ENERGY',
  'GENERAL': 'NIFTY 50'
};

const REDIS_EXPIRATION_TIME = 24 * 60 * 60; // 24 Hours in seconds

/**
 * Hydrates static data for a single symbol
 */
async function hydrateSymbol(symbol, mode = "ST") {
  const cleanSymbol = String(symbol).trim().toUpperCase();
  console.log(`[Cache Hydration] Starting hydration for ${cleanSymbol}...`);

  const sector = SECTOR_MAP[cleanSymbol] || 'GENERAL';
  const sectorIndexSymbol = SECTOR_INDEX_MAP[sector] || 'NIFTY 50';

  try {
    // Fire all slow, static data sources in parallel
    const [
      vixOut,
      chainOut,
      finOut,
      fmpData,
      avSentiment,
      avEarnings,
      kiteQuoteOut,
      kiteSectorQuoteOut,
      fiiDiiOut,
      bulkDealsOut,
      blockDealsOut,
      layer15SupplyChainNews,
      layer15Announcements
    ] = await Promise.all([
      Layer1.indiaVix().catch((e) => ({ ok: false, error: e.message })),
      Layer7.optionsChain(cleanSymbol).catch((e) => ({ ok: false, error: e.message })),
      Layer8.financials(cleanSymbol).catch((e) => ({ ok: false, error: e.message })),
      fmp.getFullProfile(cleanSymbol).catch(() => null),
      av.getNewsSentiment(cleanSymbol).catch(() => null),
      av.getEarningsCalendar(cleanSymbol).catch(() => null),
      kiteService.getQuote(cleanSymbol).catch(() => null),
      kiteService.getQuote(sectorIndexSymbol).catch(() => null),
      Layer6.fiiDii().catch(() => ({ ok: false })),
      Layer6.bulkDeals().catch(() => ({ ok: false })),
      Layer6.blockDeals().catch(() => ({ ok: false })),
      Layer15.supplyChainNews ? Layer15.supplyChainNews().catch((e) => ({ ok: false, error: e?.message })) : Promise.resolve({ ok: false }),
      Layer15.announcements ? Layer15.announcements(cleanSymbol).catch((e) => ({ ok: false, error: e?.message })) : Promise.resolve({ ok: false })
    ]);

    // ═══════════════════════════════════════════════════════════════
    // LAYER 17: Dynamic Database Backtesting
    // ═══════════════════════════════════════════════════════════════
    let layer17Metrics = { expectancy: null, winRate: null, drawdown: null, totalTrades: 0, performanceGrade: "N/A" };
    try {
      const { dbQuery } = require("../lib/db");
      const dbRes = await dbQuery(
        `SELECT entry_price, sl, exit_price, entry_ts 
         FROM trades 
         WHERE symbol = $1 AND exit_price IS NOT NULL AND sl IS NOT NULL AND entry_price IS NOT NULL
         ORDER BY entry_ts ASC`,
        [cleanSymbol]
      );

      if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
        const mappedTrades = dbRes.rows.map(row => {
          const entry = Number(row.entry_price);
          const sl = Number(row.sl);
          const exit = Number(row.exit_price);
          
          let r_multiple = 0;
          const risk = entry - sl;
          if (risk !== 0) {
            r_multiple = (exit - entry) / risk;
          }
          return {
            r_multiple: Number(r_multiple.toFixed(2)),
            entry_ts: row.entry_ts
          };
        });

        const expectancyRes = Layer17.tradeExpectancyEngine({ trades: mappedTrades });
        
        let currentVal = 100000;
        const portfolioCurve = [currentVal];
        const dailyReturns = [];
        
        for (const t of mappedTrades) {
          const tradeReturn = t.r_multiple * 1000;
          const prevVal = currentVal;
          currentVal += tradeReturn;
          portfolioCurve.push(currentVal);
          dailyReturns.push(((currentVal - prevVal) / prevVal) * 100);
        }

        const drawdownRes = Layer17.drawdownEngine({ daily_portfolio_values: portfolioCurve });
        const riskAdjustedRes = Layer17.riskAdjustedReturnsEngine({ daily_returns_pct: dailyReturns });

        if (expectancyRes.ok) {
          layer17Metrics.expectancy = Number(expectancyRes.data.expectancy.toFixed(2));
          layer17Metrics.winRate = Number(expectancyRes.data.win_rate.toFixed(1));
          layer17Metrics.totalTrades = expectancyRes.data.total_trades;
        }
        if (drawdownRes.ok) {
          layer17Metrics.drawdown = Number(drawdownRes.data.max_drawdown_pct.toFixed(2));
        }
        if (riskAdjustedRes.ok) {
          layer17Metrics.performanceGrade = riskAdjustedRes.data.performance_grade;
        }
        
        console.log(`[Layer 17 DB Backtest] Executed for ${cleanSymbol}: ${layer17Metrics.totalTrades} trades`);
      }
    } catch (dbErr) {
      console.warn(`[Layer 17 DB Backtest] Database loop skipped/failed during background hydration: ${dbErr.message}`);
    }

    // Compile into static data object
    const staticData = {
      vixOut,
      chainOut,
      finOut,
      fmpData,
      avSentiment,
      avEarnings,
      fiiDiiOut,
      bulkDealsOut,
      blockDealsOut,
      layer15SupplyChainNews,
      layer15Announcements,
      layer17Metrics,
      sector,
      sectorIndexSymbol,
      hydratedAt: new Date().toISOString()
    };

    // Compress (JSON stringify) and cache in Redis with 24 hours TTL
    const cacheKey = `stocksense:static:${cleanSymbol}`;
    await cacheSet(cacheKey, staticData, REDIS_EXPIRATION_TIME);
    console.log(`[Cache Hydration] Successfully hydrated and cached static data for ${cleanSymbol}!`);

    // Synchronize fast-moving volatile data cache if real KiteQuotes or Candles are available
    if (kiteQuoteOut?.ok && kiteQuoteOut.data?.lastPrice) {
      const VolatileCacheManager = require("../lib/volatileCache");
      VolatileCacheManager.updateTick(cleanSymbol, kiteQuoteOut.data.lastPrice, kiteQuoteOut.data.depth);
    }
  } catch (err) {
    console.error(`[Cache Hydration] Failed to hydrate symbol ${cleanSymbol}:`, err.message);
    throw err;
  }
}

/**
 * Initializes and starts the background queue worker process
 */
function startCacheHydrator() {
  console.log("[Cache Hydration Worker] Initializing Bull Queue Worker...");
  
  let queue;
  try {
    queue = createQueue("cache-hydration");
  } catch (err) {
    console.warn("[Cache Hydration Worker] Redis queue disabled or unavailable:", err.message);
    return;
  }

  // Process 1 job at a time to prevent rate-limiting on external APIs
  queue.process(1, async (job) => {
    const { symbol, mode } = job.data;
    console.log(`[Cache Hydration Worker] Received job to hydrate ${symbol}...`);
    await hydrateSymbol(symbol, mode);
  });

  queue.on("failed", (job, err) => {
    console.error(`[Cache Hydration Worker] Job for ${job?.data?.symbol} failed:`, err.message);
  });

  console.log("[Cache Hydration Worker] Worker is successfully processing jobs.");
}

module.exports = { hydrateSymbol, startCacheHydrator };
