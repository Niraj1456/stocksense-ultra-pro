const express = require("express");
const Layer8 = require("../layers/layer8");
const Layer10 = require("../layers/layer10");

const layer10Router = express.Router();

layer10Router.get("/valuation/:symbol", async (req, res, next) => {
  try {
    const f = await Layer8.financials(req.params.symbol);
    res.json(Layer10.valuation({ financials: f.data }));
  } catch (e) {
    next(e);
  }
});

module.exports = { layer10Router };

