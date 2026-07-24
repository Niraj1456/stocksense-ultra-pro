// ═══════════════════════════════════════════════════════════════════════════
// LAYER 25 — ORACLE CONFIDENCE MULTIPLIER
//
// The Oracle answers one question: "Based on historical performance in
// similar conditions, how confident should we be in the engine's score?"
//
// Instead of producing a competing score (which would double-adjust
// calibrated weights), it computes a CONFIDENCE MULTIPLIER that scales
// the engine's deviation from neutral (50):
//
//   adjustedScore = 50 + (engineScore - 50) × multiplier
//
// multiplier > 1.0 = amplify conviction (history supports this score)
// multiplier < 1.0 = dampen conviction (history suggests unreliability)
// multiplier = 1.0 = neutral (cold start or no data)
//
// The multiplier uses genuinely DIFFERENT information from the engine:
//   ① Sector-regime-specific layer accuracy (not global weights)
//   ② Profit-weighted historical accuracy (not just direction)
//   ③ Score-level empirical hit rate (how often was this score right?)
//   ④ Layer correlation redundancy penalties
//   ⑤ BOCD regime stability
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const {
  ORACLE_MULTIPLIER_MIN,
  ORACLE_MULTIPLIER_MAX
} = require('../../config/mathConstants');

const LAYER_ID = 'L25_ORACLE';

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
 * Computes the Score Reliability Index (SRI) — how reliable are the layers
 * that are ACTIVELY DRIVING the current score?
 *
 * Only considers layers with |score - 50| > 5 (layers contributing to direction).
 * Weights each layer's reliability by its contribution magnitude.
 *
 * @param {Object} layerScores - { layer1_macro: 65, layer2_microstructure: 72, ... }
 * @param {Object} effectiveDCA - { layer1_macro: 0.62, layer2_microstructure: 0.71, ... }
 * @param {Object} weights - { layer1_macro: 4, layer2_microstructure: 15, ... }
 * @param {Object} [correlationPenalties] - { layer2_microstructure: 0.12, ... }
 * @returns {number} SRI ∈ [0, 1]
 */
function computeScoreReliabilityIndex(layerScores, effectiveDCA, weights, correlationPenalties) {
  if (!layerScores || !effectiveDCA || !weights) return 0.5;

  let reliabilitySum = 0;
  let contributionSum = 0;

  for (const [key, score] of Object.entries(layerScores)) {
    if (key === 'layer12_risk') continue;

    const deviation = Math.abs(score - 50);
    if (deviation < 5) continue; // Layer is near-neutral, not driving the score

    const weight = weights[key] || 0;
    if (weight === 0) continue;

    const dca = effectiveDCA[key] ?? 0.50;
    const corrPenalty = (correlationPenalties && correlationPenalties[key]) ? correlationPenalties[key] / 100 : 0;
    const reliability = dca * (1 - Math.min(corrPenalty, 0.5)); // Cap penalty at 50%

    const contribution = deviation * weight;
    reliabilitySum += reliability * contribution;
    contributionSum += contribution;
  }

  if (contributionSum === 0) return 0.5;
  return Math.max(0, Math.min(1, reliabilitySum / contributionSum));
}

/**
 * Computes the Historical Hit Rate at the current score level.
 * Looks at past trades where the engine produced a similar score
 * and checks what percentage were directionally correct.
 *
 * @param {number} engineScore - Current engine score
 * @param {Object[]} tradeHistory - Past trades with engine scores and outcomes
 * @param {number} [bandwidth=3] - Score range to consider (±bandwidth)
 * @returns {{ hitRate: number, sampleSize: number }}
 */
function computeScoreLevelHitRate(engineScore, tradeHistory, bandwidth = 3) {
  if (!tradeHistory || !Array.isArray(tradeHistory) || tradeHistory.length === 0 || engineScore == null) {
    return { hitRate: 0.5, sampleSize: 0 };
  }

  const lowerBound = engineScore - bandwidth;
  const upperBound = engineScore + bandwidth;

  let correct = 0;
  let total = 0;

  for (const trade of tradeHistory) {
    const tradeScore = trade.engine_score || trade.total_score ||
      (trade.json && (trade.json.total_score || trade.json.engine_score));

    if (tradeScore == null || tradeScore < lowerBound || tradeScore > upperBound) continue;

    const entry = Number(trade.entry_price);
    const exit = Number(trade.exit_price);
    if (!entry || !exit || entry === exit) continue;

    const actualDirection = exit > entry ? 'UP' : 'DOWN';
    const predictedDirection = tradeScore >= 55 ? 'UP' : (tradeScore <= 45 ? 'DOWN' : null);

    if (!predictedDirection) continue; // Skip neutral-zone scores

    total++;
    if (predictedDirection === actualDirection) correct++;
  }

  if (total < 5) {
    // Insufficient sample — return neutral
    return { hitRate: 0.5, sampleSize: total };
  }

  return {
    hitRate: Math.round((correct / total) * 10000) / 10000,
    sampleSize: total
  };
}

/**
 * Computes the Oracle Confidence Multiplier.
 *
 * @param {Object} params
 * @param {number} params.engineScore - Scoring engine's raw output (5-95)
 * @param {Object} params.layerScores - Per-layer scores from the engine
 * @param {Object} params.weights - Active weights used by the engine
 * @param {Object} [params.effectiveDCA] - Context-specific effective DCA per layer
 * @param {Object} [params.correlationPenalties] - Per-layer redundancy penalties
 * @param {number} [params.wfeScore] - Walk-Forward Efficiency score
 * @param {boolean} [params.bocdChangepoint=false] - Whether BOCD detected recent regime change
 * @param {number} params.tradeCount - Total closed trades since engine upgrade
 * @param {number} [params.dataQualityScore=100] - Engine's data quality score (0-100)
 * @param {Object[]} [params.tradeHistory] - Past trades for score-level hit rate
 * @param {number} [params.coldStartThreshold=130] - Min trades for Oracle to be active
 * @returns {Object} {
 *   multiplier: number (0.5-1.3),
 *   confidence: number (0-1),
 *   reasons: string[],
 *   components: { sri, hitRate, regimeStability, dataQuality, wfeFactor }
 * }
 */
function computeOracleMultiplier({
  engineScore,
  layerScores,
  weights,
  effectiveDCA = null,
  correlationPenalties = null,
  wfeScore = null,
  bocdChangepoint = false,
  tradeCount = 0,
  dataQualityScore = 100,
  tradeHistory = null,
  coldStartThreshold = 130
}) {
  const reasons = [];

  // Cold-start guard: Oracle is completely silent until sufficient trades
  if (tradeCount < coldStartThreshold) {
    reasons.push(`COLD_START: ${tradeCount}/${coldStartThreshold} trades — Oracle silent`);
    return {
      multiplier: 1.0,
      confidence: 0,
      reasons,
      components: { sri: 0.5, hitRate: 0.5, regimeStability: 1.0, dataQuality: 1.0, wfeFactor: 0.5 }
    };
  }

  // ── Component 1: Score Reliability Index (35% weight) ──
  const sri = computeScoreReliabilityIndex(layerScores, effectiveDCA || {}, weights || {}, correlationPenalties);
  if (sri < 0.45) {
    reasons.push(`LOW_SRI: Score driven by historically unreliable layers (SRI=${sri.toFixed(3)})`);
  } else if (sri > 0.70) {
    reasons.push(`HIGH_SRI: Score driven by historically accurate layers (SRI=${sri.toFixed(3)})`);
  }

  // ── Component 2: Score-Level Historical Hit Rate (30% weight) ──
  const hitRateResult = computeScoreLevelHitRate(engineScore, tradeHistory);
  const hitRate = hitRateResult.hitRate;
  if (hitRateResult.sampleSize >= 5 && hitRate < 0.45) {
    reasons.push(`LOW_HIT_RATE: Scores near ${engineScore} were right only ${(hitRate * 100).toFixed(0)}% of the time (n=${hitRateResult.sampleSize})`);
  } else if (hitRateResult.sampleSize >= 10 && hitRate > 0.70) {
    reasons.push(`HIGH_HIT_RATE: Scores near ${engineScore} were right ${(hitRate * 100).toFixed(0)}% of the time (n=${hitRateResult.sampleSize})`);
  }

  // ── Component 3: Regime Stability Factor (20% weight) ──
  const regimeStability = bocdChangepoint ? 0.70 : 1.00;
  if (bocdChangepoint) {
    reasons.push('REGIME_CHANGEPOINT: BOCD detected regime shift — dampening conviction');
  }

  // ── Component 4: Data Quality Factor (15% weight) ──
  const dataQuality = Math.max(0, Math.min(1, (dataQualityScore || 100) / 100));
  if (dataQuality < 0.60) {
    reasons.push(`LOW_DATA_QUALITY: Only ${(dataQuality * 100).toFixed(0)}% of layer data is fresh/real`);
  }

  // ── Component 5: WFE Factor (bonus/penalty) ──
  // WFE > 0.70 = strong out-of-sample performance → slight amplification
  // WFE < 0.50 = poor OOS → dampening
  let wfeFactor = 0.5; // neutral default
  if (wfeScore != null && typeof wfeScore === 'number') {
    wfeFactor = Math.max(0, Math.min(1, wfeScore));
  }

  // ── Compute Raw Multiplier ──
  // Weighted combination of all components
  const rawScore = (
    0.35 * sri +
    0.30 * hitRate +
    0.20 * regimeStability +
    0.15 * dataQuality
  );

  // WFE acts as a scaling modifier on the raw score
  // wfeFactor of 1.0 boosts by 10%, wfeFactor of 0.0 reduces by 10%
  const wfeModifier = 1.0 + (wfeFactor - 0.5) * 0.20;
  const adjustedRawScore = rawScore * wfeModifier;

  // Map raw score [0, 1] → multiplier range [ORACLE_MULTIPLIER_MIN, ORACLE_MULTIPLIER_MAX]
  // rawScore = 0.5 → multiplier ≈ 1.0 (neutral)
  // rawScore = 0.0 → multiplier = ORACLE_MULTIPLIER_MIN (0.5)
  // rawScore = 1.0 → multiplier = ORACLE_MULTIPLIER_MAX (1.3)
  const range = ORACLE_MULTIPLIER_MAX - ORACLE_MULTIPLIER_MIN;
  const multiplier = Math.max(
    ORACLE_MULTIPLIER_MIN,
    Math.min(
      ORACLE_MULTIPLIER_MAX,
      ORACLE_MULTIPLIER_MIN + adjustedRawScore * range
    )
  );

  // Round to 4 decimal places
  const finalMultiplier = Math.round(multiplier * 10000) / 10000;

  // Confidence = how far from neutral (1.0) the Oracle is pushing
  const confidence = Math.round(Math.abs(finalMultiplier - 1.0) * 10000) / 10000;

  // Log significant adjustments
  if (finalMultiplier < 0.85) {
    logEvent('ORACLE_STRONG_DAMPENING', 'WARN',
      `Oracle dampening conviction: multiplier=${finalMultiplier}`,
      { engineScore, multiplier: finalMultiplier, reasons });
  } else if (finalMultiplier > 1.15) {
    logEvent('ORACLE_STRONG_AMPLIFICATION', 'INFO',
      `Oracle amplifying conviction: multiplier=${finalMultiplier}`,
      { engineScore, multiplier: finalMultiplier, reasons });
  }

  return {
    multiplier: finalMultiplier,
    confidence,
    reasons,
    components: {
      sri: Math.round(sri * 10000) / 10000,
      hitRate: Math.round(hitRate * 10000) / 10000,
      hitRateSampleSize: hitRateResult.sampleSize,
      regimeStability,
      dataQuality: Math.round(dataQuality * 10000) / 10000,
      wfeFactor: Math.round(wfeFactor * 10000) / 10000,
      rawScore: Math.round(adjustedRawScore * 10000) / 10000
    }
  };
}

module.exports = {
  computeOracleMultiplier,
  computeScoreReliabilityIndex,
  computeScoreLevelHitRate
};
