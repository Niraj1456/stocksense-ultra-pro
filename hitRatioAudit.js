/**
 * StockSense Ultra Pro — Hit Ratio Audit v4.0
 * Purpose: Verify the 80% hit ratio claim for Zerodha
 * Method: Take 100 random NSE stocks, run through our engine,
 *         compare 5-day-ago predictions vs actual outcomes.
 * Data Source: Yahoo Finance (real OHLCV) + technicalindicators (ADX/EMA)
 * Zero simulation. Every signal is empirical.
 */

const https = require('https');
const { runEngine } = require("./src/layers/layer13/scoreEngine");
const { ADX, EMA } = require("technicalindicators");

// ─── HELPERS ──────────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
let uaIdx = 0;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const ua = USER_AGENTS[uaIdx++ % USER_AGENTS.length];
    const opts = {
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };
    https.get(url, opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMITED'));
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('JSON_PARSE')); }
      });
    }).on('error', reject);
  });
}

async function fetchYahoo(symbol, retries = 3) {
  const sym = `${symbol}.NS`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await sleep(3000 * attempt);
      const body = await httpGet(
        `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=3mo&interval=1d&includePrePost=false`
      );
      const result = body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result');
    } catch (e) {
      if (e.message === 'RATE_LIMITED' && attempt < retries - 1) continue;
      if (attempt === retries - 1) throw e;
    }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── INDICATORS ───────────────────────────────────────────────────────────
function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgG = gains / period, avgL = losses / period;
  return avgL === 0 ? 100 : +(100 - (100 / (1 + avgG / avgL))).toFixed(2);
}

function computeATR(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

// ─── 100 RANDOM NSE STOCKS ───────────────────────────────────────────────
// Diverse mix: Large-cap, Mid-cap, Small-cap across all sectors
const AUDIT_STOCKS = [
  // NIFTY 50 Core (30)
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT",
  "AXISBANK", "SUNPHARMA", "BAJFINANCE", "TITAN", "ASIANPAINT", "MARUTI", "HCLTECH", "WIPRO", "ULTRACEMCO", "TATASTEEL",
  "ONGC", "POWERGRID", "NTPC", "COALINDIA", "DRREDDY", "CIPLA", "GRASIM", "EICHERMOT", "BAJAJ-AUTO", "HINDALCO",
  // Mid-cap Diversified (30)
  "TATAPOWER", "VEDL", "TRENT", "GODREJCP", "DABUR", "COLPAL", "HAVELLS", "VOLTAS", "PIDILITIND", "MARICO",
  "CROMPTON", "CANBK", "BANKBARODA", "PNB", "FEDERALBNK", "INDIGO", "DLF", "GODREJPROP", "OBEROIRLTY", "POLYCAB",
  "DIXON", "CUMMINSIND", "BOSCHLTD", "ASTRAL", "ATUL", "COROMANDEL", "BALKRISIND", "GAIL", "BEL", "HAL",
  // Pharma + Healthcare (10)
  "AUROPHARMA", "LUPIN", "BIOCON", "GLENMARK", "ALKEM", "TORNTPHARM", "GRANULES", "LAURUSLABS", "DIVISLAB", "APOLLOHOSP",
  // IT + Tech (5)
  "TECHM", "COFORGE", "CYIENT", "ECLERX", "PERSISTENT",
  // FMCG + Consumer (5)
  "BRITANNIA", "NESTLEIND", "EMAMILTD", "TATACONSUM", "BATAINDIA",
  // Banks + Finance (10)
  "CHOLAFIN", "MUTHOOTFIN", "BAJAJFINSV", "AUBANK", "IDFCFIRSTB", "HDFCLIFE", "SBILIFE", "BANDHANBNK", "CANFINHOME", "SHRIRAMFIN",
  // Metals + Energy + Infra (10)
  "JSWSTEEL", "JINDALSTEL", "NMDC", "BPCL", "BHEL", "SIEMENS", "ABB", "AMBUJACEM", "ACC", "SRF"
];

// ─── MAIN AUDIT ───────────────────────────────────────────────────────────
async function runAudit() {
  const timestamp = new Date().toISOString();
  console.log("\n╔═══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  STOCKSENSE ULTRA PRO — HIT RATIO AUDIT v4.0                                ║");
  console.log("║  100 NSE Stocks | Yahoo Finance Real OHLCV | Zero Simulation                 ║");
  console.log("║  Prediction Window: 5 Trading Days | Engine: scoreEngine v3.0                ║");
  console.log(`║  Timestamp: ${timestamp.padEnd(63)}║`);
  console.log("╚═══════════════════════════════════════════════════════════════════════════════╝\n");

  const results = [];
  let dirHits = 0, dirTotal = 0;
  let tgtHits = 0, tgtTotal = 0;
  let neutralCount = 0;
  let failCount = 0;

  // Tracking by verdict category
  const verdictBuckets = {};
  const scoreBands = { '0-25': { hits: 0, total: 0 }, '26-45': { hits: 0, total: 0 }, '46-55': { hits: 0, total: 0 }, '56-75': { hits: 0, total: 0 }, '76-100': { hits: 0, total: 0 } };

  for (let i = 0; i < AUDIT_STOCKS.length; i++) {
    const stock = AUDIT_STOCKS[i];
    const progress = `[${(i + 1).toString().padStart(3)}/${AUDIT_STOCKS.length}]`;
    process.stdout.write(`  ${progress} ${stock.padEnd(14)}`);

    let yahooResult;
    try {
      yahooResult = await fetchYahoo(stock);
    } catch (e) {
      console.log(`⚠ SKIP (Yahoo: ${e.message})`);
      failCount++;
      continue;
    }

    const q = yahooResult.indicators?.quote?.[0];
    if (!q) { console.log(`⚠ SKIP (no quote data)`); failCount++; continue; }

    const closes = q.close.filter(Boolean);
    const highs = q.high.filter(Boolean);
    const lows = q.low.filter(Boolean);
    const volumes = q.volume.filter(Boolean);

    if (closes.length < 30) { console.log("⚠ SKIP (insufficient data)"); failCount++; continue; }

    // ── Prediction point: 5 days ago ──
    const lookback = 5;
    const predIdx = closes.length - 1 - lookback;
    const predPrice = closes[predIdx];
    const actualPrice = closes[closes.length - 1];
    const actualChange = ((actualPrice - predPrice) / predPrice) * 100;

    // ── Compute indicators AT prediction point ──
    const closesAt = closes.slice(0, predIdx + 1);
    const highsAt = highs.slice(0, predIdx + 1);
    const lowsAt = lows.slice(0, predIdx + 1);
    const volumesAt = volumes.slice(0, predIdx + 1);

    const rsi = computeRSI(closesAt);
    const atrValue = computeATR(highsAt, lowsAt, closesAt);
    const todayVol = volumesAt[volumesAt.length - 1];
    const avgVol = volumesAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const rvol = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
    const mom5 = closesAt.length >= 6 ? (closesAt[closesAt.length - 1] > closesAt[closesAt.length - 6] ? 1 : -1) : 0;
    const atrPrev = computeATR(highsAt.slice(0, -5), lowsAt.slice(0, -5), closesAt.slice(0, -5));
    const atrTrend = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);

    const adxResult = ADX.calculate({ high: highsAt, low: lowsAt, close: closesAt, period: 14 });
    const adx = adxResult.length > 0 ? adxResult[adxResult.length - 1].adx : 25;

    const ema20Arr = EMA.calculate({ period: 20, values: closesAt });
    const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : predPrice;
    const ema50Arr = EMA.calculate({ period: 50, values: closesAt });
    const ema50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : predPrice;

    // ── Run Engine ──
    const result = runEngine(stock, predPrice, {
      rsi, rvol, momentum: mom5, atrTrend, atrValue,
      pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false,
      macd: null, ema20, ema50,
      peRatio: null, pbRatio: null, pegRatio: null, debtToEquity: null, roce: null,
      adx
    });

    // ── Evaluate ──
    const pred = result.direction;
    const dirHit = (pred === "UP" && actualChange > 0) || (pred === "DOWN" && actualChange < 0);

    // Target hit: did price reach our predicted target within the window?
    const windowPrices = closes.slice(predIdx, predIdx + lookback + 1);
    const maxInWindow = Math.max(...windowPrices);
    const minInWindow = Math.min(...windowPrices);
    const tgtHit = pred === "UP" ? maxInWindow >= result.upTarget * 0.995
                 : pred === "DOWN" ? minInWindow <= result.downTarget * 1.005
                 : false;

    if (pred !== "NEUTRAL") {
      dirTotal++;
      if (dirHit) dirHits++;
      tgtTotal++;
      if (tgtHit) tgtHits++;
    } else {
      neutralCount++;
    }

    // Score band tracking
    const band = result.score >= 76 ? '76-100' : result.score >= 56 ? '56-75' : result.score >= 46 ? '46-55' : result.score >= 26 ? '26-45' : '0-25';
    if (pred !== "NEUTRAL") {
      scoreBands[band].total++;
      if (tgtHit) scoreBands[band].hits++;
    }

    // Verdict bucket tracking
    const v = result.verdict;
    if (!verdictBuckets[v]) verdictBuckets[v] = { dirHits: 0, tgtHits: 0, total: 0 };
    if (pred !== "NEUTRAL") {
      verdictBuckets[v].total++;
      if (dirHit) verdictBuckets[v].dirHits++;
      if (tgtHit) verdictBuckets[v].tgtHits++;
    }

    const icon = pred === "NEUTRAL" ? '🛡️' : (dirHit ? '✅' : '❌');
    console.log(`${icon} ${pred.padEnd(8)} Score:${String(result.score).padEnd(6)} Act:${actualChange >= 0 ? '+' : ''}${actualChange.toFixed(1)}% RSI:${rsi} ADX:${adx.toFixed(0)} RVOL:${rvol}x`);

    results.push({
      stock, predPrice: predPrice.toFixed(2), actualPrice: actualPrice.toFixed(2),
      actualChange: +actualChange.toFixed(2),
      rsi, adx: +adx.toFixed(1), rvol, mom: mom5 > 0 ? "UP" : "DOWN",
      score: result.score, direction: pred, verdict: result.verdict,
      upTarget: result.upTarget?.toFixed(2), downTarget: result.downTarget?.toFixed(2),
      dirHit: pred !== "NEUTRAL" ? dirHit : null,
      tgtHit: pred !== "NEUTRAL" ? tgtHit : null,
    });

    // Polite delay to avoid rate limiting
    await sleep(1800 + Math.random() * 700);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════════════════
  const sep = '═'.repeat(100);
  console.log(`\n${sep}`);
  console.log('  DETAILED RESULTS TABLE');
  console.log(sep);
  console.log(
    '  #  '.padEnd(6) + 'Stock'.padEnd(14) + 'Pred₹'.padEnd(11) + 'Act₹'.padEnd(11) +
    'Chg%'.padEnd(8) + 'Score'.padEnd(7) + 'Pred'.padEnd(9) + 'Verdict'.padEnd(16) +
    'Dir'.padEnd(5) + 'Tgt'.padEnd(5) + 'RSI'.padEnd(7) + 'ADX'.padEnd(6) + 'RVOL'
  );
  console.log('─'.repeat(100));
  
  results.forEach((r, idx) => {
    const dirIcon = r.dirHit === null ? '🛡️' : (r.dirHit ? '✅' : '❌');
    const tgtIcon = r.tgtHit === null ? '🛡️' : (r.tgtHit ? '✅' : '❌');
    console.log(
      `  ${(idx + 1).toString().padEnd(4)}` +
      r.stock.padEnd(14) +
      `₹${r.predPrice}`.padEnd(11) +
      `₹${r.actualPrice}`.padEnd(11) +
      `${r.actualChange >= 0 ? '+' : ''}${r.actualChange}%`.padEnd(8) +
      `${r.score}`.padEnd(7) +
      r.direction.padEnd(9) +
      r.verdict.padEnd(16) +
      `${dirIcon}`.padEnd(5) +
      `${tgtIcon}`.padEnd(5) +
      `${r.rsi}`.padEnd(7) +
      `${r.adx}`.padEnd(6) +
      `${r.rvol}x`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const dirRate = dirTotal > 0 ? ((dirHits / dirTotal) * 100).toFixed(1) : 'N/A';
  const tgtRate = tgtTotal > 0 ? ((tgtHits / tgtTotal) * 100).toFixed(1) : 'N/A';

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  STOCKSENSE ULTRA PRO — HIT RATIO AUDIT SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\n  ┌─────────────────────────────────────────────────────────────┐`);
  console.log(`  │  DIRECTIONAL ACCURACY : ${dirRate.padEnd(6)}%  (${dirHits}/${dirTotal} stocks)`.padEnd(63) + '│');
  console.log(`  │  TARGET HIT RATE      : ${tgtRate.padEnd(6)}%  (${tgtHits}/${tgtTotal} stocks)`.padEnd(63) + '│');
  console.log(`  │  NEUTRAL (No Call)    : ${neutralCount} stocks`.padEnd(63) + '│');
  console.log(`  │  Failed / Skipped     : ${failCount} stocks`.padEnd(63) + '│');
  console.log(`  │  Total Evaluated      : ${results.length} stocks`.padEnd(63) + '│');
  console.log(`  └─────────────────────────────────────────────────────────────┘`);

  // Score Band Breakdown
  console.log(`\n  Score Band Breakdown (Target Hit Rate):`);
  for (const [band, s] of Object.entries(scoreBands)) {
    const rate = s.total > 0 ? `${((s.hits / s.total) * 100).toFixed(0)}%` : 'N/A';
    const bar = s.total > 0 ? '█'.repeat(Math.round((s.hits / s.total) * 20)) + '░'.repeat(20 - Math.round((s.hits / s.total) * 20)) : '░'.repeat(20);
    console.log(`    Score ${band.padEnd(6)}: ${bar} ${rate.padEnd(5)} (${s.hits}/${s.total})`);
  }

  // Verdict Breakdown
  console.log(`\n  Verdict Category Breakdown:`);
  for (const [v, s] of Object.entries(verdictBuckets).sort((a, b) => b[1].total - a[1].total)) {
    const dirPct = s.total > 0 ? `${((s.dirHits / s.total) * 100).toFixed(0)}%` : 'N/A';
    const tgtPct = s.total > 0 ? `${((s.tgtHits / s.total) * 100).toFixed(0)}%` : 'N/A';
    console.log(`    ${v.padEnd(16)}: Dir=${dirPct.padEnd(5)} Tgt=${tgtPct.padEnd(5)} (${s.total} stocks)`);
  }

  // Overall Grade
  const rate = tgtTotal > 0 ? (tgtHits / tgtTotal) * 100 : 0;
  const grade =
    rate >= 80 ? "🏆 EXCEPTIONAL — 80%+ Hit Ratio CONFIRMED" :
    rate >= 75 ? "🏆 INSTITUTIONAL — 75%+ Hit Ratio" :
    rate >= 65 ? "🟢 STRONG — 65%+ Hit Ratio" :
    rate >= 55 ? "🟡 GOOD — 55%+ Hit Ratio" :
    rate >= 45 ? "🟠 MODERATE — Below Target" :
                 "🔴 WEAK — Needs Improvement";

  console.log(`\n  ┌─────────────────────────────────────────────────────────────┐`);
  console.log(`  │  GRADE: ${grade}`.padEnd(63) + '│');
  console.log(`  │  Engine: scoreEngine v3.0 — 7-Pillar Architecture`.padEnd(63) + '│');
  console.log(`  │  Data: Yahoo Finance Real OHLCV (Zero Simulation)`.padEnd(63) + '│');
  console.log(`  │  Period: Last 5 Trading Days`.padEnd(63) + '│');
  console.log(`  │  Run: ${timestamp}`.padEnd(63) + '│');
  console.log(`  └─────────────────────────────────────────────────────────────┘\n`);

  // Save raw JSON for documentation
  const reportJSON = {
    timestamp,
    totalStocks: results.length,
    failedStocks: failCount,
    neutralStocks: neutralCount,
    directionalAccuracy: { hits: dirHits, total: dirTotal, rate: +dirRate },
    targetHitRate: { hits: tgtHits, total: tgtTotal, rate: +tgtRate },
    scoreBands,
    verdictBuckets,
    grade,
    results
  };

  require('fs').writeFileSync(
    'HitRatio_Audit_Report.json',
    JSON.stringify(reportJSON, null, 2)
  );
  console.log("  📄 Full report saved: HitRatio_Audit_Report.json\n");
}

runAudit().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
