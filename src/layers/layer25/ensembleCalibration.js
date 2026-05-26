// ═══════════════════════════════════════════════════════════════════════════
// LAYER 25 — ENSEMBLE WEIGHT CALIBRATION (SELF-LEARNING)
//
// Domain: Parameter Tuning & Self-Learning Calibration
//
// Calibrates layer weights dynamically using closed trade history.
// Uses a Bayesian Dirichlet prior update to optimize active layer weights
// based on each layer's Directional Conviction Accuracy (DCA):
//   DCA_i = CorrectTrades_i / TotalTrades_i
//
// Includes strict safety rails:
//   - Max ±3% weight shift per layer per cycle.
//   - Active layers floor: 2%, inactive layers floor: 1%.
//   - Maximum ceiling of 30% per layer.
//   - 3 consecutive ceiling hits (at 30%) triggers system reset.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ── CONSTANTS ────────────────────────────────────────────────────────────
const LAYER_ID = 'L25';

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
 * Normalizes weights to sum to exactly 100 while respecting floor and ceiling bounds.
 * Uses an iterative optimization loop capped at maxIterations.
 * If convergence fails, falls back to the static weights.
 *
 * @param {Object} weights - Map of layer keys to weights
 * @param {Object} floors - Map of layer keys to floor bounds
 * @param {Object} ceilings - Map of layer keys to ceiling bounds
 * @param {number} maxIterations - Maximum loop limit (defaults to 30)
 * @returns {Object} normalizedWeights
 */
function iterativeBoundedNormalize(weights, floors, ceilings, maxIterations = 30) {
  let w = { ...weights };
  const keys = Object.keys(w);
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Clamp to bounds
    let sum = 0;
    for (const k of keys) {
      const fl = floors[k] || 0;
      const cl = ceilings[k] || 100;
      w[k] = Math.max(fl, Math.min(cl, w[k]));
      sum += w[k];
    }

    if (Math.abs(sum - 100) < 0.0001) {
      converged = true;
      break;
    }

    // 2. Adjust non-clamped values
    const diff = 100 - sum;
    const adjustableKeys = keys.filter(k => {
      if (diff > 0) return w[k] < (ceilings[k] || 100);
      return w[k] > (floors[k] || 0);
    });

    if (adjustableKeys.length === 0) {
      break; // All values clamped, cannot adjust further
    }

    // Distribute the difference proportionally among adjustable layers
    const adjustShare = diff / adjustableKeys.length;
    for (const k of adjustableKeys) {
      w[k] += adjustShare;
    }
  }

  // Final check and round to 4 decimal places
  let finalSum = 0;
  for (const k of keys) {
    w[k] = Math.round(w[k] * 10000) / 10000;
    finalSum += w[k];
  }

  // Force exact sum to 100 on the largest adjustable element
  const finalDiff = 100 - finalSum;
  if (Math.abs(finalDiff) > 0) {
    const largestKey = keys.reduce((a, b) => w[a] > w[b] ? a : b);
    w[largestKey] = Math.round((w[largestKey] + finalDiff) * 10000) / 10000;
  }

  // Validate sum is exactly 100.00
  let doubleCheckSum = 0;
  for (const k of keys) {
    doubleCheckSum += w[k];
  }

  if (Math.abs(doubleCheckSum - 100) > 0.0001) {
    logEvent('L25_DIRICHLET_MUTED_DIVERGENT_CALIBRATION_CYCLE_REVERTING_TO_STATIC', 'WARN',
      'Bounded normalization did not converge to exactly 100%, reverting to baseline.',
      { finalSum: doubleCheckSum });
    return null;
  }

  return w;
}

/**
 * Blends static and calibrated weights using learning coefficient lambda.
 *
 * @param {Object} staticWeights
 * @param {Object} calibratedWeights
 * @param {number} lambda
 * @returns {Object} blendedWeights
 */
function blendWeights(staticWeights, calibratedWeights, lambda) {
  const blended = {};
  for (const k of Object.keys(staticWeights)) {
    if (k === 'layer12_risk') {
      blended[k] = 0;
      continue;
    }
    const statVal = staticWeights[k] || 0;
    const calVal = calibratedWeights[k] || statVal;
    blended[k] = (1 - lambda) * statVal + lambda * calVal;
  }

  // Re-normalize to ensure exactly 100%
  let sum = 0;
  for (const k of Object.keys(blended)) {
    if (k === 'layer12_risk') continue;
    sum += blended[k];
  }

  if (sum > 0) {
    for (const k of Object.keys(blended)) {
      if (k === 'layer12_risk') continue;
      blended[k] = Math.round((blended[k] / sum) * 100 * 10000) / 10000;
    }
  }

  // Fix exact rounding diff
  let roundedSum = 0;
  for (const k of Object.keys(blended)) {
    if (k === 'layer12_risk') continue;
    roundedSum += blended[k];
  }
  const diff = 100 - roundedSum;
  if (Math.abs(diff) > 0) {
    const activeKeys = Object.keys(blended).filter(k => k !== 'layer12_risk');
    const firstKey = activeKeys[0];
    blended[firstKey] = Math.round((blended[firstKey] + diff) * 10000) / 10000;
  }

  return blended;
}

/**
 * Calibrates static weights using trade history and walk-forward results.
 *
 * @param {Object} params
 * @param {Object} params.staticWeights - Current static weight priors
 * @param {Object[]} params.tradeHistory - Array of closed trade objects
 * @param {number} params.wfeScore - Walk-Forward Efficiency (WFE) score from Layer 26
 * @param {Object} [params.dirichletMultipliers] - Custom multipliers per layer
 * @param {Object} [params.ceilingHitStreak] - Current count of consecutive hits at 30% ceiling
 * @param {string} [params.engineUpgradeDate] - PIT start date for trade filtration
 * @returns {Object} result
 */
function calibrateWeights({
  staticWeights,
  tradeHistory,
  wfeScore,
  dirichletMultipliers = {},
  ceilingHitStreak = {},
  engineUpgradeDate = null
}) {
  const result = {
    calibratedWeights: { ...staticWeights },
    lambda: 0,
    newCeilingHitStreak: { ...ceilingHitStreak },
    shouldReset: false,
    driftAlerts: []
  };

  // Filter trade history based on engine upgrade date
  let filteredTrades = tradeHistory || [];
  if (engineUpgradeDate) {
    const upgradeTime = new Date(engineUpgradeDate).getTime();
    filteredTrades = filteredTrades.filter(t => t.exit_ts && new Date(t.exit_ts).getTime() >= upgradeTime);
  }

  const tradeCount = filteredTrades.length;

  // 1. Guard: Check minimum trade sample
  if (tradeCount < 130) {
    logEvent('INSUFFICIENT_TRADE_HISTORY_FOR_SELF_LEARNING', 'INFO',
      `Insufficient trade count (${tradeCount} < 130) to perform self-learning. Using static weights.`,
      { tradeCount });
    return result;
  }

  // 2. Compute WFE coefficient
  let wfeCoefficient = 0.00;
  if (wfeScore > 0.70) {
    wfeCoefficient = 1.00;
  } else if (wfeScore >= 0.55) {
    wfeCoefficient = 0.70;
  } else {
    wfeCoefficient = 0.00;
  }

  // Learning rate lambda
  const lambda = Math.min(1.0, tradeCount / 100) * wfeCoefficient;
  result.lambda = +lambda.toFixed(4);

  if (lambda === 0) {
    logEvent('L25_CALIBRATION_SKIPPED_LAMBDA_ZERO', 'INFO',
      `Learning rate lambda is 0 (WFE score: ${wfeScore}). Retaining static weights.`,
      { tradeCount, wfeScore, wfeCoefficient });
    return result;
  }

  // 3. Calculate Directional Conviction Accuracy (DCA) per layer
  // Extract layer scores from trade records
  const layerKeys = Object.keys(staticWeights).filter(k => k !== 'layer12_risk');
  const layerCorrectCount = {};
  const layerTotalCount = {};

  for (const k of layerKeys) {
    layerCorrectCount[k] = 0;
    layerTotalCount[k] = 0;
  }

  for (const trade of filteredTrades) {
    // Determine trade actual direction
    const entry = Number(trade.entry_price);
    const exit = Number(trade.exit_price);
    if (!entry || !exit || entry === exit) continue;
    const actualDirection = exit > entry ? 'UP' : 'DOWN';

    // Parse layer scores from JSON
    let lScores = {};
    if (typeof trade.json === 'object' && trade.json !== null) {
      lScores = trade.json.layer_scores || trade.json.layer_scores_json || {};
    } else if (typeof trade.layer_scores_json === 'object' && trade.layer_scores_json !== null) {
      lScores = trade.layer_scores_json;
    } else if (typeof trade.json === 'string') {
      try {
        const parsed = JSON.parse(trade.json);
        lScores = parsed.layer_scores || parsed.layer_scores_json || {};
      } catch (e) {}
    }

    for (const k of layerKeys) {
      const score = lScores[k];
      if (score == null) {
        // Default historical missing scores to 0.50 (DCA neutral)
        layerTotalCount[k]++;
        layerCorrectCount[k] += 0.5; // half credit / neutral
        continue;
      }

      const predictedDirection = score > 50 ? 'UP' : (score < 50 ? 'DOWN' : 'NEUTRAL');
      if (predictedDirection === 'NEUTRAL') continue;

      layerTotalCount[k]++;
      if (predictedDirection === actualDirection) {
        layerCorrectCount[k]++;
      }
    }
  }

  // Compute final DCA per layer
  const dca = {};
  for (const k of layerKeys) {
    const total = layerTotalCount[k] || 0;
    dca[k] = total > 0 ? (layerCorrectCount[k] / total) : 0.50; // Default to neutral if no signals
  }

  // 4. Run Dirichlet Prior Update
  // alpha_i = w_i * dirichlet_multiplier
  // updated_alpha_i = alpha_i + DCA_i
  // normalized_weight_i = updated_alpha_i / sum(updated_alpha)
  const dirichletWeights = {};
  let totalUpdatedAlpha = 0;
  const alphas = {};

  for (const k of layerKeys) {
    const staticW = staticWeights[k] || 0;
    // Default multiplier is 10, but L19/L20 have a multiplier of 20
    let mult = dirichletMultipliers[k] ?? 10;
    if (k === 'layer19_promoter_pledge' || k === 'layer20_earnings_quality') {
      mult = dirichletMultipliers[k] ?? 20;
    }

    const alpha = staticW * mult;
    const updatedAlpha = alpha + dca[k];
    alphas[k] = updatedAlpha;
    totalUpdatedAlpha += updatedAlpha;
  }

  for (const k of layerKeys) {
    dirichletWeights[k] = (alphas[k] / totalUpdatedAlpha) * 100;
  }

  // 5. Establish Floors and Ceilings
  const floors = {};
  const ceilings = {};
  for (const k of layerKeys) {
    const staticW = staticWeights[k] || 0;
    // Active layers: staticWeight > 1% (or active keys) get 2% floor. Inactive layers get 1% floor.
    const isInactive = staticW <= 1;
    floors[k] = isInactive ? 1.0 : 2.0;
    ceilings[k] = 30.0; // Max 30% ceiling per layer
  }

  // 6. Iterative Normalization
  let normalizedCalibrated = iterativeBoundedNormalize(dirichletWeights, floors, ceilings, 30);
  if (!normalizedCalibrated) {
    // If convergence fails, use static weights
    return result;
  }

  // 7. Enforce max shift per calibration cycle (max ±3% from static weights)
  // Ensure that no layer shifts by more than ±3% from the static baseline in the calibrated weight
  let shiftNeedsRenormalization = false;
  for (const k of layerKeys) {
    const staticW = staticWeights[k] || 0;
    const diff = normalizedCalibrated[k] - staticW;
    if (Math.abs(diff) > 3.0) {
      normalizedCalibrated[k] = staticW + Math.sign(diff) * 3.0;
      shiftNeedsRenormalization = true;
    }
  }

  if (shiftNeedsRenormalization) {
    // Renormalize to ensure sum to 100 after applying shift limits
    normalizedCalibrated = iterativeBoundedNormalize(normalizedCalibrated, floors, ceilings, 30);
    if (!normalizedCalibrated) {
      return result;
    }
  }

  // 8. Blend calibrated and static weights
  const finalWeights = blendWeights(staticWeights, normalizedCalibrated, lambda);

  // 9. Ceiling Streak Tracking & Reset check
  let shouldReset = false;
  const newCeilingHitStreak = { ...ceilingHitStreak };

  for (const k of layerKeys) {
    // Check if calibrated weight hit the 30% ceiling
    if (normalizedCalibrated[k] >= 30.0) {
      newCeilingHitStreak[k] = (newCeilingHitStreak[k] || 0) + 1;
      if (newCeilingHitStreak[k] >= 3) {
        shouldReset = true;
        logEvent('SYSTEM_WEIGHTS_RESET_ALERT', 'ERROR',
          `Layer ${k} has hit the 30% ceiling for 3 consecutive cycles. Triggering static weights reset.`,
          { layer: k, streak: newCeilingHitStreak[k] });
      }
    } else {
      // Reset streak if it drops below ceiling
      newCeilingHitStreak[k] = 0;
    }
  }

  // 10. Cumulative weight drift check: |w_calibrated - w_static| > 8% for any layer
  const driftAlerts = [];
  for (const k of layerKeys) {
    const staticW = staticWeights[k] || 0;
    const diff = Math.abs(normalizedCalibrated[k] - staticW);
    if (diff > 8.0) {
      driftAlerts.push(k);
      logEvent('HIGH_CUMULATIVE_WEIGHT_DRIFT_ALERT', 'WARN',
        `Cumulative weight drift for layer ${k} exceeds 8% limit (drift: ${diff.toFixed(2)}%)`,
        { layer: k, drift: diff });
    }
  }

  result.calibratedWeights = finalWeights;
  result.newCeilingHitStreak = newCeilingHitStreak;
  result.shouldReset = shouldReset;
  result.driftAlerts = driftAlerts;

  return result;
}

module.exports = {
  calibrateWeights,
  iterativeBoundedNormalize,
  blendWeights
};
