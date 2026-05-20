const express = require("express");
const Layer8 = require("../layers/layer8");
const Layer9 = require("../layers/layer9");

const layer9Router = express.Router();

layer9Router.get("/forensic/:symbol", async (req, res, next) => {
  try {
    const f = await Layer8.financials(req.params.symbol);
    res.json(Layer9.forensicAccounting({ financials: f.data }));
  } catch (e) {
    next(e);
  }
});

module.exports = { layer9Router };

