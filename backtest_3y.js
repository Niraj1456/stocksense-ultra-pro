const https = require('https');
const http = require('http');
const { ADX, EMA } = require('technicalindicators');
const { runEngine } = require('./src/layers/layer13/scoreEngine');

// ─── FETCHERS ─────────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];
let uaIdx = 0;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib  = url.startsWith('https') ? https : http;
    const ua   = USER_AGENTS[uaIdx++ % USER_AGENTS.length];
    const opts = {
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json,text/plain,*/*'
      }
    };
    lib.get(url, opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMITED'));
        try { resolve({ body: JSON.parse(d) }); }
        catch (e) { reject(new Error('JSON_PARSE')); }
      });
    }).on('error', reject);
  });
}

async function fetchYahoo(symbol) {
  const sym = `${symbol}.NS`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
      const r = await httpGet(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=3y&interval=1d`);
      const result = r.body.chart?.result?.[0];
      if (result) return result;
      throw new Error('No result');
    } catch (e) {
      if (e.message === 'RATE_LIMITED' && attempt < 2) continue;
      if (attempt === 2) throw new Error(e.message);
    }
  }
}

// ─── INDICATOR COMPUTATION ────────────────────────────────────────────────
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
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  if (!trs.length) return 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

// ─── CONFIGURATION ────────────────────────────────────────────────────────
const STOCKS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "BAJFINANCE"
];
const PERIOD_START = '2023-01-01';
const PERIOD_END = new Date().toISOString().split('T')[0]; // Today
const HOLDING_PERIOD = 5; // Days to hold a trade

async function runBacktest() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  STOCKSENSE ULTRA PRO — 3-YEAR QUANTITATIVE BACKTEST (2023-2026)         ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  console.log(`Analyzing ${STOCKS.length} NIFTY 50 Heavyweights...`);

  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let cumulativeReturn = 1.0; // Start with 1x multiplier
  const tradeReturns = [];
  
  // Track peak for max drawdown
  let maxPortfolioVal = 1.0;
  let maxDrawdown = 0;
  
  for (const stock of STOCKS) {
    process.stdout.write(`Fetching ${stock}... `);
    let historical;
    try {
      historical = await fetchYahoo(stock);
    } catch (e) {
      console.log(`Failed: ${e.message}`);
      continue;
    }
    
    const quote = historical.indicators.quote[0];
    const closes = quote.close.filter(Boolean);
    const highs = quote.high.filter(Boolean);
    const lows = quote.low.filter(Boolean);
    const volumes = quote.volume.filter(Boolean);

    if (closes.length < 100) {
      console.log("Insufficient data.");
      continue;
    }
    console.log(`[${closes.length} trading days] -> Processing...`);

    // Step through the timeline
    for (let i = 50; i < closes.length - HOLDING_PERIOD; i++) {
      // Data available UP TO day i
      const currentPrice = closes[i];
      const closesAt = closes.slice(0, i + 1);
      const highsAt = highs.slice(0, i + 1);
      const lowsAt = lows.slice(0, i + 1);
      const volumesAt = volumes.slice(0, i + 1);

      // Compute Indicators
      const rsi = computeRSI(closesAt);
      const atrValue = computeATR(highsAt, lowsAt, closesAt);
      
      const todayVol = volumesAt[volumesAt.length - 1];
      const avgVol = volumesAt.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
      const rvol = avgVol > 0 ? +(todayVol / avgVol).toFixed(2) : 1.0;
      
      const mom5 = (closesAt[closesAt.length - 1] > closesAt[closesAt.length - 6]) ? 1 : -1;
      
      const adxResult = ADX.calculate({ high: highsAt, low: lowsAt, close: closesAt, period: 14 });
      const adx = adxResult.length > 0 ? adxResult[adxResult.length - 1].adx : 25;

      const ema20Arr = EMA.calculate({ period: 20, values: closesAt });
      const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : currentPrice;
      
      const ema50Arr = EMA.calculate({ period: 50, values: closesAt });
      const ema50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : currentPrice;

      // Run Engine
      const result = runEngine(stock, currentPrice, {
        rsi, rvol, momentum: mom5, atrValue,
        adx, ema20, ema50,
        // No NSE data in historical backtest, engine falls back to pure tech
        pcr: 1.0, l2Imbalance: 0, hasRealPCR: false, hasRealL2: false
      });

      // Execute Trade Logic (High Conviction LONG ONLY)
      if (result.direction === "UP" && result.score >= 65) {
        totalTrades++;
        
        const entryPrice = currentPrice;
        let tradeReturn = 0;
        let targetHit = false;

        // Check for targets hitting during the 5-day window
        for (let j = 1; j <= HOLDING_PERIOD; j++) {
          if (i + j >= closes.length) break;
          
          if (result.direction === "UP") {
            if (highs[i + j] >= result.upTarget) {
              tradeReturn = (result.upTarget - entryPrice) / entryPrice;
              targetHit = true; break;
            } else if (lows[i + j] <= result.downTarget) {
              tradeReturn = (result.downTarget - entryPrice) / entryPrice; // stop loss hit
              targetHit = true; break;
            }
          } else if (result.direction === "DOWN") {
            if (lows[i + j] <= result.downTarget) {
              tradeReturn = (entryPrice - result.downTarget) / entryPrice; // short profit
              targetHit = true; break;
            } else if (highs[i + j] >= result.upTarget) {
              tradeReturn = (entryPrice - result.upTarget) / entryPrice; // short loss
              targetHit = true; break;
            }
          }
        }

        // If target not hit, exit on close of 5th day
        if (!targetHit && i + HOLDING_PERIOD < closes.length) {
          const exitPrice = closes[i + HOLDING_PERIOD];
          if (result.direction === "UP") tradeReturn = (exitPrice - entryPrice) / entryPrice;
          else tradeReturn = (entryPrice - exitPrice) / entryPrice;
        }

        // Deduct slippage and trading fees (0.1% round-trip)
        tradeReturn -= 0.001;

        tradeReturns.push(tradeReturn);
        
        // Assume equal position sizing for simplicity (5% risk per trade)
        const portfolioImpact = tradeReturn * 0.05;
        cumulativeReturn *= (1 + portfolioImpact);

        // Update Max Drawdown
        if (cumulativeReturn > maxPortfolioVal) maxPortfolioVal = cumulativeReturn;
        const drawdown = (maxPortfolioVal - cumulativeReturn) / maxPortfolioVal;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        if (tradeReturn > 0) winningTrades++;
        else losingTrades++;
        
        // Skip ahead to avoid overlapping trades
        i += HOLDING_PERIOD; 
      }
    }
  }

  // Statistics Calculation
  const winRate = (winningTrades / totalTrades) * 100;
  
  // Sharpe Ratio = (Mean Return - Risk Free Rate) / Standard Deviation
  const meanReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
  const variance = tradeReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / tradeReturns.length;
  const stdDev = Math.sqrt(variance);
  
  // Annualize Sharpe (assuming approx 252 trading days, holding period is 5 days -> ~50 periods per year)
  const annualRiskFreeRate = 0.07; // 7% Indian G-Sec
  const periodRiskFreeRate = Math.pow(1 + annualRiskFreeRate, HOLDING_PERIOD/252) - 1;
  const sharpeRatio = ((meanReturn - periodRiskFreeRate) / stdDev) * Math.sqrt(252 / HOLDING_PERIOD);
  
  const totalReturnPct = (cumulativeReturn - 1) * 100;

  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("  BACKTEST RESULTS (2023 - 2026)");
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log(`  Total Trades Executed : ${totalTrades}`);
  console.log(`  Win Rate              : ${winRate.toFixed(2)}%`);
  console.log(`  Total Return          : ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}% (Assuming 5% capital per trade)`);
  console.log(`  Max Drawdown          : -${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Sharpe Ratio          : ${sharpeRatio.toFixed(2)}  ${sharpeRatio > 1.5 ? '(Institutional Grade! 🏆)' : ''}`);
  console.log(`  Avg Return per Trade  : ${(meanReturn * 100).toFixed(2)}%`);
  console.log("══════════════════════════════════════════════════════════════════════════\n");
}

runBacktest();
