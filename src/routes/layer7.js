const express = require("express");
const Layer7 = require("../layers/layer7");

const layer7Router = express.Router();

layer7Router.get("/options-chain/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const out = await Layer7.optionsChain(symbol);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

layer7Router.get("/pcr/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const chain = await Layer7.optionsChain(symbol);
    if (!chain.ok) return res.json(chain);
    res.json(Layer7.pcr(chain.data));
  } catch (e) {
    next(e);
  }
});

layer7Router.get("/max-pain/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const chain = await Layer7.optionsChain(symbol);
    if (!chain.ok) return res.json(chain);
    res.json(Layer7.maxPain(chain.data));
  } catch (e) {
    next(e);
  }
});

layer7Router.get("/oi-delta/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const chain = await Layer7.optionsChain(symbol);
    if (!chain.ok) return res.json(chain);
    res.json(Layer7.oiDelta(chain.data));
  } catch (e) {
    next(e);
  }
});

module.exports = { layer7Router };

