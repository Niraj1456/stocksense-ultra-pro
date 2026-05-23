const express = require("express");
const { analyzeStock } = require("../analyze/analyzeStock");

const analyzeRouter = express.Router();

/**
 * GET /api/v1/analyze?symbol=TICKER&mode=ST
 * Supports ultra-low latency scoring engine queries
 */
analyzeRouter.get("/", async (req, res, next) => {
  const startTime = performance.now();
  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    const mode = String(req.query.mode || "ST").trim().toUpperCase();

    if (!symbol) {
      return res.status(400).json({ ok: false, error: "symbol_required" });
    }
    if (!["ST", "LT"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    }

    const out = await analyzeStock(symbol, mode);

    const endTime = performance.now();
    const latencyMs = endTime - startTime;
    res.setHeader("X-Response-Time", `${latencyMs.toFixed(3)}ms`);

    if (out.status === "PROCESSING") {
      return res.status(202).json({
        ...out,
        latency_ms: Number(latencyMs.toFixed(3))
      });
    }

    return res.status(200).json({
      ...out,
      latency_ms: Number(latencyMs.toFixed(3))
    });
  } catch (e) {
    return next(e);
  }
});

/**
 * POST /api/v1/analyze
 * Supports compatibility for JSON POST payloads
 */
analyzeRouter.post("/", async (req, res, next) => {
  const startTime = performance.now();
  try {
    const symbol = String(req.body?.symbol || "").trim().toUpperCase();
    const mode = String(req.body?.mode || "ST").trim().toUpperCase();

    if (!symbol) {
      return res.status(400).json({ ok: false, error: "symbol_required" });
    }
    if (!["ST", "LT"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    }

    const out = await analyzeStock(symbol, mode);

    const endTime = performance.now();
    const latencyMs = endTime - startTime;
    res.setHeader("X-Response-Time", `${latencyMs.toFixed(3)}ms`);

    if (out.status === "PROCESSING") {
      return res.status(202).json({
        ...out,
        latency_ms: Number(latencyMs.toFixed(3))
      });
    }

    return res.status(200).json({
      ...out,
      latency_ms: Number(latencyMs.toFixed(3))
    });
  } catch (e) {
    return next(e);
  }
});

/**
 * GET /api/v1/analyze/:symbol/:mode
 * Compatibility layer for older path-parameter routing formats
 */
analyzeRouter.get("/:symbol/:mode", async (req, res, next) => {
  const startTime = performance.now();
  try {
    const symbol = String(req.params.symbol || "").trim().toUpperCase();
    const mode = String(req.params.mode || "ST").trim().toUpperCase();

    if (!symbol) {
      return res.status(400).json({ ok: false, error: "symbol_required" });
    }
    if (!["ST", "LT"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "mode_must_be_ST_or_LT" });
    }

    const out = await analyzeStock(symbol, mode);

    const endTime = performance.now();
    const latencyMs = endTime - startTime;
    res.setHeader("X-Response-Time", `${latencyMs.toFixed(3)}ms`);

    if (out.status === "PROCESSING") {
      return res.status(202).json({
        ...out,
        latency_ms: Number(latencyMs.toFixed(3))
      });
    }

    return res.status(200).json({
      ...out,
      latency_ms: Number(latencyMs.toFixed(3))
    });
  } catch (e) {
    return next(e);
  }
});

module.exports = { analyzeRouter };
