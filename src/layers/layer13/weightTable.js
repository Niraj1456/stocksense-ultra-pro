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
      layer5_volume_profile: 12,
      layer6_institutional: 3,
      layer7_derivatives: 6,
      layer8_fundamentals: 2,
      layer9_forensic: 2,
      layer10_valuation: 2,
      layer11_predictive: 4,
      layer15_sentiment: 3,
      layer19_promoter_pledge: 2,
      layer20_earnings_quality: 2,
      layer21_rs_rating: 7,
      layer22_mtf_coherence: 9,
      layer23_peer_percentile: 2,
      layer24_mgmt_quality: 2,
      layer12_risk: 0
    },
    HIGH_VIX: {
      layer1_macro: 10,
      layer2_microstructure: 12,
      layer3_technicals: 10,
      layer4_price_action: 6,
      layer5_volume_profile: 8,
      layer6_institutional: 3,
      layer7_derivatives: 14,
      layer8_fundamentals: 2,
      layer9_forensic: 2,
      layer10_valuation: 2,
      layer11_predictive: 3,
      layer15_sentiment: 4,
      layer19_promoter_pledge: 2,
      layer20_earnings_quality: 2,
      layer21_rs_rating: 5,
      layer22_mtf_coherence: 11,
      layer23_peer_percentile: 2,
      layer24_mgmt_quality: 2,
      layer12_risk: 0
    }
  },
  INVESTMENT: {
    LOW_VIX: {
      layer1_macro: 8,
      layer2_microstructure: 2,
      layer3_technicals: 3,
      layer4_price_action: 2,
      layer5_volume_profile: 4,
      layer6_institutional: 12,
      layer7_derivatives: 2,
      layer8_fundamentals: 8,
      layer9_forensic: 6,
      layer10_valuation: 9,
      layer11_predictive: 2,
      layer15_sentiment: 3,
      layer19_promoter_pledge: 5,
      layer20_earnings_quality: 8,
      layer21_rs_rating: 5,
      layer22_mtf_coherence: 3,
      layer23_peer_percentile: 10,
      layer24_mgmt_quality: 8,
      layer12_risk: 0
    },
    HIGH_VIX: {
      layer1_macro: 11,
      layer2_microstructure: 2,
      layer3_technicals: 3,
      layer4_price_action: 2,
      layer5_volume_profile: 3,
      layer6_institutional: 16,
      layer7_derivatives: 3,
      layer8_fundamentals: 8,
      layer9_forensic: 5,
      layer10_valuation: 9,
      layer11_predictive: 2,
      layer15_sentiment: 3,
      layer19_promoter_pledge: 5,
      layer20_earnings_quality: 5,
      layer21_rs_rating: 4,
      layer22_mtf_coherence: 4,
      layer23_peer_percentile: 8,
      layer24_mgmt_quality: 7,
      layer12_risk: 0
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
