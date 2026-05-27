/**
 * IFundamentalAdapter interface contract.
 * Every concrete fundamental financial data provider adapter must implement these methods.
 */
class IFundamentalAdapter {
  /**
   * Fetch company income statements.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<Array<object>>}
   */
  async getIncomeStatement(symbol) {
    throw new Error("IFundamentalAdapter: Method 'getIncomeStatement' must be implemented.");
  }

  /**
   * Fetch company balance sheet statements.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<Array<object>>}
   */
  async getBalanceSheet(symbol) {
    throw new Error("IFundamentalAdapter: Method 'getBalanceSheet' must be implemented.");
  }

  /**
   * Fetch company cash flow statements.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<Array<object>>}
   */
  async getCashFlow(symbol) {
    throw new Error("IFundamentalAdapter: Method 'getCashFlow' must be implemented.");
  }

  /**
   * Fetch standardized performance metrics and ratios.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<object>}
   */
  async getKeyMetrics(symbol) {
    throw new Error("IFundamentalAdapter: Method 'getKeyMetrics' must be implemented.");
  }

  /**
   * Fetch standard corporate summary/profile.
   * @param {string} symbol - Ticker symbol
   * @returns {Promise<object>}
   */
  async getCompanyProfile(symbol) {
    throw new Error("IFundamentalAdapter: Method 'getCompanyProfile' must be implemented.");
  }
}

module.exports = IFundamentalAdapter;
