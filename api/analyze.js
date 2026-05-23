const { analyzeStock } = require("../src/analyze/analyzeStock");
require("dotenv").config();

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let symbol = "";
    let mode = "ST";

    if (req.method === "GET") {
      symbol = String(req.query.symbol || "").trim().toUpperCase();
      mode = String(req.query.mode || "ST").trim().toUpperCase();
    } else if (req.method === "POST") {
      symbol = String(req.body?.symbol || "").trim().toUpperCase();
      mode = String(req.body?.mode || "ST").trim().toUpperCase();
    } else {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    if (!symbol) {
      return res.status(400).json({ ok: false, error: "symbol_required" });
    }
    if (!["ST", "LT"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    }

    console.log(`[API Analyze] Running 18-layer engine for ${symbol} in ${mode} mode`);
    const analysis = await analyzeStock(symbol, mode);
    
    return res.status(200).json(analysis);
  } catch (err) {
    console.error("[API Analyze] Engine execution error:", err);
    return res.status(500).json({
      ok: false,
      error: "engine_error",
      message: err.message,
    });
  }
};
