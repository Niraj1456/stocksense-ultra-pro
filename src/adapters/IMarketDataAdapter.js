/**
 * IMarketDataAdapter interface contract.
 * Every concrete market data provider adapter must implement these methods.
 */
class IMarketDataAdapter {
  /**
   * Fetch historical price data for a stock.
   * @param {string} symbol - Ticker symbol
   * @param {string} period - Duration (e.g., '1y', '6mo')
   * @param {string} interval - Bar interval (e.g., '1d', '1wk')
   * @returns {Promise<{ ok: boolean, data: Array<{ t: string, o: number, h: number, l: number, c: number, v: number }>, meta: object }>}
   */
  async getHistoricalPrices(symbol, period, interval) {
    throw new Error("IMarketDataAdapter: Method 'getHistoricalPrices' must be implemented.");
  }

  /**
   * Fetch Last Traded Price (LTP) and basic real-time price info.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<{ price: number, change: number, changePercent: number, volume: number }>}
   */
  async getLTP(symbol) {
    throw new Error("IMarketDataAdapter: Method 'getLTP' must be implemented.");
  }

  /**
   * Fetch full market quote including order depth, volume, and open interest.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<{ ok: boolean, data: object }>}
   */
  async getQuote(symbol) {
    throw new Error("IMarketDataAdapter: Method 'getQuote' must be implemented.");
  }

  /**
   * Fetch high-frequency intraday prices.
   * @param {string} symbol - Ticker symbol
   * @param {string} interval - e.g., '1m', '5m'
   * @returns {Promise<{ ok: boolean, data: object }>}
   */
  async getIntradayPrices(symbol, interval) {
    throw new Error("IMarketDataAdapter: Method 'getIntradayPrices' must be implemented.");
  }
}

module.exports = IMarketDataAdapter;
