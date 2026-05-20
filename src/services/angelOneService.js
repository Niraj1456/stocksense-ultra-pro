const { SmartAPI, WebSocket } = require("smartapi-javascript");
require("dotenv").config();
const { TOTP } = require("totp-generator");

class AngelOneService {
  constructor() {
    this.smart_api = new SmartAPI({
      api_key: process.env.ANGEL_API_KEY,
    });
    this.jwtToken = null;
    this.feedToken = null;
  }

  async generateToken() {
    try {
      // Generate TOTP dynamically using the secret
      const { otp } = await TOTP.generate(process.env.ANGEL_TOTP_SECRET);

      const data = await this.smart_api.generateSession(
        process.env.ANGEL_CLIENT_ID,
        process.env.ANGEL_PIN,
        otp
      );

      if (data.status) {
        this.jwtToken = data.data.jwtToken;
        this.feedToken = data.data.feedToken;
        console.log("✅ Angel One SmartAPI Authenticated successfully.");
        return true;
      } else {
        console.error("❌ Angel One Authentication failed:", data.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Error generating Angel One token:", error.message);
      return false;
    }
  }

  // Example: Fetch Historical Data to calculate EMAs/RSI
  async getHistoricalData(symbolToken, exchange, timeframe, fromdate, todate) {
    try {
      const data = await this.smart_api.getCandleData({
        exchange: exchange, // e.g., "NSE"
        symboltoken: symbolToken,
        interval: timeframe, // e.g., "ONE_MINUTE"
        fromdate: fromdate, // format: "2023-10-01 09:15"
        todate: todate,
      });
      return data;
    } catch (error) {
      console.error("Error fetching historical data:", error.message);
      return null;
    }
  }
}

module.exports = new AngelOneService();
