const {
  volatilityRegimeClassifier,
  garchVolatilityEngine,
  ivRvBridge,
  eventAtrAdjustment,
  predictATR
} = require("./atrPredictor");

const {
  distributionPhaseDetector,
  momentumExhaustionEngine,
  squeezeRiskDetector,
  regimeShortThreshold,
  optimalShortEntry,
  adviseShortEntry
} = require("./shortAdvisor");

module.exports = {
  // ATR Predictor
  volatilityRegimeClassifier,
  garchVolatilityEngine,
  ivRvBridge,
  eventAtrAdjustment,
  predictATR,
  // Short Advisor
  distributionPhaseDetector,
  momentumExhaustionEngine,
  squeezeRiskDetector,
  regimeShortThreshold,
  optimalShortEntry,
  adviseShortEntry
};
