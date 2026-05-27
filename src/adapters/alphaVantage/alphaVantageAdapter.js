const alphaVantageService = require("../../services/alphaVantageService");
const { logger } = require("../../lib/logger");

/**
 * Concrete Adapter for Alpha Vantage alternative data services.
 */
class AlphaVantageAdapter {
  async getNewsSentiment(symbol) {
    try {
      return await alphaVantageService.getNewsSentiment(symbol);
    } catch (error) {
      logger.error("av_adapter_news_sentiment_failed", { symbol, error: error.message });
      return null;
    }
  }

  async getSectorPerformance() {
    try {
      return await alphaVantageService.getSectorPerformance();
    } catch (error) {
      logger.error("av_adapter_sector_failed", { error: error.message });
      return null;
    }
  }

  async getEarningsCalendar(symbol) {
    try {
      return await alphaVantageService.getEarningsCalendar(symbol);
    } catch (error) {
      logger.error("av_adapter_earnings_failed", { symbol, error: error.message });
      return null;
    }
  }
}

module.exports = AlphaVantageAdapter;
