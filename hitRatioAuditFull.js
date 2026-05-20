/**
 * StockSense Ultra Pro — Comprehensive Hit Ratio Audit v5.0
 * Tests 100+ NSE stocks, measures Target Hit Rate with full per-stock breakdown.
 * Data: Yahoo Finance real OHLCV | Engine: scoreEngine v3.0 (7-Pillar)
 * Zero simulation — every signal is empirical.
 */

const https = require('https');
const fs = require('fs');
const { runEngine } = require("./src/layers/layer13/scoreEngine");
const { ADX, EMA } = require("technicalindicators");

// ─── HTTP ─────────────────────────────────────────────────────────────────
const UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
let uaIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const ua = UA[uaIdx++ % UA.length];
    https.get(url, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMITED'));
        try { resolve(JSON.parse(d)); } catch { reject(new Error('JSON_PARSE')); }
      });
    }).on('error', reject);
  });
}

async function fetchYahoo(symbol) {
  const sym = `${symbol}.NS`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * attempt);
      const body = await httpGet(
        `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=3mo&interval=1d&includePrePost=false`
      );
      const result = body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result');
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

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
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

// ─── STOCK UNIVERSE ───────────────────────────────────────────────────────
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

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function runAudit() {
  const ts = new Date().toISOString();
  console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  STOCKSENSE ULTRA PRO — TARGET HIT RATIO AUDIT v5.0                            ║");
  console.log("║  110 NSE Stocks | Yahoo Finance OHLCV | scoreEngine v3.0 | 5-Day Window         ║");
  console.log(`║  ${ts}                                                          ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");

  const results = [];
  let dirHits = 0, dirTotal = 0, tgtHits = 0, tgtTotal = 0, neutralCount = 0, failCount = 0;

  // Score-band buckets
  const bands = {
    'STRONG_BUY (75-95)':  { dirH: 0, tgtH: 0, tot: 0 },
    'BUY (60-74)':         { dirH: 0, tgtH: 0, tot: 0 },
    'NEUTRAL (45-59)':     { dirH: 0, tgtH: 0, tot: 0 },
    'SELL (30-44)':        { dirH: 0, tgtH: 0, tot: 0 },
    'STRONG_SELL (5-29)':  { dirH: 0, tgtH: 0, tot: 0 },
  };
  function getBand(s) {
    if (s >= 75) return 'STRONG_BUY (75-95)';
    if (s >= 60) return 'BUY (60-74)';
    if (s >= 45) return 'NEUTRAL (45-59)';
    if (s >= 30) return 'SELL (30-44)';
    return 'STRONG_SELL (5-29)';
  }

  // Sector tracking
  const sectors = {};

  for (let i = 0; i < TEST_STOCKS.length; i++) {
    const stock = TEST_STOCKS[i];
    const tag = `[${String(i + 1).padStart(3)}/${TEST_STOCKS.length}]`;
    process.stdout.write(`  ${tag} ${stock.padEnd(14)}`);

    let yahoo;
    try { yahoo = await fetchYahoo(stock); }
    catch (e) { console.log(`⚠ SKIP: ${e.message}`); failCount++; await sleep(2000); continue; }

    const q = yahoo?.indicators?.quote?.[0];
    if (!q) { console.log("⚠ SKIP: no data"); failCount++; await sleep(1500); continue; }

    const closes = q.close.filter(Boolean);
    const highs  = q.high.filter(Boolean);
    const lows   = q.low.filter(Boolean);
    const vols   = q.volume.filter(Boolean);
    if (closes.length < 35) { console.log("⚠ SKIP: insufficient bars"); failCount++; await sleep(1500); continue; }

    // Prediction point = 5 days before latest
    const LB = 5;
    const pi = closes.length - 1 - LB;
    const predPrice   = closes[pi];
    const actualPrice = closes[closes.length - 1];
    const actualChg   = ((actualPrice - predPrice) / predPrice) * 100;

    // Compute indicators AT prediction point
    const cAt = closes.slice(0, pi + 1), hAt = highs.slice(0, pi + 1), lAt = lows.slice(0, pi + 1), vAt = vols.slice(0, pi + 1);
    const rsi      = computeRSI(cAt);
    const atrValue = computeATR(hAt, lAt, cAt);
    const todayVol = vAt[vAt.length - 1];
    const avgVol   = vAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const rvol     = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
    const mom5     = cAt.length >= 6 ? (cAt[cAt.length - 1] > cAt[cAt.length - 6] ? 1 : -1) : 0;
    const atrPrev  = computeATR(hAt.slice(0, -5), lAt.slice(0, -5), cAt.slice(0, -5));
    const atrTrend = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);

    const adxArr = ADX.calculate({ high: hAt, low: lAt, close: cAt, period: 14 });
    const adx    = adxArr.length > 0 ? adxArr[adxArr.length - 1].adx : 25;
    const ema20  = (() => { const a = EMA.calculate({ period: 20, values: cAt }); return a.length ? a[a.length - 1] : predPrice; })();
    const ema50  = (() => { const a = EMA.calculate({ period: 50, values: cAt }); return a.length ? a[a.length - 1] : predPrice; })();

    // Run engine
    const eng = runEngine(stock, predPrice, {
      rsi, rvol, momentum: mom5, atrTrend, atrValue,
      pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false,
      macd: null, ema20, ema50,
      peRatio: null, pbRatio: null, pegRatio: null, debtToEquity: null, roce: null, adx
    });

    const pred = eng.direction;

    // Evaluate
    const dirHit = (pred === "UP" && actualChg > 0) || (pred === "DOWN" && actualChg < 0);
    const windowPrices = closes.slice(pi, pi + LB + 1);
    const maxW = Math.max(...windowPrices);
    const minW = Math.min(...windowPrices);
    const tgtHit = pred === "UP"   ? maxW >= eng.upTarget   * 0.995
                 : pred === "DOWN" ? minW <= eng.downTarget * 1.005
                 : false;

    // How close did it get to target? (for analysis)
    let tgtReachPct = 0;
    if (pred === "UP") {
      const needed = eng.upTarget - predPrice;
      const got    = maxW - predPrice;
      tgtReachPct  = needed > 0 ? Math.min(100, +(got / needed * 100).toFixed(1)) : 100;
    } else if (pred === "DOWN") {
      const needed = predPrice - eng.downTarget;
      const got    = predPrice - minW;
      tgtReachPct  = needed > 0 ? Math.min(100, +(got / needed * 100).toFixed(1)) : 100;
    }

    if (pred !== "NEUTRAL") {
      dirTotal++; if (dirHit) dirHits++;
      tgtTotal++; if (tgtHit) tgtHits++;
      const band = getBand(eng.score);
      bands[band].tot++;
      if (dirHit) bands[band].dirH++;
      if (tgtHit) bands[band].tgtH++;
    } else {
      neutralCount++;
    }

    const icon = pred === "NEUTRAL" ? '🛡️' : (tgtHit ? '✅' : '❌');
    console.log(
      `${icon} ${pred.padEnd(8)} Score:${String(eng.score).padEnd(6)} ` +
      `Tgt:${pred === "UP" ? '₹' + eng.upTarget.toFixed(0) : pred === "DOWN" ? '₹' + eng.downTarget.toFixed(0) : 'N/A'}  ` +
      `Act:${actualChg >= 0 ? '+' : ''}${actualChg.toFixed(1)}%  ` +
      `Reach:${tgtReachPct}%  ` +
      `RSI:${rsi} ADX:${adx.toFixed(0)}`
    );

    results.push({
      stock, score: eng.score, direction: pred, verdict: eng.verdict,
      predPrice: +predPrice.toFixed(2), actualPrice: +actualPrice.toFixed(2),
      actualChg: +actualChg.toFixed(2),
      upTarget: eng.upTarget ? +eng.upTarget.toFixed(2) : null,
      downTarget: eng.downTarget ? +eng.downTarget.toFixed(2) : null,
      dirHit: pred !== "NEUTRAL" ? dirHit : null,
      tgtHit: pred !== "NEUTRAL" ? tgtHit : null,
      tgtReachPct,
      rsi, adx: +adx.toFixed(1), rvol, atrValue, momentum: mom5,
    });

    await sleep(2000 + Math.random() * 500);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DETAILED RESULTS TABLE
  // ═══════════════════════════════════════════════════════════════════════
  const W = 130;
  console.log(`\n${'═'.repeat(W)}`);
  console.log('  FULL RESULTS — PER STOCK BREAKDOWN');
  console.log('═'.repeat(W));
  console.log(
    '  # '.padEnd(5) +
    'Stock'.padEnd(14) +
    'Score'.padEnd(7) +
    'Pred'.padEnd(9) +
    'Pred₹'.padEnd(11) +
    'Target₹'.padEnd(11) +
    'Actual₹'.padEnd(11) +
    'Chg%'.padEnd(8) +
    'Reach%'.padEnd(8) +
    'DirHit'.padEnd(7) +
    'TgtHit'.padEnd(7) +
    'RSI'.padEnd(7) +
    'ADX'.padEnd(6) +
    'RVOL'.padEnd(6) +
    'Verdict'
  );
  console.log('─'.repeat(W));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const tgt = r.direction === "UP" ? r.upTarget : r.direction === "DOWN" ? r.downTarget : null;
    const dI = r.dirHit === null ? '🛡️' : (r.dirHit ? '✅' : '❌');
    const tI = r.tgtHit === null ? '🛡️' : (r.tgtHit ? '✅' : '❌');
    console.log(
      `  ${String(i + 1).padEnd(4)}` +
      r.stock.padEnd(14) +
      `${r.score}`.padEnd(7) +
      r.direction.padEnd(9) +
      `₹${r.predPrice}`.padEnd(11) +
      `${tgt ? '₹' + tgt : 'N/A'}`.padEnd(11) +
      `₹${r.actualPrice}`.padEnd(11) +
      `${r.actualChg >= 0 ? '+' : ''}${r.actualChg}%`.padEnd(8) +
      `${r.tgtReachPct}%`.padEnd(8) +
      `${dI}`.padEnd(7) +
      `${tI}`.padEnd(7) +
      `${r.rsi}`.padEnd(7) +
      `${r.adx}`.padEnd(6) +
      `${r.rvol}x`.padEnd(6) +
      r.verdict
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  const dirRate = dirTotal > 0 ? ((dirHits / dirTotal) * 100).toFixed(1) : 'N/A';
  const tgtRate = tgtTotal > 0 ? ((tgtHits / tgtTotal) * 100).toFixed(1) : 'N/A';

  // Average target reach %
  const activeResults = results.filter(r => r.direction !== "NEUTRAL");
  const avgReach = activeResults.length > 0
    ? (activeResults.reduce((s, r) => s + r.tgtReachPct, 0) / activeResults.length).toFixed(1) : 'N/A';

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  STOCKSENSE ULTRA PRO — TARGET HIT RATIO AUDIT REPORT');
  console.log('═'.repeat(80));

  console.log(`\n  ┌───────────────────────────────────────────────────────────────────┐`);
  console.log(`  │                     PRIMARY METRICS                               │`);
  console.log(`  ├───────────────────────────────────────────────────────────────────┤`);
  console.log(`  │  TARGET HIT RATE       : ${tgtRate.padStart(5)}%   (${tgtHits}/${tgtTotal} active calls)`.padEnd(69) + '│');
  console.log(`  │  DIRECTIONAL ACCURACY  : ${dirRate.padStart(5)}%   (${dirHits}/${dirTotal} active calls)`.padEnd(69) + '│');
  console.log(`  │  AVG TARGET REACH      : ${avgReach.padStart(5)}%   (how close price got to target)`.padEnd(69) + '│');
  console.log(`  │  NEUTRAL / VETOED      : ${String(neutralCount).padStart(5)}    (system chose not to call)`.padEnd(69) + '│');
  console.log(`  │  SKIPPED / FAILED      : ${String(failCount).padStart(5)}    (Yahoo data unavailable)`.padEnd(69) + '│');
  console.log(`  │  TOTAL STOCKS TESTED   : ${String(results.length).padStart(5)}`.padEnd(69) + '│');
  console.log(`  └───────────────────────────────────────────────────────────────────┘`);

  // Score Band Breakdown
  console.log(`\n  ┌───────────────────────────────────────────────────────────────────┐`);
  console.log(`  │                SCORE BAND BREAKDOWN                               │`);
  console.log(`  ├───────────────────────────────────────────────────────────────────┤`);
  for (const [label, b] of Object.entries(bands)) {
    const dR = b.tot > 0 ? `${((b.dirH / b.tot) * 100).toFixed(0)}%` : 'N/A';
    const tR = b.tot > 0 ? `${((b.tgtH / b.tot) * 100).toFixed(0)}%` : 'N/A';
    const bar = b.tot > 0 ? '█'.repeat(Math.round((b.tgtH / b.tot) * 15)).padEnd(15, '░') : '░'.repeat(15);
    console.log(`  │  ${label.padEnd(22)} ${bar} Dir:${dR.padEnd(5)} Tgt:${tR.padEnd(5)} (${b.tgtH}/${b.tot})`.padEnd(69) + '│');
  }
  console.log(`  └───────────────────────────────────────────────────────────────────┘`);

  // Top Hits & Misses
  const hits = activeResults.filter(r => r.tgtHit);
  const misses = activeResults.filter(r => !r.tgtHit);

  console.log(`\n  ── TOP 5 BEST TARGET HITS ──`);
  hits.sort((a, b) => b.tgtReachPct - a.tgtReachPct).slice(0, 5).forEach(r => {
    console.log(`    ✅ ${r.stock.padEnd(14)} Score:${r.score} Pred:${r.direction.padEnd(5)} Chg:${r.actualChg >= 0 ? '+' : ''}${r.actualChg}% Reach:${r.tgtReachPct}%`);
  });

  console.log(`\n  ── TOP 5 BIGGEST MISSES ──`);
  misses.sort((a, b) => a.tgtReachPct - b.tgtReachPct).slice(0, 5).forEach(r => {
    console.log(`    ❌ ${r.stock.padEnd(14)} Score:${r.score} Pred:${r.direction.padEnd(5)} Chg:${r.actualChg >= 0 ? '+' : ''}${r.actualChg}% Reach:${r.tgtReachPct}%`);
  });

  // Grade
  const rate = tgtTotal > 0 ? (tgtHits / tgtTotal) * 100 : 0;
  const grade =
    rate >= 80 ? "🏆 EXCEPTIONAL — 80%+ Target Hit Ratio CONFIRMED" :
    rate >= 75 ? "🏆 INSTITUTIONAL GRADE — 75%+ Target Hit Ratio" :
    rate >= 65 ? "🟢 STRONG — 65%+ Target Hit Ratio" :
    rate >= 55 ? "🟡 GOOD — 55%+ Target Hit Ratio" :
    rate >= 45 ? "🟠 MODERATE — Below Institutional Standard" :
                 "🔴 NEEDS WORK";

  console.log(`\n  ┌───────────────────────────────────────────────────────────────────┐`);
  console.log(`  │  GRADE: ${grade}`.padEnd(69) + '│');
  console.log(`  │  Engine : scoreEngine v3.0 — 7-Pillar Non-Linear Architecture`.padEnd(69) + '│');
  console.log(`  │  Data   : Yahoo Finance Real OHLCV (Zero Simulation)`.padEnd(69) + '│');
  console.log(`  │  Window : 5 Trading Days Look-ahead`.padEnd(69) + '│');
  console.log(`  │  Run    : ${ts}`.padEnd(69) + '│');
  console.log(`  └───────────────────────────────────────────────────────────────────┘\n`);

  // Save full JSON report
  const report = {
    timestamp: ts,
    metrics: { dirRate: +dirRate, tgtRate: +tgtRate, avgReach: +avgReach, dirHits, dirTotal, tgtHits, tgtTotal, neutralCount, failCount, totalTested: results.length },
    scoreBands: bands,
    grade,
    topHits: hits.slice(0, 5).map(r => ({ stock: r.stock, score: r.score, dir: r.direction, chg: r.actualChg, reach: r.tgtReachPct })),
    topMisses: misses.slice(0, 5).map(r => ({ stock: r.stock, score: r.score, dir: r.direction, chg: r.actualChg, reach: r.tgtReachPct })),
    results
  };
  fs.writeFileSync('HitRatio_Audit_v5.json', JSON.stringify(report, null, 2));
  console.log("  📄 Full JSON report saved → HitRatio_Audit_v5.json\n");
}

runAudit().catch(e => { console.error("Fatal:", e); process.exit(1); });
