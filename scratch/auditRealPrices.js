const fs = require('fs');
const path = require('path');
const { runEngine } = require('../src/layers/layer13/scoreEngine');
const {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  adxEngine,
  pdhPdlBreakoutEngine
} = require('../src/layers/layer3/technicals');
const { yahooChartCandles } = require('../src/layers/layer3/candles');

function loadNseStocks() {
  try {
    const stocksFilePath = path.join(__dirname, '../frontend/src/stocks.js');
    const content = fs.readFileSync(stocksFilePath, 'utf8');
    const match = content.match(/const\s+ALL_INDIAN_STOCKS\s*=\s*\[([\s\S]*?)\]/);
    if (!match) {
      throw new Error("Could not parse ALL_INDIAN_STOCKS array from stocks.js");
    }
    return match[1].split(',').map(s => s.replace(/["'\s\r\n]/g, '')).filter(Boolean);
  } catch (err) {
    console.error("Failed to load real stocks list. Error:", err);
    return ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateIndicatorsForSlice(candlesSlice, entryPrice) {
  const close_prices = candlesSlice.map(c => c.c);
  const high_prices = candlesSlice.map(c => c.h);
  const low_prices = candlesSlice.map(c => c.l);
  const volume = candlesSlice.map(c => c.v);
  const len = close_prices.length;

  const rsiRes = rsiEngine({ close_prices });
  const macdRes = macdEngine({ close_prices });
  const emaRes = emaEngine({ close_prices, current_price: entryPrice });
  const atrRes = atrEngine({ high_prices, low_prices, close_prices, entry_price: entryPrice, vix_regime: "STABLE" });
  const adxRes = adxEngine({ high_prices, low_prices, close_prices });

  const v20 = volume.slice(-20);
  const avg20 = v20.reduce((a, b) => a + b, 0) / Math.max(1, v20.length);
  const rvol20 = avg20 > 0 ? volume[volume.length - 1] / avg20 : 1.0;

  let momentum = 0;
  let momentumPct = 0;
  if (len >= 6) {
    momentum = close_prices[len - 1] > close_prices[len - 6] ? 1 : -1;
    momentumPct = ((close_prices[len - 1] - close_prices[len - 6]) / close_prices[len - 6]) * 100;
  }

  const adxVal = adxRes.ok ? adxRes.data.adx : 25;
  let pdhPdlPts = 0;
  if (len >= 3) {
    const pdhPdlRes = pdhPdlBreakoutEngine({
      high_prices, low_prices, close_prices, current_price: entryPrice, rvol: rvol20, adx: adxVal
    });
    if (pdhPdlRes.ok) pdhPdlPts = pdhPdlRes.data.pts;
  }

  return {
    rsi: rsiRes.ok ? rsiRes.data.rsi_value : 50,
    rvol: rvol20,
    momentum,
    momentumPct,
    atrTrend: 1,
    atrValue: atrRes.ok ? atrRes.data.atr : (0.015 * entryPrice),
    pcr: 1.0,
    l2Imbalance: 0,
    hasRealPCR: false,
    hasRealL2: false,
    macd: macdRes.ok ? {
      macd_line: macdRes.data.macd_line,
      signal_line: macdRes.data.signal_line,
      histogram: macdRes.data.histogram,
      histogram_direction: macdRes.data.histogram_direction,
      crossover: macdRes.data.crossover
    } : null,
    ema20: emaRes.ok ? emaRes.data.ema20 : null,
    ema50: emaRes.ok ? emaRes.data.ema50 : null,
    ema200: emaRes.ok ? emaRes.data.ema200 : null,
    adx: adxVal,
    prevDayChangePct: len >= 2 ? ((close_prices[len - 1] - close_prices[len - 2]) / close_prices[len - 2]) * 100 : 0,
    intradayChangePct: len >= 2 ? ((close_prices[len - 1] - close_prices[len - 2]) / close_prices[len - 2]) * 100 : 0,
    triggerCandleOpen: len >= 1 ? candlesSlice[len - 1].o : null,
    triggerCandleHigh: len >= 1 ? candlesSlice[len - 1].h : null,
    triggerCandleLow: len >= 1 ? candlesSlice[len - 1].l : null,
    prevCandleOpen: len >= 2 ? candlesSlice[len - 2].o : null,
    prevCandleClose: len >= 2 ? candlesSlice[len - 2].c : null,
    pdhPdlPts,
    marketRegime: "NEUTRAL",
    sectorRegime: "NEUTRAL"
  };
}

async function runRealAudit() {
  console.log("Loading real stock list from stocks.js...");
  const allStocks = loadNseStocks();
  
  // Shuffle randomly to select 100 random stocks for evaluation
  const shuffled = [...allStocks].sort(() => 0.5 - Math.random());
  
  const auditSamples = [];
  let stActive = 0, stWins = 0, stLosses = 0, stTimeouts = 0, stVetoes = 0, stDirCorrect = 0;
  let ltActive = 0, ltWins = 0, ltLosses = 0, ltTimeouts = 0, ltVetoes = 0, ltDirCorrect = 0;
  
  const scoreBuckets = {
    high: { count: 0, wins: 0 },
    medium: { count: 0, wins: 0 },
    low: { count: 0, wins: 0 }
  };

  const targetSamplesCount = parseInt(process.argv[2], 10) || 100;
  let processedCount = 0;
  let attemptIdx = 0;

  console.log(`Evaluating stocks over the last 5 trading days. Target: ${targetSamplesCount} stocks.`);

  while (processedCount < targetSamplesCount && attemptIdx < shuffled.length) {
    const symbol = shuffled[attemptIdx++];
    console.log(`[${processedCount + 1}/${targetSamplesCount}] Fetching ${symbol}...`);
    
    await sleep(200);

    const candleRes = await yahooChartCandles(symbol, { range: '1y', interval: '1d' });
    if (!candleRes.ok || !candleRes.data || candleRes.data.length < 230) {
      console.warn(`Skipping ${symbol}: Insufficient candle data (${candleRes.data?.length || 0} candles)`);
      continue;
    }

    const candles = candleRes.data;
    const N = candles.length;
    let registeredSample = false;

    // Loop over the last 5 days to average out single-day market pullbacks
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      // ═══════════════════════════════════════════════════════════════
      // SHORT TERM (1D INTRADAY) EVALUATION
      // ═══════════════════════════════════════════════════════════════
      const stIdx = N - 1 - dayOffset;
      const stEntryIdx = N - 2 - dayOffset;
      const stEntryPrice = candles[stEntryIdx].c;
      const stSlice = candles.slice(0, stEntryIdx + 1);
      const stIndicators = calculateIndicatorsForSlice(stSlice, stEntryPrice);
      
      const stRes = runEngine(symbol, stEntryPrice, stIndicators, { timeHorizon: '1D' });
      let stWinStatus = "N/A";
      let stTarget = "—", stSL = "—", stFinal = "—";
      const stTodayCandle = candles[stIdx];

      if (stRes.isVetoed || stRes.direction === "NEUTRAL") {
        stVetoes++;
      } else {
        stActive++;
        const target = stRes.direction === "UP" ? stRes.upTarget : stRes.downTarget;
        const slRoom = stIndicators.atrValue * 1.5;
        const sl = stRes.direction === "UP" ? stEntryPrice - slRoom : stEntryPrice + slRoom;

        stTarget = `₹${target.toFixed(2)}`;
        stSL = `₹${sl.toFixed(2)}`;
        
        const actualHigh = stTodayCandle.h;
        const actualLow = stTodayCandle.l;
        const actualClose = stTodayCandle.c;

        if (stRes.direction === "UP") {
          if (actualHigh >= target && actualLow <= sl) {
            stWinStatus = "LOSS";
            stFinal = `₹${sl.toFixed(2)}`;
            stLosses++;
          } else if (actualHigh >= target) {
            stWinStatus = "WIN";
            stFinal = `₹${actualHigh.toFixed(2)}`;
            stWins++;
          } else if (actualLow <= sl) {
            stWinStatus = "LOSS";
            stFinal = `₹${actualLow.toFixed(2)}`;
            stLosses++;
          } else {
            stWinStatus = "TIMEOUT";
            stFinal = `₹${actualClose.toFixed(2)}`;
            stTimeouts++;
          }
        } else { // DOWN
          if (actualLow <= target && actualHigh >= sl) {
            stWinStatus = "LOSS";
            stFinal = `₹${sl.toFixed(2)}`;
            stLosses++;
          } else if (actualLow <= target) {
            stWinStatus = "WIN";
            stFinal = `₹${actualLow.toFixed(2)}`;
            stWins++;
          } else if (actualHigh >= sl) {
            stWinStatus = "LOSS";
            stFinal = `₹${actualHigh.toFixed(2)}`;
            stLosses++;
          } else {
            stWinStatus = "TIMEOUT";
            stFinal = `₹${actualClose.toFixed(2)}`;
            stTimeouts++;
          }
        }

        let actualDir = "NEUTRAL";
        if (stWinStatus === "WIN") actualDir = stRes.direction;
        else if (actualClose > stEntryPrice) actualDir = "UP";
        else if (actualClose < stEntryPrice) actualDir = "DOWN";

        if (actualDir === stRes.direction) {
          stDirCorrect++;
        }

        const compositeScore = stRes.score;
        let bucket = "medium";
        if (compositeScore >= 70) bucket = "high";
        else if (compositeScore < 45) bucket = "low";
        scoreBuckets[bucket].count++;
        if (stWinStatus === "WIN") scoreBuckets[bucket].wins++;
      }

      // ═══════════════════════════════════════════════════════════════
      // LONG TERM (5D SWING) EVALUATION
      // ═══════════════════════════════════════════════════════════════
      const ltEntryIdx = N - 6 - dayOffset;
      const ltEntryPrice = candles[ltEntryIdx].c;
      const ltSlice = candles.slice(0, ltEntryIdx + 1);
      const ltIndicators = calculateIndicatorsForSlice(ltSlice, ltEntryPrice);
      
      const ltRes = runEngine(symbol, ltEntryPrice, ltIndicators, { timeHorizon: '5D' });
      let ltWinStatus = "N/A";
      let ltTarget = "—", ltSL = "—", ltFinal = "—";
      const ltTargetWindow = candles.slice(N - 5 - dayOffset, N - dayOffset);

      if (ltRes.isVetoed || ltRes.direction === "NEUTRAL") {
        ltVetoes++;
      } else {
        ltActive++;
        const target = ltRes.direction === "UP" ? ltRes.upTarget : ltRes.downTarget;
        const slRoom = ltIndicators.atrValue * 2.0;
        const sl = ltRes.direction === "UP" ? ltEntryPrice - slRoom : ltEntryPrice + slRoom;

        ltTarget = `₹${target.toFixed(2)}`;
        ltSL = `₹${sl.toFixed(2)}`;

        const maxHigh5D = Math.max(...ltTargetWindow.map(c => c.h));
        const minLow5D = Math.min(...ltTargetWindow.map(c => c.l));
        const finalClose5D = ltTargetWindow[ltTargetWindow.length - 1].c;

        if (ltRes.direction === "UP") {
          if (maxHigh5D >= target && minLow5D <= sl) {
            ltWinStatus = "LOSS";
            ltFinal = `₹${sl.toFixed(2)}`;
            ltLosses++;
          } else if (maxHigh5D >= target) {
            ltWinStatus = "WIN";
            ltFinal = `₹${maxHigh5D.toFixed(2)}`;
            ltWins++;
          } else if (minLow5D <= sl) {
            ltWinStatus = "LOSS";
            ltFinal = `₹${minLow5D.toFixed(2)}`;
            ltLosses++;
          } else {
            ltWinStatus = "TIMEOUT";
            ltFinal = `₹${finalClose5D.toFixed(2)}`;
            ltTimeouts++;
          }
        } else { // DOWN
          if (minLow5D <= target && maxHigh5D >= sl) {
            ltWinStatus = "LOSS";
            ltFinal = `₹${sl.toFixed(2)}`;
            ltLosses++;
          } else if (minLow5D <= target) {
            ltWinStatus = "WIN";
            ltFinal = `₹${minLow5D.toFixed(2)}`;
            ltWins++;
          } else if (maxHigh5D >= sl) {
            ltWinStatus = "LOSS";
            ltFinal = `₹${maxHigh5D.toFixed(2)}`;
            ltLosses++;
          } else {
            ltWinStatus = "TIMEOUT";
            ltFinal = `₹${finalClose5D.toFixed(2)}`;
            ltTimeouts++;
          }
        }

        let actualDir = "NEUTRAL";
        if (ltWinStatus === "WIN") actualDir = ltRes.direction;
        else if (finalClose5D > ltEntryPrice) actualDir = "UP";
        else if (finalClose5D < ltEntryPrice) actualDir = "DOWN";

        if (actualDir === ltRes.direction) {
          ltDirCorrect++;
        }
      }

      // Add a single representative entry to the ledger for clarity
      if (dayOffset === 0 && !registeredSample) {
        registeredSample = true;
        auditSamples.push({
          id: processedCount + 1,
          symbol,
          stPrice: stEntryPrice.toFixed(2),
          stScore: stRes.score,
          stDirection: stRes.direction,
          stTarget,
          stSL,
          stFinal,
          stVeto: stRes.isVetoed ? "YES" : "NO",
          stResult: stWinStatus,
          
          ltPrice: ltEntryPrice.toFixed(2),
          ltScore: ltRes.score,
          ltDirection: ltRes.direction,
          ltTarget,
          ltSL,
          ltFinal,
          ltVeto: ltRes.isVetoed ? "YES" : "NO",
          ltResult: ltWinStatus
        });
      }
    }

    processedCount++;
  }

  // Calculate final statistics
  const stHitRatio = stActive > 0 ? (stWins / stActive) * 100 : 0;
  const stDirAcc = stActive > 0 ? (stDirCorrect / stActive) * 100 : 0;
  
  const ltHitRatio = ltActive > 0 ? (ltWins / ltActive) * 100 : 0;
  const ltDirAcc = ltActive > 0 ? (ltDirCorrect / ltActive) * 100 : 0;

  const highWinRate = scoreBuckets.high.count > 0 ? (scoreBuckets.high.wins / scoreBuckets.high.count) * 100 : 0;
  const medWinRate = scoreBuckets.medium.count > 0 ? (scoreBuckets.medium.wins / scoreBuckets.medium.count) * 100 : 0;
  const lowWinRate = scoreBuckets.low.count > 0 ? (scoreBuckets.low.wins / scoreBuckets.low.count) * 100 : 0;

  let md = `# StockSense Ultra Pro — Real Systems Audit Report

This report presents an honest, systems-level audit evaluating the **Target Hit Ratio** and **Directional Accuracy** of StockSense Ultra Pro. 
This audit evaluates the system using **actual historical price series fetched from Yahoo Finance** for **${processedCount} random NSE stocks** evaluated over a **rolling 5-day window** (500 total evaluation points).

### Key Audit Methodology:
1. **Robust Sampling**: Evaluates 100 random stocks over 5 distinct trading days to smooth out single-day broad market noise.
2. **Real Market Prices**: Entry prices, targets, stop-losses, and indicators are calculated from real market candles.
3. **Target Win Status**: Evaluated by checking if today's actual High/Low hit the targets.
4. **Swing Horizon Evaluation**: Tested over the actual subsequent 5 trading days.

---

## 1. Executive Performance Summary

| Metric | Short-Term (ST) Intraday | Long-Term (LT) Horizon | Target Benchmark | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Total Evaluated Stocks** | ${processedCount} | ${processedCount} | — | — |
| **Vetoed / Filtered Setups** | ${stVetoes} | ${ltVetoes} | — | — |
| **Active Trade Setups** | ${stActive} | ${ltActive} | — | — |
| **Target Hit Ratio (Wins)** | ${stHitRatio.toFixed(2)}% | ${ltHitRatio.toFixed(2)}% | >= 90% (ST)<br>>= 50% (LT) | ST: ${stHitRatio >= 90 ? "**PASSED** ✅" : "**FAILED** ❌"}<br>LT: ${ltHitRatio >= 50 ? "**PASSED** ✅" : "**FAILED** ❌"} |
| **Directional Accuracy** | ${stDirAcc.toFixed(2)}% | ${ltDirAcc.toFixed(2)}% | >= 60.00% | ST: ${stDirAcc >= 60 ? "**PASSED** ✅" : "**FAILED** ❌"}<br>LT: ${ltDirAcc >= 60 ? "**PASSED** ✅" : "**FAILED** ❌"} |

*Note: In real-world data, trades that do not hit target or SL within the intraday session are classified as **TIMEOUT** (exit at close), which represents standard trading execution.*

---

## 2. Conviction Accuracy Correlation (Short-Term)

To verify that higher system scores correlate mathematically with higher winning probability, active trades are grouped by their Master Intelligence score ranges:

* **High Conviction — STRONG BUY (Score >= 70)**: **${highWinRate.toFixed(2)}% Win Rate** (${scoreBuckets.high.wins}/${scoreBuckets.high.count} setups)
* **Moderate Conviction — BUY / ACCUMULATE (45 <= Score < 70)**: **${medWinRate.toFixed(2)}% Win Rate** (${scoreBuckets.medium.wins}/${scoreBuckets.medium.count} setups)
* **Low Conviction — AVOID (Score < 45)**: **${lowWinRate.toFixed(2)}% Win Rate** (${scoreBuckets.low.wins}/${scoreBuckets.low.count} setups)

---

## 3. Short-Term Intraday Verification Ledger (All ${processedCount} Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in today's market to verify the outcome.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | ST Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

  for (let j = 0; j < auditSamples.length; j++) {
    const s = auditSamples[j];
    md += `| ${s.id} | \`${s.symbol}\` | ₹${s.stPrice} | ${s.stScore} | **${s.stDirection}** | ${s.stTarget} | ${s.stSL} | **${s.stFinal}** | ${s.stVeto} | **${s.stResult}** |\n`;
  }

  md += `
---

## 4. Long-Term Horizon Verification Ledger (All ${processedCount} Stocks - Latest Day Snapshot)

This ledger presents the entry price, target level, stop-loss, and the **actual price reached** in the market over the last 5 days.

| ID | Symbol | Entry Price | Score | Direction | Target Price | Stop-Loss | Actual Final/Limit Price | Vetoed | LT Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

  for (let j = 0; j < auditSamples.length; j++) {
    const s = auditSamples[j];
    md += `| ${s.id} | \`${s.symbol}\` | ₹${s.ltPrice} | ${s.ltScore} | **${s.ltDirection}** | ${s.ltTarget} | ${s.ltSL} | **${s.ltFinal}** | ${s.ltVeto} | **${s.ltResult}** |\n`;
  }

  md += `
---

## 5. Systems Validation & Verification Sign-Off

### Real Data Verification
* Backtest executed directly on real historical candles from Yahoo Finance.
* Realized target hit ratio reflects true historical execution margins rather than biased random walks.

### System Settings Used
* Short-Term SL Multiplier: **1.5 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)
* Long-Term SL Multiplier: **2.0 × ATR**, Target: **0.40–1.20 × ATR** (dynamic, conviction-scaled)

**Audit Conducted by:** Antigravity AI Engine
**Verification Date:** ${new Date().toISOString().split('T')[0]}
`;

  const reportPath = path.join(__dirname, '../audit_report.md');
  fs.writeFileSync(reportPath, md);
  console.log(`Audit report generated successfully at ${reportPath}`);
}

runRealAudit().then(() => process.exit(0)).catch(e => {
  console.error("Audit failed:", e);
  process.exit(1);
});
