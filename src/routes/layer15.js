const express = require("express");
const Layer15 = require("../layers/layer15");

const layer15Router = express.Router();

layer15Router.get("/supply-chain-news", async (_req, res, next) => {
  try {
    res.json(await Layer15.supplyChainNews());
  } catch (e) {
    next(e);
  }
});

layer15Router.get("/announcements/:symbol", async (req, res, next) => {
  try {
    res.json(await Layer15.announcements(req.params.symbol));
  } catch (e) {
    next(e);
  }
});

module.exports = { layer15Router };

