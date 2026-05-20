const { indiaVix } = require("./indiaVix");
const { advanceDecline } = require("./advanceDecline");
const { mcclellan } = require("./mcclellan");
const { globalMarkets } = require("./globalMarkets");
const { sectorHeatmap } = require("./sectorHeatmap");
const { globalRisk } = require("./globalRisk");
const { sectorRotation } = require("./sectorRotation");
const { giftNifty } = require("./giftNifty");
const { fiiFlowMonthly } = require("./fiiFlow");
const { gdpDataIndia } = require("./gdpData");
const { rbiData } = require("./rbiData");
const { nifty50 } = require("./nifty50");

module.exports = {
  indiaVix,
  advanceDecline,
  mcclellan,
  nifty50,
  globalMarkets,
  sectorHeatmap,
  globalRisk,
  sectorRotation,
  giftNifty,
  fiiFlowMonthly,
  gdpDataIndia,
  rbiData
};

