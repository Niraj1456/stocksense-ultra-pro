const express = require("express");
const Layer16 = require("../layers/layer16");

const layer16Router = express.Router();

layer16Router.get("/symbol-resolve/:symbol", (req, res) => {
  res.json(Layer16.symbolResolver(req.params.symbol));
});

layer16Router.get("/cache-probe", async (_req, res, next) => {
  try {
    res.json(await Layer16.cacheLayerProbe());
  } catch (e) {
    next(e);
  }
});

module.exports = { layer16Router };

