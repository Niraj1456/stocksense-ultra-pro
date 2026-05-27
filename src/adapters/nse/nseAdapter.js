const nseService = require("../../services/nse");
const nseDerivativesService = require("../../services/nseDerivatives");
const { logger } = require("../../lib/logger");

/**
 * Concrete Adapter for NSE India exchange scraping services.
 */
class NseAdapter {
  async getIndices() {
    try {
      return await nseService.fetchAllIndices();
    } catch (error) {
      logger.error("nse_adapter_indices_failed", { error: error.message });
      return null;
    }
  }

  async getAdvancesDeclines() {
    try {
      return await nseService.fetchAdvancesDeclines();
    } catch (error) {
      logger.error("nse_adapter_advances_declines_failed", { error: error.message });
      return null;
    }
  }

  async getOptionChain(symbol) {
    try {
      return await nseDerivativesService.fetchOptionChainEquities(symbol);
    } catch (error) {
      logger.error("nse_adapter_option_chain_failed", { symbol, error: error.message });
      return null;
    }
  }

  async getFiiDiiFlow() {
    try {
      return await nseDerivativesService.fetchFiiDii();
    } catch (error) {
      logger.error("nse_adapter_fiidii_failed", { error: error.message });
      return null;
    }
  }

  async getBulkDeals() {
    try {
      return await nseDerivativesService.fetchBulkDeals();
    } catch (error) {
      logger.error("nse_adapter_bulk_deals_failed", { error: error.message });
      return null;
    }
  }

  async getBlockDeals() {
    try {
      return await nseDerivativesService.fetchBlockDeals();
    } catch (error) {
      logger.error("nse_adapter_block_deals_failed", { error: error.message });
      return null;
    }
  }

  async getMarketDepth(symbol) {
    try {
      return await nseDerivativesService.fetchMarketDepth(symbol);
    } catch (error) {
      logger.error("nse_adapter_market_depth_failed", { symbol, error: error.message });
      return null;
    }
  }
}

module.exports = NseAdapter;
