const axios = require("axios");
const { EMA, SMA, RSI, MACD, ATR, BollingerBands, ADX, StochasticRSI, ROC } = require("technicalindicators");
const { truthWaterfall } = require("../../lib/truthProtocol");
const { env } = require("../../config/env");

async function yahooChartCandles(symbol, { range = "6mo", interval = "1d" } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const resp = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    params: { range, interval },
    timeout: 20000,
    validateStatus: () => true
  });
  if (resp.status >= 400) return { ok: false, error: `yahoo_chart_failed:${resp.status}`, meta: { source: "yahoo" } };
  const r0 = resp.data?.chart?.result?.[0];
  const ts = r0?.timestamp || [];
  const q = r0?.indicators?.quote?.[0] || {};
  const out = ts.map((t, i) => ({
    ts: new Date(t * 1000).toISOString(),
    o: q.open?.[i],
    h: q.high?.[i],
    l: q.low?.[i],
    c: q.close?.[i],
    v: q.volume?.[i]
  }));
  const candles = out.filter((c) => [c.o, c.h, c.l, c.c].every((x) => typeof x === "number"));
  return { ok: candles.length > 0, data: candles, meta: { source: "yahoo:chart", fetchedAt: new Date().toISOString() } };
}

async function smartApiCandles() {
  // Implemented in Layer2 integration; until enabled+creds present, this remains unavailable.
  if (!env.enableSmartApi) return { ok: false, error: "smartapi_disabled", meta: { source: "smartapi" } };
  return { ok: false, error: "smartapi_candles_not_wired_yet", meta: { source: "smartapi" } };
}

async function getCandles({ symbol, sourcePreference = ["smartapi", "yahoo"], range, interval } = {}) {
  const sources = sourcePreference
    .map((s) => {
      if (s === "smartapi") return { name: "smartapi", fn: () => smartApiCandles({ symbol, range, interval }) };
      if (s === "yahoo") return { name: "yahoo", fn: () => yahooChartCandles(symbol, { range, interval }) };
      return null;
    })
    .filter(Boolean);

  return truthWaterfall({ datum: `candles:${symbol}:${range}:${interval}`, sources });
}

function series(candles) {
  return {
    open: candles.map((c) => c.o),
    high: candles.map((c) => c.h),
    low: candles.map((c) => c.l),
    close: candles.map((c) => c.c),
    volume: candles.map((c) => c.v)
  };
}

function indicatorsFromCandles(candles) {
  const s = series(candles);
  const close = s.close;
  const high = s.high;
  const low = s.low;
  const volume = s.volume;

  const ema20 = EMA.calculate({ period: 20, values: close }).slice(-1)[0] ?? null;
  const ema50 = EMA.calculate({ period: 50, values: close }).slice(-1)[0] ?? null;
  const ema200 = EMA.calculate({ period: 200, values: close }).slice(-1)[0] ?? null;
  const sma20 = SMA.calculate({ period: 20, values: close }).slice(-1)[0] ?? null;
  const sma50 = SMA.calculate({ period: 50, values: close }).slice(-1)[0] ?? null;

  const rsi14 = RSI.calculate({ period: 14, values: close }).slice(-1)[0] ?? null;
  const macd = MACD.calculate({
    values: close,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  }).slice(-1)[0] ?? null;

  const atr14 = ATR.calculate({ period: 14, high, low, close }).slice(-1)[0] ?? null;
  const bb20 = BollingerBands.calculate({ period: 20, values: close, stdDev: 2 }).slice(-1)[0] ?? null;
  const adx14 = ADX.calculate({ period: 14, high, low, close }).slice(-1)[0] ?? null;
  const stochRsi = StochasticRSI.calculate({ values: close, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 })
    .slice(-1)[0] ?? null;

  const roc12 = ROC.calculate({ period: 12, values: close }).slice(-1)[0] ?? null;
  const roc20 = ROC.calculate({ period: 20, values: close }).slice(-1)[0] ?? null;

  // RVOL (20D)
  const v20 = volume.slice(-20);
  const avg20 = v20.length === 20 ? v20.reduce((a, b) => a + b, 0) / 20 : null;
  const lastVol = volume[volume.length - 1] ?? null;
  const rvol20 = avg20 && lastVol ? lastVol / avg20 : null;

  const lastClose = close[close.length - 1] ?? null;
  const prevClose = close[close.length - 2] ?? null;
  const gapPct = lastClose && prevClose ? ((candles[candles.length - 1].o - prevClose) / prevClose) * 100 : null;

  return {
    lastClose,
    ema20,
    ema50,
    ema200,
    sma20,
    sma50,
    rsi14,
    macd,
    atr14,
    bb20,
    adx14,
    stochRsi,
    roc12,
    roc20,
    rvol20,
    gapPct
  };
}

module.exports = { getCandles, indicatorsFromCandles, yahooChartCandles };

