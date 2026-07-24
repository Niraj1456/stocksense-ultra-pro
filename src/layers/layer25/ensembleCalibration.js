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
// ═══════════════ SELF-LEARNING UPGRADE ═══════════════════════════════════
// Now supports:
//   - EWMA-Weighted DCA: Recent trades weighted higher (λ^k decay)
//   - Profit-Weighted DCA: Accuracy weighted by return magnitude
//   - Kelly Criterion Lambda: Optimal learning rate from win/loss ratios
//   - KL-Divergence Monitoring: Statistical drift detection
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
const {
  EWMA_LAMBDA,
  KL_DIVERGENCE_MODERATE,
  KL_DIVERGENCE_SEVERE
} = require('../../config/mathConstants');

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

// ═══════════════════════════════════════════════════════════════════════════
// SELF-LEARNING UPGRADE: NEW ALGORITHM FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Computes EWMA-Weighted Directional Conviction Accuracy per layer.
 * Recent trades are weighted exponentially higher than older trades.
 *
 * Formula: EWMA_DCA_i = Σ(λ^k × correct_k) / Σ(λ^k)
 * where k = recency index (0 = most recent), λ = decay factor (default 0.97)
 * Halflife ≈ ln(0.5) / ln(λ) ≈ 23 trades for λ=0.97
 *
 * @param {Object[]} sortedTrades - Trades sorted by exit_ts DESCENDING (most recent first)
 * @param {string[]} layerKeys - Layer keys to compute DCA for
 * @param {number} [lambda] - EWMA decay factor (default from mathConstants)
 * @returns {Object} { layer1_macro: 0.62, layer2_microstructure: 0.71, ... }
 */
function computeEWMA_DCA(sortedTrades, layerKeys, lambda = null) {
  const ewmaLambda = lambda ?? EWMA_LAMBDA;
  const ewmaDCA = {};

  for (const key of layerKeys) {
    let correctWeightedSum = 0;
    let totalWeightedSum = 0;

    for (let k = 0; k < sortedTrades.length; k++) {
      const trade = sortedTrades[k];
      const entry = Number(trade.entry_price);
      const exit = Number(trade.exit_price);

      if (!entry || !exit || entry === exit) continue;

      const actualDirection = exit > entry ? 'UP' : 'DOWN';

      // Parse layer scores
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

      const score = lScores[key];
      const decayWeight = Math.pow(ewmaLambda, k);

      if (score == null) {
        // Missing score → 0.5 credit (neutral)
        correctWeightedSum += 0.5 * decayWeight;
        totalWeightedSum += decayWeight;
        continue;
      }

      const predictedDirection = score > 50 ? 'UP' : (score < 50 ? 'DOWN' : 'NEUTRAL');
      if (predictedDirection === 'NEUTRAL') continue;

      const correct = predictedDirection === actualDirection ? 1 : 0;
      correctWeightedSum += correct * decayWeight;
      totalWeightedSum += decayWeight;
    }

    ewmaDCA[key] = totalWeightedSum > 0 ? correctWeightedSum / totalWeightedSum : 0.50;
  }

  return ewmaDCA;
}

/**
 * Computes Profit-Weighted DCA per layer.
 * Weights each accuracy observation by the MAGNITUDE of the trade return.
 * A layer correctly predicting a +5% move gets 50× more credit than one
 * correct on a +0.1% move.
 *
 * Formula: PWDCA_i = Σ(λ^k × correct_k × |return_k|) / Σ(λ^k × |return_k|)
 *
 * @param {Object[]} sortedTrades - Trades sorted by exit_ts DESCENDING
 * @param {string[]} layerKeys - Layer keys to compute PWDCA for
 * @param {number} [lambda] - EWMA decay factor
 * @returns {Object} { layer1_macro: 0.71, layer2_microstructure: 0.68, ... }
 */
function computeProfitWeightedDCA(sortedTrades, layerKeys, lambda = null) {
  const ewmaLambda = lambda ?? EWMA_LAMBDA;
  const pwDCA = {};

  for (const key of layerKeys) {
    let correctWeightedSum = 0;
    let totalWeightedSum = 0;

    for (let k = 0; k < sortedTrades.length; k++) {
      const trade = sortedTrades[k];
      const entry = Number(trade.entry_price);
      const exit = Number(trade.exit_price);

      if (!entry || !exit || entry === exit) continue;

      const actualDirection = exit > entry ? 'UP' : 'DOWN';
      const returnMagnitude = Math.abs((exit - entry) / entry);

      // Skip negligible moves (< 0.01% — effectively noise)
      if (returnMagnitude < 0.0001) continue;

      // Parse layer scores
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

      const score = lScores[key];
      if (score == null) continue; // Skip missing scores for profit-weighting (no neutral credit)

      const predictedDirection = score > 50 ? 'UP' : (score < 50 ? 'DOWN' : 'NEUTRAL');
      if (predictedDirection === 'NEUTRAL') continue;

      const correct = predictedDirection === actualDirection ? 1 : 0;
      const decayWeight = Math.pow(ewmaLambda, k);
      const profitWeight = decayWeight * returnMagnitude;

      correctWeightedSum += correct * profitWeight;
      totalWeightedSum += profitWeight;
    }

    pwDCA[key] = totalWeightedSum > 0 ? correctWeightedSum / totalWeightedSum : 0.50;
  }

  return pwDCA;
}

/**
 * Computes the effective DCA by blending EWMA-DCA and Profit-Weighted DCA.
 * 60% profit-weighted (what makes money) + 40% EWMA directional (stability).
 *
 * @param {Object} ewmaDCA - EWMA-weighted DCA per layer
 * @param {Object} profitWeightedDCA - Profit-weighted DCA per layer
 * @param {string[]} layerKeys - Layer keys
 * @param {number} [pwBlend=0.6] - Weight for profit-weighted component
 * @returns {Object} Blended effective DCA per layer
 */
function computeEffectiveDCA(ewmaDCA, profitWeightedDCA, layerKeys, pwBlend = 0.6) {
  const effectiveDCA = {};
  const ewmaBlend = 1 - pwBlend;

  for (const key of layerKeys) {
    const ewma = ewmaDCA[key] ?? 0.50;
    const pw = profitWeightedDCA[key] ?? 0.50;
    effectiveDCA[key] = Math.round((pwBlend * pw + ewmaBlend * ewma) * 10000) / 10000;
  }

  return effectiveDCA;
}

/**
 * Computes Kelly Criterion optimal learning rate (lambda).
 * Replaces the heuristic min(1, trades/100) × WFE formula.
 *
 * Kelly_f = (p × b - q) / b
 * where:
 *   p = win rate (fraction of profitable trades)
 *   q = 1 - p (fraction of losing trades)
 *   b = average win / average loss (payoff ratio)
 *
 * Half-Kelly: λ = Kelly_f / 2 (reduces variance by 50%, retains 75% of growth)
 * Quarter-Kelly: λ = Kelly_f / 4 (ultra-conservative)
 *
 * @param {Object[]} trades - Closed trades with entry_price and exit_price
 * @param {number} wfeCoefficient - Walk-Forward Efficiency coefficient (0-1)
 * @param {string} [kellyMode='HALF'] - 'HALF', 'QUARTER', or 'DISABLED'
 * @returns {{ kellyLambda: number, kellyF: number, winRate: number, payoffRatio: number }}
 */
function computeKellyLambda(trades, wfeCoefficient, kellyMode = 'HALF') {
  if (kellyMode === 'DISABLED' || !trades || trades.length < 30) {
    return {
      kellyLambda: Math.min(1.0, (trades ? trades.length : 0) / 100) * wfeCoefficient, // fallback to heuristic
      kellyF: 0,
      winRate: 0,
      payoffRatio: 0
    };
  }

  let wins = 0;
  let losses = 0;
  let totalWinReturn = 0;
  let totalLossReturn = 0;

  for (const trade of trades) {
    const entry = Number(trade.entry_price);
    const exit = Number(trade.exit_price);
    if (!entry || !exit || entry === exit) continue;

    const returnPct = (exit - entry) / entry;

    if (returnPct > 0) {
      wins++;
      totalWinReturn += returnPct;
    } else {
      losses++;
      totalLossReturn += Math.abs(returnPct);
    }
  }

  if (wins === 0 || losses === 0) {
    // Edge case: all wins or all losses → use heuristic
    return {
      kellyLambda: Math.min(1.0, trades.length / 100) * wfeCoefficient,
      kellyF: 0,
      winRate: wins / (wins + losses || 1),
      payoffRatio: 0
    };
  }

  const p = wins / (wins + losses);
  const q = 1 - p;
  const avgWin = totalWinReturn / wins;
  const avgLoss = totalLossReturn / losses;
  const b = avgWin / (avgLoss || 0.0001); // Payoff ratio

  // Kelly fraction
  const kellyF = (p * b - q) / b;

  // If Kelly is negative, the edge is against us → force lambda to 0 (static weights)
  if (kellyF <= 0) {
    logEvent('L25_KELLY_NEGATIVE_EDGE', 'WARN',
      `Kelly criterion yields negative edge (f=${kellyF.toFixed(4)}). Forcing static weights.`,
      { kellyF: +kellyF.toFixed(4), winRate: +p.toFixed(4), payoffRatio: +b.toFixed(4) });
    return {
      kellyLambda: 0,
      kellyF: +kellyF.toFixed(4),
      winRate: +p.toFixed(4),
      payoffRatio: +b.toFixed(4)
    };
  }

  // Fractional Kelly
  let fraction;
  switch (kellyMode) {
    case 'QUARTER':
      fraction = 0.25;
      break;
    case 'HALF':
    default:
      fraction = 0.50;
      break;
  }

  // Apply fractional Kelly × WFE coefficient
  const kellyLambda = Math.min(1.0, kellyF * fraction) * wfeCoefficient;

  return {
    kellyLambda: Math.round(kellyLambda * 10000) / 10000,
    kellyF: Math.round(kellyF * 10000) / 10000,
    winRate: Math.round(p * 10000) / 10000,
    payoffRatio: Math.round(b * 10000) / 10000
  };
}

/**
 * Computes KL-Divergence between calibrated and static weight distributions.
 * Measures how far the calibrated weights have drifted from the static baseline.
 *
 * D_KL(P || Q) = Σ P_i × ln(P_i / Q_i)
 * where P = calibrated weight distribution, Q = static weight distribution
 *
 * Alert thresholds:
 *   < 0.05  → NORMAL (minor drift, expected)
 *   0.05-0.15 → MODERATE (significant drift, worth monitoring)
 *   > 0.15  → SEVERE (extreme drift, possible overfitting or regime change)
 *
 * @param {Object} calibratedWeights - Normalized calibrated weights (sum to 100)
 * @param {Object} staticWeights - Normalized static weights (sum to 100)
 * @returns {{ klDivergence: number, tier: string, driftingLayers: string[] }}
 */
function computeKLDivergence(calibratedWeights, staticWeights) {
  if (!calibratedWeights || !staticWeights) {
    return { klDivergence: 0, tier: 'NORMAL', driftingLayers: [] };
  }

  const layerKeys = Object.keys(staticWeights).filter(k => k !== 'layer12_risk');
  let kl = 0;
  const driftingLayers = [];

  for (const k of layerKeys) {
    const p = (calibratedWeights[k] || 0.001) / 100; // Normalize to probability
    const q = (staticWeights[k] || 0.001) / 100;

    // Avoid log(0) by clamping both distributions
    const pClamped = Math.max(p, 1e-6);
    const qClamped = Math.max(q, 1e-6);

    const layerKL = pClamped * Math.log(pClamped / qClamped);
    kl += layerKL;

    // Track individual layers with high drift contribution
    if (Math.abs(layerKL) > 0.01) {
      driftingLayers.push(k);
    }
  }

  // Ensure non-negative (numerical precision)
  kl = Math.max(0, kl);

  let tier;
  if (kl >= KL_DIVERGENCE_SEVERE) {
    tier = 'SEVERE';
    logEvent('L25_KL_DIVERGENCE_SEVERE', 'WARN',
      `KL-Divergence is SEVERE (${kl.toFixed(4)} ≥ ${KL_DIVERGENCE_SEVERE}). Calibrated weights have drifted far from baseline.`,
      { klDivergence: +kl.toFixed(4), driftingLayers });
  } else if (kl >= KL_DIVERGENCE_MODERATE) {
    tier = 'MODERATE';
    logEvent('L25_KL_DIVERGENCE_MODERATE', 'INFO',
      `KL-Divergence is MODERATE (${kl.toFixed(4)}). Some weight drift detected.`,
      { klDivergence: +kl.toFixed(4), driftingLayers });
  } else {
    tier = 'NORMAL';
  }

  return {
    klDivergence: Math.round(kl * 10000) / 10000,
    tier,
    driftingLayers
  };
}

/**
 * Calibrates static weights using trade history and walk-forward results.
 * This is the enhanced version with EWMA-DCA, Profit-Weighted DCA, and Kelly lambda.
 *
 * @param {Object} params
 * @param {Object} params.staticWeights - Current static weight priors
 * @param {Object[]} params.tradeHistory - Array of closed trade objects
 * @param {number} params.wfeScore - Walk-Forward Efficiency (WFE) score from Layer 26
 * @param {Object} [params.dirichletMultipliers] - Custom multipliers per layer
 * @param {Object} [params.ceilingHitStreak] - Current count of consecutive hits at 30% ceiling
 * @param {string} [params.engineUpgradeDate] - PIT start date for trade filtration
 * @param {boolean} [params.ewmaEnabled=true] - Enable EWMA-weighted DCA
 * @param {number} [params.ewmaLambda] - EWMA decay factor override
 * @param {string} [params.kellyMode='HALF'] - Kelly sizing: 'HALF', 'QUARTER', 'DISABLED'
 * @param {number} [params.wfeCoefficient] - Pre-computed WFE coefficient (if using smooth sigmoid)
 * @returns {Object} result
 */
function calibrateWeights({
  staticWeights,
  tradeHistory,
  wfeScore,
  dirichletMultipliers = {},
  ceilingHitStreak = {},
  engineUpgradeDate = null,
  ewmaEnabled = true,
  ewmaLambda = null,
  kellyMode = 'HALF',
  wfeCoefficient = null
}) {
  const result = {
    calibratedWeights: { ...staticWeights },
    lambda: 0,
    newCeilingHitStreak: { ...ceilingHitStreak },
    shouldReset: false,
    driftAlerts: [],
    // ── NEW DIAGNOSTICS ──────────────────────────────────────────────
    diagnostics: {
      ewmaDCA: null,
      profitWeightedDCA: null,
      effectiveDCA: null,
      kellyResult: null,
      klDivergence: null,
      algorithmStatus: {
        ewmaDCA: ewmaEnabled ? 'ACTIVE' : 'DISABLED',
        profitWeightedDCA: ewmaEnabled ? 'ACTIVE' : 'DISABLED',
        kellyCriterion: kellyMode !== 'DISABLED' ? kellyMode : 'DISABLED',
        klDivergence: 'MONITORING'
      }
    }
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

  // 2. Compute WFE coefficient (use pre-computed smooth sigmoid if provided)
  let wfeCoeff = wfeCoefficient;
  if (wfeCoeff == null) {
    // Fallback to legacy discrete mapping if smooth coefficient not provided
    if (wfeScore > 0.70) {
      wfeCoeff = 1.00;
    } else if (wfeScore >= 0.55) {
      wfeCoeff = 0.70;
    } else {
      wfeCoeff = 0.00;
    }
  }

  // 3. Compute learning rate lambda using Kelly Criterion or heuristic
  const kellyResult = computeKellyLambda(filteredTrades, wfeCoeff, kellyMode);
  const lambda = kellyResult.kellyLambda;
  result.lambda = +lambda.toFixed(4);
  result.diagnostics.kellyResult = kellyResult;

  if (lambda === 0) {
    logEvent('L25_CALIBRATION_SKIPPED_LAMBDA_ZERO', 'INFO',
      `Learning rate lambda is 0 (WFE score: ${wfeScore}, Kelly: ${kellyResult.kellyF}). Retaining static weights.`,
      { tradeCount, wfeScore, wfeCoeff, kellyMode, kellyF: kellyResult.kellyF });
    return result;
  }

  // 4. Calculate DCA per layer (EWMA-weighted + Profit-weighted or flat)
  const layerKeys = Object.keys(staticWeights).filter(k => k !== 'layer12_risk');

  // Sort trades by exit_ts descending for EWMA weighting
  const sortedTrades = [...filteredTrades]
    .filter(t => t.exit_ts)
    .sort((a, b) => new Date(b.exit_ts) - new Date(a.exit_ts));

  let dca;

  if (ewmaEnabled && sortedTrades.length >= 30) {
    // ── UPGRADED PATH: EWMA + Profit-Weighted DCA ────────────────
    const ewmaDCA = computeEWMA_DCA(sortedTrades, layerKeys, ewmaLambda);
    const profitWeightedDCA = computeProfitWeightedDCA(sortedTrades, layerKeys, ewmaLambda);
    const effectiveDCA = computeEffectiveDCA(ewmaDCA, profitWeightedDCA, layerKeys);

    dca = effectiveDCA;

    result.diagnostics.ewmaDCA = ewmaDCA;
    result.diagnostics.profitWeightedDCA = profitWeightedDCA;
    result.diagnostics.effectiveDCA = effectiveDCA;

    logEvent('L25_EWMA_DCA_COMPUTED', 'INFO',
      `EWMA+PW DCA computed over ${sortedTrades.length} sorted trades (λ=${ewmaLambda ?? EWMA_LAMBDA})`,
      { tradeCount: sortedTrades.length });
  } else {
    // ── LEGACY PATH: Flat DCA (original algorithm) ───────────────
    const layerCorrectCount = {};
    const layerTotalCount = {};

    for (const k of layerKeys) {
      layerCorrectCount[k] = 0;
      layerTotalCount[k] = 0;
    }

    for (const trade of filteredTrades) {
      const entry = Number(trade.entry_price);
      const exit = Number(trade.exit_price);
      if (!entry || !exit || entry === exit) continue;
      const actualDirection = exit > entry ? 'UP' : 'DOWN';

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
          layerTotalCount[k]++;
          layerCorrectCount[k] += 0.5;
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

    dca = {};
    for (const k of layerKeys) {
      const total = layerTotalCount[k] || 0;
      dca[k] = total > 0 ? (layerCorrectCount[k] / total) : 0.50;
    }

    result.diagnostics.algorithmStatus.ewmaDCA = 'DISABLED';
    result.diagnostics.algorithmStatus.profitWeightedDCA = 'DISABLED';
  }

  // 5. Run Dirichlet Prior Update (using the computed DCA — flat or effective)
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

  // 6. Establish Floors and Ceilings
  const floors = {};
  const ceilings = {};
  for (const k of layerKeys) {
    const staticW = staticWeights[k] || 0;
    // Active layers: staticWeight > 1% (or active keys) get 2% floor. Inactive layers get 1% floor.
    const isInactive = staticW <= 1;
    floors[k] = isInactive ? 1.0 : 2.0;
    ceilings[k] = 30.0; // Max 30% ceiling per layer
  }

  // 7. Iterative Normalization
  let normalizedCalibrated = iterativeBoundedNormalize(dirichletWeights, floors, ceilings, 30);
  if (!normalizedCalibrated) {
    // If convergence fails, use static weights
    return result;
  }

  // 8. Enforce max shift per calibration cycle (max ±3% from static weights)
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

  // 9. Blend calibrated and static weights
  const finalWeights = blendWeights(staticWeights, normalizedCalibrated, lambda);

  // 10. Ceiling Streak Tracking & Reset check
  let shouldReset = false;
  const newCeilingHitStreak = { ...ceilingHitStreak };

  for (const k of layerKeys) {
    // Check if calibrated weight hit the 30% ceiling (with tiny rounding tolerance)
    if (normalizedCalibrated[k] >= 29.99) {
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

  // 11. Cumulative weight drift check: |w_calibrated - w_static| > 8% for any layer
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

  // 12. KL-Divergence monitoring (NEW)
  const klResult = computeKLDivergence(normalizedCalibrated, staticWeights);
  result.diagnostics.klDivergence = klResult;

  result.calibratedWeights = finalWeights;
  result.newCeilingHitStreak = newCeilingHitStreak;
  result.shouldReset = shouldReset;
  result.driftAlerts = driftAlerts;

  return result;
}

module.exports = {
  calibrateWeights,
  iterativeBoundedNormalize,
  blendWeights,
  computeEWMA_DCA,
  computeProfitWeightedDCA,
  computeEffectiveDCA,
  computeKellyLambda,
  computeKLDivergence
};
