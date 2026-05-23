/**
 * Stocksense Ultra Pro - Microservice Latency Verification Script
 * Validates that decoupled, in-memory execution drops below 15ms limit.
 */

const dotenv = require("dotenv");
dotenv.config();

const redis = require("../src/lib/cacheRedis");

// Sample cached fundamental data
const mockStaticData = {
  vixOut: { ok: true, data: { inputs: { vix_current: 12.5 } }, meta: { fetchedAt: new Date().toISOString() } },
  chainOut: { ok: true, data: { records: [] }, meta: { fetchedAt: new Date().toISOString() } },
  finOut: { ok: true, data: { peRatio: 22.4, pbRatio: 3.1, pegRatio: 1.2, debtToEquity: 0.6, roe: 14.5, currentRatio: 1.8 }, meta: { fetchedAt: new Date().toISOString() } },
  fmpData: {
    financials: {
      latest: { totalAssets: 1000000, totalLiabilities: 400000, revenue: 500000, grossProfit: 250000, costOfRevenue: 250000, netIncome: 60000, ebitda: 90000, operatingIncome: 80000, EPS: 4.2 },
      income: [
        { revenue: 500000, grossProfit: 250000, netIncome: 60000 },
        { revenue: 450000, grossProfit: 220000, netIncome: 50000 }
      ],
      balance: [
        { totalAssets: 1000000, totalLiabilities: 400000, totalCurrentAssets: 300000, totalCurrentLiabilities: 150000, longTermDebt: 200000 },
        { totalAssets: 900000, totalLiabilities: 380000, totalCurrentAssets: 280000, totalCurrentLiabilities: 140000, longTermDebt: 190000 }
      ]
    },
    metrics: [{ debtToEquity: 0.6, roe: 0.145, currentRatio: 1.8, roic: 0.12 }],
    profile: { marketCap: 1500000, beta: 1.1, averageVolume: 1200000 },
    dcf: { dcf: 1200.0 }
  },
  avSentiment: { avgSentiment: 0.35, sentimentLabel: "BULLISH", pts: 2, vetoFlag: false, articleCount: 15, dataConfidence: "HIGH" },
  avEarnings: { daysToEarnings: 45, recentSurprises: [] },
  fiiDiiOut: { ok: true, data: [{ category: "FII", netValue: 120 }, { category: "DII", netValue: 95 }] },
  bulkDealsOut: { ok: true, data: [] },
  blockDealsOut: { ok: true, data: [] },
  layer15SupplyChainNews: { ok: true, data: { items: [] } },
  layer15Announcements: { ok: true, data: [] },
  layer17Metrics: { expectancy: 1.8, winRate: 64.5, drawdown: 8.2, performanceGrade: "A+", totalTrades: 42 },
  sector: "IT",
  sectorIndexSymbol: "NIFTY IT"
};

// MOCK cacheGet BEFORE importing analyzeStock to intercept CommonJS destructuring
redis.cacheGet = async (key) => {
  if (key && key.includes("stocksense:static")) {
    return mockStaticData;
  }
  return undefined;
};

// Now import analyzeStock (it gets the mocked function)
const { analyzeStock } = require("../src/analyze/analyzeStock");
const VolatileCacheManager = require("../src/lib/volatileCache");

async function runBenchmark() {
  const symbol = "TCS";
  console.log("=============================================================");
  console.log(`Starting High-Speed Microservice Verification for ${symbol}...`);
  console.log("=============================================================");

  // 1. Initialize Volatile Cache
  console.log("[1/3] Initializing volatile WebSocket memory cache...");
  const volatileObj = VolatileCacheManager.initSymbol(symbol);
  console.log(`- Volatile Cache hot-loaded. Price: ₹${volatileObj.lastPrice}`);

  // 2. Populate Static fundamental Cache
  console.log("[2/3] Mocking Redis static cache to simulate instant hit...");
  // Already mocked above

  // 3. Profile decoupled Execution Latency
  console.log("[3/3] Executing 18-layer scoring engine under decoupled constraints...");

  // Run a warmup run to ensure V8 jit compiler optimizations are applied
  await analyzeStock(symbol, "ST");

  // Perform multiple profiling iterations to gather average execution speeds
  const iterations = 50;
  let totalLatency = 0;
  let successCount = 0;
  let resultsSample = null;

  for (let i = 0; i < iterations; i++) {
    // Fluctuate price slightly to emulate live tick flow
    VolatileCacheManager.updateTick(symbol, 3400.0 + (Math.random() - 0.5) * 5);

    const start = performance.now();
    const result = await analyzeStock(symbol, "ST");
    const end = performance.now();
    
    const latency = end - start;
    totalLatency += latency;

    if (result.ok && result.data && result.data.masterScore) {
      successCount++;
      if (i === 0) resultsSample = result;
    }
  }

  const averageLatency = totalLatency / iterations;
  console.log("\n=============================================================");
  console.log("                      BENCHMARK RESULTS                      ");
  console.log("=============================================================");
  console.log(`Total Iterations : ${iterations}`);
  console.log(`Successful Runs  : ${successCount} / ${iterations}`);
  console.log(`Average Latency  : ${averageLatency.toFixed(4)} ms`);
  console.log(`Target Latency   : < 15.0000 ms`);
  
  if (averageLatency < 15.0) {
    console.log("\x1b[32m%s\x1b[0m", `[PASS] Architectural Optimization SUCCESSFUL! Latency is well below 15ms.`);
  } else {
    console.log("\x1b[31m%s\x1b[0m", `[FAIL] Average latency of ${averageLatency.toFixed(2)}ms exceeded the 15ms microservice guardrail.`);
  }

  if (resultsSample) {
    console.log("\n-------------------------------------------------------------");
    console.log("SAMPLE OUTPUT PREVIEW:");
    console.log(`- Master Conviction Score : ${resultsSample.data.masterScore}`);
    console.log(`- Final Trade Verdict    : ${resultsSample.data.verdict}`);
    console.log(`- Trade Direction        : ${resultsSample.layers.layer13.scoreOut.data.engineResult.direction}`);
    console.log(`- Vetoes Triggered       : ${resultsSample.layers.layer13.scoreOut.data.engineResult.isVetoed ? "YES" : "NO"}`);
    console.log(`- Backtest Expectancy    : ${resultsSample.layers.layer17.expectancy}R`);
    console.log("-------------------------------------------------------------");
  }
  
  const r = redis.getRedis();
  if (r) {
    try {
      await r.quit();
    } catch {}
  }
  
  // Exit the process cleanly
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
