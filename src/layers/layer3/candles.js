const axios = require("axios");
const { EMA, SMA, RSI, MACD, ATR, BollingerBands, ADX, StochasticRSI, ROC } = require("technicalindicators");
const { truthWaterfall } = require("../../lib/truthProtocol");
const { env } = require("../../config/env");
const angelOneService = require("../../services/angelOneService");

// ═══════════════════════════════════════════════════════════════════════════
// SMARTAPI CANDLE TOKEN MAP — Maps NSE symbols to Angel One token IDs
// Required because SmartAPI uses numeric token IDs, not ticker symbols.
// Coverage: NIFTY 50 + major large-caps. Expand as needed.
// ═══════════════════════════════════════════════════════════════════════════
const SYMBOL_TOKEN_MAP = {
  'RELIANCE': '2885', 'TCS': '11536', 'HDFCBANK': '1333', 'INFY': '1594',
  'ICICIBANK': '4963', 'HINDUNILVR': '1394', 'SBIN': '3045', 'BHARTIARTL': '10604',
  'ITC': '1660', 'KOTAKBANK': '1922', 'LT': '11483', 'AXISBANK': '5900',
  'BAJFINANCE': '317', 'MARUTI': '10999', 'ASIANPAINT': '236',
  'HCLTECH': '7229', 'SUNPHARMA': '3351', 'TATAMOTORS': '3456',
  'TITAN': '3506', 'WIPRO': '3787', 'ULTRACEMCO': '11532',
  'NTPC': '11630', 'POWERGRID': '14977', 'M&M': '2031', 'TATASTEEL': '3499',
  'JSWSTEEL': '11723', 'ADANIENT': '25', 'ADANIPORTS': '15083',
  'NESTLEIND': '17963', 'BAJAJFINSV': '16675', 'ONGC': '2475',
  'COALINDIA': '20374', 'TECHM': '13538', 'DRREDDY': '881', 'CIPLA': '694',
  'DIVISLAB': '10940', 'APOLLOHOSP': '157', 'EICHERMOT': '910',
  'BAJAJ-AUTO': '16669', 'HEROMOTOCO': '1348', 'BRITANNIA': '547',
  'TATACONSUM': '3432', 'INDUSINDBK': '5258', 'HINDALCO': '1363',
  'VEDL': '3063', 'BPCL': '526', 'GRASIM': '1232', 'TATAPOWER': '3426',
  'LTIM': '17818', 'LUPIN': '10440', 'AUROPHARMA': '275',
  'TVSMOTOR': '8479', 'SBILIFE': '21808', 'HDFCLIFE': '467',
  'DMART': '19913', 'PIDILITIND': '2664', 'SIEMENS': '3150',
  'HAVELLS': '9819', 'ABB': '13', 'GODREJCP': '10099',
  'DABUR': '772', 'COLPAL': '15141', 'MARICO': '4067',
  'AMBUJACEM': '1270', 'SHREECEM': '3103', 'BIOCON': '11373',
  'DLF': '14732', 'NAUKRI': '13751', 'ZOMATO': '5097',
  'PAYTM': '6705', 'POLICYBZR': '28842'
};

async function yahooChartCandles(symbol, { range = "6mo", interval = "1d" } = {}) {
  const ticker = symbol.includes(".") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;
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

// FIX RC6: SmartAPI candle source is now actually wired to Angel One
async function smartApiCandles({ symbol, range = "6mo" } = {}) {
  if (!env.enableSmartApi) return { ok: false, error: "smartapi_disabled", meta: { source: "smartapi" } };

  // Look up the Angel One token for this symbol
  const cleanSymbol = symbol.replace(".NS", "").replace(".BO", "");
  const symbolToken = SYMBOL_TOKEN_MAP[cleanSymbol];
  if (!symbolToken) {
    return { ok: false, error: `smartapi_no_token_for:${cleanSymbol}`, meta: { source: "smartapi" } };
  }

  try {
    // Ensure we have a valid session
    if (!angelOneService.jwtToken) {
      const sessionOk = await angelOneService.generateToken();
      if (!sessionOk) return { ok: false, error: "smartapi_auth_failed", meta: { source: "smartapi" } };
    }

    // Calculate date range based on requested range
    const now = new Date();
    const toDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 15:30`;
    const fromDate = new Date(now);
    const rangeDays = range === "1y" ? 365 : range === "6mo" ? 180 : range === "3mo" ? 90 : 30;
    fromDate.setDate(fromDate.getDate() - rangeDays);
    const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth()+1).padStart(2,'0')}-${String(fromDate.getDate()).padStart(2,'0')} 09:15`;

    const result = await angelOneService.getHistoricalData(
      symbolToken,
      "NSE",
      "ONE_DAY",
      fromStr,
      toDate
    );

    if (!result || !result.data || !Array.isArray(result.data)) {
      return { ok: false, error: "smartapi_empty_response", meta: { source: "smartapi" } };
    }

    // Transform SmartAPI format [timestamp, o, h, l, c, v] to our standard format
    const candles = result.data.map(c => ({
      ts: c[0],
      o: c[1],
      h: c[2],
      l: c[3],
      c: c[4],
      v: c[5]
    })).filter(c => [c.o, c.h, c.l, c.c].every(x => typeof x === "number"));

    if (candles.length < 20) {
      return { ok: false, error: `smartapi_insufficient_candles:${candles.length}`, meta: { source: "smartapi" } };
    }

    return { ok: true, data: candles, meta: { source: "smartapi:angelone", fetchedAt: new Date().toISOString() } };
  } catch (err) {
    console.error(`[SmartAPI] Error fetching candles for ${cleanSymbol}: ${err.message}`);
    return { ok: false, error: `smartapi_error:${err.message}`, meta: { source: "smartapi" } };
  }
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
