// ═══════════════════════════════════════════════════════════════════════════
// LAYER 23 — PEER PERCENTILE RANKING
//
// Domain: Valuation & Efficiency Context
//
// Compares a stock's fundamental indicators (ROE, ROCE, Debt/Equity,
// FCF Yield) against its industry peer group. For each metric, a
// percentile rank is computed within the peer set, then averaged into
// a composite percentile score.
//
// Score Mapping:
//   peer_score = 10 + (avgPercentile / 100) * 80
//
// Peer Count Blending Logic (Section 3.3 — Peer Percentile Enhancement):
//   peerCount < 5  → theta = 0.00 (no blending; PEER_PERCENTILE_FALLBACK)
//   peerCount 5-29  → theta = 0.30 + ((peerCount - 5) / 25) * 0.35
//   peerCount >= 30 → theta = 0.65
//
//   L8_enhanced = (1 - theta) * L8_absolute + theta * L23_percentile_score
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const { BROAD_SECTOR_MAP } = require('../../config/sectorConstants');

// ── STRUCTURED LOGGING HELPER ────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 23 events.
 * @param {string} eventCode  - Machine-readable event identifier
 * @param {string} severity   - One of: INFO, WARN, ERROR
 * @param {string} message    - Human-readable description
 * @param {Object} [details]  - Optional payload with contextual data
 */
function logEvent(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: 'L23',
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

// ── HELPER: PERCENTILE RANK OF A VALUE WITHIN AN ARRAY ───────────────────

/**
 * Computes the percentile rank of `value` within `arr`.
 * Uses the "percentage of values below" method:
 *   percentile = (count of values < value) / total * 100
 *
 * @param {number}   value - The target value to rank
 * @param {number[]} arr   - The comparison set (all peer values for a metric)
 * @returns {number} Percentile rank [0, 100]
 */
function percentileRank(value, arr) {
  if (!arr || arr.length === 0) return 50; // Neutral if no peers
  const below = arr.filter(v => v < value).length;
  return (below / arr.length) * 100;
}

/**
 * Computes the percentile rank of `value` within `arr` where LOWER
 * values are BETTER (e.g. Debt/Equity ratio). This inverts the ranking
 * so that a stock with low D/E gets a high percentile.
 *
 * @param {number}   value - The target value to rank
 * @param {number[]} arr   - The comparison set
 * @returns {number} Inverted percentile rank [0, 100]
 */
function percentileRankInverted(value, arr) {
  if (!arr || arr.length === 0) return 50;
  const above = arr.filter(v => v > value).length;
  return (above / arr.length) * 100;
}

// ── HELPER: EXTRACT VALID METRIC VALUES FROM PEER ARRAY ──────────────────

/**
 * Extracts an array of numeric values for a given metric key from the
 * peer metrics array, filtering out null/undefined/NaN entries.
 *
 * @param {Object[]} peerMetrics - Array of peer objects
 * @param {string}   key         - Property name to extract
 * @returns {number[]}
 */
function extractValidValues(peerMetrics, key) {
  if (!Array.isArray(peerMetrics)) return [];
  return peerMetrics
    .map(p => p[key])
    .filter(v => v != null && typeof v === 'number' && !Number.isNaN(v));
}

// ── HELPER: THETA (BLENDING COEFFICIENT) ─────────────────────────────────

/**
 * Computes the theta blending coefficient based on peer count.
 * Controls how much weight L23's peer-relative score gets when
 * blended with L8's absolute valuation score.
 *
 * @param {number} peerCount - Number of valid peers in the group
 * @returns {number} theta ∈ [0.00, 0.65]
 */
function computeTheta(peerCount) {
  if (peerCount < 5) return 0.00;
  if (peerCount >= 30) return 0.65;
  // Linear interpolation: 5 peers → 0.30, 29 peers → 0.65
  return 0.30 + ((peerCount - 5) / 25) * 0.35;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 23.1 — CALCULATE PEER PERCENTILE SCORE
//
// Compares the stock's ROE, ROCE, Debt/Equity, and FCF Yield against
// its peer group, computes a percentile rank for each, averages them,
// and maps the composite to the [10, 90] score range.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} StockMetrics
 * @property {number|null} roe          - Return on Equity (%)
 * @property {number|null} roce         - Return on Capital Employed (%)
 * @property {number|null} debtToEquity - Debt to Equity ratio
 * @property {number|null} fcfYield     - Free Cash Flow Yield (%)
 */

/**
 * @typedef {Object} PeerMetric
 * @property {number|null} roe
 * @property {number|null} roce
 * @property {number|null} debtToEquity
 * @property {number|null} fcfYield
 */

/**
 * @typedef {Object} PeerPercentileResult
 * @property {boolean} ok
 * @property {Object}  data
 * @property {number}  data.score          - Final clamped score [10, 90]
 * @property {number}  data.peerCount      - Number of valid peers
 * @property {number}  data.theta          - Blending coefficient for L8 enhancement
 * @property {number}  data.avgPercentile  - Average percentile across all metrics
 * @property {string}  data.sectorUsed     - Sector label used for peer grouping
 * @property {boolean} data.isFallback     - True if peer count < 5 (no blending)
 * @property {string}  data.dataSource     - Origin of peer data
 * @property {Object}  meta
 */

/**
 * Calculates the Layer 23 Peer Percentile score.
 *
 * @param {Object}       params
 * @param {StockMetrics}  params.stockMetrics  - The target stock's fundamentals
 * @param {PeerMetric[]}  params.peerMetrics   - Array of peer objects
 * @param {string|null}   params.sector        - Sub-sector or sector label
 * @returns {PeerPercentileResult}
 */
function calculatePeerPercentileScore({ stockMetrics, peerMetrics, sector } = {}) {
  const fetchedAt = new Date().toISOString();

  // ── Guard: missing stock metrics ──
  if (!stockMetrics || typeof stockMetrics !== 'object') {
    logEvent('L23_MISSING_STOCK_METRICS', 'WARN',
      'stockMetrics is null or invalid — returning neutral score',
      { received: stockMetrics });

    return {
      ok: true,
      data: {
        score: 50,
        peerCount: 0,
        theta: 0.00,
        avgPercentile: 50,
        sectorUsed: sector || 'Unknown',
        isFallback: true,
        dataSource: 'fallback_neutral'
      },
      meta: { fetchedAt, source: 'calc:calculatePeerPercentileScore' }
    };
  }

  // ── Resolve effective sector (broad fallback if sub-sector has too few peers) ──
  const effectiveSector = sector || 'Unknown';
  const broadSector = BROAD_SECTOR_MAP[effectiveSector] || effectiveSector;

  // ── Guard: missing or empty peer metrics ──
  const validPeers = Array.isArray(peerMetrics)
    ? peerMetrics.filter(p => p != null && typeof p === 'object')
    : [];

  const peerCount = validPeers.length;

  if (peerCount === 0) {
    logEvent('PEER_PERCENTILE_FALLBACK', 'WARN',
      'No valid peers available — returning neutral score with theta=0',
      { sector: effectiveSector, broadSector });

    return {
      ok: true,
      data: {
        score: 50,
        peerCount: 0,
        theta: 0.00,
        avgPercentile: 50,
        sectorUsed: effectiveSector,
        isFallback: true,
        dataSource: 'no_peers_fallback'
      },
      meta: { fetchedAt, source: 'calc:calculatePeerPercentileScore' }
    };
  }

  // ── Compute percentile rank for each metric ──
  // Higher-is-better metrics: ROE, ROCE, FCF Yield
  // Lower-is-better metrics: Debt/Equity
  const metricConfigs = [
    { key: 'roe',          stockVal: stockMetrics.roe,          inverted: false },
    { key: 'roce',         stockVal: stockMetrics.roce,         inverted: false },
    { key: 'debtToEquity', stockVal: stockMetrics.debtToEquity, inverted: true  },
    { key: 'fcfYield',     stockVal: stockMetrics.fcfYield,     inverted: false }
  ];

  const percentiles = [];

  for (const mc of metricConfigs) {
    if (mc.stockVal == null || typeof mc.stockVal !== 'number') continue;

    const peerValues = extractValidValues(validPeers, mc.key);
    if (peerValues.length === 0) continue;

    const pctile = mc.inverted
      ? percentileRankInverted(mc.stockVal, peerValues)
      : percentileRank(mc.stockVal, peerValues);

    percentiles.push(pctile);
  }

  // ── Average percentiles ──
  const avgPercentile = percentiles.length > 0
    ? percentiles.reduce((a, b) => a + b, 0) / percentiles.length
    : 50; // Neutral default if no metrics computed

  // ── Map composite percentile to [10, 90] ──
  const rawScore = 10 + (avgPercentile / 100) * 80;
  const score = Math.max(10, Math.min(90, Math.round(rawScore * 100) / 100));

  // ── Compute theta (blending coefficient) ──
  const theta = computeTheta(peerCount);
  const isFallback = peerCount < 5;

  if (isFallback) {
    logEvent('PEER_PERCENTILE_FALLBACK', 'WARN',
      `Peer count (${peerCount}) is below 5 — theta set to 0 (no L8 blending)`,
      { peerCount, sector: effectiveSector, broadSector });
  } else {
    logEvent('L23_PEER_SCORE_COMPUTED', 'INFO',
      `Peer percentile score computed: score=${score}, theta=${theta.toFixed(3)}`,
      { peerCount, avgPercentile: +avgPercentile.toFixed(2), theta, sector: effectiveSector });
  }

  // ── Determine the sector label that was actually used ──
  const sectorUsed = effectiveSector;

  return {
    ok: true,
    data: {
      score,
      peerCount,
      theta: +theta.toFixed(4),
      avgPercentile: +avgPercentile.toFixed(2),
      sectorUsed,
      isFallback,
      dataSource: 'peer_fundamentals'
    },
    meta: { fetchedAt, source: 'calc:calculatePeerPercentileScore' }
  };
}

// ── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = {
  calculatePeerPercentileScore
};
