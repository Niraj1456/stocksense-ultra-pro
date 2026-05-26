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
    if (!match) throw new Error("Parse error");
    return match[1].split(',').map(s => s.replace(/["'\s\r\n]/g, '')).filter(Boolean);
  } catch (err) {
    return ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'];
  }
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
    adx: adxVal,
    prevDayChangePct: len >= 2 ? ((close_prices[len - 1] - close_prices[len - 2]) / close_prices[len - 2]) * 100 : 0,
    pdhPdlPts,
    marketRegime: "NEUTRAL",
    sectorRegime: "NEUTRAL"
  };
}

async function runOptimization() {
  const stocks = loadNseStocks();
  const shuffled = [...stocks].slice(0, 35); // Use 35 stocks to avoid rate limits
  const data = [];

  console.log("Fetching historical candles for 35 stocks...");
  for (let i = 0; i < shuffled.length; i++) {
    const sym = shuffled[i];
    try {
      await new Promise(r => setTimeout(r, 100));
      const res = await yahooChartCandles(sym, { range: '1y', interval: '1d' });
      if (res.ok && res.data && res.data.length >= 240) {
        data.push({ symbol: sym, candles: res.data });
      }
    } catch (e) { }
  }
  console.log(`Fetched data for ${data.length} stocks.`);

  // Define parameter configurations to test
  const configs = [
    { name: "Baseline (58/42)", bullT: 58, bearT: 42, reqAdx: 0, reqMacd: false },
    { name: "Baseline + ADX20", bullT: 58, bearT: 42, reqAdx: 20, reqMacd: false },
    { name: "Baseline + MACD", bullT: 58, bearT: 42, reqAdx: 0, reqMacd: true },
    { name: "Baseline + ADX18 + MACD", bullT: 58, bearT: 42, reqAdx: 18, reqMacd: true },
    { name: "Baseline + ADX20 + MACD", bullT: 58, bearT: 42, reqAdx: 20, reqMacd: true },
    { name: "Tuned V2 (57/43) + ADX20 + MACD", bullT: 57, bearT: 43, reqAdx: 20, reqMacd: true },
    { name: "Tuned V4 (60/40) + ADX20 + MACD", bullT: 60, bearT: 40, reqAdx: 20, reqMacd: true },
  ];

  const lookbackDays = 30; // Run backtest on last 30 trading days

  console.log(`Evaluating configurations over a 30-day rolling window (${lookbackDays} tests per stock)...`);

  for (const config of configs) {
    let active = 0, wins = 0, losses = 0, dirCorrect = 0;

    for (const item of data) {
      const candles = item.candles;
      const totalLen = candles.length;

      // Loop over the last 30 days
      for (let dayOffset = 0; dayOffset < lookbackDays; dayOffset++) {
        // N is the length of candles we see at that step
        const N = totalLen - dayOffset;
        if (N < 210) continue;

        const entryPrice = candles[N - 2].c;
        const slice = candles.slice(0, N - 1);
        const ind = calculateIndicatorsForSlice(slice, entryPrice);

        const res = runEngine(item.symbol, entryPrice, ind, { timeHorizon: '1D' });
        if (res.isVetoed) continue;

        let direction = "NEUTRAL";
        
        if (res.score >= config.bullT) {
          let trendAlign = true;
          if (ind.ema20 && ind.ema50) {
            trendAlign = ind.ema20 >= ind.ema50;
          }
          const adxValid = ind.adx >= config.reqAdx;
          const macdValid = config.reqMacd ? (ind.macd ? ind.macd.histogram_direction === 'EXPANDING' : true) : true;

          const rsiValid = ind.rsi > 45;
          const momValid = ind.momentum >= 0;

          if (rsiValid && momValid && trendAlign && adxValid && macdValid) {
            direction = "UP";
          }
        } else if (res.score < config.bearT) {
          let trendAlign = true;
          if (ind.ema20 && ind.ema50) {
            trendAlign = ind.ema20 <= ind.ema50;
          }
          const adxValid = ind.adx >= config.reqAdx;
          const macdValid = config.reqMacd ? (ind.macd ? ind.macd.histogram_direction === 'CONTRACTING' : true) : true;

          const rsiValid = ind.rsi < 55;
          const momValid = ind.momentum <= 0;

          if (rsiValid && momValid && trendAlign && adxValid && macdValid) {
            direction = "DOWN";
          }
        }

        if (direction === "NEUTRAL") continue;

        active++;
        const target = direction === "UP" ? res.upTarget : res.downTarget;
        const sl = direction === "UP" ? entryPrice - ind.atrValue * 1.5 : entryPrice + ind.atrValue * 1.5;
        
        const today = candles[N - 1];
        let actualDir = "NEUTRAL";
        if (today.c > entryPrice) actualDir = "UP";
        else if (today.c < entryPrice) actualDir = "DOWN";

        if (actualDir === direction) dirCorrect++;

        if (direction === "UP") {
          if (today.h >= target && today.l <= sl) losses++;
          else if (today.h >= target) wins++;
          else if (today.l <= sl) losses++;
        } else {
          if (today.l <= target && today.h >= sl) losses++;
          else if (today.l <= target) wins++;
          else if (today.h >= sl) losses++;
        }
      }
    }

    const winRate = active > 0 ? (wins / active) * 100 : 0;
    const dirAcc = active > 0 ? (dirCorrect / active) * 100 : 0;
    console.log(`${config.name.padEnd(38)} -> Active: ${String(active).padEnd(4)}, Dir Acc: ${dirAcc.toFixed(2)}%, Win Rate: ${winRate.toFixed(2)}%`);
  }
}

runOptimization().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
