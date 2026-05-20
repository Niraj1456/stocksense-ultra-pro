const express = require("express");
const { analyzeStock } = require("../analyze/analyzeStock");

const analyzeRouter = express.Router();

analyzeRouter.post("/", async (req, res, next) => {
  try {
    const symbol = String(req.body?.symbol || "").trim().toUpperCase();
    const mode = String(req.body?.mode || "ST").toUpperCase();
    if (!symbol) return res.status(400).json({ ok: false, error: "symbol_required" });
    if (!["ST", "LT"].includes(mode)) return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    const out = await analyzeStock(symbol, mode);
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

analyzeRouter.get("/:symbol/:mode", async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol || "").trim().toUpperCase();
    const mode = String(req.params.mode || "ST").trim().toUpperCase();
    if (!symbol) return res.status(400).json({ ok: false, error: "symbol_required" });
    if (!["ST", "LT"].includes(mode)) return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    const out = await analyzeStock(symbol, mode);
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

module.exports = { analyzeRouter };

