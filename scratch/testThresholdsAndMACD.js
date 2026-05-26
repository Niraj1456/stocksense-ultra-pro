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

async function runGridSearch() {
  const stocks = loadNseStocks();
  const shuffled = [...stocks].slice(0, 35);
  const data = [];

  console.log("Fetching historical candles...");
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

  const lookbackDays = 30;
  const results = [];

  const thresholds = [53, 55, 57, 58, 60, 62, 65];
  const rsiBounds = [45, 48, 50, 52, 55];
  const reqMacds = [true, false];
  const reqEmas = [true, false];

  console.log("Starting grid search...");

  for (const bullT of thresholds) {
    const bearT = 100 - bullT; // symmetrical bear threshold

    for (const rsiLongMin of rsiBounds) {
      const rsiShortMax = 100 - rsiLongMin; // symmetrical RSI bound

      for (const reqMacd of reqMacds) {
        for (const reqEma of reqEmas) {
          let active = 0, wins = 0, losses = 0, dirCorrect = 0;

          for (const item of data) {
            const candles = item.candles;
            const totalLen = candles.length;

            for (let dayOffset = 0; dayOffset < lookbackDays; dayOffset++) {
              const N = totalLen - dayOffset;
              if (N < 210) continue;

              const entryPrice = candles[N - 2].c;
              const slice = candles.slice(0, N - 1);
              const ind = calculateIndicatorsForSlice(slice, entryPrice);

              const res = runEngine(item.symbol, entryPrice, ind, { timeHorizon: '1D' });
              if (res.isVetoed) continue;

              let direction = "NEUTRAL";
              
              if (res.score >= bullT) {
                let trendAlign = true;
                if (reqEma && ind.ema20 && ind.ema50) {
                  trendAlign = ind.ema20 >= ind.ema50;
                }
                const rsiValid = ind.rsi > rsiLongMin;
                const momValid = ind.momentum >= 0;
                const macdValid = reqMacd ? (ind.macd ? ind.macd.histogram_direction === 'EXPANDING' : true) : true;

                if (rsiValid && momValid && trendAlign && macdValid) {
                  direction = "UP";
                }
              } else if (res.score < bearT) {
                let trendAlign = true;
                if (reqEma && ind.ema20 && ind.ema50) {
                  trendAlign = ind.ema20 <= ind.ema50;
                }
                const rsiValid = ind.rsi < rsiShortMax;
                const momValid = ind.momentum <= 0;
                const macdValid = reqMacd ? (ind.macd ? ind.macd.histogram_direction === 'CONTRACTING' : true) : true;

                if (rsiValid && momValid && trendAlign && macdValid) {
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

          if (active >= 25) { // Require at least 25 setups
            const winRate = (wins / active) * 100;
            const dirAcc = (dirCorrect / active) * 100;
            results.push({ bullT, bearT, rsiLongMin, reqMacd, reqEma, active, winRate, dirAcc });
          }
        }
      }
    }
  }

  // Sort by directional accuracy desc
  results.sort((a, b) => b.dirAcc - a.dirAcc || b.winRate - a.winRate);

  console.log("\n================ TOP 15 SEARCH RESULTS ================");
  results.slice(0, 15).forEach((r, idx) => {
    console.log(`${idx + 1}. Active: ${r.active} | Dir Acc: ${r.dirAcc.toFixed(2)}% | Win Rate: ${r.winRate.toFixed(2)}%`);
    console.log(`   Config: bullT=${r.bullT}/bearT=${r.bearT}, rsiLongMin=${r.rsiLongMin}, reqMacd=${r.reqMacd}, reqEma=${r.reqEma}`);
  });
}

runGridSearch().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
