const IMarketDataAdapter = require("../IMarketDataAdapter");
const yahooService = require("../../services/yahoo");
const { logger } = require("../../lib/logger");

/**
 * Concrete Market Data Adapter for Yahoo Finance.
 * Implements IMarketDataAdapter interface.
 */
class YahooAdapter extends IMarketDataAdapter {
  constructor() {
    super();
  }

  /**
   * Fetch historical candles.
   */
  async getHistoricalPrices(symbol, period = "1y", interval = "1d") {
    try {
      logger.info("yahoo_adapter_get_historical_prices", { symbol, period, interval });
      
      // Check if candles are retrieved from the raw service
      const closePrices = await yahooService.fetchChart(symbol, period, interval);
      
      if (!closePrices || closePrices.length === 0) {
        return { ok: false, error: "no_data_returned", meta: { source: "yahoo" } };
      }
      
      // Formulating standard candle structure (Yahoo service returns close prices array)
      const candles = closePrices.map((close, idx) => ({
        t: new Date(Date.now() - (closePrices.length - 1 - idx) * 86400000).toISOString().split("T")[0],
        o: close,
        h: close,
        l: close,
        c: close,
        v: 0
      }));
      
      return {
        ok: true,
        data: candles,
        meta: { source: "yahoo:chart", fetchedAt: new Date().toISOString() }
      };
    } catch (error) {
      logger.error("yahoo_adapter_historical_failed", { symbol, error: error.message });
      return { ok: false, error: error.message, meta: { source: "yahoo" } };
    }
  }

  /**
   * Fetch Last Traded Price (LTP).
   */
  async getLTP(symbol) {
    try {
      const symbols = Array.isArray(symbol) ? symbol : [symbol];
      const quotes = await yahooService.fetchQuotes(symbols);
      
      if (Array.isArray(symbol)) {
        return symbols.reduce((acc, s) => {
          const q = quotes[s];
          acc[s] = q ? {
            price: Number(q.regularMarketPrice || 0),
            change: Number(q.regularMarketChange || 0),
            changePercent: Number(q.regularMarketChangePercent || 0),
            volume: Number(q.regularMarketVolume || 0)
          } : null;
          return acc;
        }, {});
      }

      const quote = quotes && quotes[symbol];
      if (!quote) {
        throw new Error(`Symbol ${symbol} not found in Yahoo response.`);
      }
      return {
        price: Number(quote.regularMarketPrice || 0),
        change: Number(quote.regularMarketChange || 0),
        changePercent: Number(quote.regularMarketChangePercent || 0),
        volume: Number(quote.regularMarketVolume || 0)
      };
    } catch (error) {
      logger.error("yahoo_adapter_ltp_failed", { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch full quote. Can take single symbol string or array of symbols.
   */
  async getQuote(symbol) {
    try {
      const isArray = Array.isArray(symbol);
      const symbols = isArray ? symbol : [symbol];
      const quotes = await yahooService.fetchQuotes(symbols);
      
      if (isArray) {
        return quotes;
      }
      
      const quote = quotes && quotes[symbol];
      return {
        ok: !!quote,
        data: quote || null
      };
    } catch (error) {
      logger.error("yahoo_adapter_quote_failed", { symbol, error: error.message });
      return { ok: false, error: error.message };
    }
  }

  /**
   * Fetch high-frequency intraday prices.
   */
  async getIntradayPrices(symbol, interval = "5m") {
    return this.getHistoricalPrices(symbol, "1d", interval);
  }
}

module.exports = YahooAdapter;
