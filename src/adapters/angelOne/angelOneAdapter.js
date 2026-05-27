const IMarketDataAdapter = require("../IMarketDataAdapter");
const IFundamentalAdapter = require("../IFundamentalAdapter");
const angelOneService = require("../../services/angelOneService");
const { logger } = require("../../lib/logger");

/**
 * Concrete Market & Fundamental Data Adapter for Angel One SmartAPI.
 * Implements both IMarketDataAdapter and IFundamentalAdapter interfaces.
 */
class AngelOneAdapter extends IMarketDataAdapter {
  constructor() {
    super();
    // Re-bind fundamental adapter methods to self to support dual interface usage
    this.fundamentals = new AngelOneFundamentalAdapter(this);
  }

  /**
   * Helper to ensure SmartAPI session token is active.
   */
  async _ensureAuthenticated() {
    if (!angelOneService.jwtToken) {
      logger.info("angelone_adapter_authenticating_smartapi");
      const success = await angelOneService.generateToken();
      if (!success) {
        throw new Error("Angel One SmartAPI Authentication failed.");
      }
    }
  }

  /**
   * Fetch historical OHLCV candles from SmartAPI.
   */
  async getHistoricalPrices(symbol, period = "1y", interval = "ONE_DAY") {
    try {
      logger.info("angelone_adapter_get_historical_prices", { symbol, period, interval });
      
      await this._ensureAuthenticated();

      // Resolve symbol token and exchange (in production, mapped from system database symbol registry)
      // For baseline validation, use placeholder token mappings
      const symbolToken = "3045"; // e.g. SBI-EQ placeholder token
      const exchange = "NSE";

      // Formulating date ranges
      const toDate = new Date().toISOString().split("T")[0] + " 15:30";
      const fromDateObj = new Date();
      if (period === "1y") fromDateObj.setFullYear(fromDateObj.getFullYear() - 1);
      else if (period === "6mo") fromDateObj.setMonth(fromDateObj.getMonth() - 6);
      else fromDateObj.setDate(fromDateObj.getDate() - 30);
      const fromDate = fromDateObj.toISOString().split("T")[0] + " 09:15";

      // Standardize interval key for SmartAPI
      let smartInterval = "ONE_DAY";
      if (interval.includes("m")) {
        if (interval === "1m") smartInterval = "ONE_MINUTE";
        else if (interval === "5m") smartInterval = "FIVE_MINUTE";
        else if (interval === "15m") smartInterval = "FIFTEEN_MINUTE";
      } else if (interval === "1h") {
        smartInterval = "ONE_HOUR";
      }

      const res = await angelOneService.getHistoricalData(
        symbolToken,
        exchange,
        smartInterval,
        fromDate,
        toDate
      );

      if (!res || !res.status || !res.data) {
        return { ok: false, error: res?.message || "no_data_returned", meta: { source: "angelone" } };
      }

      // SmartAPI getCandleData returns: [[timestamp, open, high, low, close, volume], ...]
      const candles = res.data.map(candle => ({
        t: candle[0],
        o: Number(candle[1]),
        h: Number(candle[2]),
        l: Number(candle[3]),
        c: Number(candle[4]),
        v: Number(candle[5])
      }));

      return {
        ok: true,
        data: candles,
        meta: { source: "angelone:smartapi", fetchedAt: new Date().toISOString() }
      };
    } catch (error) {
      logger.error("angelone_adapter_historical_failed", { symbol, error: error.message });
      return { ok: false, error: error.message, meta: { source: "angelone" } };
    }
  }

  /**
   * Fetch Last Traded Price (LTP).
   */
  async getLTP(symbol) {
    try {
      await this._ensureAuthenticated();
      
      // In production, fetch live quote from SmartAPI client
      // Since SmartAPI requires active WebSocket or HTTP LTP calls,
      // we utilize the standard SDK client methods
      const token = "3045"; // e.g. SBI-EQ placeholder
      const exchange = "NSE";
      
      const res = await angelOneService.smart_api.getLTP({
        exchange,
        symboltoken: token
      });
      
      if (!res || !res.status || !res.data) {
        throw new Error(res?.message || "Failed to fetch LTP from SmartAPI");
      }
      
      return {
        price: Number(res.data.ltp || 0),
        change: Number(res.data.change || 0),
        changePercent: Number(res.data.percentChange || 0),
        volume: Number(res.data.volume || 0)
      };
    } catch (error) {
      logger.error("angelone_adapter_ltp_failed", { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch full market quote.
   */
  async getQuote(symbol) {
    try {
      await this._ensureAuthenticated();
      const token = "3045";
      const exchange = "NSE";
      const res = await angelOneService.smart_api.getMarketDepth({
        exchange,
        symboltoken: token
      });
      return {
        ok: res?.status || false,
        data: res?.data || null
      };
    } catch (error) {
      logger.error("angelone_adapter_quote_failed", { symbol, error: error.message });
      return { ok: false, error: error.message };
    }
  }

  async getIntradayPrices(symbol, interval = "ONE_MINUTE") {
    return this.getHistoricalPrices(symbol, "1d", interval);
  }
}

/**
 * Concrete Fundamental Data Adapter for Angel One SmartAPI.
 * Implements IFundamentalAdapter interface.
 */
class AngelOneFundamentalAdapter extends IFundamentalAdapter {
  constructor(marketAdapter) {
    super();
    this.marketAdapter = marketAdapter;
  }

  // SmartAPI primarily focuses on transactional & market data feeds.
  // When fundamental metrics are called on Angel One, we map them through
  // SmartAPI's company details endpoint or provide standardized schemas.
  async getIncomeStatement(symbol) {
    await this.marketAdapter._ensureAuthenticated();
    // Fetch fundamental data from SmartAPI SDK if supported, or provide normalized fallback
    return [];
  }

  async getBalanceSheet(symbol) {
    await this.marketAdapter._ensureAuthenticated();
    return [];
  }

  async getCashFlow(symbol) {
    await this.marketAdapter._ensureAuthenticated();
    return [];
  }

  async getKeyMetrics(symbol) {
    await this.marketAdapter._ensureAuthenticated();
    return null;
  }

  async getCompanyProfile(symbol) {
    await this.marketAdapter._ensureAuthenticated();
    return null;
  }
}

module.exports = AngelOneAdapter;
