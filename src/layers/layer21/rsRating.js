// ═══════════════════════════════════════════════════════════════════════════
// LAYER 21 — RS RATING ENGINE (IBD-STYLE RELATIVE STRENGTH)
//
// Domain: Relative Strength / Price Momentum Ranking
//
// Computes a weighted price performance metric inspired by Investor's
// Business Daily (IBD) Relative Strength methodology. The raw performance
// is computed by the offline rsRatingJob; this module accepts the
// pre-computed percentile rank (1-99) and maps it to the engine's [10, 90]
// scoring range via a linear transform.
//
// Weighted Performance Formula:
//   Perf = 2 * ROC(20) + 2 * ROC(40) + 1 * ROC(65) + 1 * ROC(252)
//   where ROC(n) = (C_t - C_{t-n}) / C_{t-n}
//
// Score Mapping:
//   L21_score = 10 + ((percentile - 1) / 98) * 80
//
// Cold-Start: When rs_ratings cache is empty or percentile is null,
//   the score defaults to 50 and an advisory log is emitted.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ── STRUCTURED LOGGING HELPER ────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 21 events.
 * @param {string} eventCode  - Machine-readable event identifier
 * @param {string} severity   - One of: INFO, WARN, ERROR
 * @param {string} message    - Human-readable description
 * @param {Object} [details]  - Optional payload with contextual data
 */
function logEvent(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: 'L21',
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

// ── HELPER: SAFE RATE-OF-CHANGE ──────────────────────────────────────────

/**
 * Computes rate-of-change between two prices.
 * Returns 0 if the base price is zero / falsy to prevent division-by-zero.
 * @param {number} current  - Current closing price
 * @param {number} base     - Historical closing price (denominator)
 * @returns {number}
 */
function safeRoc(current, base) {
  if (!base || base === 0) return 0;
  return (current - base) / base;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 21.1 — COMPUTE WEIGHTED PERFORMANCE
//
// Calculates the raw IBD-style weighted performance from an array of
// closing prices (newest last). Requires at least 252 data points for a
// full computation; gracefully degrades with fewer data points by only
// including available lookback windows.
//
// Lookback windows (days) and weights:
//   20-day  → weight 2
//   40-day  → weight 2
//   65-day  → weight 1 (approx 1 quarter)
//   252-day → weight 1 (approx 1 year)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} WeightedPerfResult
 * @property {boolean} ok
 * @property {Object}  data
 * @property {number}  data.weightedPerformance  - Sum of weighted ROC values
 * @property {number}  data.windowsUsed          - How many lookback windows contributed
 * @property {number}  data.totalWeight           - Sum of active weights
 * @property {Object}  data.components            - Individual ROC values per window
 * @property {boolean} data.isPartial             - True if fewer than 4 windows available
 * @property {Object}  meta
 */

/**
 * Computes the IBD-style weighted price performance from an array of
 * closing prices ordered oldest → newest.
 *
 * @param {Object}   params
 * @param {number[]} params.closePrices - Array of closing prices (oldest first)
 * @returns {WeightedPerfResult}
 */
function computeWeightedPerformance({ closePrices } = {}) {
  // ── Guard: null / undefined / non-array input ──
  if (!Array.isArray(closePrices) || closePrices.length < 2) {
    logEvent('L21_WEIGHTED_PERF_INSUFFICIENT_DATA', 'WARN',
      'closePrices array is missing or too short for any ROC computation',
      { received: closePrices ? closePrices.length : 0 });

    return {
      ok: true,
      data: {
        weightedPerformance: 0,
        windowsUsed: 0,
        totalWeight: 0,
        components: {},
        isPartial: true
      },
      meta: { fetchedAt: new Date().toISOString(), source: 'calc:computeWeightedPerformance' }
    };
  }

  const len = closePrices.length;
  const currentClose = closePrices[len - 1];

  // Define lookback windows with their weights
  const windows = [
    { name: 'roc20',  lookback: 20,  weight: 2 },
    { name: 'roc40',  lookback: 40,  weight: 2 },
    { name: 'roc65',  lookback: 65,  weight: 1 },
    { name: 'roc252', lookback: 252, weight: 1 }
  ];

  let weightedPerformance = 0;
  let totalWeight = 0;
  let windowsUsed = 0;
  const components = {};

  for (const w of windows) {
    if (len > w.lookback) {
      const baseClose = closePrices[len - 1 - w.lookback];
      const roc = safeRoc(currentClose, baseClose);
      components[w.name] = +roc.toFixed(6);
      weightedPerformance += w.weight * roc;
      totalWeight += w.weight;
      windowsUsed++;
    }
  }

  const isPartial = windowsUsed < 4;

  if (isPartial) {
    logEvent('L21_WEIGHTED_PERF_PARTIAL', 'INFO',
      `Only ${windowsUsed}/4 lookback windows available (need 252+ prices for full calc)`,
      { dataPoints: len, windowsUsed });
  }

  return {
    ok: true,
    data: {
      weightedPerformance: +weightedPerformance.toFixed(6),
      windowsUsed,
      totalWeight,
      components,
      isPartial
    },
    meta: { fetchedAt: new Date().toISOString(), source: 'calc:computeWeightedPerformance' }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 21.2 — CALCULATE RS SCORE
//
// Accepts a pre-computed RS percentile rank (1-99) from the rsRatingJob
// database cache and maps it to the [10, 90] scoring range.
//
// Linear mapping: L21_score = 10 + ((percentile - 1) / 98) * 80
//
// Cold-start: if percentile is null / undefined (cache empty or stale),
//   defaults to score 50 and logs L21_RS_RATING_COLD_START_ACTIVE.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} RSScoreResult
 * @property {boolean} ok
 * @property {Object}  data
 * @property {number}  data.score              - Final clamped score [10, 90]
 * @property {number|null} data.percentile     - Input RS percentile (1-99)
 * @property {boolean} data.isConfirmedUptrend - Whether the stock is in confirmed uptrend
 * @property {boolean} data.isColdStart        - True if cold-start defaults were used
 * @property {string}  data.dataSource         - Origin of the percentile data
 * @property {Object}  meta
 */

/**
 * Calculates the Layer 21 RS score from a pre-computed percentile rank.
 *
 * @param {Object}  params
 * @param {number|null}  params.rsPercentile      - RS percentile rank (1-99) from rsRatingJob
 * @param {boolean}      [params.isConfirmedUptrend=false] - Market regime flag
 * @returns {RSScoreResult}
 */
function calculateRSScore({ rsPercentile = null, isConfirmedUptrend = false } = {}) {
  const fetchedAt = new Date().toISOString();

  // ── Cold-start detection ──
  if (rsPercentile == null || typeof rsPercentile !== 'number' || rsPercentile < 1 || rsPercentile > 99) {
    logEvent('L21_RS_RATING_COLD_START_ACTIVE', 'WARN',
      'RS percentile is null, out-of-range, or non-numeric — applying cold-start default score of 50',
      { receivedPercentile: rsPercentile });

    return {
      ok: true,
      data: {
        score: 50,
        percentile: null,
        isConfirmedUptrend: !!isConfirmedUptrend,
        isColdStart: true,
        dataSource: 'cold_start_default'
      },
      meta: { fetchedAt, source: 'calc:calculateRSScore' }
    };
  }

  // ── Linear mapping: percentile (1-99) → score (10-90) ──
  // At percentile=1  → score=10
  // At percentile=99 → score=90
  const rawScore = 10 + ((rsPercentile - 1) / 98) * 80;

  // Clamp to [10, 90] — defensive; the formula already constrains to this range
  const score = Math.max(10, Math.min(90, Math.round(rawScore * 100) / 100));

  logEvent('L21_RS_SCORE_COMPUTED', 'INFO',
    `RS score computed: percentile=${rsPercentile}, score=${score}`,
    { rsPercentile, score, isConfirmedUptrend });

  return {
    ok: true,
    data: {
      score,
      percentile: rsPercentile,
      isConfirmedUptrend: !!isConfirmedUptrend,
      isColdStart: false,
      dataSource: 'rs_ratings_cache'
    },
    meta: { fetchedAt, source: 'calc:calculateRSScore' }
  };
}

// ── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = {
  calculateRSScore,
  computeWeightedPerformance
};
