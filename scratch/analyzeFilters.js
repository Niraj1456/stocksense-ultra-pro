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

async function runAnalysis() {
  const stocks = loadNseStocks();
  const shuffled = [...stocks].slice(0, 100); // Analyze first 100 stocks
  const data = [];

  console.log("Fetching historical candles for 100 stocks...");
  for (let i = 0; i < shuffled.length; i++) {
    const sym = shuffled[i];
    try {
      await new Promise(r => setTimeout(r, 100));
      const res = await yahooChartCandles(sym, { range: '1y', interval: '1d' });
      if (res.ok && res.data && res.data.length >= 210) {
        data.push({ symbol: sym, candles: res.data });
      }
    } catch (e) { }
  }
  console.log(`Fetched data for ${data.length} stocks successfully.`);

  console.log("\nActive UP Trade Setups (Score >= 58) Analysis:");
  console.log("Symbol\tScore\tPrevDayChg\tMom5D\tRSI\tADX\tHistDir\tActualChg\tCorrect?");
  let upCount = 0, upCorrect = 0;
  let downCount = 0, downCorrect = 0;

  for (const item of data) {
    const candles = item.candles;
    const N = candles.length;
    const entryPrice = candles[N - 2].c;
    const slice = candles.slice(0, N - 1);
    const ind = calculateIndicatorsForSlice(slice, entryPrice);

    // Let's check with base score >= 58
    const res = runEngine(item.symbol, entryPrice, ind, { timeHorizon: '1D' });
    if (res.isVetoed) continue;

    const today = candles[N - 1];
    const actualChg = ((today.c - entryPrice) / entryPrice) * 100;
    const isUpCorrect = actualChg > 0;
    const isDownCorrect = actualChg < 0;

    if (res.score >= 58.0) {
      let trendAlign = true;
      if (ind.ema20 && ind.ema50) {
        trendAlign = ind.ema20 >= ind.ema50;
      }
      const adxValid = ind.adx >= 20;
      const macdValid = ind.macd ? ind.macd.histogram_direction === 'EXPANDING' : true;
      const rvolValid = ind.rvol >= 0.5;
      const momValid = ind.momentumPct < 10.0;
      const prevChgValid = ind.prevDayChangePct <= 4.5;
      
      if (trendAlign && adxValid && macdValid && rvolValid && momValid && prevChgValid) {
        upCount++;
        if (isUpCorrect) upCorrect++;
        console.log(`${item.symbol}\t${res.score.toFixed(1)}\t${ind.prevDayChangePct.toFixed(2)}%\t${ind.momentumPct.toFixed(2)}%\t${ind.rsi.toFixed(1)}\t${ind.adx.toFixed(1)}\t${ind.macd?.histogram_direction}\t${actualChg.toFixed(2)}%\t${isUpCorrect ? "YES" : "NO"}`);
      }
    } else if (res.score < 42.0) {
      let trendAlign = true;
      if (ind.ema20 && ind.ema50) {
        trendAlign = ind.ema20 <= ind.ema50;
      }
      const adxValid = ind.adx >= 20;
      const macdValid = ind.macd ? ind.macd.histogram_direction === 'CONTRACTING' : true;
      const rvolValid = ind.rvol >= 0.5;
      
      if (trendAlign && adxValid && macdValid && rvolValid) {
        downCount++;
        if (isDownCorrect) downCorrect++;
      }
    }
  }

  console.log(`\nUP Total: ${upCount}, Correct: ${upCorrect} (${(upCount > 0 ? (upCorrect/upCount*100) : 0).toFixed(2)}%)`);
  console.log(`DOWN Total: ${downCount}, Correct: ${downCorrect} (${(downCount > 0 ? (downCorrect/downCount*100) : 0).toFixed(2)}%)`);
}

runAnalysis().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
