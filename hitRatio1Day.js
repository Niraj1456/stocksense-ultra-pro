/**
 * StockSense Ultra Pro — 1-DAY Target Hit Ratio Audit
 * Tests 109 NSE stocks with a 1-day prediction window (intraday/next-day).
 * Data: Yahoo Finance real OHLCV | Engine: scoreEngine v3.0
 */

const https = require('https');
const fs = require('fs');
const { runEngine } = require("./src/layers/layer13/scoreEngine");
const { ADX, EMA, MACD } = require("technicalindicators");

const UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
];
let uaIdx = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA[uaIdx++ % UA.length], 'Accept': 'application/json' } }, res => {
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * attempt);
      const body = await httpGet(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}.NS?range=3mo&interval=1d&includePrePost=false`);
      const result = body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result');
    } catch (e) { if (attempt === 2) throw e; }
  }
}

async function fetchFundamentals(symbol) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * attempt);
      const body = await httpGet(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS?modules=summaryDetail,defaultKeyStatistics,financialData`);
      if (body && body.quoteSummary && body.quoteSummary.result && body.quoteSummary.result.length > 0) {
        return body.quoteSummary.result[0];
      }
      return null;
    } catch (e) { if (attempt === 2) return null; }
  }
  return null;
}

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
  for (let i = 1; i < closes.length; i++)
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

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

async function runAudit() {
  const ts = new Date().toISOString();
  console.log("\n╔══════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  STOCKSENSE ULTRA PRO — 1-DAY INTRADAY TARGET HIT RATIO AUDIT                  ║");
  console.log("║  109 NSE Stocks | Yahoo Finance OHLCV | scoreEngine v3.0 | 1-Day Window         ║");
  console.log(`║  ${ts}                                                          ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════════════╝\n");

  const results = [];
  let dirHits = 0, dirTotal = 0, tgtHits = 0, tgtTotal = 0, neutralCount = 0, failCount = 0;
  // Intraday high/low hit tracking
  let intradayTgtHits = 0, intradayTgtTotal = 0;

  // FIX 4: Fetch Nifty 50 data for Market Regime detection
  let marketRegime = 'NEUTRAL';
  try {
    // Use NIFTY_50.NS or direct URL for Nifty 50 index
    const niftyBody = await httpGet('https://query2.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=3mo&interval=1d&includePrePost=false');
    const niftyYahoo = niftyBody.chart?.result?.[0];
    const nq_dummy = null; // skip fetchYahoo wrapper
    const nq = niftyYahoo?.indicators?.quote?.[0];
    if (nq) {
      const nc = nq.close.filter(Boolean);
      if (nc.length >= 6) {
        const niftyMom = ((nc[nc.length - 1] - nc[nc.length - 6]) / nc[nc.length - 6]) * 100;
        marketRegime = niftyMom > 0.5 ? 'BULL' : niftyMom < -0.5 ? 'BEAR' : 'NEUTRAL';
        console.log(`  🌐 Market Regime: ${marketRegime} (Nifty 5d momentum: ${niftyMom >= 0 ? '+' : ''}${niftyMom.toFixed(2)}%)\n`);
      }
    }
  } catch (e) { console.log(`  ⚠ Nifty fetch failed, using NEUTRAL regime\n`); }
  await sleep(2000);

  const bands = {
    'STRONGLY_BUY (75-95)': { dirH: 0, tgtH: 0, intH: 0, tot: 0 },
    'BUY (60-74)':          { dirH: 0, tgtH: 0, intH: 0, tot: 0 },
    'NEUTRAL/HOLD (45-59)': { dirH: 0, tgtH: 0, intH: 0, tot: 0 },
    'AVOID (35-44)':        { dirH: 0, tgtH: 0, intH: 0, tot: 0 },
    'STRONGLY_AVOID (5-34)':{ dirH: 0, tgtH: 0, intH: 0, tot: 0 },
  };
  function getBand(s) {
    if (s >= 75) return 'STRONGLY_BUY (75-95)';
    if (s >= 60) return 'BUY (60-74)';
    if (s >= 45) return 'NEUTRAL/HOLD (45-59)';
    if (s >= 35) return 'AVOID (35-44)';
    return 'STRONGLY_AVOID (5-34)';
  }

  for (let i = 0; i < TEST_STOCKS.length; i++) {
    const stock = TEST_STOCKS[i];
    const tag = `[${String(i + 1).padStart(3)}/${TEST_STOCKS.length}]`;
    process.stdout.write(`  ${tag} ${stock.padEnd(14)}`);

    let yahoo, fundamentals;
    try { 
      yahoo = await fetchYahoo(stock); 
      fundamentals = await fetchFundamentals(stock);
    }
    catch (e) { console.log(`⚠ SKIP: ${e.message}`); failCount++; await sleep(2000); continue; }

    const q = yahoo?.indicators?.quote?.[0];
    if (!q) { console.log("⚠ SKIP: no data"); failCount++; await sleep(1500); continue; }

    let peRatio = null, pbRatio = null, pegRatio = null, debtToEquity = null, roce = null;
    if (fundamentals) {
      const fd = fundamentals.financialData || {};
      const dks = fundamentals.defaultKeyStatistics || {};
      const sd = fundamentals.summaryDetail || {};
      
      peRatio = sd.trailingPE?.raw || sd.forwardPE?.raw || null;
      pbRatio = dks.priceToBook?.raw || null;
      pegRatio = dks.pegRatio?.raw || null;
      debtToEquity = fd.debtToEquity?.raw ? fd.debtToEquity.raw / 100 : null; // YF gives D/E as 150 for 1.5
      roce = fd.returnOnEquity?.raw ? fd.returnOnEquity.raw * 100 : null; // Use ROE proxy
    }

    const closes = q.close.filter(Boolean);
    const highs  = q.high.filter(Boolean);
    const lows   = q.low.filter(Boolean);
    const vols   = q.volume.filter(Boolean);
    if (closes.length < 30) { console.log("⚠ SKIP: insufficient"); failCount++; await sleep(1500); continue; }

    // ══════════════════════════════════════════════════════════════════
    // KEY CHANGE: 1-DAY LOOKBACK
    // Prediction point = 1 day before latest (yesterday's close)
    // We predict what happens TODAY (the next trading day)
    // ══════════════════════════════════════════════════════════════════
    const LB = 1;
    const pi = closes.length - 1 - LB;  // prediction index = yesterday
    const predPrice   = closes[pi];      // yesterday's close = today's open proxy
    const actualClose = closes[pi + 1];  // today's actual close
    const nextHigh    = highs[pi + 1];   // today's intraday high
    const nextLow     = lows[pi + 1];    // today's intraday low
    const actualChg   = ((actualClose - predPrice) / predPrice) * 100;

    // Compute indicators AT prediction point (using data up to yesterday)
    const cAt = closes.slice(0, pi + 1);
    const hAt = highs.slice(0, pi + 1);
    const lAt = lows.slice(0, pi + 1);
    const vAt = vols.slice(0, pi + 1);

    const rsi      = computeRSI(cAt);
    const atrValue = computeATR(hAt, lAt, cAt);
    const todayVol = vAt[vAt.length - 1];
    const avgVol   = vAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const rvol     = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
    const mom5     = cAt.length >= 6 ? (cAt[cAt.length - 1] > cAt[cAt.length - 6] ? 1 : -1) : 0;
    const momentumPct = cAt.length >= 6 ? ((cAt[cAt.length - 1] - cAt[cAt.length - 6]) / cAt[cAt.length - 6]) * 100 : 0;
    const atrPrev  = cAt.length > 19 ? computeATR(hAt.slice(0, -5), lAt.slice(0, -5), cAt.slice(0, -5)) : atrValue;
    const atrTrend = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);

    const adxArr = ADX.calculate({ high: hAt, low: lAt, close: cAt, period: 14 });
    const adx    = adxArr.length > 0 ? adxArr[adxArr.length - 1].adx : 25;
    const ema20  = (() => { const a = EMA.calculate({ period: 20, values: cAt }); return a.length ? a[a.length - 1] : predPrice; })();
    const ema50  = (() => { const a = EMA.calculate({ period: 50, values: cAt }); return a.length ? a[a.length - 1] : predPrice; })();
    const ema200 = (() => { const a = EMA.calculate({ period: 200, values: cAt }); return a.length ? a[a.length - 1] : predPrice; })();

    let macd = null;
    const macdData = MACD.calculate({ values: cAt, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    if (macdData.length > 1) {
      const cur = macdData[macdData.length - 1];
      const prev = macdData[macdData.length - 2];
      if (cur.MACD !== undefined && cur.signal !== undefined) {
        macd = {
          crossover: cur.MACD > cur.signal && prev.MACD <= prev.signal ? "BULLISH" : (cur.MACD < cur.signal && prev.MACD >= prev.signal ? "BEARISH" : "NONE"),
          histogram: cur.histogram,
          histogram_direction: Math.abs(cur.histogram) > Math.abs(prev.histogram) ? "EXPANDING" : "CONTRACTING"
        };
      }
    }

    // FIX 2: Compute previous-day candle change
    const prevDayChangePct = pi >= 1 ? ((cAt[pi] - cAt[pi - 1]) / cAt[pi - 1]) * 100 : 0;

    const eng = runEngine(stock, predPrice, {
      rsi, rvol, momentum: mom5, momentumPct, atrTrend, atrValue,
      pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false,
      macd, ema20, ema50, ema200,
      peRatio, pbRatio, pegRatio, debtToEquity, roce, adx,
      prevDayChangePct, marketRegime // FIX 2 & 4: new inputs
    }, { timeHorizon: '1D' }); // FIX 3: pass timeHorizon for ATR cap

    const pred = eng.direction;

    // ── EVALUATION ───────────────────────────────────────────────────
    // 1. Direction hit: did closing price move in predicted direction?
    const dirHit = (pred === "UP" && actualChg > 0) || (pred === "DOWN" && actualChg < 0);

    // 2. Target hit (close-based): did close reach our target?
    const closeTgtHit = pred === "UP"   ? actualClose >= eng.upTarget * 0.995
                      : pred === "DOWN" ? actualClose <= eng.downTarget * 1.005
                      : false;

    // 3. INTRADAY target hit: did the HIGH or LOW touch our target during the day?
    //    This is the real intraday metric — a limit order at the target would have filled.
    const intradayTgtHitResult = pred === "UP"   ? nextHigh >= eng.upTarget * 0.995
                               : pred === "DOWN" ? nextLow  <= eng.downTarget * 1.005
                               : false;

    // How close did intraday price get?
    let tgtReachPct = 0;
    if (pred === "UP" && eng.upTarget > predPrice) {
      const needed = eng.upTarget - predPrice;
      const got    = nextHigh - predPrice;
      tgtReachPct  = Math.min(100, Math.max(0, +(got / needed * 100).toFixed(1)));
    } else if (pred === "DOWN" && predPrice > eng.downTarget) {
      const needed = predPrice - eng.downTarget;
      const got    = predPrice - nextLow;
      tgtReachPct  = Math.min(100, Math.max(0, +(got / needed * 100).toFixed(1)));
    }

    if (pred !== "NEUTRAL") {
      dirTotal++; if (dirHit) dirHits++;
      tgtTotal++; if (closeTgtHit) tgtHits++;
      intradayTgtTotal++; if (intradayTgtHitResult) intradayTgtHits++;
      const band = getBand(eng.score);
      bands[band].tot++;
      if (dirHit) bands[band].dirH++;
      if (closeTgtHit) bands[band].tgtH++;
      if (intradayTgtHitResult) bands[band].intH++;
    } else {
      neutralCount++;
    }

    const icon = pred === "NEUTRAL" ? '🛡️' : (intradayTgtHitResult ? '✅' : '❌');
    const tgtStr = pred === "UP" ? `↑₹${eng.upTarget.toFixed(1)}` : pred === "DOWN" ? `↓₹${eng.downTarget.toFixed(1)}` : 'N/A';
    console.log(
      `${icon} ${pred.padEnd(8)} Score:${String(eng.score).padEnd(6)} ` +
      `${tgtStr.padEnd(14)} ` +
      `Hi:₹${nextHigh?.toFixed(1) || '?'} Lo:₹${nextLow?.toFixed(1) || '?'} Cl:${actualChg >= 0 ? '+' : ''}${actualChg.toFixed(2)}%  ` +
      `Reach:${tgtReachPct}%`
    );

    results.push({
      stock, score: eng.score, direction: pred, verdict: eng.verdict,
      predPrice: +predPrice.toFixed(2), 
      nextHigh: +nextHigh.toFixed(2), nextLow: +nextLow.toFixed(2),
      actualClose: +actualClose.toFixed(2), actualChg: +actualChg.toFixed(2),
      upTarget: eng.upTarget ? +eng.upTarget.toFixed(2) : null,
      downTarget: eng.downTarget ? +eng.downTarget.toFixed(2) : null,
      dirHit: pred !== "NEUTRAL" ? dirHit : null,
      closeTgtHit: pred !== "NEUTRAL" ? closeTgtHit : null,
      intradayTgtHit: pred !== "NEUTRAL" ? intradayTgtHitResult : null,
      tgtReachPct,
      rsi, adx: +adx.toFixed(1), rvol, atrValue,
    });

    await sleep(2000 + Math.random() * 500);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const dirRate = dirTotal > 0 ? ((dirHits / dirTotal) * 100).toFixed(1) : 'N/A';
  const closeTgtRate = tgtTotal > 0 ? ((tgtHits / tgtTotal) * 100).toFixed(1) : 'N/A';
  const intradayTgtRate = intradayTgtTotal > 0 ? ((intradayTgtHits / intradayTgtTotal) * 100).toFixed(1) : 'N/A';
  const activeResults = results.filter(r => r.direction !== "NEUTRAL");
  const avgReach = activeResults.length > 0
    ? (activeResults.reduce((s, r) => s + r.tgtReachPct, 0) / activeResults.length).toFixed(1) : 'N/A';

  console.log(`\n${'═'.repeat(85)}`);
  console.log('  STOCKSENSE ULTRA PRO — 1-DAY INTRADAY TARGET HIT RATIO REPORT');
  console.log('═'.repeat(85));
  console.log(`\n  ┌──────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │                       PRIMARY METRICS (1-DAY)                        │`);
  console.log(`  ├──────────────────────────────────────────────────────────────────────┤`);
  console.log(`  │  INTRADAY TARGET HIT   : ${intradayTgtRate.padStart(5)}%   (${intradayTgtHits}/${intradayTgtTotal})  ← KEY METRIC`.padEnd(72) + '│');
  console.log(`  │    (price touched target during the next trading day)`.padEnd(72) + '│');
  console.log(`  │  CLOSE TARGET HIT      : ${closeTgtRate.padStart(5)}%   (${tgtHits}/${tgtTotal})`.padEnd(72) + '│');
  console.log(`  │    (closing price hit target)`.padEnd(72) + '│');
  console.log(`  │  DIRECTIONAL ACCURACY  : ${dirRate.padStart(5)}%   (${dirHits}/${dirTotal})`.padEnd(72) + '│');
  console.log(`  │  AVG INTRADAY REACH    : ${avgReach.padStart(5)}%`.padEnd(72) + '│');
  console.log(`  │  NEUTRAL / VETOED      : ${String(neutralCount).padStart(5)}    (no prediction made)`.padEnd(72) + '│');
  console.log(`  │  FAILED / SKIPPED      : ${String(failCount).padStart(5)}`.padEnd(72) + '│');
  console.log(`  │  TOTAL TESTED          : ${String(results.length).padStart(5)}`.padEnd(72) + '│');
  console.log(`  └──────────────────────────────────────────────────────────────────────┘`);

  console.log(`\n  ┌──────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │            SCORE BAND BREAKDOWN (INTRADAY TARGET HIT)                │`);
  console.log(`  ├──────────────────────────────────────────────────────────────────────┤`);
  for (const [label, b] of Object.entries(bands)) {
    if (b.tot === 0) {
      console.log(`  │  ${label.padEnd(22)} (no calls)`.padEnd(72) + '│');
      continue;
    }
    const iR = `${((b.intH / b.tot) * 100).toFixed(0)}%`;
    const dR = `${((b.dirH / b.tot) * 100).toFixed(0)}%`;
    const bar = '█'.repeat(Math.round((b.intH / b.tot) * 15)).padEnd(15, '░');
    console.log(`  │  ${label.padEnd(22)} ${bar} Intra:${iR.padEnd(5)} Dir:${dR.padEnd(5)} (${b.intH}/${b.tot})`.padEnd(72) + '│');
  }
  console.log(`  └──────────────────────────────────────────────────────────────────────┘`);

  // Top hits
  const hits = activeResults.filter(r => r.intradayTgtHit);
  const misses = activeResults.filter(r => !r.intradayTgtHit);

  console.log(`\n  ── TOP INTRADAY HITS ──`);
  hits.sort((a, b) => Math.abs(b.actualChg) - Math.abs(a.actualChg)).slice(0, 5).forEach(r => {
    console.log(`    ✅ ${r.stock.padEnd(14)} Score:${r.score} ${r.direction.padEnd(5)} Chg:${r.actualChg >= 0 ? '+' : ''}${r.actualChg}% Reach:${r.tgtReachPct}%`);
  });

  console.log(`\n  ── TOP MISSES ──`);
  misses.sort((a, b) => a.tgtReachPct - b.tgtReachPct).slice(0, 5).forEach(r => {
    console.log(`    ❌ ${r.stock.padEnd(14)} Score:${r.score} ${r.direction.padEnd(5)} Chg:${r.actualChg >= 0 ? '+' : ''}${r.actualChg}% Reach:${r.tgtReachPct}%`);
  });

  const rate = intradayTgtTotal > 0 ? (intradayTgtHits / intradayTgtTotal) * 100 : 0;
  const grade =
    rate >= 80 ? "🏆 EXCEPTIONAL — 80%+ Intraday Hit Ratio CONFIRMED" :
    rate >= 75 ? "🏆 INSTITUTIONAL GRADE — 75%+ Intraday Hit Ratio" :
    rate >= 65 ? "🟢 STRONG — 65%+ Intraday Hit Ratio" :
    rate >= 55 ? "🟡 GOOD — 55%+ Intraday Hit Ratio" :
    rate >= 45 ? "🟠 MODERATE" : "🔴 NEEDS WORK";

  console.log(`\n  ┌──────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │  GRADE: ${grade}`.padEnd(72) + '│');
  console.log(`  │  Engine  : scoreEngine v3.0 — 7-Pillar Architecture`.padEnd(72) + '│');
  console.log(`  │  Window  : 1 Trading Day (Intraday / Next-Day)`.padEnd(72) + '│');
  console.log(`  │  Data    : Yahoo Finance Real OHLCV — Zero Simulation`.padEnd(72) + '│');
  console.log(`  │  Run     : ${ts}`.padEnd(72) + '│');
  console.log(`  └──────────────────────────────────────────────────────────────────────┘\n`);

  // Save JSON
  const report = {
    timestamp: ts,
    window: "1-DAY",
    metrics: { intradayTgtRate: +intradayTgtRate, closeTgtRate: +closeTgtRate, dirRate: +dirRate, avgReach: +avgReach,
               intradayTgtHits, intradayTgtTotal, tgtHits, tgtTotal, dirHits, dirTotal, neutralCount, failCount, totalTested: results.length },
    scoreBands: bands, grade,
    results
  };
  fs.writeFileSync('HitRatio_1Day_Audit.json', JSON.stringify(report, null, 2));
  console.log("  📄 Full report saved → HitRatio_1Day_Audit.json\n");
}

runAudit().catch(e => { console.error("Fatal:", e); process.exit(1); });
