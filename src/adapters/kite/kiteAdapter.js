const IMarketDataAdapter = require("../IMarketDataAdapter");
const kiteService = require("../../services/kiteService");
const { logger } = require("../../lib/logger");

/**
 * Concrete Market Data Adapter for Zerodha Kite.
 * Implements IMarketDataAdapter interface.
 */
class KiteAdapter extends IMarketDataAdapter {
  constructor() {
    super();
  }

  async getHistoricalPrices(symbol, period = "1y", interval = "day") {
    try {
      logger.info("kite_adapter_get_historical_prices", { symbol, period, interval });
      
      // Map period (e.g. '1y') to estimated days back for the raw service
      let daysBack = 365;
      if (period === "6mo") daysBack = 180;
      if (period === "1mo") daysBack = 30;
      if (period === "5d") daysBack = 5;
      
      // Standardize interval key for Kite service
      let mappedInterval = "day";
      if (interval.includes("m")) mappedInterval = interval; // '1m', '5m', etc.
      if (interval === "1h") mappedInterval = "60minute";
      
      const candles = await kiteService.getHistoricalData(symbol, mappedInterval, daysBack);
      
      if (!candles || candles.length === 0) {
        return { ok: false, error: "no_data_returned", meta: { source: "kite" } };
      }
      
      // Format to standard structures
      const formatted = candles.map(c => ({
        t: new Date(c.t).toISOString(),
        o: Number(c.o),
        h: Number(c.h),
        l: Number(c.l),
        c: Number(c.c),
        v: Number(c.v)
      }));
      
      return {
        ok: true,
        data: formatted,
        meta: { source: "kite:chart", fetchedAt: new Date().toISOString() }
      };
    } catch (error) {
      logger.error("kite_adapter_historical_failed", { symbol, error: error.message });
      return { ok: false, error: error.message, meta: { source: "kite" } };
    }
  }

  async getLTP(symbol) {
    try {
      const res = await kiteService.getQuote(symbol);
      if (!res.ok || !res.data) {
        throw new Error(`Failed to fetch Kite quote for ${symbol}`);
      }
      return {
        price: Number(res.data.lastPrice || 0),
        change: Number(res.data.change || 0),
        changePercent: res.data.changePercent || 0,
        volume: Number(res.data.volume || 0)
      };
    } catch (error) {
      logger.error("kite_adapter_ltp_failed", { symbol, error: error.message });
      throw error;
    }
  }

  async getQuote(symbol) {
    return await kiteService.getQuote(symbol);
  }

  async getIntradayPrices(symbol, interval = "5m") {
    return this.getHistoricalPrices(symbol, "1d", interval);
  }
}

module.exports = KiteAdapter;
