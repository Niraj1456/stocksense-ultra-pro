// ═══════════════════════════════════════════════════════════════════════════
// LAYER 24 — MANAGEMENT QUALITY SCORING
//
// Domain: Governance & Capital Allocation
//
// Evaluates management quality through three orthogonal signals:
//
// 1. ROCE Trend (5-year linear regression slope)
//    - Improving ROCE over time signals effective capital deployment.
//    - BFSI companies get a 1.5x multiplier on slope (inherently lower ROCEs).
//
// 2. Dividend Payout Sustainability (Dividends Paid / Free Cash Flow)
//    - Sustainable range: 0.20–0.60 → +5 pts
//    - Unsustainable (>0.90) or negligible (<0.05) → -5 pts
//    - Negative FCF → dividendRatio clamped to 0, advisory logged.
//
// 3. Auditor Tier
//    - Big4 (Deloitte, PwC, EY, KPMG) → +5 pts
//    - Mid-tier (BDO, Grant Thornton, etc.) → +2 pts
//    - Local / Unknown → +0 pts
//
// Score Mapping (starting from base 50):
//   ROCE slope > 2.0       → +15
//   ROCE slope 0.5–2.0     → +8
//   ROCE slope -0.5–0.5    → +0
//   ROCE slope < -0.5      → -10
//   ROCE slope < -2.0      → -20
//   Dividend sustainable    → +5
//   Dividend unsustainable  → -5
//   Auditor tier bonus      → +0 / +2 / +5
//
// Final score clamped to [10, 90].
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const { BFSI_SECTORS } = require('../../config/sectorConstants');

// ── BIG4 AND MID-TIER AUDITOR LISTS ─────────────────────────────────────

const BIG4_AUDITORS = [
  'deloitte', 'pwc', 'pricewaterhousecoopers', 'ey', 'ernst & young',
  'ernst and young', 'kpmg'
];

const MID_TIER_AUDITORS = [
  'bdo', 'grant thornton', 'rsm', 'crowe', 'mazars', 'baker tilly',
  'moore', 'nexia', 'haines watts', 'saffery champness',
  // India-specific mid-tier
  's.r. batliboi', 'sr batliboi', 'walker chandiok', 'bsr',
  'mska', 'sharp & tannan', 'lodha'
];

// ── STRUCTURED LOGGING HELPER ────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 24 events.
 * @param {string} eventCode  - Machine-readable event identifier
 * @param {string} severity   - One of: INFO, WARN, ERROR
 * @param {string} message    - Human-readable description
 * @param {Object} [details]  - Optional payload with contextual data
 */
function logEvent(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: 'L24',
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

// ── HELPER: LINEAR REGRESSION SLOPE (LEAST SQUARES) ──────────────────────

/**
 * Computes the slope of a simple linear regression (y = mx + b) using
 * the least-squares method.
 *
 *   slope = Σ(xi - x̄)(yi - ȳ) / Σ(xi - x̄)²
 *
 * x-values are implicitly 0, 1, 2, ..., n-1 (year indices).
 *
 * @param {number[]} values - Array of y-values (e.g. ROCE by year, oldest first)
 * @returns {number} The slope, or 0 if insufficient data
 */
function linearRegressionSlope(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;

  const n = values.length;

  // x̄ = (n-1) / 2 for indices 0..n-1
  const xMean = (n - 1) / 2;

  // ȳ
  let ySum = 0;
  for (let i = 0; i < n; i++) ySum += values[i];
  const yMean = ySum / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDev = i - xMean;
    const yDev = values[i] - yMean;
    numerator += xDev * yDev;
    denominator += xDev * xDev;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ── HELPER: CLASSIFY AUDITOR TIER ────────────────────────────────────────

/**
 * Classifies an auditor name into a tier.
 * @param {string|null} auditorName - Name of the auditing firm
 * @returns {{ tier: string, bonus: number }}
 */
function classifyAuditor(auditorName) {
  if (!auditorName || typeof auditorName !== 'string') {
    return { tier: 'Unknown', bonus: 0 };
  }

  const normalized = auditorName.toLowerCase().trim();

  // Check Big4 first
  for (const name of BIG4_AUDITORS) {
    if (normalized.includes(name)) {
      return { tier: 'Big4', bonus: 5 };
    }
  }

  // Check mid-tier
  for (const name of MID_TIER_AUDITORS) {
    if (normalized.includes(name)) {
      return { tier: 'Mid-tier', bonus: 2 };
    }
  }

  return { tier: 'Local', bonus: 0 };
}

// ── HELPER: IS BFSI SECTOR ──────────────────────────────────────────────

/**
 * Checks if the given sector string belongs to the BFSI sector list.
 * Uses case-insensitive comparison.
 * @param {string|null} sector
 * @returns {boolean}
 */
function isBfsiSector(sector) {
  if (!sector || typeof sector !== 'string') return false;
  const normalized = sector.trim();
  return BFSI_SECTORS.some(
    s => s.toLowerCase() === normalized.toLowerCase()
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 24.1 — CALCULATE MANAGEMENT QUALITY SCORE
//
// Main scoring function. Evaluates ROCE trend, dividend sustainability,
// and auditor tier, combining into a composite score.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ManagementQualityResult
 * @property {boolean} ok
 * @property {Object}  data
 * @property {number}  data.score          - Final clamped score [10, 90]
 * @property {number}  data.roceSlope      - Linear regression slope of ROCE history
 * @property {number}  data.dividendRatio  - Dividends paid / free cash flow
 * @property {string}  data.auditorTier    - Big4, Mid-tier, or Local
 * @property {string}  data.dataSource     - Origin of the computation
 * @property {Object}  meta
 */

/**
 * Calculates the Layer 24 Management Quality score.
 *
 * @param {Object}     params
 * @param {number[]}   params.roceHistory    - Array of annual ROCE values (oldest first, ideally 5 years)
 * @param {number|null} params.dividendsPaid - Total dividends paid (absolute value, positive)
 * @param {number|null} params.freeCashFlow  - Free cash flow (can be negative)
 * @param {string|null} params.auditorName   - Name of the auditing firm
 * @param {string|null} params.sector        - Company's sector/sub-sector
 * @returns {ManagementQualityResult}
 */
function calculateManagementQualityScore({
  roceHistory = null,
  dividendsPaid = null,
  freeCashFlow = null,
  auditorName = null,
  sector = null
} = {}) {
  const fetchedAt = new Date().toISOString();

  let score = 50; // Base score
  let roceSlope = 0;
  let dividendRatio = 0;
  const isBfsi = isBfsiSector(sector);

  // ────────────────────────────────────────────────────────────────────────
  // SIGNAL 1: ROCE TREND SLOPE (5-year linear regression)
  // ────────────────────────────────────────────────────────────────────────

  if (Array.isArray(roceHistory) && roceHistory.length >= 2) {
    // Filter to valid numeric entries
    const validRoce = roceHistory.filter(
      v => v != null && typeof v === 'number' && !Number.isNaN(v)
    );

    if (validRoce.length >= 2) {
      roceSlope = linearRegressionSlope(validRoce);

      // BFSI adjustment: banks have inherently lower ROCE slopes,
      // so we multiply by 1.5 to normalize comparison
      if (isBfsi) {
        roceSlope *= 1.5;
        logEvent('L24_BFSI_ROCE_SLOPE_ADJUSTMENT_ACTIVE', 'INFO',
          `BFSI sector detected (${sector}) — ROCE slope multiplied by 1.5`,
          { originalSlope: +(roceSlope / 1.5).toFixed(4), adjustedSlope: +roceSlope.toFixed(4) });
      }

      // Score mapping for ROCE slope
      // NOTE: Check < -2.0 first (more restrictive), then < -0.5
      if (roceSlope > 2.0) {
        score += 15;
      } else if (roceSlope >= 0.5) {
        score += 8;
      } else if (roceSlope >= -0.5) {
        score += 0; // Neutral — no adjustment
      } else if (roceSlope < -2.0) {
        score -= 20;
      } else {
        // roceSlope < -0.5 but >= -2.0
        score -= 10;
      }
    } else {
      logEvent('L24_ROCE_HISTORY_INSUFFICIENT', 'WARN',
        'ROCE history has fewer than 2 valid numeric values — slope set to 0',
        { received: roceHistory.length, valid: validRoce.length });
    }
  } else {
    logEvent('L24_ROCE_HISTORY_MISSING', 'WARN',
      'roceHistory is null or has fewer than 2 entries — ROCE slope not computed',
      { received: roceHistory ? roceHistory.length : 0 });
  }

  // ────────────────────────────────────────────────────────────────────────
  // SIGNAL 2: DIVIDEND PAYOUT SUSTAINABILITY
  // ────────────────────────────────────────────────────────────────────────

  if (dividendsPaid != null && typeof dividendsPaid === 'number') {
    if (freeCashFlow != null && typeof freeCashFlow === 'number') {
      if (freeCashFlow <= 0) {
        // Negative FCF: cannot sustain dividends from cash flows
        dividendRatio = 0;
        logEvent('L24_NEGATIVE_FCF_DIVIDEND_CLAMP_ACTIVE', 'WARN',
          'Free cash flow is zero or negative — dividendRatio clamped to 0',
          { dividendsPaid, freeCashFlow });
      } else {
        dividendRatio = Math.abs(dividendsPaid) / freeCashFlow;
      }

      // Score adjustment based on dividend sustainability
      if (dividendRatio >= 0.20 && dividendRatio <= 0.60) {
        score += 5; // Sustainable payout
      } else if (dividendRatio > 0.90 || dividendRatio < 0.05) {
        score -= 5; // Unsustainable or negligible
      }
      // Ratios between 0.05–0.20 and 0.60–0.90 are neutral (no adjustment)
    } else {
      logEvent('L24_FCF_MISSING', 'INFO',
        'freeCashFlow is null — dividend sustainability not assessed',
        { dividendsPaid });
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // SIGNAL 3: AUDITOR TIER
  // ────────────────────────────────────────────────────────────────────────

  const { tier: auditorTier, bonus: auditorBonus } = classifyAuditor(auditorName);
  score += auditorBonus;

  // ────────────────────────────────────────────────────────────────────────
  // FINAL CLAMPING
  // ────────────────────────────────────────────────────────────────────────

  score = Math.max(10, Math.min(90, score));

  // Round the slope for clean output
  roceSlope = +roceSlope.toFixed(4);
  dividendRatio = +dividendRatio.toFixed(4);

  logEvent('L24_MANAGEMENT_SCORE_COMPUTED', 'INFO',
    `Management quality score computed: score=${score}`,
    { score, roceSlope, dividendRatio, auditorTier, sector, isBfsi });

  return {
    ok: true,
    data: {
      score,
      roceSlope,
      dividendRatio,
      auditorTier,
      dataSource: 'management_quality_analysis'
    },
    meta: { fetchedAt, source: 'calc:calculateManagementQualityScore' }
  };
}

// ── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = {
  calculateManagementQualityScore
};
