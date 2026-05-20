const { getCandles, indicatorsFromCandles, yahooChartCandles } = require("./candles");
const {
  rsiEngine,
  macdEngine,
  emaEngine,
  atrEngine,
  rvolEngine,
  adxEngine,
  supportResistanceEngine
} = require("./technicals");

async function layer3Technicals({ symbol, range = "6mo", interval = "1d" } = {}) {
  const candles = await getCandles({ symbol, range, interval });
  if (!candles.ok) return candles;
  const indicators = indicatorsFromCandles(candles.data);
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
  supportResistanceEngine
};

