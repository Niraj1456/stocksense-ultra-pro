const IFundamentalAdapter = require("../IFundamentalAdapter");
const fmpService = require("../../services/fmpService");
const { logger } = require("../../lib/logger");

/**
 * Concrete Fundamental Data Adapter for Financial Modeling Prep (FMP).
 * Implements IFundamentalAdapter interface.
 */
class FmpAdapter extends IFundamentalAdapter {
  constructor() {
    super();
  }

  async getIncomeStatement(symbol) {
    try {
      const statements = await fmpService.getFinancialStatements(symbol);
      return statements?.income || [];
    } catch (error) {
      logger.error("fmp_adapter_income_failed", { symbol, error: error.message });
      return [];
    }
  }

  async getBalanceSheet(symbol) {
    try {
      const statements = await fmpService.getFinancialStatements(symbol);
      return statements?.balance || [];
    } catch (error) {
      logger.error("fmp_adapter_balance_failed", { symbol, error: error.message });
      return [];
    }
  }

  async getCashFlow(symbol) {
    try {
      const statements = await fmpService.getFinancialStatements(symbol);
      return statements?.cashflow || [];
    } catch (error) {
      logger.error("fmp_adapter_cashflow_failed", { symbol, error: error.message });
      return [];
    }
  }

  async getKeyMetrics(symbol) {
    try {
      return await fmpService.getKeyMetrics(symbol);
    } catch (error) {
      logger.error("fmp_adapter_metrics_failed", { symbol, error: error.message });
      return null;
    }
  }

  async getCompanyProfile(symbol) {
    try {
      return await fmpService.getProfile(symbol);
    } catch (error) {
      logger.error("fmp_adapter_profile_failed", { symbol, error: error.message });
      return null;
    }
  }

  /**
   * Specific aggregate fetch function for FMP's composite profile
   */
  async getFullCompositeProfile(symbol) {
    try {
      return await fmpService.getFullProfile(symbol);
    } catch (error) {
      logger.error("fmp_adapter_full_profile_failed", { symbol, error: error.message });
      return null;
    }
  }
}

module.exports = FmpAdapter;
