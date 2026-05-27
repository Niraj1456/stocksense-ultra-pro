const { logger } = require("../lib/logger");

// Import concrete adapters
const YahooAdapter = require("./yahoo/yahooAdapter");
const KiteAdapter = require("./kite/kiteAdapter");
const AngelOneAdapter = require("./angelOne/angelOneAdapter");
const FmpAdapter = require("./fmp/fmpAdapter");
const AlphaVantageAdapter = require("./alphaVantage/alphaVantageAdapter");
const NseAdapter = require("./nse/nseAdapter");

// Singleton instances cache
let cachedMarketAdapter = null;
let cachedFundamentalAdapter = null;
let cachedAlphaVantageAdapter = null;
let cachedNseAdapter = null;

// Circuit Breaker State for Fail-Fast & Fallbacks
const circuitBreaker = {
  failures: 0,
  threshold: 3,
  lastFailureTime: 0,
  cooloffMs: 30000, // 30 seconds
  isOpen: function() {
    if (this.failures >= this.threshold) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooloffMs) {
        // Cooloff window elapsed, transition to half-open (reset failures to probe)
        logger.info("circuit_breaker_half_open_resetting_probes");
        this.failures = 0;
        return false;
      }
      return true; // Circuit is still OPEN (blocking calls)
    }
    return false;
  },
  recordSuccess: function() {
    this.failures = 0;
  },
  recordFailure: function() {
    this.failures++;
    this.lastFailureTime = Date.now();
    logger.warn(`circuit_breaker_recorded_failure: streak=${this.failures}/${this.threshold}`);
  }
};

/**
 * Factory pattern to resolve and cache third-party API data adapters.
 */
function getMarketDataAdapter() {
  if (cachedMarketAdapter) return cachedMarketAdapter;

  const provider = (process.env.MARKET_DATA_PROVIDER || "yahoo").toLowerCase().trim();
  logger.info("factory_resolving_market_data_provider", { provider });

  let adapter;
  switch (provider) {
    case "angelone":
    case "smartapi":
      adapter = new AngelOneAdapter();
      break;
    case "kite":
    case "zerodha":
      adapter = new KiteAdapter();
      break;
    case "yahoo":
    default:
      adapter = new YahooAdapter();
      break;
  }

  // Wrap adapter in a resilience proxy to enforce the circuit breaker and fallback mechanisms
  cachedMarketAdapter = new Proxy(adapter, {
    get: function(target, prop, receiver) {
      const originalMethod = target[prop];
      if (typeof originalMethod === "function") {
        return async function(...args) {
          if (circuitBreaker.isOpen()) {
            logger.warn("circuit_breaker_open_redirecting_to_fallback", { method: prop });
            
            // Fallback strategy: if the active provider is broken, fall back to Yahoo Finance
            if (provider !== "yahoo") {
              const fallback = new YahooAdapter();
              return await fallback[prop](...args);
            }
            throw new Error(`Circuit open: Primary provider '${provider}' is offline and no fallback is available.`);
          }

          try {
            const result = await originalMethod.apply(target, args);
            circuitBreaker.recordSuccess();
            return result;
          } catch (error) {
            circuitBreaker.recordFailure();
            logger.error("primary_provider_failed_initiating_fallback_waterfall", { 
              method: prop, 
              error: error.message 
            });
            
            // Waterfall fallback: immediately try Yahoo if primary failed
            if (provider !== "yahoo") {
              logger.info("waterfall_falling_back_to_yahoo_finance", { method: prop });
              const fallback = new YahooAdapter();
              try {
                return await fallback[prop](...args);
              } catch (fallbackError) {
                logger.error("waterfall_fallback_failed", { method: prop, error: fallbackError.message });
              }
            }
            throw error;
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });

  return cachedMarketAdapter;
}

function getFundamentalAdapter() {
  if (cachedFundamentalAdapter) return cachedFundamentalAdapter;

  const provider = (process.env.FUNDAMENTAL_DATA_PROVIDER || "fmp").toLowerCase().trim();
  logger.info("factory_resolving_fundamental_provider", { provider });

  switch (provider) {
    case "angelone":
    case "smartapi":
      cachedFundamentalAdapter = new AngelOneAdapter().fundamentals;
      break;
    case "fmp":
    default:
      cachedFundamentalAdapter = new FmpAdapter();
      break;
  }

  return cachedFundamentalAdapter;
}

function getAlphaVantageAdapter() {
  if (cachedAlphaVantageAdapter) return cachedAlphaVantageAdapter;
  cachedAlphaVantageAdapter = new AlphaVantageAdapter();
  return cachedAlphaVantageAdapter;
}

function getNseAdapter() {
  if (cachedNseAdapter) return cachedNseAdapter;
  cachedNseAdapter = new NseAdapter();
  return cachedNseAdapter;
}

module.exports = {
  getMarketDataAdapter,
  getFundamentalAdapter,
  getAlphaVantageAdapter,
  getNseAdapter,
  circuitBreaker
};
