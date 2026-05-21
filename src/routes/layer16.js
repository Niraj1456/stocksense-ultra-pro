const express = require("express");
const Layer16 = require("../layers/layer16");

const layer16Router = express.Router();

// FIX RC12: Replaced symbolResolver and cacheLayerProbe (which were undefined)
// with the actual exported engines from reliability.js

layer16Router.get("/freshness", async (req, res, next) => {
  try {
    // Return freshness decay analysis for provided timestamps
    const result = Layer16.freshnessDecayEngine({
      layer_timestamps: req.query || {},
      current_time: new Date().toISOString()
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

layer16Router.get("/outlier-check", async (req, res, next) => {
  try {
    const { price, prevClose, high, low } = req.query;
    const result = Layer16.outlierDetectionEngine({
      current_price: parseFloat(price) || 0,
      previous_close: parseFloat(prevClose) || 0,
      high: parseFloat(high) || 0,
      low: parseFloat(low) || 0
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

layer16Router.get("/confidence", async (req, res, next) => {
  try {
    const confidences = (req.query.scores || "").split(",").map(Number).filter(n => !isNaN(n));
    const result = Layer16.confidenceAggregatorEngine({ layer_confidences: confidences });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = { layer16Router };
