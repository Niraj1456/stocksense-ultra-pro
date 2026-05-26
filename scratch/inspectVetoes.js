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
  
  const vetoCounts = {};
  const activeVetoCounts = {}; // Vetoes that actually caused a Fatal Veto or a compression that killed a trade
  let fatalCount = 0;
  let deadZoneCount = 0;
  let activeCount = 0;
  
  console.log("Analyzing 100 random stocks for veto triggers...");
  
  let processed = 0;
  for (let i = 0; i < shuffled.length && processed < 100; i++) {
    const symbol = shuffled[i];
    const candleRes = await yahooChartCandles(symbol, { range: '1y', interval: '1d' });
    if (!candleRes.ok || candleRes.data.length < 210) continue;
    
    const candles = candleRes.data;
    const N = candles.length;
    const entry = candles[N - 2].c;
    const slice = candles.slice(0, N - 1);
    const indicators = calculateIndicatorsForSlice(slice, entry);
    const res = runEngine(symbol, entry, indicators, { timeHorizon: '1D' });
    
    processed++;
    
    if (res.isVetoed) {
      fatalCount++;
      res.fatalVetoes.forEach(v => {
        activeVetoCounts[v] = (activeVetoCounts[v] || 0) + 1;
      });
    } else if (res.direction === "NEUTRAL") {
      deadZoneCount++;
      // Check which caution vetoes were active and might have dragged the score down
      res.cautionVetoes.forEach(v => {
        vetoCounts[v] = (vetoCounts[v] || 0) + 1;
      });
    } else {
      activeCount++;
      res.cautionVetoes.forEach(v => {
        vetoCounts[v] = (vetoCounts[v] || 0) + 1;
      });
    }
  }
  
  console.log("\n=================================================");
  console.log("VETO & FILTRATION AUDIT");
  console.log("=================================================");
  console.log(`Total Evaluated Stocks: ${processed}`);
  console.log(`Active Trade Setups  : ${activeCount}`);
  console.log(`Fatal Vetoed Stocks  : ${fatalCount}`);
  console.log(`Neutral Dead Zone    : ${deadZoneCount}`);
  console.log("=================================================\n");
  
  console.log("--- FATAL VETO TRIGGERS (Complete Blocks) ---");
  if (Object.keys(activeVetoCounts).length === 0) {
    console.log("(None triggered)");
  } else {
    Object.entries(activeVetoCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
      console.log(`▸ ${k}: ${v} occurrences`);
    });
  }
  
  console.log("\n--- CAUTION VETO TRIGGERS (Soft Score Dampeners) ---");
  if (Object.keys(vetoCounts).length === 0) {
    console.log("(None triggered)");
  } else {
    Object.entries(vetoCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
      console.log(`▸ ${k}: ${v} occurrences`);
    });
  }
}

main().catch(console.error);
