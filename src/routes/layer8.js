const express = require("express");
const Layer8 = require("../layers/layer8");

const layer8Router = express.Router();

layer8Router.get("/financials/:symbol", async (req, res, next) => {
  try {
    res.json(await Layer8.financials(req.params.symbol));
  } catch (e) {
    next(e);
  }
});

module.exports = { layer8Router };

