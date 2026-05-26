const fs = require('fs');
const path = require('path');
const { runEngine } = require('../src/layers/layer13/scoreEngine');
const {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  adxEngine
} = require('../src/layers/layer3/technicals');
const { yahooChartCandles } = require('../src/layers/layer3/candles');

function loadNseStocks() {
  const stocksFilePath = path.join(__dirname, '../frontend/src/stocks.js');
  const content = fs.readFileSync(stocksFilePath, 'utf8');
  const match = content.match(/const\s+ALL_INDIAN_STOCKS\s*=\s*\[([\s\S]*?)\]/);
  return match[1]
    .split(',')
    .map(s => s.replace(/["'\s\r\n]/g, ''))
    .filter(Boolean);
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
  const atrRes = atrEngine({
    high_prices,
    low_prices,
    close_prices,
    entry_price: entryPrice,
    vix_regime: "STABLE"
  });
  const adxRes = adxEngine({ high_prices, low_prices, close_prices });

  const v20 = volume.slice(-20);
  const avg20 = v20.reduce((a, b) => a + b, 0) / Math.max(1, v20.length);
  const rvol20 = avg20 > 0 ? volume[volume.length - 1] / avg20 : 1.0;

  let momentum = 0, momentumPct = 0;
  if (len >= 6) {
    momentum = close_prices[len - 1] > close_prices[len - 6] ? 1 : -1;
    momentumPct = ((close_prices[len - 1] - close_prices[len - 6]) / close_prices[len - 6]) * 100;
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
    adx: adxRes.ok ? adxRes.data.adx : 25,
    prevDayChangePct: len >= 2 ? ((close_prices[len - 1] - close_prices[len - 2]) / close_prices[len - 2]) * 100 : 0,
    marketRegime: "NEUTRAL",
    sectorRegime: "NEUTRAL"
  };
}

async function main() {
  const allStocks = loadNseStocks();
  const shuffled = [...allStocks].sort(() => 0.5 - Math.random());
  
  // Pre-load data for 100 valid stocks to make sweeps super fast
  console.log("Pre-fetching 100 stocks data...");
  const validData = [];
  for (let i = 0; i < shuffled.length && validData.length < 100; i++) {
    const symbol = shuffled[i];
    const candleRes = await yahooChartCandles(symbol, { range: '1y', interval: '1d' });
    if (!candleRes.ok || candleRes.data.length < 210) continue;
    
    const candles = candleRes.data;
    const N = candles.length;
    const entry = candles[N - 2].c;
    const slice = candles.slice(0, N - 1);
    const indicators = calculateIndicatorsForSlice(slice, entry);
    const today = candles[N - 1];
    
    validData.push({ symbol, entry, indicators, today });
  }
  
  console.log("\nRunning threshold sweeps on cached stocks...");
  console.log("Format: Bullish / Bearish | Active Setups | Hit Rate % | Directional Accuracy %");
  console.log("--------------------------------------------------------------------------------");
  
  const thresholds = [
    { bull: 53.0, bear: 47.0 },
    { bull: 53.5, bear: 46.5 },
    { bull: 54.0, bear: 46.0 },
    { bull: 54.5, bear: 45.5 },
    { bull: 55.0, bear: 42.0 },
    { bull: 55.5, bear: 41.5 },
    { bull: 56.0, bear: 41.0 },
    { bull: 56.5, bear: 40.5 }
  ];
  
  for (const t of thresholds) {
    let stActive = 0, stWins = 0, stLosses = 0, stTimeouts = 0, stDirCorrect = 0;
    
    for (const item of validData) {
      // Evaluate runEngine, but override direction using custom thresholds
      const res = runEngine(item.symbol, item.entry, item.indicators, { timeHorizon: '1D' });
      
      let direction = "NEUTRAL";
      if (!res.isVetoed) {
        if (res.score >= t.bull) {
          if (item.indicators.rsi > 48 && item.indicators.momentum >= 0) {
            direction = "UP";
          }
        } else if (res.score < t.bear) {
          if (item.indicators.rsi < 52 && item.indicators.momentum <= 0) {
            direction = "DOWN";
          }
        }
      }
      
      if (direction === "NEUTRAL") continue;
      
      stActive++;
      
      const deviation = Math.abs(res.score - 50) / 50;
      const start = 0.05;
      const slope = 0.10;
      const cap = 0.010;
      
      let baseMultiplier = start + deviation * slope;
      if (item.indicators.adx < 12) baseMultiplier = Math.min(baseMultiplier, start + 0.03);

      const atrFloor = 0.05;
      const atrCeiling = 0.18;
      let atrMultiplier = Math.max(atrFloor, Math.min(atrCeiling, baseMultiplier));
      let headroom = item.indicators.atrValue * atrMultiplier;

      if (item.indicators.rvol < 0.8) headroom *= 0.85;

      const atrPct = item.indicators.atrValue / item.entry;
      const dailyCap = Math.min(atrPct * 0.40, cap);
      const maxIntraday = item.entry * Math.max(dailyCap, 0.0030);
      headroom = Math.min(headroom, maxIntraday);

      const target = direction === "UP" ? item.entry + headroom : item.entry - headroom;
      const slRoom = item.indicators.atrValue * 1.5;
      const sl = direction === "UP" ? item.entry - slRoom : item.entry + slRoom;
      
      const actualHigh = item.today.h;
      const actualLow = item.today.l;
      const actualClose = item.today.c;
      
      let actualDir = "NEUTRAL";
      if (actualClose > item.entry) actualDir = "UP";
      else if (actualClose < item.entry) actualDir = "DOWN";
      
      if (actualDir === direction) {
        stDirCorrect++;
      }
      
      if (direction === "UP") {
        if (actualHigh >= target && actualLow <= sl) stLosses++;
        else if (actualHigh >= target) stWins++;
        else if (actualLow <= sl) stLosses++;
        else stTimeouts++;
      } else {
        if (actualLow <= target && actualHigh >= sl) stLosses++;
        else if (actualLow <= target) stWins++;
        else if (actualHigh >= sl) stLosses++;
        else stTimeouts++;
      }
    }
    
    const hitRatio = stActive > 0 ? (stWins / stActive * 100) : 0;
    const dirAcc = stActive > 0 ? (stDirCorrect / stActive * 100) : 0;
    
    console.log(`Bull >= ${t.bull.toFixed(1)} / Bear < ${t.bear.toFixed(1)} | Active: ${stActive.toString().padEnd(2)} | Target Hit: ${hitRatio.toFixed(2)}% | Dir Acc: ${dirAcc.toFixed(2)}%`);
  }
}

main().catch(console.error);
