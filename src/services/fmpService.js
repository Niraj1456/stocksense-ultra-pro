// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL MODELING PREP — INSTITUTIONAL DATA SERVICE
// Rate-limited, cached, gracefully degrading integration.
// Feeds: Layer 8 (Fundamentals), Layer 9 (Forensics), Layer 10 (Valuation),
//        Layer 6 (Institutional), Layer 15 (Insider/Earnings)
// ═══════════════════════════════════════════════════════════════════════════
const axios = require("axios");
require("dotenv").config();

const FMP_BASE = "https://financialmodelingprep.com/stable";
const API_KEY = process.env.FMP_API_KEY || "";

// ── Rate Limiter: 250 calls/day on free tier ──
let callCount = 0;
let callCountResetAt = Date.now() + 86400000;
const MAX_DAILY_CALLS = 240; // Leave 10 buffer

// ── Local Cache with TTL ──
const cache = new Map();
const TTL = {
  financials: 6 * 3600 * 1000,    // 6 hours — quarterly data doesn't change intraday
  keyMetrics: 6 * 3600 * 1000,
  dcf: 6 * 3600 * 1000,
  insiderTrading: 3600 * 1000,     // 1 hour — can change during the day
  institutionalHolder: 6 * 3600 * 1000,
  earningsSurprises: 24 * 3600 * 1000,
  analystEstimates: 6 * 3600 * 1000,
  profile: 24 * 3600 * 1000
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

async function fmpGet(path) {
  if (!API_KEY) return null;
  if (!canMakeCall()) {
    console.warn("[FMP] Daily rate limit reached. Degrading gracefully.");
    return null;
  }
  try {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${FMP_BASE}${path}${sep}apikey=${API_KEY}`;
    callCount++;
    const resp = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    if (resp.status >= 400) {
      console.warn(`[FMP] ${path} returned ${resp.status}`);
      return null;
    }
    return resp.data;
  } catch (err) {
    console.error(`[FMP] Error fetching ${path}: ${err.message}`);
    return null;
  }
}

// ── Map NSE symbol to FMP ticker (FMP uses .NS suffix for NSE) ──
function toFmpTicker(symbol) {
  const clean = symbol.replace(".NS", "").replace(".BO", "");
  return `${clean}.NS`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Full Financial Statements (Income, Balance Sheet, Cash Flow)
// Feeds Layer 8, Layer 9 (Altman Z, Beneish M, Piotroski F), Layer 10
// ═══════════════════════════════════════════════════════════════════════════
async function getFinancialStatements(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `financials:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [income, balance, cashflow] = await Promise.all([
    fmpGet(`/income-statement?symbol=${ticker}&period=annual&limit=3`),
    fmpGet(`/balance-sheet-statement?symbol=${ticker}&period=annual&limit=3`),
    fmpGet(`/cash-flow-statement?symbol=${ticker}&period=annual&limit=3`)
  ]);

  if (!income || !balance || !cashflow) return null;

  const result = {
    income: Array.isArray(income) ? income : [],
    balance: Array.isArray(balance) ? balance : [],
    cashflow: Array.isArray(cashflow) ? cashflow : [],
    latest: {
      // Extract key fields from most recent statements
      ...(Array.isArray(income) && income[0] ? {
        revenue: income[0].revenue,
        netIncome: income[0].netIncome,
        grossProfit: income[0].grossProfit,
        ebitda: income[0].ebitda,
        eps: income[0].eps,
        operatingIncome: income[0].operatingIncome,
        sellingAndMarketingExpenses: income[0].sellingAndMarketingExpenses,
        generalAndAdministrativeExpenses: income[0].generalAndAdministrativeExpenses,
        depreciationAndAmortization: income[0].depreciationAndAmortization,
        interestExpense: income[0].interestExpense,
        costOfRevenue: income[0].costOfRevenue,
      } : {}),
      ...(Array.isArray(balance) && balance[0] ? {
        totalAssets: balance[0].totalAssets,
        totalLiabilities: balance[0].totalLiabilities,
        totalStockholdersEquity: balance[0].totalStockholdersEquity,
        totalCurrentAssets: balance[0].totalCurrentAssets,
        totalCurrentLiabilities: balance[0].totalCurrentLiabilities,
        longTermDebt: balance[0].longTermDebt,
        shortTermDebt: balance[0].shortTermDebt,
        netReceivables: balance[0].netReceivables,
        inventory: balance[0].inventory,
        retainedEarnings: balance[0].retainedEarnings,
        commonStock: balance[0].commonStock,
        totalDebt: balance[0].totalDebt,
      } : {}),
      ...(Array.isArray(cashflow) && cashflow[0] ? {
        operatingCashFlow: cashflow[0].operatingCashFlow,
        freeCashFlow: cashflow[0].freeCashFlow,
        capitalExpenditure: cashflow[0].capitalExpenditure,
      } : {})
    }
  };

  setCache(cacheKey, result, TTL.financials);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Key Metrics (ROIC, FCF Yield, Debt ratios etc.)
// ═══════════════════════════════════════════════════════════════════════════
async function getKeyMetrics(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `keyMetrics:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/key-metrics?symbol=${ticker}&period=annual&limit=3`);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  setCache(cacheKey, data, TTL.keyMetrics);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: DCF Valuation
// ═══════════════════════════════════════════════════════════════════════════
async function getDCF(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `dcf:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/discounted-cash-flow?symbol=${ticker}`);
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  const result = Array.isArray(data) ? data[0] : data;
  setCache(cacheKey, result, TTL.dcf);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Insider Trading
// ═══════════════════════════════════════════════════════════════════════════
async function getInsiderTrading(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `insider:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/insider-trading?symbol=${ticker}&limit=20`);
  if (!data || !Array.isArray(data)) return null;

  setCache(cacheKey, data, TTL.insiderTrading);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Institutional Holders
// ═══════════════════════════════════════════════════════════════════════════
async function getInstitutionalHolders(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `instHolder:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/institutional-holder?symbol=${ticker}`);
  if (!data || !Array.isArray(data)) return null;

  setCache(cacheKey, data, TTL.institutionalHolder);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Earnings Surprises
// ═══════════════════════════════════════════════════════════════════════════
async function getEarningsSurprises(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `earningsSurprises:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/earnings-surprises?symbol=${ticker}`);
  if (!data || !Array.isArray(data)) return null;

  setCache(cacheKey, data, TTL.earningsSurprises);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Company Profile (sector, industry, market cap, etc.)
// ═══════════════════════════════════════════════════════════════════════════
async function getProfile(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `profile:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/profile?symbol=${ticker}`);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  setCache(cacheKey, data[0], TTL.profile);
  return data[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API: Analyst Estimates
// ═══════════════════════════════════════════════════════════════════════════
async function getAnalystEstimates(symbol) {
  const ticker = toFmpTicker(symbol);
  const cacheKey = `analystEstimates:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await fmpGet(`/analyst-estimates?symbol=${ticker}&limit=4`);
  if (!data || !Array.isArray(data)) return null;

  setCache(cacheKey, data, TTL.analystEstimates);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE: Get everything for a stock in one call (parallel, cached)
// ═══════════════════════════════════════════════════════════════════════════
async function getFullProfile(symbol) {
  const [financials, metrics, dcf, insider, institutional, earnings, profile, estimates] = await Promise.all([
    getFinancialStatements(symbol).catch(() => null),
    getKeyMetrics(symbol).catch(() => null),
    getDCF(symbol).catch(() => null),
    getInsiderTrading(symbol).catch(() => null),
    getInstitutionalHolders(symbol).catch(() => null),
    getEarningsSurprises(symbol).catch(() => null),
    getProfile(symbol).catch(() => null),
    getAnalystEstimates(symbol).catch(() => null)
  ]);

  return {
    financials,
    metrics,
    dcf,
    insider,
    institutional,
    earnings,
    profile,
    estimates,
    dataConfidence: {
      hasFinancials: !!financials,
      hasMetrics: !!metrics,
      hasDCF: !!dcf,
      hasInsider: !!insider,
      hasInstitutional: !!institutional,
      hasEarnings: !!earnings,
      hasProfile: !!profile,
      hasEstimates: !!estimates,
      score: [financials, metrics, dcf, insider, institutional, earnings, profile, estimates].filter(Boolean).length / 8 * 100
    }
  };
}

module.exports = {
  getFinancialStatements,
  getKeyMetrics,
  getDCF,
  getInsiderTrading,
  getInstitutionalHolders,
  getEarningsSurprises,
  getProfile,
  getAnalystEstimates,
  getFullProfile
};
