const express = require("express");
const Layer6 = require("../layers/layer6");

const layer6Router = express.Router();

layer6Router.get("/fii-dii", async (_req, res, next) => {
  try {
    res.json(await Layer6.fiiDii());
  } catch (e) {
    next(e);
  }
});

layer6Router.get("/participants-oi", async (_req, res, next) => {
  try {
    res.json(await Layer6.participantsOi());
  } catch (e) {
    next(e);
  }
});

layer6Router.get("/bulk-deals", async (_req, res, next) => {
  try {
    res.json(await Layer6.bulkDeals());
  } catch (e) {
    next(e);
  }
});

layer6Router.get("/block-deals", async (_req, res, next) => {
  try {
    res.json(await Layer6.blockDeals());
  } catch (e) {
    next(e);
  }
});

module.exports = { layer6Router };

