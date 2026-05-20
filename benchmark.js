/**
 * StockSense Ultra Pro — v3.0 Benchmark (ALL REAL DATA)
 * Sources: Yahoo Finance (RSI/ATR/RVOL/Momentum) + NSE India (PCR/L2)
 * Zero hash-simulation. Every signal is empirical.
 */

const https = require('https');
const http = require('http');

// ─── HELPERS ──────────────────────────────────────────────────────────────
const getVerdict = (score) => {
  if (score >= 80) return "STRONG BUY";
  if (score >= 65) return "ACCUMULATE";
  if (score >= 45) return "HOLD";
  if (score >= 30) return "REDUCE";
  return "STRONG SELL";
};

const { runEngine } = require("./src/layers/layer13/scoreEngine");

// ─── FETCHERS ─────────────────────────────────────────────────────────────
// ─── FETCHERS ─────────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
let uaIdx = 0;

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib  = url.startsWith('https') ? https : http;
    const ua   = USER_AGENTS[uaIdx++ % USER_AGENTS.length];
    const opts = {
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers
      }
    };
    lib.get(url, opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMITED'));
        try { resolve({ status: res.statusCode, body: JSON.parse(d), headers: res.headers }); }
        catch (e) { reject(new Error('JSON_PARSE: ' + d.slice(0, 40))); }
      });
    }).on('error', reject);
  });
}

async function fetchYahoo(symbol) {
  const sym = `${symbol}.NS`;
  // Try v8 chart endpoint with retry
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt));
      const r = await httpGet(
        `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=3mo&interval=1d&includePrePost=false`
      );
      const result = r.body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result in response');
    } catch (e) {
      if (e.message === 'RATE_LIMITED' && attempt < 2) continue;
      if (attempt === 2) throw new Error(`Yahoo failed after retries: ${e.message}`);
    }
  }
}

// NSE requires a cookie from the homepage first
async function fetchNSEWithCookie(path) {
  try {
    // Step 1: get NSE session cookies
    const home = await httpGet('https://www.nseindia.com/', {
      'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9'
    });
    const rawCookies = home.headers['set-cookie'] || [];
    const cookieStr  = rawCookies.map(c => c.split(';')[0]).join('; ');

    await new Promise(r => setTimeout(r, 600)); // polite delay

    // Step 2: fetch the actual endpoint
    const res = await httpGet(`https://www.nseindia.com/${path}`, {
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
      'Cookie': cookieStr,
    });
    if (res.status !== 200) throw new Error(`NSE HTTP ${res.status}`);
    return res.body;
  } catch (e) {
    throw new Error(`NSE fetch failed: ${e.message}`);
  }
}

async function fetchOptionChainPCR(symbol) {
  const data = await fetchNSEWithCookie(
    `api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`
  );
  if (!data.records?.data) throw new Error('No OC data');

  let totalPutOI = 0, totalCallOI = 0;
  for (const item of data.records.data) {
    totalPutOI  += item.PE?.openInterest || 0;
    totalCallOI += item.CE?.openInterest || 0;
  }
  const pcrOI = totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(3) : 1.0;
  return { pcrOI, totalPutOI, totalCallOI };
}

async function fetchMarketDepth(symbol) {
  const data = await fetchNSEWithCookie(
    `api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`
  );
  const md = data.marketDeptOrderBook || data.marketDept498OrderBook;
  if (!md) throw new Error('No market depth');

  let buyQty = 0, sellQty = 0;
  for (const b of (md.bid || [])) buyQty  += b.quantity || 0;
  for (const a of (md.ask || [])) sellQty += a.quantity || 0;
  const total      = buyQty + sellQty;
  const imbalance  = total > 0 ? +((buyQty - sellQty) / total * 100).toFixed(2) : 0;
  const deliveryPct = data.securityWiseDP?.deliveryToTradedQuantity
    ? parseFloat(data.securityWiseDP.deliveryToTradedQuantity) : null;
  return { l2Imbalance: imbalance, buyQty, sellQty, deliveryPct };
}

const { ADX, EMA } = require("technicalindicators");

// ─── INDICATOR COMPUTATION ────────────────────────────────────────────────
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
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

// ─── BENCHMARK RUNNER ─────────────────────────────────────────────────────
const TEST_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "TATACONSUM", "SBIN", "CIPLA", "VEDL", "BHARTIARTL", "SUNPHARMA",
  "M&M", "KOTAKBANK", "AXISBANK", "TATAMOTORS", "TATASTEEL", "ULTRACEMCO", "ADANIENT", "ONGC", "HINDALCO", "POWERGRID",
  "BAJFINANCE", "HINDUNILVR", "ITC", "LT", "MARUTI", "WIPRO", "HCLTECH", "ASIANPAINT", "TITAN", "BAJAJFINSV",
  "JSWSTEEL", "NTPC", "GRASIM", "TECHM", "DIVISLAB", "DRREDDY", "HEROMOTOCO", "APOLLOHOSP", "INDUSINDBK", "BAJAJ-AUTO",
  "LTIM", "EICHERMOT", "COALINDIA", "BRITANNIA", "NESTLEIND", "BPCL", "SHREECEM", "HDFCLIFE", "ADANIPORTS",
  "TATAPOWER", "TVSMOTOR", "ZOMATO", "HAL", "BEL", "SIEMENS", "PFC", "RECLTD", "GAIL", "BHEL",
  "IRFC", "RVNL", "JINDALSTEL", "NMDC", "AMBUJACEM", "DABUR", "GODREJCP", "MARICO", "COLPAL", "PIDILITIND",
  "HAVELLS", "VOLTAS", "TRENT", "CHOLAFIN", "SHRIRAMFIN", "MUTHOOTFIN", "PNB", "BANKBARODA", "CANBK", "UNIONBANK",
  "IDFCFIRSTB", "INDIGO", "MOTHERSON", "BOSCHLTD", "CUMMINSIND", "DIXON", "POLYCAB", "LODHA", "DLF", "GODREJPROP",
  "OBEROIRLTY", "PRESTIGE", "TORNTPHARM", "LUPIN", "AUROPHARMA", "BIOCON", "GLENMARK", "SYNGENE", "LAURUSLABS", "ALKEM",
  "TATACHEM", "UPL", "COROMANDEL", "PIIND", "SRF", "AARTIIND", "DEEPAKNTR", "NAVINFLUOR", "ATGL", "IGL"
];

async function benchmark() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  STOCKSENSE ULTRA PRO v3.0 — FULL REAL-DATA BENCHMARK                        ║");
  console.log("║  Yahoo Finance (RSI/ATR/RVOL/Momentum) + NSE India (PCR/L2) — ZERO SIMULATION║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════════╝\n");

  const results = [];
  let dirHits = 0, dirTotal = 0, tgtHits = 0, tgtTotal = 0;
  let nseOkCount = 0;

  // Component accuracy tracking
  const compStats = {
    rsi:  { correct: 0, total: 0 },
    mom:  { correct: 0, total: 0 },
    pcr:  { correct: 0, total: 0 },
    l2:   { correct: 0, total: 0 },
  };

  for (const stock of TEST_STOCKS) {
    process.stdout.write(`  ${stock.padEnd(14)}`);

    let yahooResult, ocData = null, depthData = null;

    // 1. Yahoo Finance
    try {
      yahooResult = await fetchYahoo(stock);
    } catch (e) {
      console.log(`⚠ Yahoo Error: ${e.message}`);
      continue;
    }

    // 2. NSE Option Chain PCR
    try {
      ocData = await fetchOptionChainPCR(stock);
      process.stdout.write(`[PCR:${ocData.pcrOI}] `);
      nseOkCount++;
    } catch (e) {
      process.stdout.write(`[PCR:fail] `);
    }

    // 3. NSE Market Depth
    try {
      depthData = await fetchMarketDepth(stock);
      process.stdout.write(`[L2:${depthData.l2Imbalance}%] `);
    } catch (e) {
      process.stdout.write(`[L2:fail] `);
    }

    // 4. Compute indicators at prediction point (5 days ago)
    const q        = yahooResult.indicators.quote[0];
    const closes   = q.close.filter(Boolean);
    const highs    = q.high.filter(Boolean);
    const lows     = q.low.filter(Boolean);
    const volumes  = q.volume.filter(Boolean);

    if (closes.length < 30) { console.log("⚠ Insufficient data"); continue; }

    const lookback    = 5;
    const predIdx     = closes.length - 1 - lookback;
    const predPrice   = closes[predIdx];
    const actualPrice = closes[closes.length - 1];
    const actualChange = ((actualPrice - predPrice) / predPrice) * 100;
    const actualDir    = actualChange > 0.3 ? "UP" : (actualChange < -0.3 ? "DOWN" : "NEUTRAL");

    const closesAt  = closes.slice(0, predIdx + 1);
    const highsAt   = highs.slice(0,  predIdx + 1);
    const lowsAt    = lows.slice(0,   predIdx + 1);
    const volumesAt = volumes.slice(0, predIdx + 1);

    const rsi       = computeRSI(closesAt);
    const atrValue  = computeATR(highsAt, lowsAt, closesAt);
    const todayVol  = volumesAt[volumesAt.length - 1];
    const avgVol    = volumesAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const rvol      = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
    const mom5      = closesAt.length >= 6
      ? (closesAt[closesAt.length - 1] > closesAt[closesAt.length - 6] ? 1 : -1) : 0;
    const atrPrev   = computeATR(highsAt.slice(0, -5), lowsAt.slice(0, -5), closesAt.slice(0, -5));
    const atrTrend  = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);

    const adxResult = ADX.calculate({
      high: highsAt,
      low: lowsAt,
      close: closesAt,
      period: 14
    });
    const adx = adxResult.length > 0 ? adxResult[adxResult.length - 1].adx : 25;

    const ema20Arr = EMA.calculate({ period: 20, values: closesAt });
    const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : predPrice;
    
    const ema50Arr = EMA.calculate({ period: 50, values: closesAt });
    const ema50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : predPrice;

    // Use real NSE data if available, else neutral defaults
    const pcr         = ocData    ? ocData.pcrOI          : 1.0;
    const l2Imbalance = depthData ? depthData.l2Imbalance  : 0;
    const hasRealPCR  = !!ocData;
    const hasRealL2   = !!depthData;

    const result = runEngine(stock, predPrice, {
      rsi, rvol, momentum: mom5, atrTrend, atrValue,
      pcr, l2Imbalance, hasRealPCR, hasRealL2,
      macd: null,
      ema20,
      ema50,
      peRatio: null, pbRatio: null, pegRatio: null, debtToEquity: null, roce: null,
      adx
    });

    // ── Evaluate accuracy ──────────────────────────────────────────────
    const pred = result.direction;
    const hit  = (pred === "UP" && actualChange > 0) || (pred === "DOWN" && actualChange < 0);
    // Evaluate overall targets
    const maxPeriod = Math.max(...closes.slice(predIdx, predIdx + lookback + 1));
    const minPeriod = Math.min(...closes.slice(predIdx, predIdx + lookback + 1));
    const hitUp = maxPeriod >= result.upTarget * 0.995;
    const hitDown = minPeriod <= result.downTarget * 1.005;

    if (pred !== "NEUTRAL") {
      dirTotal++; if (hit) dirHits++;
      tgtTotal++;
      if (pred === "UP" && hitUp) tgtHits++;
      if (pred === "DOWN" && hitDown) tgtHits++;
    }

    // Component accuracy based on TARGET hits (the true mathematical benchmark)
    if (Math.abs(result.signals.trend) > 0) {
      compStats.mom.total++;
      if ((result.signals.trend > 0 && hitUp) || (result.signals.trend < 0 && hitDown)) compStats.mom.correct++;
    }
    if (Math.abs(result.signals.momEx) > 0) {
      compStats.rsi.total++;
      if ((result.signals.momEx > 0 && hitUp) || (result.signals.momEx < 0 && hitDown)) compStats.rsi.correct++;
    }
    if (hasRealPCR) {
      compStats.pcr.total++;
      if ((result.signals.flow > 0 && hitUp) || (result.signals.flow < 0 && hitDown)) compStats.pcr.correct++;
    }
    if (hasRealL2) {
      compStats.l2.total++;
      if ((result.signals.flow > 0 && hitUp) || (result.signals.flow < 0 && hitDown)) compStats.l2.correct++;
    }

    console.log(`${hit ? '✅' : '❌'} ${pred.padEnd(6)} Act:${actualChange >= 0 ? '+' : ''}${actualChange.toFixed(1)}% Score:${result.score} PCR:${pcr} L2:${l2Imbalance.toFixed(1)}% RSI:${rsi} RVOL:${rvol}x`);

    results.push({
      stock, predPrice: predPrice.toFixed(2), actualPrice: actualPrice.toFixed(2),
      actualChange: actualChange.toFixed(2), actualDir,
      rsi: rsi.toFixed(1), rvol, mom: mom5 > 0 ? "UP" : "DOWN",
      pcr: pcr.toFixed(3), l2: l2Imbalance.toFixed(1),
      score: result.score, direction: pred, verdict: result.verdict,
      vetoed: result.isVetoed, vetoFails: result.vetoFailCount, hit,
      pcrSrc: hasRealPCR ? 'NSE' : 'N/A',
      l2Src:  hasRealL2  ? 'NSE' : 'N/A',
      shap: result.shap,
    });

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
  }

  // ─── RESULTS TABLE ───────────────────────────────────────────────────────
  const sep = '═'.repeat(140);
  console.log(`\n${sep}`);
  console.log('  FULL RESULTS — ALL REAL DATA');
  console.log(sep);
  console.log(
    '  Stock'.padEnd(14) + 'Pred₹'.padEnd(10) + 'Act₹'.padEnd(10) +
    'Chg%'.padEnd(8) + 'Act'.padEnd(6) + 'RSI'.padEnd(7) + 'RVOL'.padEnd(7) +
    'Mom'.padEnd(5) + 'PCR(src)'.padEnd(12) + 'L2%(src)'.padEnd(12) +
    'Score'.padEnd(8) + 'Pred'.padEnd(7) + 'Verdict'.padEnd(20) + 'Hit'
  );
  console.log('─'.repeat(140));
  for (const r of results) {
    console.log(
      `  ${r.stock.padEnd(12)}` +
      `₹${r.predPrice}`.padEnd(10) + `₹${r.actualPrice}`.padEnd(10) +
      `${parseFloat(r.actualChange) >= 0 ? '+' : ''}${r.actualChange}%`.padEnd(8) +
      r.actualDir.padEnd(6) + r.rsi.padEnd(7) + `${r.rvol}x`.padEnd(7) +
      r.mom.padEnd(5) +
      `${r.pcr}(${r.pcrSrc})`.padEnd(12) +
      `${r.l2}(${r.l2Src})`.padEnd(12) +
      `${r.score}/100`.padEnd(8) + r.direction.padEnd(7) +
      r.verdict.padEnd(20) +
      (r.direction === "NEUTRAL" ? '🛡️ N/A' : (r.hit ? '✅' : '❌'))
    );
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  const dirRate = dirTotal > 0 ? ((dirHits / dirTotal) * 100).toFixed(1) : 'N/A';
  const tgtRate = tgtTotal > 0 ? ((tgtHits / tgtTotal) * 100).toFixed(1) : 'N/A';
  const pct = (s) => s.total > 0 ? `${((s.correct / s.total) * 100).toFixed(0)}% (${s.correct}/${s.total})` : 'N/A';

  console.log(`\n${'═'.repeat(70)}`);
  console.log('  BENCHMARK SUMMARY v3.0 — REAL DATA ENGINE');
  console.log('═'.repeat(70));
  console.log(`\n  Directional Accuracy : ${dirRate}%  (${dirHits}/${dirTotal})`);
  console.log(`  Target Hit Rate      : ${tgtRate}%  (${tgtHits}/${tgtTotal})`);
  console.log(`  NSE Live Calls OK    : ${nseOkCount}/${results.length}`);
  console.log(`\n  Component Accuracy:`);
  console.log(`    RSI  (Yahoo REAL)  : ${pct(compStats.rsi)}`);
  console.log(`    Momentum (REAL)    : ${pct(compStats.mom)}`);
  console.log(`    PCR  (NSE LIVE)    : ${pct(compStats.pcr)}`);
  console.log(`    L2   (NSE LIVE)    : ${pct(compStats.l2)}`);

  const rate = dirTotal > 0 ? (dirHits / dirTotal) * 100 : 0;
  const grade =
    rate >= 75 ? "🏆 EXCEPTIONAL — Institutional Grade" :
    rate >= 65 ? "🟢 STRONG — Clear Statistical Edge" :
    rate >= 55 ? "🟡 GOOD — Marginal Edge (better than random)" :
    rate >= 45 ? "🟠 MODERATE — Near Coin-Flip" :
                 "🔴 WEAK — Needs More Work";

  console.log(`\n  Grade  : ${grade}`);
  console.log(`  Engine : v3.0 — Zero Simulated Data`);
  console.log(`  Period : Last 5 trading days`);
  console.log(`  Stocks : ${results.length} NSE equities\n`);
}

benchmark().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
