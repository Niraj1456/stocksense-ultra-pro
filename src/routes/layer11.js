const express = require("express");
const Layer7 = require("../layers/layer7");
const Layer8 = require("../layers/layer8");
const Layer10 = require("../layers/layer10");
const Layer11 = require("../layers/layer11");
const { layer3Technicals } = require("../layers/layer3");

const layer11Router = express.Router();

layer11Router.get("/predictive/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol;
    const [chain, t, f] = await Promise.all([
      Layer7.optionsChain(symbol),
      layer3Technicals({ symbol }),
      Layer8.financials(symbol)
    ]);
    const pcr = chain.ok ? Layer7.pcr(chain.data).data : {};
    const maxPain = chain.ok ? Layer7.maxPain(chain.data).data : {};
    const val = Layer10.valuation({ financials: f.data }).data;

    res.json(
      Layer11.predictiveSignals({
        maxPain,
        pcr,
        technicals: t?.data?.indicators || {},
        valuationBand: val.valuationBand
      })
    );
  } catch (e) {
    next(e);
  }
});

module.exports = { layer11Router };

