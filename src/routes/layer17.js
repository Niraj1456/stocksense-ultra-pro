const express = require("express");
const Layer17 = require("../layers/layer17");

const layer17Router = express.Router();

// FIX RC12: Replaced calls to non-existent winRateByScoreBand and drawdownAnalysis
// with actual exported engines from backtesting.js

layer17Router.post("/expectancy", async (req, res, next) => {
  try {
    const { trades } = req.body || {};
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ ok: false, error: "Provide an array of trades with r_multiple values" });
    }
    const result = Layer17.tradeExpectancyEngine({ trades });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

layer17Router.post("/drawdown", async (req, res, next) => {
  try {
    const { equity_curve } = req.body || {};
    if (!Array.isArray(equity_curve) || equity_curve.length === 0) {
      return res.status(400).json({ ok: false, error: "Provide an equity_curve array" });
    }
    const result = Layer17.drawdownEngine({ equity_curve });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

layer17Router.post("/risk-adjusted", async (req, res, next) => {
  try {
    const { returns } = req.body || {};
    if (!Array.isArray(returns) || returns.length === 0) {
      return res.status(400).json({ ok: false, error: "Provide a returns array" });
    }
    const result = Layer17.riskAdjustedReturnsEngine({ returns });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

layer17Router.post("/alpha-decay", async (req, res, next) => {
  try {
    const result = Layer17.alphaDecayEngine(req.body || {});
    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = { layer17Router };
