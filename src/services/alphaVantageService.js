// ═══════════════════════════════════════════════════════════════════════════
// ALPHA VANTAGE — ALTERNATIVE DATA SERVICE
// Rate-limited (25/day free tier), cached, gracefully degrading.
// Feeds: Layer 15 (Sentiment), Layer 18 (Earnings Calendar), Layer 1 (Sector Perf)
// ═══════════════════════════════════════════════════════════════════════════
const axios = require("axios");
require("dotenv").config();

const AV_BASE = "https://www.alphavantage.co/query";
const API_KEY = process.env.ALPHA_VANTAGE_KEY || "";

// ── Rate Limiter: 25 calls/day free tier ──
let callCount = 0;
let callCountResetAt = Date.now() + 86400000;
const MAX_DAILY_CALLS = 23; // Leave 2 buffer

// ── Cache ──
const cache = new Map();
const TTL = {
  newsSentiment: 15 * 60 * 1000,    // 15 minutes — news changes fast
  sectorPerf: 30 * 60 * 1000,       // 30 minutes
  earningsCalendar: 6 * 3600 * 1000  // 6 hours
};

function getCached(key) {
  if (!cache.has(key)) return null;
  const entry = cache.get(key);
  if (Date.now() - entry.ts > entry.ttl) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data, ttl) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

function canMakeCall() {
  if (Date.now() > callCountResetAt) {
    callCount = 0;
    callCountResetAt = Date.now() + 86400000;
  }
  return callCount < MAX_DAILY_CALLS;
}

async function avGet(params) {
  if (!API_KEY) return null;
  if (!canMakeCall()) {
    console.warn("[AlphaVantage] Daily rate limit reached. Degrading gracefully.");
    return null;
  }
  try {
    callCount++;
    const resp = await axios.get(AV_BASE, {
      params: { ...params, apikey: API_KEY },
      timeout: 15000,
      validateStatus: () => true
    });
    if (resp.status >= 400) {
      console.warn(`[AlphaVantage] ${params.function} returned ${resp.status}`);
      return null;
    }
    // Alpha Vantage returns errors in JSON body
    if (resp.data?.["Error Message"] || resp.data?.["Note"]) {
      console.warn(`[AlphaVantage] ${resp.data["Error Message"] || resp.data["Note"]}`);
      return null;
    }
    return resp.data;
  } catch (err) {
    console.error(`[AlphaVantage] Error: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: News Sentiment for a specific ticker
// Returns pre-computed sentiment scores from Alpha Vantage's NLP engine.
// This replaces Layer 15's basic keyword matching with institutional NLP.
// ═══════════════════════════════════════════════════════════════════════════
async function getNewsSentiment(symbol) {
  const clean = symbol.replace(".NS", "").replace(".BO", "");
  const cacheKey = `news:${clean}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Strategy: Try ticker-based first. For Indian stocks (no AV ticker coverage),
  // fall back to using overall article sentiment with keyword relevance filtering.
  let raw = await avGet({
    function: "NEWS_SENTIMENT",
    tickers: clean,
    limit: 20,
    sort: "LATEST"
  });

  // If no articles found, try without ticker filter (broader market sentiment)
  const feed = raw?.feed || [];
  const hasArticles = feed.length > 0;

  if (!hasArticles) {
    // No direct coverage — return graceful null so system degrades
    return null;
  }

  // Parse articles — use ticker-specific sentiment if available, else overall
  const articles = feed.map(article => {
    const tickerSentiment = (article.ticker_sentiment || []).find(
      ts => ts.ticker === clean || ts.ticker === `BSE:${clean}` || ts.ticker === `NSE:${clean}`
    );
    const useTickerData = tickerSentiment && parseFloat(tickerSentiment.relevance_score) > 0.1;

    return {
      title: article.title,
      source: article.source,
      publishedAt: article.time_published,
      // Use ticker-specific if available, else fall back to article-level
      sentiment: useTickerData
        ? parseFloat(tickerSentiment.ticker_sentiment_score)
        : parseFloat(article.overall_sentiment_score || 0),
      label: useTickerData
        ? tickerSentiment.ticker_sentiment_label
        : (article.overall_sentiment_label || "Neutral"),
      relevance: useTickerData ? parseFloat(tickerSentiment.relevance_score) : 0.5,
      isTickerSpecific: useTickerData
    };
  });

  // Filter to meaningful articles
  const relevantArticles = articles.filter(a => Math.abs(a.sentiment) > 0.01);
  const avgSentiment = relevantArticles.length > 0
    ? relevantArticles.reduce((sum, a) => sum + a.sentiment, 0) / relevantArticles.length
    : 0;

  let sentimentLabel = "NEUTRAL";
  let pts = 0;
  let vetoFlag = false;

  if (avgSentiment > 0.25) { sentimentLabel = "STRONGLY_BULLISH"; pts = 3; }
  else if (avgSentiment > 0.1) { sentimentLabel = "BULLISH"; pts = 1; }
  else if (avgSentiment < -0.25) { sentimentLabel = "STRONGLY_BEARISH"; pts = -4; vetoFlag = true; }
  else if (avgSentiment < -0.1) { sentimentLabel = "BEARISH"; pts = -2; }

  const result = {
    articles: relevantArticles.slice(0, 10),
    avgSentiment: +avgSentiment.toFixed(4),
    sentimentLabel,
    pts,
    vetoFlag,
    articleCount: relevantArticles.length,
    dataConfidence: relevantArticles.length >= 5 ? "HIGH" : relevantArticles.length >= 2 ? "MODERATE" : "LOW"
  };

  setCache(cacheKey, result, TTL.newsSentiment);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Sector Performance
// Returns real-time sector rotation data to feed Layer 1's sectorRotation.
// ═══════════════════════════════════════════════════════════════════════════
async function getSectorPerformance() {
  const cacheKey = "sectorPerf";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const raw = await avGet({ function: "SECTOR" });
  if (!raw) return null;

  // Extract relevant timeframes
  const realTime = raw["Rank A: Real-Time Performance"] || {};
  const oneDay = raw["Rank B: 1 Day Performance"] || {};
  const fiveDay = raw["Rank C: 5 Day Performance"] || {};
  const oneMonth = raw["Rank D: 1 Month Performance"] || {};

  const result = {
    realTime,
    oneDay,
    fiveDay,
    oneMonth,
    topSectors: Object.entries(realTime)
      .map(([k, v]) => ({ sector: k, performance: parseFloat(v) }))
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 3),
    bottomSectors: Object.entries(realTime)
      .map(([k, v]) => ({ sector: k, performance: parseFloat(v) }))
      .sort((a, b) => a.performance - b.performance)
      .slice(0, 3)
  };

  setCache(cacheKey, result, TTL.sectorPerf);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Earnings Calendar
// Returns upcoming earnings dates to feed Layer 18's event-driven ATR.
// ═══════════════════════════════════════════════════════════════════════════
async function getEarningsCalendar(symbol) {
  const cacheKey = `earningsCal:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const avTicker = symbol.includes(".") ? symbol : `${symbol}.BSE`;
  const raw = await avGet({
    function: "EARNINGS",
    symbol: avTicker
  });

  if (!raw) return null;

  const quarterly = raw.quarterlyEarnings || [];
  const annual = raw.annualEarnings || [];

  // Find next earnings date (if available from quarterly data)
  const now = new Date();
  const upcoming = quarterly.find(q => {
    if (!q.reportedDate) return false;
    return new Date(q.reportedDate) > now;
  });

  const result = {
    nextEarningsDate: upcoming?.reportedDate || null,
    daysToEarnings: upcoming?.reportedDate
      ? Math.ceil((new Date(upcoming.reportedDate) - now) / 86400000)
      : null,
    recentSurprises: quarterly.slice(0, 4).map(q => ({
      date: q.reportedDate,
      estimatedEPS: parseFloat(q.estimatedEPS) || 0,
      actualEPS: parseFloat(q.reportedEPS) || 0,
      surprise: parseFloat(q.surprise) || 0,
      surprisePct: parseFloat(q.surprisePercentage) || 0
    })),
    annualEarnings: annual.slice(0, 3)
  };

  setCache(cacheKey, result, TTL.earningsCalendar);
  return result;
}

module.exports = {
  getNewsSentiment,
  getSectorPerformance,
  getEarningsCalendar
};
