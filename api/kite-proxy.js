const kiteService = require("../src/services/kiteService");
require("dotenv").config();

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ ok: false, error: "symbol_required" });
    }

    console.log(`[API Kite Proxy] Fetching active L2 depth for ${symbol}`);
    const quoteRes = await kiteService.getQuote(symbol);

    if (quoteRes.ok && quoteRes.data) {
      return res.status(200).json({
        ok: true,
        source: 'KITE_CONNECT',
        isMocked: !kiteService.client, // will be true if running in Sandbox/Mock mode
        data: quoteRes.data
      });
    } else {
      return res.status(500).json({ ok: false, error: "failed_to_fetch_depth" });
    }
  } catch (err) {
    console.error("[API Kite Proxy] Error:", err);
    return res.status(500).json({
      ok: false,
      error: "proxy_error",
      message: err.message,
    });
  }
};
