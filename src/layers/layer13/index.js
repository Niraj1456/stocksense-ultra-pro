const { scoreEngine } = require("./scoreEngine");
const { verdictClassifier } = require("./verdictClassifier");
const {
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine
} = require("./masterScoring");

module.exports = { 
  scoreEngine, 
  verdictClassifier,
  weightTableEngine,
  scoreAggregationEngine,
  vetoVerificationEngine,
  verdictClassifierEngine
};

