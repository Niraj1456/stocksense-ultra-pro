const express = require("express");
const { cache } = require("../lib/cache");
const Layer1 = require("../layers/layer1");
const { fetchAllIndices, fetchAdvancesDeclines } = require("../services/nse");

const layer1Router = express.Router();

layer1Router.get("/nse/indices", async (_req, res, next) => {
  try {
    const cached = cache.get("layer1:nse:allIndices");
    if (cached) return res.json(cached);

    const data = await fetchAllIndices();
    const payload = { fetchedAt: new Date().toISOString(), data };
    cache.set("layer1:nse:allIndices", payload, 30 * 1000);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

layer1Router.get("/nse/advances-declines", async (_req, res, next) => {
  try {
    const cached = cache.get("layer1:nse:advdec");
    if (cached) return res.json(cached);

    const data = await fetchAdvancesDeclines();
    const payload = { fetchedAt: new Date().toISOString(), data };
    cache.set("layer1:nse:advdec", payload, 30 * 1000);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

layer1Router.get("/global/quotes", async (_req, res, next) => {
  try {
    const cached = cache.get("layer1:yahoo:quotes");
    if (cached) return res.json(cached);

    const out = await Layer1.globalMarkets();
    const payload = { fetchedAt: out.meta.fetchedAt, data: out.data };
    cache.set("layer1:yahoo:quotes", payload, 20 * 1000);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

layer1Router.get("/india-vix", async (_req, res, next) => {
  try {
    const out = await Layer1.indiaVix();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/advance-decline", async (_req, res, next) => {
  try {
    const out = await Layer1.advanceDecline();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/mcclellan", async (_req, res, next) => {
  try {
    const out = await Layer1.mcclellan();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/sector-heatmap", async (_req, res, next) => {
  try {
    const out = await Layer1.sectorHeatmap();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/sector-rotation", async (_req, res, next) => {
  try {
    const heat = await Layer1.sectorHeatmap();
    const out = Layer1.sectorRotation({ sectorHeatmap: heat.data });
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/global-risk", async (_req, res, next) => {
  try {
    const [vix, globals] = await Promise.all([Layer1.indiaVix(), Layer1.globalMarkets()]);
    const out = await Layer1.globalRisk({ indiaVixRow: vix.data, yahooQuotes: globals.data });
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/nifty50", async (_req, res, next) => {
  try {
    const out = await Layer1.nifty50();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/gift-nifty", async (_req, res, next) => {
  try {
    const out = await Layer1.giftNifty();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/fii-flow-monthly", async (_req, res, next) => {
  try {
    const out = await Layer1.fiiFlowMonthly();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/gdp", async (_req, res, next) => {
  try {
    const out = await Layer1.gdpDataIndia();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

layer1Router.get("/rbi", async (_req, res, next) => {
  try {
    const out = await Layer1.rbiData();
    return res.json(out);
  } catch (e) {
    return next(e);
  }
});

module.exports = { layer1Router };

