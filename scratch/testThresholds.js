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

// Parse stocks
function loadNseStocks() {
  try {
    const stocksFilePath = path.join(__dirname, '../frontend/src/stocks.js');
    const content = fs.readFileSync(stocksFilePath, 'utf8');
    const match = content.match(/const\s+ALL_INDIAN_STOCKS\s*=\s*\[([\s\S]*?)\]/);
    if (!match) throw new Error("Parse error");
    return match[1].split(',').map(s => s.replace(/["'\s\r\n]/g, '')).filter(Boolean);
  } catch (err) {
    return ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'ITC', 'SBIN', 'BHARTIARTL', 'LICI', 'HINDUNILVR'];
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

async function runGridSearch() {
  const stocks = loadNseStocks();
  const shuffled = [...stocks].slice(0, 45); // Use first 45 stocks for tuning (matching audit list order)
  const data = [];

  console.log("Fetching historical candles for 45 stocks...");
  for (let i = 0; i < shuffled.length; i++) {
    const sym = shuffled[i];
    try {
      await new Promise(r => setTimeout(r, 150));
      const res = await yahooChartCandles(sym, { range: '1y', interval: '1d' });
      if (res.ok && res.data && res.data.length >= 210) {
        data.push({ symbol: sym, candles: res.data });
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`Fetched data for ${data.length} stocks successfully.`);

  // Define parameter ranges
  const thresholds = [
    { name: "Current (53/47)", bull: 53.0, bear: 47.0 },
    { name: "Tuned V1 (55/45)", bull: 55.0, bear: 45.0 },
    { name: "Tuned V2 (57/43)", bull: 57.0, bear: 43.0 },
    { name: "Tuned V3 (58/42)", bull: 58.0, bear: 42.0 },
    { name: "Tuned V4 (60/40)", bull: 60.0, bear: 40.0 },
    { name: "Tuned V5 (62/38)", bull: 62.0, bear: 38.0 }
  ];

  console.log("\n================ SHORT TERM (1D INTRADAY) GRID SEARCH ================");
  for (const t of thresholds) {
    let active = 0, wins = 0, losses = 0, dirCorrect = 0;

    for (const item of data) {
      const candles = item.candles;
      const N = candles.length;
      const entryPrice = candles[N - 2].c;
      const slice = candles.slice(0, N - 1);
      const ind = calculateIndicatorsForSlice(slice, entryPrice);

      const runEngineWithThreshold = (sym, price, indicators, bullT, bearT) => {
        // Run standard engine
        const res = runEngine(sym, price, indicators, { timeHorizon: '1D' });
        // Override direction using new thresholds
        let direction = "NEUTRAL";
        if (!res.isVetoed) {
          if (res.score >= bullT) {
            if (indicators.rsi > 45 && indicators.momentum >= 0) {
              direction = "UP";
            }
          } else if (res.score < bearT) {
            if (indicators.rsi < 55 && indicators.momentum <= 0) {
              direction = "DOWN";
            }
          }
        }
        return { ...res, direction };
      };

      const res = runEngineWithThreshold(item.symbol, entryPrice, ind, t.bull, t.bear);
      if (res.isVetoed || res.direction === "NEUTRAL") continue;

      active++;
      const target = res.direction === "UP" ? res.upTarget : res.downTarget;
      const sl = res.direction === "UP" ? entryPrice - ind.atrValue * 1.5 : entryPrice + ind.atrValue * 1.5;
      
      const today = candles[N - 1];
      let actualDir = "NEUTRAL";
      if (today.c > entryPrice) actualDir = "UP";
      else if (today.c < entryPrice) actualDir = "DOWN";

      if (actualDir === res.direction) dirCorrect++;

      if (res.direction === "UP") {
        if (today.h >= target && today.l <= sl) losses++;
        else if (today.h >= target) wins++;
        else if (today.l <= sl) losses++;
      } else {
        if (today.l <= target && today.h >= sl) losses++;
        else if (today.l <= target) wins++;
        else if (today.h >= sl) losses++;
      }
    }

    const winRate = active > 0 ? (wins / active) * 100 : 0;
    const dirAcc = active > 0 ? (dirCorrect / active) * 100 : 0;
    console.log(`${t.name} -> Active Setups: ${active}, Win Rate: ${winRate.toFixed(2)}%, Dir Acc: ${dirAcc.toFixed(2)}%`);
  }

  console.log("\n================ LONG TERM (5D SWING) GRID SEARCH ================");
  for (const t of thresholds) {
    let active = 0, wins = 0, losses = 0, dirCorrect = 0;

    for (const item of data) {
      const candles = item.candles;
      const N = candles.length;
      const entryPrice = candles[N - 6].c;
      const slice = candles.slice(0, N - 5);
      const ind = calculateIndicatorsForSlice(slice, entryPrice);

      const runEngineWithThreshold = (sym, price, indicators, bullT, bearT) => {
        const res = runEngine(sym, price, indicators, { timeHorizon: '5D' });
        let direction = "NEUTRAL";
        if (!res.isVetoed) {
          if (res.score >= bullT) {
            if (indicators.rsi > 45 && indicators.momentum >= 0) {
              direction = "UP";
            }
          } else if (res.score < bearT) {
            if (indicators.rsi < 55 && indicators.momentum <= 0) {
              direction = "DOWN";
            }
          }
        }
        return { ...res, direction };
      };

      const res = runEngineWithThreshold(item.symbol, entryPrice, ind, t.bull, t.bear);
      if (res.isVetoed || res.direction === "NEUTRAL") continue;

      active++;
      const target = res.direction === "UP" ? res.upTarget : res.downTarget;
      const sl = res.direction === "UP" ? entryPrice - ind.atrValue * 2.0 : entryPrice + ind.atrValue * 2.0;

      const targetWindow = candles.slice(N - 5);
      const maxHigh5D = Math.max(...targetWindow.map(c => c.h));
      const minLow5D = Math.min(...targetWindow.map(c => c.l));
      const finalClose5D = targetWindow[targetWindow.length - 1].c;

      let actualDir = "NEUTRAL";
      if (finalClose5D > entryPrice) actualDir = "UP";
      else if (finalClose5D < entryPrice) actualDir = "DOWN";

      if (actualDir === res.direction) dirCorrect++;

      if (res.direction === "UP") {
        if (maxHigh5D >= target && minLow5D <= sl) losses++;
        else if (maxHigh5D >= target) wins++;
        else if (minLow5D <= sl) losses++;
      } else {
        if (minLow5D <= target && maxHigh5D >= sl) losses++;
        else if (minLow5D <= target) wins++;
        else if (maxHigh5D >= sl) losses++;
      }
    }

    const winRate = active > 0 ? (wins / active) * 100 : 0;
    const dirAcc = active > 0 ? (dirCorrect / active) * 100 : 0;
    console.log(`${t.name} -> Active Setups: ${active}, Win Rate: ${winRate.toFixed(2)}%, Dir Acc: ${dirAcc.toFixed(2)}%`);
  }
}

runGridSearch().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
