const https = require('https');
const { runEngine } = require("./src/layers/layer13/scoreEngine");
const { ADX, EMA } = require("technicalindicators");

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
let uaIdx = 0;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const ua = USER_AGENTS[uaIdx++ % USER_AGENTS.length];
    const opts = { headers: { 'User-Agent': ua, 'Accept': 'application/json' } };
    https.get(url, opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMITED'));
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('JSON_PARSE')); }
      });
    }).on('error', reject);
  });
}

async function fetchYahoo(symbol, retries = 3) {
  const sym = `${symbol}.NS`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
      const body = await httpGet(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=3mo&interval=1d&includePrePost=false`);
      const result = body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result');
    } catch (e) {
      if (e.message === 'RATE_LIMITED' && attempt < retries - 1) continue;
      if (attempt === retries - 1) throw e;
    }
  }
}

function computeRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgG = gains / period, avgL = losses / period;
  return avgL === 0 ? 100 : +(100 - (100 / (1 + avgG / avgL))).toFixed(2);
}

function computeATR(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

const AUDIT_STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "TATACONSUM", "SBIN", "CIPLA", "VEDL", "BHARTIARTL", "SUNPHARMA",
  "M&M", "KOTAKBANK", "AXISBANK", "TATAMOTORS", "TATASTEEL", "ULTRACEMCO", "ADANIENT", "ONGC", "HINDALCO", "POWERGRID",
  "BAJFINANCE", "HINDUNILVR", "ITC", "LT", "MARUTI", "WIPRO", "HCLTECH", "ASIANPAINT", "TITAN", "BAJAJFINSV",
  "JSWSTEEL", "NTPC", "GRASIM", "TECHM", "DIVISLAB", "DRREDDY", "HEROMOTOCO", "APOLLOHOSP", "INDUSINDBK", "BAJAJ-AUTO",
  "LTIM", "EICHERMOT", "COALINDIA", "BRITANNIA", "NESTLEIND", "BPCL", "SHREECEM", "HDFCLIFE", "ADANIPORTS",
  "TATAPOWER", "TVSMOTOR", "ZOMATO", "HAL", "BEL", "SIEMENS", "PFC", "RECLTD", "GAIL", "BHEL",
  "IRFC", "RVNL", "JINDALSTEL", "NMDC", "AMBUJACEM", "DABUR", "GODREJCP", "MARICO", "COLPAL", "PIDILITIND",
  "HAVELLS", "VOLTAS", "TRENT", "CHOLAFIN", "SHRIRAMFIN", "MUTHOOTFIN", "PNB", "BANKBARODA", "CANBK", "UNIONBANK",
  "IDFCFIRSTB", "INDIGO", "MOTHERSON", "BOSCHLTD", "CUMMINSIND", "DIXON", "POLYCAB", "LODHA", "DLF", "GODREJPROP",
  "OBEROIRLTY", "PRESTIGE", "TORNTPHARM", "LUPIN", "AUROPHARMA", "BIOCON", "GLENMARK", "SYNGENE", "LAURUSLABS", "ALKEM",
  "TATACHEM", "UPL", "COROMANDEL", "PIIND", "SRF", "AARTIIND", "DEEPAKNTR", "NAVINFLUOR", "ATGL", "IGL"
];

async function processStock(stock) {
  try {
    const yahooResult = await fetchYahoo(stock);
    const q = yahooResult.indicators?.quote?.[0];
    if (!q) return null;

    const closes = q.close.filter(Boolean);
    const highs = q.high.filter(Boolean);
    const lows = q.low.filter(Boolean);
    const volumes = q.volume.filter(Boolean);

    if (closes.length < 30) return null;

    const lookback = 5;
    const predIdx = closes.length - 1 - lookback;
    const predPrice = closes[predIdx];
    const actualPrice = closes[closes.length - 1];
    const actualChange = ((actualPrice - predPrice) / predPrice) * 100;

    const closesAt = closes.slice(0, predIdx + 1);
    const highsAt = highs.slice(0, predIdx + 1);
    const lowsAt = lows.slice(0, predIdx + 1);
    const volumesAt = volumes.slice(0, predIdx + 1);

    const rsi = computeRSI(closesAt);
    const atrValue = computeATR(highsAt, lowsAt, closesAt);
    const todayVol = volumesAt[volumesAt.length - 1];
    const avgVol = volumesAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    const rvol = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
    const mom5 = closesAt.length >= 6 ? (closesAt[closesAt.length - 1] > closesAt[closesAt.length - 6] ? 1 : -1) : 0;
    const atrPrev = computeATR(highsAt.slice(0, -5), lowsAt.slice(0, -5), closesAt.slice(0, -5));
    const atrTrend = atrValue > atrPrev * 1.05 ? 1 : (atrValue < atrPrev * 0.95 ? -1 : 0);

    const adxResult = ADX.calculate({ high: highsAt, low: lowsAt, close: closesAt, period: 14 });
    const adx = adxResult.length > 0 ? adxResult[adxResult.length - 1].adx : 25;

    const ema20Arr = EMA.calculate({ period: 20, values: closesAt });
    const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : predPrice;
    const ema50Arr = EMA.calculate({ period: 50, values: closesAt });
    const ema50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : predPrice;

    const result = runEngine(stock, predPrice, {
      rsi, rvol, momentum: mom5, atrTrend, atrValue,
      pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false,
      macd: null, ema20, ema50, peRatio: null, pbRatio: null, pegRatio: null, debtToEquity: null, roce: null, adx
    });

    const pred = result.direction;
    const dirHit = (pred === "UP" && actualChange > 0) || (pred === "DOWN" && actualChange < 0);
    const windowPrices = closes.slice(predIdx, predIdx + lookback + 1);
    const maxInWindow = Math.max(...windowPrices);
    const minInWindow = Math.min(...windowPrices);
    const tgtHit = pred === "UP" ? maxInWindow >= result.upTarget * 0.995 : pred === "DOWN" ? minInWindow <= result.downTarget * 1.005 : false;

    return {
      stock, direction: pred, dirHit, tgtHit, score: result.score
    };
  } catch (e) {
    return null;
  }
}

async function runFast() {
  const results = [];
  console.log("Starting audit...");
  
  for (let i = 0; i < AUDIT_STOCKS.length; i++) {
    const stock = AUDIT_STOCKS[i];
    const res = await processStock(stock);
    if (res) results.push(res);
    else console.log(`Failed to process ${stock}`);
    console.log(`Processed ${i + 1}/106`);
    await new Promise(r => setTimeout(r, 1500)); // Delay to prevent rate limiting
  }
  
  let dirHits = 0, dirTotal = 0, tgtHits = 0, tgtTotal = 0, neutralCount = 0;
  for (const r of results) {
    if (r.direction !== "NEUTRAL") {
      dirTotal++;
      if (r.dirHit) dirHits++;
      tgtTotal++;
      if (r.tgtHit) tgtHits++;
    } else {
      neutralCount++;
    }
  }

  const dirRate = dirTotal > 0 ? ((dirHits / dirTotal) * 100).toFixed(1) : 'N/A';
  const tgtRate = tgtTotal > 0 ? ((tgtHits / tgtTotal) * 100).toFixed(1) : 'N/A';

  console.log('\n--- AUDIT SUMMARY ---');
  console.log(`DIRECTIONAL ACCURACY: ${dirRate}% (${dirHits}/${dirTotal})`);
  console.log(`TARGET HIT RATE:      ${tgtRate}% (${tgtHits}/${tgtTotal})`);
  console.log(`NEUTRAL:              ${neutralCount}`);
}

runFast();
