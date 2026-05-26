/**
 * Diagnose: For each of the 10 active trades in today's audit,
 * compute the target % gap vs actual intraday high,
 * and find what ATR multiplier would have produced a WIN.
 */

const { runEngine } = require('../src/layers/layer13/scoreEngine');
const {
  rsiEngine, macdEngine, emaEngine, atrEngine, adxEngine
} = require('../src/layers/layer3/technicals');
const { yahooChartCandles } = require('../src/layers/layer3/candles');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  let momentum = 0, momentumPct = 0;
  if (len >= 6) {
    momentum = close_prices[len - 1] > close_prices[len - 6] ? 1 : -1;
    momentumPct = ((close_prices[len - 1] - close_prices[len - 6]) / close_prices[len - 6]) * 100;
  }

  return {
    rsi: rsiRes.ok ? rsiRes.data.rsi_value : 50,
    rvol: rvol20, momentum, momentumPct,
    atrTrend: 1,
    atrValue: atrRes.ok ? atrRes.data.atr : (0.015 * entryPrice),
    pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false,
    macd: macdRes.ok ? { macd_line: macdRes.data.macd_line, signal_line: macdRes.data.signal_line, histogram: macdRes.data.histogram, histogram_direction: macdRes.data.histogram_direction, crossover: macdRes.data.crossover } : null,
    ema20: emaRes.ok ? emaRes.data.ema20 : null,
    ema50: emaRes.ok ? emaRes.data.ema50 : null,
    ema200: emaRes.ok ? emaRes.data.ema200 : null,
    adx: adxRes.ok ? adxRes.data.adx : 25,
    prevDayChangePct: len >= 2 ? ((close_prices[len - 1] - close_prices[len - 2]) / close_prices[len - 2]) * 100 : 0,
    marketRegime: "NEUTRAL", sectorRegime: "NEUTRAL"
  };
}

// The 10 active stocks from today's audit
const ACTIVE_STOCKS = [
  'LLOYDSENGG', 'MOLDTKPAC', 'LAURUSLABS', 'GANDHAR', 'HCG',
  'DCM', 'SYNCOMF', 'NAVINFLUOR', 'ACUTAAS', 'KERNEX'
];

async function diagnose() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TARGET HIT RATE DIAGNOSTIC — INTRADAY TARGET GAP ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const symbol of ACTIVE_STOCKS) {
    await sleep(200);
    const candleRes = await yahooChartCandles(symbol, { range: '1y', interval: '1d' });
    if (!candleRes.ok || !candleRes.data || candleRes.data.length < 210) {
      console.log(`Skipping ${symbol}: insufficient data`);
      continue;
    }

    const candles = candleRes.data;
    const N = candles.length;
    const stEntryPrice = candles[N - 2].c;
    const stSlice = candles.slice(0, N - 1);
    const stIndicators = calculateIndicatorsForSlice(stSlice, stEntryPrice);
    const stRes = runEngine(symbol, stEntryPrice, stIndicators, { timeHorizon: '1D' });

    if (stRes.direction === "NEUTRAL" || stRes.isVetoed) continue;

    const todayCandle = candles[N - 1];
    const actualHigh = todayCandle.h;
    const actualLow = todayCandle.l;
    const actualClose = todayCandle.c;
    const target = stRes.direction === "UP" ? stRes.upTarget : stRes.downTarget;

    const targetPct = ((target - stEntryPrice) / stEntryPrice * 100);
    const highPct = ((actualHigh - stEntryPrice) / stEntryPrice * 100);
    const closePct = ((actualClose - stEntryPrice) / stEntryPrice * 100);
    const atrPct = (stIndicators.atrValue / stEntryPrice * 100);
    const headroom = Math.abs(target - stEntryPrice);
    const currentMultiplier = headroom / stIndicators.atrValue;

    // What multiplier would have caused a WIN?
    let neededHeadroom, neededMultiplier;
    if (stRes.direction === "UP") {
      neededHeadroom = actualHigh - stEntryPrice;
      neededMultiplier = neededHeadroom > 0 ? neededHeadroom / stIndicators.atrValue : 999;
    } else {
      neededHeadroom = stEntryPrice - actualLow;
      neededMultiplier = neededHeadroom > 0 ? neededHeadroom / stIndicators.atrValue : 999;
    }

    const hitTarget = stRes.direction === "UP" ? actualHigh >= target : actualLow <= target;

    console.log(`▸ ${symbol} (Score: ${stRes.score}, Dir: ${stRes.direction})`);
    console.log(`  Entry: ₹${stEntryPrice.toFixed(2)} | ATR: ₹${stIndicators.atrValue.toFixed(2)} (${atrPct.toFixed(2)}%)`);
    console.log(`  Target: ₹${target.toFixed(2)} (${targetPct >= 0 ? '+' : ''}${targetPct.toFixed(2)}%) | ATR Mult: ${currentMultiplier.toFixed(3)}×`);
    console.log(`  Today High: ₹${actualHigh.toFixed(2)} (+${highPct.toFixed(2)}%) | Close: ₹${actualClose.toFixed(2)} (${closePct >= 0 ? '+' : ''}${closePct.toFixed(2)}%)`);
    console.log(`  Result: ${hitTarget ? 'WIN ✅' : 'TIMEOUT ❌'}`);
    console.log(`  MAX reachable ATR mult: ${neededMultiplier.toFixed(3)}×`);
    if (!hitTarget) {
      console.log(`  → To WIN: need target ≤ ₹${(stRes.direction === "UP" ? actualHigh : actualLow).toFixed(2)} (mult ≤ ${neededMultiplier.toFixed(3)}×)`);
    }
    console.log('');
  }
}

diagnose().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
