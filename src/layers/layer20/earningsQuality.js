// ═══════════════════════════════════════════════════════════════════════════
// LAYER 20 — EARNINGS QUALITY & REVENUE DECOMPOSITION
// Domain: Accounting Quality & Revenue Sustainability
//
// Decomposes reported earnings into cash-backed vs. accrual-driven
// components using the Sloan Accruals Ratio. High accruals signal
// aggressive accounting — earnings that aren't supported by real cash
// flows tend to reverse within 1–2 quarters.
//
// Also tracks the Cash Conversion Cycle (CCC) trend and organic
// revenue growth to separate genuine business momentum from
// acquisition-fuelled top-line inflation.
//
// Sector-aware: BFSI companies bypass accruals checks entirely
// (their balance sheets are structurally different). Asset-heavy
// sectors use a relaxed threshold (0.35 vs 0.20).
//
// CAUTION: EARNINGS_QUALITY_MANIPULATION fires when accruals ratio
// exceeds sector-appropriate thresholds.
// ═══════════════════════════════════════════════════════════════════════════

// ── IMPORTS ──────────────────────────────────────────────────────────────
const { ACCRUALS_EPSILON } = require('../../config/mathConstants');
const { BFSI_SECTORS, ASSET_HEAVY_SECTORS } = require('../../config/sectorConstants');

// ── CONSTANTS ────────────────────────────────────────────────────────────
const LAYER_ID = 'L20';
const DATA_SOURCE = 'financial_statements';

// Accruals ratio tier boundaries
const ACCRUALS_EXCELLENT = 0.05;
const ACCRUALS_GOOD = 0.10;
const ACCRUALS_NEUTRAL = 0.20;
const ACCRUALS_ASSET_HEAVY_THRESHOLD = 0.35;

// CCC trend thresholds (days)
const CCC_INCREASE_ALERT_DAYS = 30;

// Organic growth thresholds
const ORGANIC_GROWTH_POSITIVE = 10; // > 10% organic growth is rewarded
const ORGANIC_GROWTH_ZERO = 0;      // Negative organic growth is penalized

// Caution constants
const CAUTION_CODE = 'EARNINGS_QUALITY_MANIPULATION';

// ── STRUCTURED LOGGING ───────────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 20 events.
 * @param {string} eventCode - Short event identifier
 * @param {string} severity  - One of: INFO, WARN, ERROR, FATAL
 * @param {string} message   - Human-readable log message
 * @param {Object} [details] - Optional payload
 */
function emitLog(eventCode, severity, message, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    layer_id: LAYER_ID,
    event_code: eventCode,
    severity,
    message,
    details
  }));
}

// ── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Clamps a numeric value to the universal [10, 90] scoring range.
 * @param {number} score - Raw score before clamping
 * @returns {number}
 */
function clamp(score) {
  return Math.max(10, Math.min(90, score));
}

/**
 * Safely coerces a value to a finite number, returning a default if invalid.
 * @param {*} val          - Input value
 * @param {number} fallback - Default when val is null/undefined/NaN
 * @returns {number}
 */
function safeNum(val, fallback) {
  if (val == null || !Number.isFinite(val)) return fallback;
  return val;
}

/**
 * Checks whether a given sector string belongs to the BFSI group.
 * Performs case-insensitive matching against the canonical BFSI_SECTORS list.
 * @param {string|null} sector
 * @returns {boolean}
 */
function isBFSI(sector) {
  if (!sector) return false;
  const normalized = sector.trim().toLowerCase();
  return BFSI_SECTORS.some(s => s.toLowerCase() === normalized);
}

/**
 * Checks whether a given sector string belongs to the asset-heavy group.
 * @param {string|null} sector
 * @returns {boolean}
 */
function isAssetHeavy(sector) {
  if (!sector) return false;
  const normalized = sector.trim().toLowerCase();
  return ASSET_HEAVY_SECTORS.some(s => s.toLowerCase() === normalized);
}

/**
 * Computes the Sloan Accruals Ratio.
 *
 * Formula: (NetIncome - CFO) / ((TotalAssets_t + TotalAssets_t1) / 2 + EPSILON)
 *
 * A higher ratio means a larger share of earnings comes from accruals
 * rather than cash — a red flag for earnings sustainability.
 *
 * @param {number} netIncome     - Net income for the period
 * @param {number} cfo           - Cash flow from operations
 * @param {number} totalAssets_t - Total assets at end of current period
 * @param {number} totalAssets_t1 - Total assets at end of prior period
 * @returns {number} Absolute accruals ratio (always ≥ 0)
 */
function computeAccrualsRatio(netIncome, cfo, totalAssets_t, totalAssets_t1) {
  const accruals = netIncome - cfo;
  const avgAssets = (totalAssets_t + totalAssets_t1) / 2 + ACCRUALS_EPSILON;
  // Return absolute value — direction matters less than magnitude
  return Math.abs(accruals / avgAssets);
}

/**
 * Computes the Cash Conversion Cycle (CCC) in days.
 *
 * CCC = DaysReceivable + DaysInventory - DaysPayable
 *
 * A rising CCC means the company is taking longer to convert
 * its resource investments into cash flows — working capital stress.
 *
 * @param {number} daysReceivable - Days sales outstanding
 * @param {number} daysInventory  - Days inventory outstanding
 * @param {number} daysPayable    - Days payable outstanding
 * @returns {number} CCC in days (can be negative for strong bargaining power)
 */
function computeCCC(daysReceivable, daysInventory, daysPayable) {
  return daysReceivable + daysInventory - daysPayable;
}

/**
 * Computes organic revenue growth by stripping out acquisition-driven growth.
 *
 * @param {number} revenueGrowth            - Total revenue growth (%)
 * @param {number} acquisitionRevenueGrowth  - Revenue growth from acquisitions (%)
 * @returns {number} Organic growth percentage
 */
function computeOrganicGrowth(revenueGrowth, acquisitionRevenueGrowth) {
  return revenueGrowth - acquisitionRevenueGrowth;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates the Layer 20 Earnings Quality score.
 *
 * Additive scoring from a 50-point neutral base:
 *   Accruals:
 *     < 0.05                                     → +15
 *     0.05–0.10                                  → +10
 *     0.10–0.20                                  → +0  (neutral)
 *     > 0.20 (non-BFSI, non-asset-heavy)         → -15 + CAUTION
 *     > 0.35 (asset-heavy sectors)               → -15 + CAUTION
 *     BFSI                                       → bypass (no adjustment)
 *   CCC Trend:
 *     Decreasing                                 → +5
 *     Increasing > 30 days                       → -10
 *   Organic Growth:
 *     > 10%                                      → +5
 *     Negative                                   → -5
 *
 * @param {Object} params
 * @param {number|null} params.netIncome                - Net income (₹ Cr or absolute)
 * @param {number|null} params.cfo                      - Cash flow from operations
 * @param {number|null} params.totalAssets_t             - Total assets, current period
 * @param {number|null} params.totalAssets_t1            - Total assets, prior period
 * @param {number|null} params.daysReceivable            - Days sales outstanding
 * @param {number|null} params.daysInventory             - Days inventory outstanding
 * @param {number|null} params.daysPayable               - Days payable outstanding
 * @param {number|null} params.revenueGrowth             - Total revenue growth (%)
 * @param {number|null} params.acquisitionRevenueGrowth  - Acquisition-driven revenue growth (%)
 * @param {string|null} params.sector                    - Company sector classification
 * @returns {{ ok: boolean, data: Object, meta: Object }}
 */
function calculateEarningsQualityScore({
  netIncome = null,
  cfo = null,
  totalAssets_t = null,
  totalAssets_t1 = null,
  daysReceivable = null,
  daysInventory = null,
  daysPayable = null,
  revenueGrowth = null,
  acquisitionRevenueGrowth = null,
  sector = null
} = {}) {
  // ── Neutral defaults for missing data ──────────────────────────────
  const ni = safeNum(netIncome, null);
  const cf = safeNum(cfo, null);
  const ta_t = safeNum(totalAssets_t, null);
  const ta_t1 = safeNum(totalAssets_t1, null);
  const dr = safeNum(daysReceivable, null);
  const di = safeNum(daysInventory, null);
  const dp = safeNum(daysPayable, null);
  const revGrowth = safeNum(revenueGrowth, null);
  const acqGrowth = safeNum(acquisitionRevenueGrowth, 0);

  // Start from neutral base
  let score = 50;
  let accrualRatio = null;
  let cccTrend = null;
  let organicGrowth = null;
  let cautionTriggered = false;
  let cautionCode = null;

  const sectorIsBFSI = isBFSI(sector);
  const sectorIsAssetHeavy = isAssetHeavy(sector);

  // ── 1. Sloan Accruals Ratio ────────────────────────────────────────
  const canComputeAccruals = (ni != null && cf != null && ta_t != null && ta_t1 != null);

  if (canComputeAccruals) {
    accrualRatio = computeAccrualsRatio(ni, cf, ta_t, ta_t1);

    if (sectorIsBFSI) {
      // BFSI bypass: banks/NBFCs have structurally different cash flow
      // statements — accruals analysis is meaningless for them
      emitLog('L20_BFSI_ACCRUALS_BYPASS_ACTIVE', 'INFO',
        `BFSI sector detected (${sector}) — accruals check bypassed`,
        { sector, accrualRatio: +accrualRatio.toFixed(4) });
      // No score adjustment
    } else if (accrualRatio < ACCRUALS_EXCELLENT) {
      // Outstanding cash backing — earnings are highly sustainable
      score += 15;
    } else if (accrualRatio < ACCRUALS_GOOD) {
      // Good cash backing
      score += 10;
    } else if (accrualRatio < ACCRUALS_NEUTRAL) {
      // Neutral — accruals within normal range
      // No adjustment
    } else if (sectorIsAssetHeavy && accrualRatio <= ACCRUALS_ASSET_HEAVY_THRESHOLD) {
      // Asset-heavy sectors naturally run higher accruals due to
      // depreciation timing, revenue recognition on long projects, etc.
      // Only flag if above the relaxed threshold.
      emitLog('L20_ASSET_HEAVY_ACCRUALS_ELEVATED', 'INFO',
        `Asset-heavy sector (${sector}) — using relaxed accruals threshold`,
        { sector, accrualRatio: +accrualRatio.toFixed(4), threshold: ACCRUALS_ASSET_HEAVY_THRESHOLD });
      // No adjustment — within relaxed tolerance
    } else {
      // Accruals exceed sector-appropriate threshold → CAUTION
      // This catches:
      //   - Non-BFSI, non-asset-heavy with ratio > 0.20
      //   - Asset-heavy sectors with ratio > 0.35
      score -= 15;
      cautionTriggered = true;
      cautionCode = CAUTION_CODE;
      emitLog('L20_EARNINGS_QUALITY_CAUTION', 'WARN',
        `CAUTION: High accruals ratio suggests earnings manipulation risk`,
        {
          sector,
          accrualRatio: +accrualRatio.toFixed(4),
          threshold: sectorIsAssetHeavy ? ACCRUALS_ASSET_HEAVY_THRESHOLD : ACCRUALS_NEUTRAL,
          cautionCode: CAUTION_CODE
        });
    }

    // Round for output
    accrualRatio = +accrualRatio.toFixed(4);
  } else {
    emitLog('L20_MISSING_ACCRUALS_DATA', 'WARN',
      'Insufficient data to compute accruals ratio — skipping accruals check',
      { hasNetIncome: ni != null, hasCFO: cf != null, hasAssets: ta_t != null && ta_t1 != null });
  }

  // ── 2. Cash Conversion Cycle Trend ─────────────────────────────────
  const canComputeCCC = (dr != null && di != null && dp != null);

  if (canComputeCCC) {
    cccTrend = computeCCC(dr, di, dp);

    if (cccTrend < 0) {
      // Negative CCC: company collects cash before paying suppliers
      // (strong bargaining power — e.g. FMCG, platform businesses)
      score += 5;
      emitLog('L20_CCC_DECREASING', 'INFO',
        'CCC is negative/decreasing — strong working capital efficiency',
        { cccTrend: +cccTrend.toFixed(1) });
    } else if (cccTrend > CCC_INCREASE_ALERT_DAYS) {
      // CCC > 30 days and rising: working capital stress
      score -= 10;
      emitLog('L20_CCC_INCREASING', 'WARN',
        `CCC exceeds ${CCC_INCREASE_ALERT_DAYS} days — working capital stress`,
        { cccTrend: +cccTrend.toFixed(1), threshold: CCC_INCREASE_ALERT_DAYS });
    }
    // Between 0 and 30: no adjustment

    cccTrend = +cccTrend.toFixed(1);
  } else {
    emitLog('L20_MISSING_CCC_DATA', 'INFO',
      'Insufficient data to compute CCC trend — skipping CCC check',
      { hasDR: dr != null, hasDI: di != null, hasDP: dp != null });
  }

  // ── 3. Organic Revenue Growth ──────────────────────────────────────
  if (revGrowth != null) {
    organicGrowth = computeOrganicGrowth(revGrowth, acqGrowth);

    if (organicGrowth > ORGANIC_GROWTH_POSITIVE) {
      // Strong organic growth — business is growing on its own merit
      score += 5;
    } else if (organicGrowth < ORGANIC_GROWTH_ZERO) {
      // Negative organic growth — stripping acquisitions reveals shrinkage
      score -= 5;
      emitLog('L20_NEGATIVE_ORGANIC_GROWTH', 'WARN',
        'Organic growth is negative — revenue quality concern',
        { organicGrowth: +organicGrowth.toFixed(2), revenueGrowth: revGrowth, acquisitionGrowth: acqGrowth });
    }

    organicGrowth = +organicGrowth.toFixed(2);
  } else {
    emitLog('L20_MISSING_REVENUE_DATA', 'INFO',
      'Revenue growth data unavailable — skipping organic growth check', {});
  }

  // ── Final clamping ─────────────────────────────────────────────────
  score = clamp(score);

  emitLog('L20_SCORE_COMPUTED', 'INFO',
    `Earnings quality score: ${score}`,
    { accrualRatio, cccTrend, organicGrowth, cautionTriggered, sector });

  return {
    ok: true,
    data: {
      score,
      accrualRatio,
      cccTrend,
      organicGrowth,
      cautionTriggered,
      cautionCode,
      sectorClassification: sectorIsBFSI ? 'BFSI' : (sectorIsAssetHeavy ? 'ASSET_HEAVY' : 'STANDARD'),
      dataSource: DATA_SOURCE
    },
    meta: { fetchedAt: new Date().toISOString(), source: 'calc:calculateEarningsQualityScore' }
  };
}

module.exports = {
  calculateEarningsQualityScore
};
