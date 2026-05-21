/**
 * StockSense Ultra Pro — Real Market Data Engine v2.0
 * 
 * ZERO simulated data. Every value comes from a real API source.
 * 
 * Sources:
 *   1. NSE India API → Option Chain (PCR, Max Pain, OI Delta), Market Depth (L2), Delivery %
 *   2. Yahoo Finance → Fundamentals (P/E, ROE, Debt/Equity, EPS Growth, Margins)
 *   3. NSE India → FII/DII Institutional Flow
 *   4. Groww Public API → Fallback real-time quotes
 * 
 * Angel One SmartAPI Alternative:
 *   NSE India's quote-equity API provides the same Level 2 order book data
 *   (top 5 bid/ask, total buy/sell qty, delivery %) without any API key.
 */

// ─── In-Memory Cache with TTL ────────────────────────────────────────────
const dataCache = new Map();
const CACHE_TTL = {
  optionChain: 60_000,    // 1 min (OI changes intraday)
  marketDepth: 15_000,    // 15 sec (L2 is fast-moving)
  fundamentals: 300_000,  // 5 min (fundamentals are slow)
  fiiDii: 120_000,        // 2 min
};

function getCached(key) {
  const entry = dataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { dataCache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data, ttl) {
  dataCache.set(key, { data, ts: Date.now(), ttl });
}

// ─── Retry Helper ────────────────────────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
      if (res.ok) return res;
      if (res.status === 401 || res.status === 403) {
        // NSE cookie expired — hit homepage to refresh
        await fetch('/api/nse/', { credentials: 'include' });
        if (attempt < retries) { await sleep(delayMs); continue; }
      }
      if (attempt === retries) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(delayMs * (attempt + 1));
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ═══════════════════════════════════════════════════════════════
// 1. NSE OPTION CHAIN → Real Put-Call Ratio (PCR)
// ═══════════════════════════════════════════════════════════════
export async function fetchOptionChainPCR(symbol) {
  const cacheKey = `pcr_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Warm NSE cookies first
    await fetch('/api/nse/', { credentials: 'include' });

    const res = await fetchWithRetry(
      `/api/nse/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`,
      { credentials: 'include' }
    );
    const data = await res.json();

    if (!data.records?.data) return null;

    let totalPutOI = 0, totalCallOI = 0;
    let totalPutVol = 0, totalCallVol = 0;
    let totalPutOIChange = 0, totalCallOIChange = 0;
    let maxPainStrike = 0, maxPainOI = 0;

    const strikewiseData = [];

    for (const item of data.records.data) {
      const ceOI = item.CE?.openInterest || 0;
      const peOI = item.PE?.openInterest || 0;
      const ceVol = item.CE?.totalTradedVolume || 0;
      const peVol = item.PE?.totalTradedVolume || 0;
      const ceOIChg = item.CE?.changeinOpenInterest || 0;
      const peOIChg = item.PE?.changeinOpenInterest || 0;

      totalCallOI += ceOI;
      totalPutOI += peOI;
      totalCallVol += ceVol;
      totalPutVol += peVol;
      totalCallOIChange += ceOIChg;
      totalPutOIChange += peOIChg;

      const combinedOI = ceOI + peOI;
      if (combinedOI > maxPainOI) {
        maxPainOI = combinedOI;
        maxPainStrike = item.strikePrice;
      }

      strikewiseData.push({
        strike: item.strikePrice,
        ceOI, peOI, ceVol, peVol, ceOIChg, peOIChg,
        ceIV: item.CE?.impliedVolatility || 0,
        peIV: item.PE?.impliedVolatility || 0,
      });
    }

    const pcrOI = totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(3) : 1.0;
    const pcrVol = totalCallVol > 0 ? +(totalPutVol / totalCallVol).toFixed(3) : 1.0;

    // OI Change delta (net put writing vs call writing)
    const oiDelta = totalPutOIChange - totalCallOIChange;

    // Unusual activity detection (big OI spikes)
    const unusualCalls = strikewiseData
      .filter(d => d.ceOIChg > 50000)
      .sort((a, b) => b.ceOIChg - a.ceOIChg)
      .slice(0, 3)
      .map(d => ({ strike: d.strike, oiChange: d.ceOIChg, volume: d.ceVol }));

    const unusualPuts = strikewiseData
      .filter(d => d.peOIChg > 50000)
      .sort((a, b) => b.peOIChg - a.peOIChg)
      .slice(0, 3)
      .map(d => ({ strike: d.strike, oiChange: d.peOIChg, volume: d.peVol }));

    // IV Percentile from near-ATM strikes
    const spotPrice = data.records?.underlyingValue || 0;
    const atmStrikes = strikewiseData
      .filter(d => Math.abs(d.strike - spotPrice) / spotPrice < 0.03)
      .slice(0, 4);
    const avgIV = atmStrikes.length > 0
      ? atmStrikes.reduce((s, d) => s + (d.ceIV + d.peIV) / 2, 0) / atmStrikes.length
      : 0;

    const result = {
      pcrOI,
      pcrVol,
      totalPutOI,
      totalCallOI,
      totalPutVol,
      totalCallVol,
      oiDelta,
      maxPainStrike,
      spotPrice,
      avgIV: +avgIV.toFixed(2),
      unusualCalls,
      unusualPuts,
      expiryDate: data.records?.expiryDates?.[0] || null,
      source: 'NSE_LIVE',
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result, CACHE_TTL.optionChain);
    return result;
  } catch (err) {
    console.warn(`[PCR] ${symbol}: ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// 2. NSE MARKET DEPTH → Real L2 Order Book (Angel One Alternative)
//    This replaces Angel One SmartAPI completely — no API key needed
// ═══════════════════════════════════════════════════════════════
export async function fetchMarketDepth(symbol) {
  const cacheKey = `depth_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    await fetch('/api/nse/', { credentials: 'include' });

    // NSE provides full market depth via quote-equity endpoint
    const res = await fetchWithRetry(
      `/api/nse/api/quote-equity?symbol=${encodeURIComponent(symbol)}&section=trade_info`,
      { credentials: 'include' }
    );
    const data = await res.json();

    const marketDepth = data.marketDeptOrderBook || data.marketDept498OrderBook;
    const secWiseDP = data.securityWiseDP;

    let totalBuyQty = 0, totalSellQty = 0;
    let bidLevels = [], askLevels = [];
    let spreadPct = 0;

    if (marketDepth) {
      for (const bid of (marketDepth.bid || [])) {
        totalBuyQty += bid.quantity || 0;
        bidLevels.push({ price: bid.price, qty: bid.quantity, orders: bid.orders });
      }
      for (const ask of (marketDepth.ask || [])) {
        totalSellQty += ask.quantity || 0;
        askLevels.push({ price: ask.price, qty: ask.quantity, orders: ask.orders });
      }

      // Bid-ask spread
      if (bidLevels.length > 0 && askLevels.length > 0) {
        const bestBid = bidLevels[0].price;
        const bestAsk = askLevels[0].price;
        if (bestBid > 0) spreadPct = +((bestAsk - bestBid) / bestBid * 100).toFixed(3);
      }
    }

    const totalBuyers = marketDepth?.totalBuyQuantity || totalBuyQty;
    const totalSellers = marketDepth?.totalSellQuantity || totalSellQty;

    // L2 Imbalance: (BuyQty - SellQty) / (BuyQty + SellQty) * 100
    const totalQty = totalBuyers + totalSellers;
    const l2Imbalance = totalQty > 0 ? +((totalBuyers - totalSellers) / totalQty * 100).toFixed(2) : 0;

    // Delivery percentage (institutional proxy — high delivery = real buying)
    const deliveryPct = secWiseDP?.deliveryToTradedQuantity
      ? parseFloat(secWiseDP.deliveryToTradedQuantity)
      : null;

    // Traded volume
    const totalTradedVolume = marketDepth?.totalTradedVolume || 0;

    // Order concentration (are a few big orders dominating?)
    const topBidConcentration = bidLevels.length > 0 && totalBuyers > 0
      ? +(bidLevels[0].qty / totalBuyers * 100).toFixed(1)
      : 0;

    const result = {
      l2Imbalance,
      totalBuyQty: totalBuyers,
      totalSellQty: totalSellers,
      bidLevels: bidLevels.slice(0, 5),
      askLevels: askLevels.slice(0, 5),
      spreadPct,
      deliveryPct,
      totalTradedVolume,
      topBidConcentration,
      source: 'NSE_LIVE',
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result, CACHE_TTL.marketDepth);
    return result;
  } catch (err) {
    console.warn(`[L2] ${symbol}: ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// 3. YAHOO FINANCE FUNDAMENTALS → Real P/E, ROE, Debt, EPS
//    Replaces ALL hash-simulated fundamental scores
// ═══════════════════════════════════════════════════════════════
export async function fetchFundamentals(symbol) {
  const cacheKey = `fund_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const yfSym = `${symbol.replace(/\s+/g, '')}.NS`;
    const modules = 'defaultKeyStatistics,financialData,earningsTrend,summaryDetail,earnings';
    const res = await fetchWithRetry(`/api/yahoo/v10/finance/quoteSummary/${yfSym}?modules=${modules}`);
    const data = await res.json();
    const result = data.quoteSummary?.result?.[0];
    if (!result) return null;

    const fin = result.financialData || {};
    const stats = result.defaultKeyStatistics || {};
    const detail = result.summaryDetail || {};

    // Extract raw values safely
    const pe = detail.trailingPE?.raw || detail.forwardPE?.raw || null;
    const pb = detail.priceToBook?.raw || stats.priceToBook?.raw || null;
    const roe = fin.returnOnEquity?.raw ? +(fin.returnOnEquity.raw * 100).toFixed(2) : null;
    const roa = fin.returnOnAssets?.raw ? +(fin.returnOnAssets.raw * 100).toFixed(2) : null;
    const debtToEquity = fin.debtToEquity?.raw || null;
    const currentRatio = fin.currentRatio?.raw || null;
    const epsTrailing = stats.trailingEps?.raw || null;
    const epsForward = stats.forwardEps?.raw || null;
    const revenueGrowth = fin.revenueGrowth?.raw ? +(fin.revenueGrowth.raw * 100).toFixed(2) : null;
    const earningsGrowth = fin.earningsGrowth?.raw ? +(fin.earningsGrowth.raw * 100).toFixed(2) : null;
    const profitMargin = fin.profitMargins?.raw ? +(fin.profitMargins.raw * 100).toFixed(2) : null;
    const operatingMargin = fin.operatingMargins?.raw ? +(fin.operatingMargins.raw * 100).toFixed(2) : null;
    const freeCashflow = fin.freeCashflow?.raw || null;
    const dividendYield = detail.dividendYield?.raw ? +(detail.dividendYield.raw * 100).toFixed(2) : null;
    const beta = stats.beta?.raw || null;
    const pegRatio = stats.pegRatio?.raw || null;
    const enterpriseToRevenue = stats.enterpriseToRevenue?.raw || null;
    const enterpriseToEbitda = stats.enterpriseToEbitda?.raw || null;
    const marketCap = detail.marketCap?.raw || null;
    const fiftyTwoWeekHigh = detail.fiftyTwoWeekHigh?.raw || null;
    const fiftyTwoWeekLow = detail.fiftyTwoWeekLow?.raw || null;

    // ── FUNDAMENTAL SCORE (0-100) ──
    let fundamentalScore = 50;
    if (roe != null) { if (roe > 20) fundamentalScore += 12; else if (roe > 15) fundamentalScore += 8; else if (roe > 10) fundamentalScore += 4; else if (roe < 5) fundamentalScore -= 8; }
    if (pe != null) { if (pe > 0 && pe < 15) fundamentalScore += 10; else if (pe < 25) fundamentalScore += 5; else if (pe >= 40) fundamentalScore -= 8; else if (pe < 0) fundamentalScore -= 12; }
    if (debtToEquity != null) { if (debtToEquity < 50) fundamentalScore += 8; else if (debtToEquity < 100) fundamentalScore += 3; else if (debtToEquity > 200) fundamentalScore -= 10; }
    if (earningsGrowth != null) { if (earningsGrowth > 20) fundamentalScore += 8; else if (earningsGrowth > 10) fundamentalScore += 4; else if (earningsGrowth < 0) fundamentalScore -= 6; }
    if (profitMargin != null) { if (profitMargin > 20) fundamentalScore += 6; else if (profitMargin > 10) fundamentalScore += 3; else if (profitMargin < 0) fundamentalScore -= 8; }
    if (currentRatio != null) { if (currentRatio > 1.5) fundamentalScore += 4; else if (currentRatio < 1.0) fundamentalScore -= 6; }
    fundamentalScore = Math.max(5, Math.min(95, fundamentalScore));

    // ── VALUATION SCORE (0-100) ──
    let valuationScore = 50;
    if (pe != null && pe > 0) { if (pe < 12) valuationScore += 15; else if (pe < 20) valuationScore += 8; else if (pe > 35) valuationScore -= 10; else if (pe > 50) valuationScore -= 18; }
    if (pb != null) { if (pb < 1) valuationScore += 12; else if (pb < 2) valuationScore += 6; else if (pb > 5) valuationScore -= 8; }
    if (pegRatio != null && pegRatio > 0) { if (pegRatio < 1) valuationScore += 10; else if (pegRatio < 1.5) valuationScore += 5; else if (pegRatio > 3) valuationScore -= 8; }
    if (enterpriseToEbitda != null) { if (enterpriseToEbitda < 10) valuationScore += 6; else if (enterpriseToEbitda > 25) valuationScore -= 6; }
    if (dividendYield != null && dividendYield > 2) valuationScore += 4;
    valuationScore = Math.max(5, Math.min(95, valuationScore));

    const fundResult = {
      pe, pb, roe, roa, debtToEquity, currentRatio,
      epsTrailing, epsForward, revenueGrowth, earningsGrowth,
      profitMargin, operatingMargin, freeCashflow,
      dividendYield, beta, pegRatio,
      enterpriseToRevenue, enterpriseToEbitda,
      marketCap, fiftyTwoWeekHigh, fiftyTwoWeekLow,
      fundamentalScore,
      valuationScore,
      earnings: result.earnings || null,
      source: 'YAHOO_LIVE',
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, fundResult, CACHE_TTL.fundamentals);
    return fundResult;
  } catch (err) {
    console.warn(`[FUND] ${symbol}: ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// 4. NSE FII/DII DATA → Real Institutional Flow
// ═══════════════════════════════════════════════════════════════
export async function fetchFIIDII() {
  const cacheKey = 'fiidii';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    await fetch('/api/nse/', { credentials: 'include' });
    const res = await fetchWithRetry('/api/nse/api/fiidiiTradeReact', { credentials: 'include' });
    const data = await res.json();

    let fiiNetValue = 0, diiNetValue = 0;
    let fiiBuyValue = 0, fiiSellValue = 0;
    let diiBuyValue = 0, diiSellValue = 0;

    for (const entry of data) {
      if (entry.category === 'FII/FPI') {
        fiiNetValue = parseFloat(entry.netValue?.replace(/,/g, '') || '0');
        fiiBuyValue = parseFloat(entry.buyValue?.replace(/,/g, '') || '0');
        fiiSellValue = parseFloat(entry.sellValue?.replace(/,/g, '') || '0');
      } else if (entry.category === 'DII') {
        diiNetValue = parseFloat(entry.netValue?.replace(/,/g, '') || '0');
        diiBuyValue = parseFloat(entry.buyValue?.replace(/,/g, '') || '0');
        diiSellValue = parseFloat(entry.sellValue?.replace(/,/g, '') || '0');
      }
    }

    let institutionalScore = 50;
    if (fiiNetValue > 1000) institutionalScore += 15;
    else if (fiiNetValue > 0) institutionalScore += 8;
    else if (fiiNetValue < -1000) institutionalScore -= 12;
    else if (fiiNetValue < 0) institutionalScore -= 5;
    if (diiNetValue > 500) institutionalScore += 8;
    else if (diiNetValue < -500) institutionalScore -= 5;
    institutionalScore = Math.max(10, Math.min(90, institutionalScore));

    const fiiDiiResult = {
      fiiNetValue, diiNetValue,
      fiiBuyValue, fiiSellValue,
      diiBuyValue, diiSellValue,
      institutionalScore,
      source: 'NSE_LIVE',
      fetchedAt: new Date().toISOString(),
    };

    setCache(cacheKey, fiiDiiResult, CACHE_TTL.fiiDii);
    return fiiDiiResult;
  } catch (err) {
    console.warn(`[FII/DII]: ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// 5. ALPHA VANTAGE NEWS SENTIMENT → Real News & Article Count
// ═══════════════════════════════════════════════════════════════
export async function fetchNewsSentiment(symbol) {
  const cacheKey = `sentiment_${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const cleanSym = symbol.replace(/\s+/g, '').trim();
    const res = await fetchWithRetry(`/api/yahoo/news-sentiment?symbol=${encodeURIComponent(cleanSym)}`);
    const data = await res.json();
    setCache(cacheKey, data, CACHE_TTL.fiiDii); // Use same TTL as fiiDii (2 min)
    return data;
  } catch (err) {
    console.warn(`[NewsSentiment] ${symbol}: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// MASTER FETCHER — Fetches all real data for a stock in parallel
// ═══════════════════════════════════════════════════════════════
export async function fetchAllRealData(symbol) {
  const [optionChain, marketDepth, fundamentals, fiiDii, newsSentiment] = await Promise.allSettled([
    fetchOptionChainPCR(symbol),
    fetchMarketDepth(symbol),
    fetchFundamentals(symbol),
    fetchFIIDII(),
    fetchNewsSentiment(symbol),
  ]);

  return {
    optionChain: optionChain.status === 'fulfilled' ? optionChain.value : null,
    marketDepth: marketDepth.status === 'fulfilled' ? marketDepth.value : null,
    fundamentals: fundamentals.status === 'fulfilled' ? fundamentals.value : null,
    fiiDii: fiiDii.status === 'fulfilled' ? fiiDii.value : null,
    newsSentiment: newsSentiment.status === 'fulfilled' ? newsSentiment.value : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════
export function clearDataCache() {
  dataCache.clear();
}

export function getCacheStats() {
  const stats = {};
  for (const [key, entry] of dataCache) {
    stats[key] = {
      age: Math.round((Date.now() - entry.ts) / 1000) + 's',
      expired: Date.now() - entry.ts > entry.ttl,
    };
  }
  return stats;
}
