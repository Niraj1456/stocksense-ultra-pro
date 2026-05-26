/**
 * StockSense Ultra Pro — 26-Layer Static Weight Table
 * 
 * Research-calibrated weight allocation across 4 regimes:
 * - INTRADAY × LOW_VIX
 * - INTRADAY × HIGH_VIX
 * - INVESTMENT × LOW_VIX
 * - INVESTMENT × HIGH_VIX
 * 
 * All weights use the standard verbose key format (layer1_macro, etc.)
 * matching getLayerScoresFromIndicators() output keys and
 * weight_calibration_log JSONB keys.
 * 
 * Each weight carries a ±2% confidence band.
 * L25 calibration may shift any weight by ±3% per cycle within [1%, 30%] bounds.
 */

const WEIGHT_TABLE = {
  INTRADAY: {
    LOW_VIX: {
      layer1_macro: 4,
      layer2_microstructure: 15,
      layer3_technicals: 15,
      layer4_price_action: 8,
      layer5_volume_profile: 10,
      layer6_institutional: 4,
      layer7_derivatives: 5,
      layer8_fundamentals: 1,
      layer9_forensic: 1,
      layer10_valuation: 1,
      layer11_predictive: 5,
      layer14_consensus: 1,
      layer15_sentiment: 2,
      layer16_integrity: 1,
      layer17_backtest: 3,
      layer18_volatility: 3,
      layer19_promoter_pledge: 1,
      layer20_earnings_quality: 1,
      layer21_rs_rating: 5,
      layer22_mtf_coherence: 10,
      layer23_peer_percentile: 1,
      layer24_mgmt_quality: 1,
      layer25_ensemble: 1,
      layer26_walk_forward: 1,
      layer12_risk: 0
    },
    HIGH_VIX: {
      layer1_macro: 10,
      layer2_microstructure: 10,
      layer3_technicals: 9,
      layer4_price_action: 5,
      layer5_volume_profile: 7,
      layer6_institutional: 4,
      layer7_derivatives: 15,
      layer8_fundamentals: 1,
      layer9_forensic: 1,
      layer10_valuation: 1,
      layer11_predictive: 3,
      layer14_consensus: 1,
      layer15_sentiment: 3,
      layer16_integrity: 1,
      layer17_backtest: 3,
      layer18_volatility: 6,
      layer19_promoter_pledge: 1,
      layer20_earnings_quality: 1,
      layer21_rs_rating: 4,
      layer22_mtf_coherence: 8,
      layer23_peer_percentile: 1,
      layer24_mgmt_quality: 1,
      layer25_ensemble: 2,
      layer26_walk_forward: 2,
      layer12_risk: 0
    }
  },
  INVESTMENT: {
    LOW_VIX: {
      layer1_macro: 6,
      layer2_microstructure: 1,
      layer3_technicals: 1,
      layer4_price_action: 1,
      layer5_volume_profile: 1,
      layer6_institutional: 12,
      layer7_derivatives: 1,
      layer8_fundamentals: 15,
      layer9_forensic: 5,
      layer10_valuation: 15,
      layer11_predictive: 1,
      layer14_consensus: 1,
      layer15_sentiment: 1,
      layer16_integrity: 1,
      layer17_backtest: 1,
      layer18_volatility: 1,
      layer19_promoter_pledge: 4,
      layer20_earnings_quality: 10,
      layer21_rs_rating: 1,
      layer22_mtf_coherence: 1,
      layer23_peer_percentile: 8,
      layer24_mgmt_quality: 10,
      layer25_ensemble: 1,
      layer26_walk_forward: 1,
      layer12_risk: 0
    },
    HIGH_VIX: {
      layer1_macro: 8,
      layer2_microstructure: 1,
      layer3_technicals: 1,
      layer4_price_action: 1,
      layer5_volume_profile: 3,
      layer6_institutional: 15,
      layer7_derivatives: 1,
      layer8_fundamentals: 12,
      layer9_forensic: 5,
      layer10_valuation: 12,
      layer11_predictive: 1,
      layer15_sentiment: 3,
      layer16_integrity: 1,
      layer17_backtest: 1,
      layer18_volatility: 1,
      layer19_promoter_pledge: 4,
      layer20_earnings_quality: 4,
      layer21_rs_rating: 4,
      layer22_mtf_coherence: 4,
      layer23_peer_percentile: 7,
      layer24_mgmt_quality: 6,
      layer25_ensemble: 2,
      layer26_walk_forward: 2,
      layer12_risk: 0,
      layer14_consensus: 1
    }
  }
};

// Legacy compatibility: ST = INTRADAY, LT = INVESTMENT
// Default to LOW_VIX if regime not specified
const ST = WEIGHT_TABLE.INTRADAY.LOW_VIX;
const LT = WEIGHT_TABLE.INVESTMENT.LOW_VIX;

/**
 * Get static weights for a given mode and VIX regime.
 * @param {string} mode - "ST" | "LT" | "INTRADAY" | "INVESTMENT"
 * @param {string} regime - "LOW_VIX" | "HIGH_VIX" (default: "LOW_VIX")
 * @returns {Object} Weight map with standard verbose keys
 */
function getWeights(mode, regime = 'LOW_VIX') {
  const normalizedMode = (mode === 'LT' || mode === 'INVESTMENT' || mode === 'POSITIONAL')
    ? 'INVESTMENT'
    : 'INTRADAY';
  const normalizedRegime = regime === 'HIGH_VIX' ? 'HIGH_VIX' : 'LOW_VIX';
  return WEIGHT_TABLE[normalizedMode][normalizedRegime];
}

/**
 * Get the list of all active layer keys (non-zero weight in any regime).
 * @returns {string[]} Array of standard verbose layer key names
 */
function getActiveLayerKeys() {
  return Object.keys(WEIGHT_TABLE.INTRADAY.LOW_VIX).filter(k => k !== 'layer12_risk');
}

module.exports = { getWeights, getActiveLayerKeys, WEIGHT_TABLE, ST, LT };
