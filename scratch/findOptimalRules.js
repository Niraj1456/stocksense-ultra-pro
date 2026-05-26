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
  const shuffled = [...stocks].slice(0, 50); // Use 50 deterministic stocks
  const data = [];

  console.log("Fetching historical candles for 50 stocks...");
  for (let i = 0; i < shuffled.length; i++) {
    const sym = shuffled[i];
    try {
      await new Promise(r => setTimeout(r, 120));
      const res = await yahooChartCandles(sym, { range: '1y', interval: '1d' });
      if (res.ok && res.data && res.data.length >= 210) {
        data.push({ symbol: sym, candles: res.data });
      }
    } catch (e) { }
  }
  console.log(`Fetched data for ${data.length} stocks.`);

  // We want to test different combinations of:
  // - bullThreshold / bearThreshold
  // - maxLongRsi (to prevent overbought buying)
  // - minShortRsi (to prevent oversold selling)
  // - minAdx (to require trend)
  // - maxLongMomentumPct (to avoid overextended buying)
  // - minRvol (to require volume confirmation)

  const configs = [];
  const bullThresholds = [53, 55, 57, 58, 60];
  const bearThresholds = [47, 45, 43, 42, 40];
  const maxLongRsis = [62, 65, 68, 999];
  const minShortRsis = [0, 32, 35, 38];
  const minAdxs = [0, 15, 18, 20];
  const maxMomPcts = [8, 12, 999];

  // Let's generate a smart subset of configurations to evaluate
  for (const bullT of bullThresholds) {
    const bearT = bearThresholds[bullThresholds.indexOf(bullT)];
    for (const maxRsi of maxLongRsis) {
      for (const minRsi of minShortRsis) {
        for (const minAdx of minAdxs) {
          for (const maxMom of maxMomPcts) {
            configs.push({ bullT, bearT, maxRsi, minRsi, minAdx, maxMom });
          }
        }
      }
    }
  }

  console.log(`Evaluating ${configs.length} rule configurations...`);
  const results = [];

  for (const config of configs) {
    let active = 0, wins = 0, losses = 0, dirCorrect = 0;

    for (const item of data) {
      const candles = item.candles;
      const N = candles.length;
      const entryPrice = candles[N - 2].c;
      const slice = candles.slice(0, N - 1);
      const ind = calculateIndicatorsForSlice(slice, entryPrice);

      const res = runEngine(item.symbol, entryPrice, ind, { timeHorizon: '1D' });
      if (res.isVetoed) continue;

      let direction = "NEUTRAL";
      
      if (res.score >= config.bullT) {
        let trendAlign = true;
        if (ind.adx > 20 && ind.ema20 && ind.ema50) {
          trendAlign = ind.ema20 >= ind.ema50;
        }
        
        const rsiValid = ind.rsi > 45 && ind.rsi < config.maxRsi;
        const momValid = ind.momentum >= 0 && ind.momentumPct < config.maxMom;
        const adxValid = ind.adx >= config.minAdx;

        if (rsiValid && momValid && trendAlign && adxValid) {
          direction = "UP";
        }
      } else if (res.score < config.bearT) {
        let trendAlign = true;
        if (ind.adx > 20 && ind.ema20 && ind.ema50) {
          trendAlign = ind.ema20 <= ind.ema50;
        }

        const rsiValid = ind.rsi < 55 && ind.rsi > config.minRsi;
        const momValid = ind.momentum <= 0;
        const adxValid = ind.adx >= config.minAdx;

        if (rsiValid && momValid && trendAlign && adxValid) {
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

    if (active >= 8) { // Require at least 8 setups to be statistically meaningful
      const winRate = (wins / active) * 100;
      const dirAcc = (dirCorrect / active) * 100;
      results.push({ config, active, winRate, dirAcc });
    }
  }

  // Sort by directional accuracy desc, then win rate desc
  results.sort((a, b) => b.dirAcc - a.dirAcc || b.winRate - a.winRate);

  console.log("\n================ TOP 10 OPTIMAL CONFIGURATIONS ================");
  results.slice(0, 15).forEach((r, idx) => {
    console.log(`${idx + 1}. Active Setups: ${r.active} | Dir Acc: ${r.dirAcc.toFixed(2)}% | Win Rate: ${r.winRate.toFixed(2)}%`);
    console.log(`   Config: bullT=${r.config.bullT}, bearT=${r.config.bearT}, maxLongRsi=${r.config.maxRsi}, minShortRsi=${r.config.minRsi}, minAdx=${r.config.minAdx}, maxLongMom=${r.config.maxMom}`);
  });
}

runOptimization().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
