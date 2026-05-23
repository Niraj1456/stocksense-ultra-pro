const { getCandles, indicatorsFromCandles, yahooChartCandles } = require("./candles");
const {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  rvolEngine,
  adxEngine,
  supportResistanceEngine,
  volumeProfileEngine
} = require("./technicals");

async function layer3Technicals({ symbol, range = "6mo", interval = "1d" } = {}) {
  const candles = await getCandles({ symbol, range, interval });
  if (!candles.ok) return candles;
  
  const indicators = indicatorsFromCandles(candles.data);
  
  // Extract price/volume arrays for technicals engines
  const s = {
    open: candles.data.map(c => c.o),
    high: candles.data.map(c => c.h),
    low: candles.data.map(c => c.l),
    close: candles.data.map(c => c.c),
    volume: candles.data.map(c => c.v)
  };
  const current_price = s.close[s.close.length - 1];

  const rsiRes = rsiEngine({ close_prices: s.close });
  const macdRes = macdEngine({ close_prices: s.close });
  const emaRes = emaEngine({ close_prices: s.close, current_price });
  const atrRes = atrEngine({
    high_prices: s.high,
    low_prices: s.low,
    close_prices: s.close,
    entry_price: current_price,
    vix_regime: "STABLE"
  });
  const adxRes = adxEngine({ high_prices: s.high, low_prices: s.low, close_prices: s.close });

  const pvPairs = candles.data.map(c => ({ price: c.c, volume: c.v }));
  const vpRes = volumeProfileEngine({
    price_volume_pairs: pvPairs,
    current_price,
    rvol: indicators.rvol20 || 1.0,
    atr_target_2: atrRes.ok ? atrRes.data.target_2 : null
  });

  const hvn = vpRes.ok ? vpRes.data.hvn_zones : [];
  const srRes = supportResistanceEngine({
    high_prices: s.high,
    low_prices: s.low,
    close_prices: s.close,
    current_price,
    hvn_zones: hvn
  });

  // Enrich indicators with advanced technical calculations
  if (rsiRes.ok) indicators.rsiDetails = rsiRes.data;
  if (macdRes.ok) {
    indicators.macdDetails = macdRes.data;
    // Map custom indicators to indicators.macd so scoreEngine gets crossover and histogram_direction
    indicators.macd = {
      ...indicators.macd,
      macd_line: macdRes.data.macd_line,
      signal_line: macdRes.data.signal_line,
      histogram: macdRes.data.histogram,
      histogram_direction: macdRes.data.histogram_direction,
      crossover: macdRes.data.crossover
    };
  }
  if (emaRes.ok) indicators.emaDetails = emaRes.data;
  if (atrRes.ok) indicators.atrDetails = atrRes.data;
  if (adxRes.ok) indicators.adxDetails = adxRes.data;
  if (vpRes.ok) indicators.vpDetails = vpRes.data;
  if (srRes.ok) {
    indicators.srDetails = srRes.data;
    indicators.r1 = srRes.data.r1;
    indicators.s1 = srRes.data.s1;
    indicators.r2 = srRes.data.r2;
    indicators.s2 = srRes.data.s2;
    indicators.r3 = srRes.data.r3;
    indicators.s3 = srRes.data.s3;
  }

  return {
    ok: true,
    data: { candles: candles.data, indicators },
    meta: { fetchedAt: new Date().toISOString(), source: candles.meta?.source || "truth" }
  };
}

module.exports = { 
  layer3Technicals, 
  getCandles, 
  indicatorsFromCandles, 
  yahooChartCandles,
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  rvolEngine,
  adxEngine,
  supportResistanceEngine,
  volumeProfileEngine
};

