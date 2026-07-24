// ═══════════════════════════════════════════════════════════════════════════
// LAYER 26 — WALK-FORWARD OPTIMIZATION ENGINE
// Out-of-sample validation engine that segregates trade history into
// rolling in-sample / out-of-sample windows, computes Sharpe ratios,
// and derives the Walk-Forward Efficiency (WFE) coefficient used by
// Layer 25's Dirichlet weight calibration.
//
// Provides alpha-decay detection with automatic FATAL veto when the
// strategy's out-of-sample edge degrades beyond recoverable thresholds.
// ═══════════════════════════════════════════════════════════════════════════

const {
  SHARPE_EPSILON,
  WFE_SIGMOID_K,
  WFE_SIGMOID_MIDPOINT,
  SORTINO_EPSILON,
  BOCD_HAZARD_RATE
} = require("../../config/mathConstants");

// ── CONSTANTS ────────────────────────────────────────────────────────────
/** Minimum closed trades required before walk-forward analysis activates */
const MIN_TRADES_FOR_WF = 130;

/** Default rolling window sizes */
const DEFAULT_WINDOW_SIZE = 130;
const DEFAULT_STEP_SIZE = 50;

/** Alpha decay thresholds */
const DECAY_RATE_VETO_THRESHOLD = -0.15;
const CONSECUTIVE_DECAY_VETO_COUNT = 3;

/** Maximum staleness for intraday window (days) */
const DEFAULT_MAX_WINDOW_TIMESPAN_DAYS = 180;

// ── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Computes the arithmetic mean of an array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Computes sample standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * Structured log entry generator.
 * @param {string} eventCode
 * @param {string} severity - INFO | WARN | HIGH | FATAL
 * @param {string} message
 * @param {object} [details]
 * @returns {object}
 */
function logEntry(eventCode, severity, message, details = {}) {
  return {
    timestamp: new Date().toISOString(),
    layer_id: "L26",
    event_code: eventCode,
    severity,
    message,
    details,
  };
}

/**
 * Calculates average holding days from an array of trade objects.
 * Each trade should have entryDate and exitDate (ISO strings or Date objects).
 * @param {object[]} trades
 * @returns {number}
 */
function averageHoldingDays(trades) {
  if (!trades || trades.length === 0) return 5;
  let totalDays = 0;
  let counted = 0;
  for (const t of trades) {
    if (t.entryDate && t.exitDate) {
      const entry = new Date(t.entryDate);
      const exit = new Date(t.exitDate);
      const diffMs = exit.getTime() - entry.getTime();
      if (diffMs >= 0) {
        totalDays += diffMs / (1000 * 60 * 60 * 24);
        counted++;
      }
    }
  }
  return counted > 0 ? totalDays / counted : 5;
}

/**
 * Extracts percentage returns from an array of trade objects.
 * Each trade should have a `returnPct` field (e.g. 2.5 for +2.5%).
 * Falls back to computing from entryPrice / exitPrice if available.
 * @param {object[]} trades
 * @returns {number[]}
 */
function extractReturns(trades) {
  if (!trades || trades.length === 0) return [];
  return trades.map((t) => {
    if (t.returnPct != null) return t.returnPct / 100;
    if (t.entryPrice && t.exitPrice && t.entryPrice > 0) {
      return (t.exitPrice - t.entryPrice) / t.entryPrice;
    }
    return 0;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 26.1 — SHARPE RATIO CALCULATOR
// Computes annualised Sharpe ratio: (mean_R - 0) / (stdDev_R + ε) × SF
// Risk-free rate assumed zero (standard for relative comparison).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Computes annualized Sharpe ratio for a series of returns.
 *
 * @param {number[]} returns - Array of per-trade (or per-period) return values
 * @param {number} scaleFactor - Annualization factor
 *   - Intraday mode: 252
 *   - Investment mode: sqrt(252 / max(5, avgHoldingDays))
 * @returns {number} Annualized Sharpe ratio
 */
function computeSharpe(returns, scaleFactor) {
  // Graceful null/empty handling → 0 Sharpe
  if (!returns || returns.length === 0) return 0;
  if (scaleFactor == null || scaleFactor <= 0) scaleFactor = 1;

  const meanR = mean(returns);
  const stdR = stddev(returns);
  const rawSharpe = meanR / (stdR + SHARPE_EPSILON);

  return rawSharpe * scaleFactor;
}

/**
 * Computes annualized Sortino ratio for a series of returns.
 * Sortino = mean(R) / (DownsideDeviation + ε) × ScaleFactor
 * DownsideDeviation = sqrt(Σ min(R_i, 0)² / N)
 * Only counts negative returns for the denominator.
 *
 * @param {number[]} returns
 * @param {number} scaleFactor
 * @returns {number}
 */
function computeSortino(returns, scaleFactor) {
  if (!returns || returns.length === 0) return 0;
  if (scaleFactor == null || scaleFactor <= 0) scaleFactor = 1;
  
  const meanR = mean(returns);
  const downsideReturns = returns.filter(r => r < 0);
  const downsideDev = downsideReturns.length > 0 
    ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / returns.length)
    : 0;
  
  return (meanR / (downsideDev + SORTINO_EPSILON)) * scaleFactor;
}

/**
 * Bayesian Online Changepoint Detection (Adams & MacKay, 2007).
 * Detects the exact point where OOS return statistical properties change.
 * Uses Gaussian likelihood with online sufficient statistics.
 *
 * @param {number[]} observations - OOS returns or OOS Sharpe values per window
 * @param {number} hazardRate - Prior probability of changepoint per observation (default: 0.005)
 * @returns {{ changePointDetected: boolean, changePointIndex: number|null, confidence: number, maxRunLength: number }}
 */
function bayesianChangePointDetection(observations, hazardRate) {
  if (!observations || observations.length < 3) {
    return { changePointDetected: false, changePointIndex: null, confidence: 0, maxRunLength: observations ? observations.length : 0 };
  }
  if (hazardRate == null || hazardRate <= 0) hazardRate = BOCD_HAZARD_RATE;
  
  const n = observations.length;
  // Run-length probability vector: P(r_t | x_{1:t})
  // r=0 means 'changepoint just happened', r=k means 'k observations since last changepoint'
  let runLengthProbs = new Float64Array(n + 1);
  runLengthProbs[0] = 1.0; // Start with run length 0
  
  // Sufficient statistics for Gaussian predictive likelihood
  // For each possible run length, maintain (count, sum, sumSq)
  let counts = new Float64Array(n + 1);
  let sums = new Float64Array(n + 1);
  let sumSqs = new Float64Array(n + 1);
  
  // Prior hyperparameters for Normal-Inverse-Gamma
  const mu0 = 0;
  const kappa0 = 1;
  const alpha0 = 1;
  const beta0 = 1;
  
  let bestChangePointIdx = null;
  let bestChangePointConf = 0;
  
  for (let t = 0; t < n; t++) {
    const x = observations[t];
    const newRunLengthProbs = new Float64Array(n + 1);
    const newCounts = new Float64Array(n + 1);
    const newSums = new Float64Array(n + 1);
    const newSumSqs = new Float64Array(n + 1);
    
    // Growth probabilities: P(r_t = r_{t-1} + 1 | ...)
    let growthSum = 0;
    for (let r = 0; r <= t; r++) {
      // Compute predictive probability P(x_t | r, x_{r:t-1})
      const count = counts[r];
      const sum_r = sums[r];
      const sumSq_r = sumSqs[r];
      
      const kn = kappa0 + count;
      const mun = (kappa0 * mu0 + sum_r) / kn;
      const an = alpha0 + count / 2;
      const bn = beta0 + 0.5 * (sumSq_r - sum_r * sum_r / (count || 1)) + 
                 (kappa0 * count * (sum_r / (count || 1) - mu0) * (sum_r / (count || 1) - mu0)) / (2 * kn);
      
      // Student-t predictive distribution
      const predVar = (bn * (kn + 1)) / (an * kn);
      const predStd = Math.sqrt(Math.max(predVar, 1e-10));
      const z = (x - mun) / predStd;
      // Use Gaussian approximation for computational efficiency
      const logPred = -0.5 * Math.log(2 * Math.PI) - Math.log(predStd) - 0.5 * z * z;
      const pred = Math.exp(logPred);
      
      // Growth: extend run length
      const growthProb = runLengthProbs[r] * pred * (1 - hazardRate);
      newRunLengthProbs[r + 1] = growthProb;
      growthSum += growthProb;
      
      // Update sufficient statistics for grown run
      newCounts[r + 1] = count + 1;
      newSums[r + 1] = sum_r + x;
      newSumSqs[r + 1] = sumSq_r + x * x;
    }
    
    // Changepoint probability: P(r_t = 0 | ...)
    let changepointProb = 0;
    for (let r = 0; r <= t; r++) {
      const count = counts[r];
      const sum_r = sums[r];
      const sumSq_r = sumSqs[r];
      
      const kn = kappa0 + count;
      const mun = (kappa0 * mu0 + sum_r) / kn;
      const an = alpha0 + count / 2;
      const bn = beta0 + 0.5 * (sumSq_r - sum_r * sum_r / (count || 1)) + 
                 (kappa0 * count * (sum_r / (count || 1) - mu0) * (sum_r / (count || 1) - mu0)) / (2 * kn);
      
      const predVar = (bn * (kn + 1)) / (an * kn);
      const predStd = Math.sqrt(Math.max(predVar, 1e-10));
      const z = (x - mun) / predStd;
      const logPred = -0.5 * Math.log(2 * Math.PI) - Math.log(predStd) - 0.5 * z * z;
      const pred = Math.exp(logPred);
      
      changepointProb += runLengthProbs[r] * pred * hazardRate;
    }
    
    newRunLengthProbs[0] = changepointProb;
    newCounts[0] = 0;
    newSums[0] = 0;
    newSumSqs[0] = 0;
    
    // Normalize
    let totalProb = changepointProb + growthSum;
    if (totalProb > 0) {
      for (let r = 0; r <= t + 1; r++) {
        newRunLengthProbs[r] /= totalProb;
      }
    }
    
    // Track if changepoint probability spikes
    if (newRunLengthProbs[0] > 0.5 && t > 2) {
      if (newRunLengthProbs[0] > bestChangePointConf) {
        bestChangePointConf = newRunLengthProbs[0];
        bestChangePointIdx = t;
      }
    }
    
    runLengthProbs = newRunLengthProbs;
    counts = newCounts;
    sums = newSums;
    sumSqs = newSumSqs;
  }
  
  // Find MAP (most probable) run length
  let maxRunLength = 0;
  let maxRunLengthProb = 0;
  for (let r = 0; r <= n; r++) {
    if (runLengthProbs[r] > maxRunLengthProb) {
      maxRunLengthProb = runLengthProbs[r];
      maxRunLength = r;
    }
  }
  
  const changePointDetected = bestChangePointConf > 0.80;
  
  return {
    changePointDetected,
    changePointIndex: changePointDetected ? bestChangePointIdx : null,
    confidence: +bestChangePointConf.toFixed(4),
    maxRunLength
  };
}

/**
 * Returns a regime stability coefficient for the Oracle confidence calculation.
 * 1.0 = stable regime, 0.7 = changepoint detected recently.
 * @param {{ changePointDetected: boolean }} bocdResult
 * @returns {number}
 */
function getRegimeStabilityCoefficient(bocdResult) {
  if (!bocdResult) return 1.0;
  return bocdResult.changePointDetected ? 0.70 : 1.00;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 26.2 — WFE COEFFICIENT MAPPER
// Maps raw Walk-Forward Efficiency ratio to a discrete coefficient
// used by Layer 25 for λ blending strength.
//
//   WFE > 0.70  → 1.00  (full calibration authority)
//   0.55–0.70   → 0.70  (moderate authority)
//   < 0.55      → 0.00  (calibration muted — static weights only)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts raw WFE ratio into a discrete blending coefficient.
 * @param {number} wfe - Walk-Forward Efficiency ratio (OOS Sharpe / IS Sharpe)
 * @returns {number} 1.0, 0.70, or 0.00
 */
function computeWFECoefficient(wfe) {
  if (wfe == null || typeof wfe !== 'number' || isNaN(wfe)) return 0.0;
  // Smooth sigmoid: 1 / (1 + exp(-k * (wfe - midpoint)))
  // k=12, midpoint=0.55 gives:
  //   WFE=0.40 → 0.03, WFE=0.50 → 0.23, WFE=0.55 → 0.50
  //   WFE=0.60 → 0.73, WFE=0.70 → 0.95, WFE=0.80 → 0.99
  return 1.0 / (1.0 + Math.exp(-WFE_SIGMOID_K * (wfe - WFE_SIGMOID_MIDPOINT)));
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 26.3 — WALK-FORWARD OPTIMIZATION ENGINE (COMPOSITE)
// Rolls through closed trade history using IS/OOS windows to measure
// strategy robustness. Detects alpha decay and can issue FATAL veto
// when the OOS edge degrades across consecutive windows.
//
// Trade segregation by mode:
//   "Intraday"   → ScaleFactor = 252
//   "Investment"  → ScaleFactor = sqrt(252 / max(5, avgHoldingDays))
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Runs walk-forward optimization across closed trade history.
 *
 * @param {object} params
 * @param {object[]} params.trades - Array of closed trade objects, each with:
 *   - returnPct {number}     (or entryPrice + exitPrice)
 *   - entryDate {string}     ISO date
 *   - exitDate  {string}     ISO date
 *   - mode      {string}     "Intraday" | "Investment" (optional, uses param.mode)
 *   - layerScores {object}   Per-layer directional accuracy (optional, for L25)
 * @param {string} [params.mode="Intraday"] - "Intraday" or "Investment"
 * @param {number} [params.windowSize=130]  - IS window size (trade count)
 * @param {number} [params.stepSize=50]     - OOS step size (trade count)
 * @param {number} [params.maxWindowTimespanDays=180] - Max age of oldest trade in window
 * @returns {object} Walk-forward result envelope
 */
function computeWalkForward({
  trades,
  mode = "Intraday",
  windowSize = DEFAULT_WINDOW_SIZE,
  stepSize = DEFAULT_STEP_SIZE,
  maxWindowTimespanDays = DEFAULT_MAX_WINDOW_TIMESPAN_DAYS,
}) {
  const logs = [];
  const now = new Date();

  // ── GUARD: null/empty trades ───────────────────────────────────────
  if (!trades || !Array.isArray(trades)) {
    logs.push(logEntry("WFE_NO_TRADES", "WARN", "No trade data provided; returning neutral defaults."));
    return {
      ok: true,
      data: {
        wfeScore: 0,
        wfeCoefficient: 0.0,
        decayRate: 0,
        consecutiveDecayWindows: 0,
        shouldHalt: false,
        alphaDecayVeto: false,
        windows: [],
        bocdResult: { changePointDetected: false, changePointIndex: null, confidence: 0, maxRunLength: 0 },
      },
      meta: { fetchedAt: now.toISOString(), source: "calc:computeWalkForward" },
      logs,
    };
  }

  // ── STEP 1: Filter trades by mode ──────────────────────────────────
  const normMode = String(mode).toUpperCase();
  const modeTrades = trades.filter((t) => {
    // If trade has its own mode field, filter by it; otherwise include all
    if (t.mode) return t.mode.toUpperCase() === normMode;
    return true;
  });

  // Sort by exit date ascending (chronological order)
  modeTrades.sort((a, b) => {
    const da = a.exitDate ? new Date(a.exitDate).getTime() : 0;
    const db = b.exitDate ? new Date(b.exitDate).getTime() : 0;
    return da - db;
  });

  // ── GUARD: Minimum trade count W = 130 ─────────────────────────────
  if (modeTrades.length < MIN_TRADES_FOR_WF) {
    logs.push(
      logEntry("WFE_INSUFFICIENT_TRADES", "INFO", `Only ${modeTrades.length} closed trades; need ${MIN_TRADES_FOR_WF}. Returning cold-start defaults.`, {
        tradeCount: modeTrades.length,
        required: MIN_TRADES_FOR_WF,
      })
    );
    return {
      ok: true,
      data: {
        wfeScore: 0,
        wfeCoefficient: 0.0,
        decayRate: 0,
        consecutiveDecayWindows: 0,
        shouldHalt: false,
        alphaDecayVeto: false,
        windows: [],
        bocdResult: { changePointDetected: false, changePointIndex: null, confidence: 0, maxRunLength: 0 },
      },
      meta: { fetchedAt: now.toISOString(), source: "calc:computeWalkForward" },
      logs,
    };
  }

  // ── STEP 2: Determine scale factor ─────────────────────────────────
  const avgHold = averageHoldingDays(modeTrades);
  let scaleFactor;
  if (normMode === "INTRADAY") {
    scaleFactor = 252;
  } else {
    // Investment mode: sqrt(252 / max(5, avgHoldingDays))
    scaleFactor = Math.sqrt(252 / Math.max(5, avgHold));
  }

  // ── STEP 3: Build rolling windows ──────────────────────────────────
  // Structure: [IS window of `windowSize`] → [OOS window of `stepSize`]
  // Slide forward by `stepSize` trades per iteration.
  const windows = [];
  let startIdx = 0;

  while (startIdx + windowSize + stepSize <= modeTrades.length) {
    const isTrades = modeTrades.slice(startIdx, startIdx + windowSize);
    const oosTrades = modeTrades.slice(startIdx + windowSize, startIdx + windowSize + stepSize);

    // ── 180-day staleness check ────────────────────────────────────
    const oldestTrade = isTrades[0];
    let windowStale = false;
    if (oldestTrade && oldestTrade.entryDate) {
      const oldestDate = new Date(oldestTrade.entryDate);
      const ageDays = (now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > maxWindowTimespanDays) {
        windowStale = true;
      }
    }

    const isReturns = extractReturns(isTrades);
    const oosReturns = extractReturns(oosTrades);

    const isSharpe = computeSharpe(isReturns, scaleFactor);
    const oosSharpe = computeSharpe(oosReturns, scaleFactor);

    const isSortino = computeSortino(isReturns, scaleFactor);
    const oosSortino = computeSortino(oosReturns, scaleFactor);

    // ── WFE for this window ────────────────────────────────────────
    let windowWFE;
    let windowSortinoWFE;
    let windowNote = null;

    if (isSharpe < 0 || oosSharpe < 0) {
      // If either Sharpe is negative → clamp WFE to 0.00
      windowWFE = 0.0;
      windowNote = "NEGATIVE_SHARPE_CLAMPED";
    } else if (Math.abs(isSharpe) < SHARPE_EPSILON) {
      // IS Sharpe near zero → indeterminate
      windowWFE = 0.0;
      windowNote = "IS_SHARPE_NEAR_ZERO";
      logs.push(
        logEntry(
          "WFE_INDETERMINATE_IS_SHARPE_NEAR_ZERO",
          "WARN",
          `IS Sharpe (${isSharpe.toFixed(6)}) below epsilon (${SHARPE_EPSILON}); WFE clamped to 0.00.`,
          { isSharpe, oosSharpe, windowIdx: windows.length }
        )
      );
    } else {
      windowWFE = oosSharpe / isSharpe;
    }

    if (isSortino <= 0 || oosSortino < 0) {
      windowSortinoWFE = 0.0;
    } else {
      windowSortinoWFE = oosSortino / isSortino;
    }

    windows.push({
      windowIndex: windows.length,
      startTradeIdx: startIdx,
      isTradeCount: isTrades.length,
      oosTradeCount: oosTrades.length,
      isSharpe: +isSharpe.toFixed(6),
      oosSharpe: +oosSharpe.toFixed(6),
      isSortino: +isSortino.toFixed(6),
      oosSortino: +oosSortino.toFixed(6),
      wfe: +windowWFE.toFixed(4),
      sortinoWfe: +windowSortinoWFE.toFixed(4),
      stale: windowStale,
      note: windowNote,
    });

    startIdx += stepSize;
  }

  // ── STEP 4: Aggregate WFE (use latest window as primary) ──────────
  let wfeScore = 0;
  let sortinoWfeScore = 0;
  if (windows.length > 0) {
    // Use the most recent non-stale window; fallback to last window
    let latestValid = null;
    for (let i = windows.length - 1; i >= 0; i--) {
      if (!windows[i].stale) {
        latestValid = windows[i];
        break;
      }
    }

    if (latestValid) {
      wfeScore = latestValid.wfe;
      sortinoWfeScore = latestValid.sortinoWfe;
    } else {
      // All windows are stale → force static weight fallback
      wfeScore = 0;
      sortinoWfeScore = 0;
      logs.push(
        logEntry("WFE_ALL_WINDOWS_STALE", "HIGH", `All ${windows.length} windows exceed ${maxWindowTimespanDays}-day timespan. Forcing static fallback.`, {
          windowCount: windows.length,
          maxDays: maxWindowTimespanDays,
        })
      );
    }
  }

  const effectiveWfeScore = Math.min(wfeScore, sortinoWfeScore || wfeScore);
  const wfeCoefficient = computeWFECoefficient(effectiveWfeScore);

  // ── STEP 5: Alpha decay detection ─────────────────────────────────
  // Compute DecayRate as slope of OOS Sharpe across windows
  let decayRate = 0;
  let consecutiveDecayWindows = 0;
  let shouldHalt = false;
  let alphaDecayVeto = false;

  if (windows.length < 2) {
    // Cold start: fewer than 2 windows → bypass decay analysis
    decayRate = 0;
    logs.push(logEntry("WFE_COLD_START", "INFO", `Only ${windows.length} window(s); alpha decay analysis bypassed.`));
  } else {
    // Simple linear regression of OOS Sharpe vs window index
    const xs = windows.map((w) => w.windowIndex);
    const ys = windows.map((w) => w.oosSharpe);
    const n = xs.length;
    const xMean = mean(xs);
    const yMean = mean(ys);

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xs[i] - xMean) * (ys[i] - yMean);
      denominator += (xs[i] - xMean) ** 2;
    }

    decayRate = denominator > 0 ? numerator / denominator : 0;

    // Count consecutive windows (from the tail) where decay is active
    // "Decay active" = OOS Sharpe of window N < OOS Sharpe of window N-1
    // AND decay rate is below the veto threshold
    for (let i = windows.length - 1; i >= 1; i--) {
      if (windows[i].oosSharpe < windows[i - 1].oosSharpe && decayRate < DECAY_RATE_VETO_THRESHOLD) {
        consecutiveDecayWindows++;
      } else {
        break;
      }
    }

    // FATAL veto: decay < -0.15 for 3+ consecutive windows
    if (decayRate < DECAY_RATE_VETO_THRESHOLD && consecutiveDecayWindows >= CONSECUTIVE_DECAY_VETO_COUNT) {
      shouldHalt = true;
      alphaDecayVeto = true;
      logs.push(
        logEntry(
          "ALPHA_DECAY_HALT_ALERT",
          "FATAL",
          `Alpha decay veto triggered: DecayRate=${decayRate.toFixed(4)}, consecutive=${consecutiveDecayWindows}. ALPHA_DECAY_HALT_VETO issued.`,
          {
            decayRate: +decayRate.toFixed(4),
            consecutiveDecayWindows,
            threshold: DECAY_RATE_VETO_THRESHOLD,
            requiredConsecutive: CONSECUTIVE_DECAY_VETO_COUNT,
          }
        )
      );
    }
  }

  const bocdResult = bayesianChangePointDetection(windows.map(w => w.oosSharpe), BOCD_HAZARD_RATE);

  return {
    ok: true,
    data: {
      wfeScore: +wfeScore.toFixed(4),
      wfeCoefficient,
      decayRate: +decayRate.toFixed(4),
      consecutiveDecayWindows,
      shouldHalt,
      alphaDecayVeto,
      windows,
      bocdResult,
    },
    meta: {
      fetchedAt: now.toISOString(),
      source: "calc:computeWalkForward",
      mode,
      scaleFactor: +scaleFactor.toFixed(4),
      avgHoldingDays: +avgHold.toFixed(1),
      totalTrades: modeTrades.length,
      windowSize,
      stepSize,
    },
    logs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
  computeWalkForward,
  computeSharpe,
  computeSortino,
  computeWFECoefficient,
  bayesianChangePointDetection,
  getRegimeStabilityCoefficient,
};
