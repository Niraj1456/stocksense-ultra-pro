/**
 * Centralized registry of all third-party external API base URLs and endpoints.
 * Sourced from environment variables with production-ready fallback defaults.
 */
const apiEndpoints = {
  // Alpha Vantage Base URL
  alphaVantage: process.env.ALPHA_VANTAGE_BASE_URL || "https://www.alphavantage.co/query",

  // Financial Modeling Prep (FMP) Base URL
  fmp: process.env.FMP_BASE_URL || "https://financialmodelingprep.com/stable",

  // Zerodha Kite Connect API Base URL
  kite: process.env.KITE_BASE_URL || "https://api.kite.trade",

  // NSE India APIs Base URL
  nse: process.env.NSE_BASE_URL || "https://www.nseindia.com",

  // BSE India Website Base URL
  bse: process.env.BSE_BASE_URL || "https://www.bseindia.com",

  // Screener.in Base URL
  screener: process.env.SCREENER_BASE_URL || "https://www.screener.in",

  // Reserve Bank of India (RBI) DBIE API Base URL
  rbi: process.env.RBI_DBIE_BASE || "https://api.dbie.rbi.org.in/DBIE/dbie.rbi",

  // Yahoo Finance Base URLs
  yahoo: {
    chart: "https://query1.finance.yahoo.com/v8/finance/chart",
    quote: "https://query1.finance.yahoo.com/v7/finance/quote",
    quoteSummary: "https://query2.finance.yahoo.com/v10/finance/quoteSummary",
    consent: "https://fc.yahoo.com"
  }
};

module.exports = { apiEndpoints };
