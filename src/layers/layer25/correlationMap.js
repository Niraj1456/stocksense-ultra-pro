// ═══════════════════════════════════════════════════════════════════════════
// LAYER 25 — LAYER CORRELATION MAP & REDUNDANCY PENALTIES
//
// Computes pairwise Pearson correlations between layer scores across
// closed trade history. Identifies redundant (highly correlated) layer
// pairs and computes weight penalties to diversify the score.
//
// Rationale: If L2 (Microstructure) and L5 (Volume Profile) are ρ=0.85
// correlated, having both at 15% and 10% means 25% of the score is
// effectively driven by one type of signal. The redundancy penalty
// reduces combined weight of correlated pairs.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const {
  CORRELATION_REDUNDANCY_THRESHOLD,
  CORRELATION_DAMPING_ALPHA
} = require('../../config/mathConstants');

const LAYER_ID = 'L25_CORR';

function logEvent(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: LAYER_ID,
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

/**
 * Computes Pearson correlation coefficient between two arrays.
 * Returns 0 if inputs are invalid or have zero variance.
 *
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number} Correlation coefficient ∈ [-1, 1]
 */
function pearsonCorrelation(xs, ys) {
  if (!xs || !ys || xs.length !== ys.length || xs.length < 3) return 0;

  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denomX = n * sumX2 - sumX * sumX;
  const denomY = n * sumY2 - sumY * sumY;
  const denominator = Math.sqrt(denomX * denomY);

  if (denominator === 0 || !isFinite(denominator)) return 0;

  const r = numerator / denominator;
  // Clamp to [-1, 1] to handle floating-point imprecision
  return Math.max(-1, Math.min(1, r));
}

/**
 * Builds a pairwise correlation matrix from trade history layer scores.
 *
 * @param {Object[]} trades - Array of closed trade objects with layer scores.
 *   Each trade should have `json.layer_scores` or `layer_scores_json` containing
 *   per-layer scores like { layer1_macro: 65, layer2_microstructure: 72, ... }
 * @param {string[]} layerKeys - Array of layer key names to compute correlations for.
 * @param {number} [maxTrades=200] - Maximum number of most recent trades to use.
 * @returns {Object} {
 *   matrix: { layer_a: { layer_b: correlation, ... }, ... },
 *   pairs: [{ layerA, layerB, correlation }],  // Only pairs with |ρ| > threshold
 *   tradeCount: number
 * }
 */
function buildCorrelationMatrix(trades, layerKeys, maxTrades = 200) {
  if (!trades || !Array.isArray(trades) || trades.length < 10 || !layerKeys || layerKeys.length < 2) {
    return { matrix: {}, pairs: [], tradeCount: 0 };
  }

  // Use the most recent trades (sorted by exit date)
  const sortedTrades = [...trades]
    .sort((a, b) => new Date(b.exit_ts || b.exitDate || 0) - new Date(a.exit_ts || a.exitDate || 0))
    .slice(0, maxTrades);

  // Extract layer score vectors
  const layerVectors = {};
  for (const k of layerKeys) {
    layerVectors[k] = [];
  }

  for (const trade of sortedTrades) {
    let lScores = {};
    if (typeof trade.json === 'object' && trade.json !== null) {
      lScores = trade.json.layer_scores || trade.json.layer_scores_json || {};
    } else if (typeof trade.layer_scores_json === 'object' && trade.layer_scores_json !== null) {
      lScores = trade.layer_scores_json;
    } else if (typeof trade.json === 'string') {
      try {
        const parsed = JSON.parse(trade.json);
        lScores = parsed.layer_scores || parsed.layer_scores_json || {};
      } catch (e) { /* skip */ }
    }

    for (const k of layerKeys) {
      layerVectors[k].push(lScores[k] != null ? Number(lScores[k]) : 50);
    }
  }

  // Compute pairwise correlations
  const matrix = {};
  const significantPairs = [];

  for (let i = 0; i < layerKeys.length; i++) {
    const keyA = layerKeys[i];
    if (!matrix[keyA]) matrix[keyA] = {};

    for (let j = i + 1; j < layerKeys.length; j++) {
      const keyB = layerKeys[j];
      if (!matrix[keyB]) matrix[keyB] = {};

      const corr = pearsonCorrelation(layerVectors[keyA], layerVectors[keyB]);
      const roundedCorr = Math.round(corr * 10000) / 10000;

      matrix[keyA][keyB] = roundedCorr;
      matrix[keyB][keyA] = roundedCorr;

      // Track pairs above the redundancy threshold
      if (Math.abs(roundedCorr) > CORRELATION_REDUNDANCY_THRESHOLD) {
        significantPairs.push({
          layerA: keyA,
          layerB: keyB,
          correlation: roundedCorr
        });
      }
    }

    // Self-correlation is always 1.0
    matrix[keyA][keyA] = 1.0;
  }

  if (significantPairs.length > 0) {
    logEvent('CORRELATION_REDUNDANCY_DETECTED', 'INFO',
      `Found ${significantPairs.length} layer pairs with |ρ| > ${CORRELATION_REDUNDANCY_THRESHOLD}`,
      { pairs: significantPairs.map(p => `${p.layerA}↔${p.layerB}: ${p.correlation}`) });
  }

  return {
    matrix,
    pairs: significantPairs,
    tradeCount: sortedTrades.length
  };
}

/**
 * Computes per-layer redundancy penalties based on the correlation matrix.
 * Layers that are highly correlated with other high-weight layers get penalized
 * to diversify the overall score composition.
 *
 * Formula:
 *   For each pair (i, j) with |ρ_ij| > threshold:
 *     redundancy_i += weight_j × |ρ_ij|
 *     redundancy_j += weight_i × |ρ_ij|
 *
 *   adjustedWeight_i = rawWeight_i / (1 + α × redundancy_i)
 *   where α = CORRELATION_DAMPING_ALPHA (default 0.15)
 *
 * @param {Object} correlationData - Output from buildCorrelationMatrix()
 * @param {Object} currentWeights - Current weight map { layer1_macro: 4, ... }
 * @returns {Object} {
 *   adjustedWeights: { layer1_macro: 3.8, ... },
 *   penalties: { layer2_microstructure: 0.12, ... },
 *   totalRedistributed: number
 * }
 */
function computeRedundancyPenalties(correlationData, currentWeights) {
  if (!correlationData || !correlationData.pairs || correlationData.pairs.length === 0 || !currentWeights) {
    return {
      adjustedWeights: { ...currentWeights },
      penalties: {},
      totalRedistributed: 0
    };
  }

  const layerKeys = Object.keys(currentWeights).filter(k => k !== 'layer12_risk');
  const redundancy = {};
  for (const k of layerKeys) {
    redundancy[k] = 0;
  }

  // Accumulate redundancy from correlated pairs
  for (const pair of correlationData.pairs) {
    const { layerA, layerB, correlation } = pair;
    const absCorr = Math.abs(correlation);
    const weightA = currentWeights[layerA] || 0;
    const weightB = currentWeights[layerB] || 0;

    if (redundancy[layerA] !== undefined) {
      redundancy[layerA] += weightB * absCorr;
    }
    if (redundancy[layerB] !== undefined) {
      redundancy[layerB] += weightA * absCorr;
    }
  }

  // Apply damped penalty
  const adjustedWeights = {};
  const penalties = {};
  let totalOriginal = 0;
  let totalAdjusted = 0;

  for (const k of layerKeys) {
    const originalW = currentWeights[k] || 0;
    const penalty = redundancy[k] > 0 ? CORRELATION_DAMPING_ALPHA * redundancy[k] : 0;
    const adjusted = originalW / (1 + penalty / 100); // Normalize penalty relative to weight scale

    adjustedWeights[k] = Math.round(adjusted * 10000) / 10000;
    penalties[k] = Math.round(penalty * 10000) / 10000;
    totalOriginal += originalW;
    totalAdjusted += adjustedWeights[k];
  }

  // Preserve layer12_risk = 0
  adjustedWeights.layer12_risk = 0;

  // Re-normalize adjusted weights to sum to totalOriginal (usually 100)
  if (totalAdjusted > 0 && totalOriginal > 0) {
    const scaleFactor = totalOriginal / totalAdjusted;
    for (const k of layerKeys) {
      adjustedWeights[k] = Math.round(adjustedWeights[k] * scaleFactor * 10000) / 10000;
    }
  }

  const totalRedistributed = Math.abs(totalOriginal - totalAdjusted);

  return {
    adjustedWeights,
    penalties,
    totalRedistributed: Math.round(totalRedistributed * 10000) / 10000
  };
}

module.exports = {
  pearsonCorrelation,
  buildCorrelationMatrix,
  computeRedundancyPenalties
};
