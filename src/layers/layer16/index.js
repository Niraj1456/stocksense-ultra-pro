const { 
  freshnessDecayEngine,
  outlierDetectionEngine,
  confidenceAggregatorEngine,
  circuitBreakerEngine
} = require("./reliability");

// FIX RC12: Removed symbolResolver, cacheLayerProbe, freshnessTracker 
// which were never defined in reliability.js and caused undefined exports.
module.exports = { 
  freshnessDecayEngine,
  outlierDetectionEngine,
  confidenceAggregatorEngine,
  circuitBreakerEngine
};
