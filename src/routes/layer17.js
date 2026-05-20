const express = require("express");
const Layer17 = require("../layers/layer17");

const layer17Router = express.Router();

layer17Router.get("/win-rate-by-score", async (_req, res, next) => {
  try {
    res.json(await Layer17.winRateByScoreBand());
  } catch (e) {
    next(e);
  }
});

layer17Router.get("/drawdown", async (_req, res, next) => {
  try {
    res.json(await Layer17.drawdownAnalysis());
  } catch (e) {
    next(e);
  }
});

module.exports = { layer17Router };

