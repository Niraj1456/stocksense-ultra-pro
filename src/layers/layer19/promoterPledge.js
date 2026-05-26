// ═══════════════════════════════════════════════════════════════════════════
// LAYER 19 — PROMOTER PLEDGE TRACKER
// Domain: Promoter Risk & Corporate Governance
//
// Evaluates the risk posed by promoter share pledging. High pledge
// percentages signal financial distress at the promoter level and can
// trigger forced liquidation cascades. This layer tracks both the
// absolute pledge level and its quarter-over-quarter velocity to
// distinguish stable legacy pledges from deteriorating situations.
//
// FATAL VETO: PROMOTER_PLEDGE_DISTRESS_VETO fires when pledge > 50%
// AND velocity > 10% QoQ — indicating an accelerating death spiral.
// ═══════════════════════════════════════════════════════════════════════════

// ── CONSTANTS ────────────────────────────────────────────────────────────
const LAYER_ID = 'L19';
const DATA_SOURCE = 'promoter_pledge_table';

// Velocity direction thresholds (QoQ change in pledge percentage points)
const VELOCITY_STABLE_THRESHOLD = 0;   // ≤ 0 means stable or decreasing
const VELOCITY_MODERATE_THRESHOLD = 5; // < 5% QoQ is moderate increase
const VELOCITY_HIGH_THRESHOLD = 10;    // > 10% QoQ triggers severe concern

// Pledge percentage tier boundaries
const PLEDGE_NEGLIGIBLE = 1;   // < 1% treated as effectively zero
const PLEDGE_LOW = 5;
const PLEDGE_MODERATE = 15;
const PLEDGE_HIGH = 30;
const PLEDGE_SEVERE = 50;

// Veto constants
const VETO_CODE = 'PROMOTER_PLEDGE_DISTRESS_VETO';

// ── STRUCTURED LOGGING ───────────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 19 events.
 * @param {string} eventCode - Short event identifier (e.g. L19_VETO_TRIGGERED)
 * @param {string} severity  - One of: INFO, WARN, ERROR, FATAL
 * @param {string} message   - Human-readable log message
 * @param {Object} [details] - Optional payload with numeric/contextual data
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
 * @returns {number} Clamped score
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
 * Determines velocity direction label from QoQ pledge velocity.
 * @param {number} velocity - Quarter-over-quarter change in pledge %
 * @returns {'DECREASING'|'STABLE'|'INCREASING_MODERATE'|'INCREASING_HIGH'}
 */
function classifyVelocity(velocity) {
  if (velocity < 0) return 'DECREASING';
  if (velocity === 0) return 'STABLE';
  if (velocity < VELOCITY_MODERATE_THRESHOLD) return 'INCREASING_MODERATE';
  return 'INCREASING_HIGH';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates the Layer 19 Promoter Pledge risk score.
 *
 * Score Mapping (higher = safer):
 *   Pledge% = 0% (or < 1%)                            → 80
 *   Pledge% < 5% stable/decreasing                    → 75
 *   Pledge% < 5% increasing < 5% QoQ                  → 65
 *   Pledge% 5–15% stable/decreasing                   → 60
 *   Pledge% 5–15% increasing < 5% QoQ                 → 55
 *   Pledge% 15–30% stable/decreasing                  → 50 (neutral)
 *   Pledge% 15–30% increasing < 5% QoQ                → 45
 *   Pledge% 30–50% stable/decreasing
 *     OR velocity > 5% QoQ (with total ≤ 50%)         → 30
 *   Pledge% > 50% AND velocity > 10%                  → 10 + FATAL VETO
 *   Pledge% > 50% AND velocity ≤ 10%                  → 20 (severe, no veto)
 *
 * @param {Object} params
 * @param {number|null} params.pledgedSharesPct       - Current pledged shares as % of promoter holding
 * @param {number|null} params.promoterHoldingPct     - Promoter holding as % of total equity
 * @param {number|null} params.pledgeVelocityQoQ      - QoQ change in pledge % (positive = increasing)
 * @param {boolean}     params.hasCorporateActionMask  - True if QIP/RIGHTS action exists this quarter
 * @param {boolean}     params.bulkDealAlert           - True if bulk deal alert flagged in promoter_pledge table
 * @returns {{ ok: boolean, data: Object, meta: Object }}
 */
function calculatePromoterPledgeScore({
  pledgedSharesPct = null,
  promoterHoldingPct = null,
  pledgeVelocityQoQ = null,
  hasCorporateActionMask = false,
  bulkDealAlert = false
} = {}) {
  // ── Null/undefined guard: return neutral on missing data ───────────
  const pledgePct = safeNum(pledgedSharesPct, null);
  const promoterPct = safeNum(promoterHoldingPct, null);
  let velocityQoQ = safeNum(pledgeVelocityQoQ, 0);

  if (pledgePct == null) {
    emitLog('L19_MISSING_PLEDGE_DATA', 'WARN',
      'Pledge percentage data unavailable — returning neutral score', {});
    return {
      ok: true,
      data: {
        score: 50,
        pledgePct: null,
        velocityQoQ: null,
        vetoTriggered: false,
        vetoCode: null,
        bulkDealAlert: false,
        dataSource: DATA_SOURCE
      },
      meta: { fetchedAt: new Date().toISOString(), source: 'calc:calculatePromoterPledgeScore' }
    };
  }

  // ── Corporate action muting ────────────────────────────────────────
  // When a QIP or RIGHTS issue occurs this quarter, equity dilution
  // mechanically distorts pledge velocity. We zero it out to prevent
  // false alarms from legitimate capital-raising events.
  if (hasCorporateActionMask) {
    emitLog('L19_PLEDGE_VELOCITY_MUTED_DUE_TO_EQUITY_DILUTION', 'INFO',
      'Pledge velocity zeroed — corporate action (QIP/RIGHTS) detected this quarter',
      { original_velocity: velocityQoQ });
    velocityQoQ = 0.00;
  }

  // ── Bulk deal alert logging ────────────────────────────────────────
  if (bulkDealAlert) {
    emitLog('L19_BULK_DEAL_ALERT', 'WARN',
      'Bulk deal alert flagged — potential promoter share offloading detected',
      { pledgePct, velocityQoQ });
  }

  // ── Classify velocity direction ────────────────────────────────────
  const velocityDir = classifyVelocity(velocityQoQ);
  const isStableOrDecreasing = (velocityDir === 'STABLE' || velocityDir === 'DECREASING');
  const isModerateIncrease = (velocityDir === 'INCREASING_MODERATE');

  // ── Score determination ────────────────────────────────────────────
  let score = 50;
  let vetoTriggered = false;
  let vetoCode = null;

  if (pledgePct < PLEDGE_NEGLIGIBLE) {
    // Tier 1: Effectively zero pledge
    score = 80;
  } else if (pledgePct < PLEDGE_LOW) {
    // Tier 2: Low pledge (< 5%)
    if (isStableOrDecreasing) {
      score = 75;
    } else {
      // Increasing but moderate (< 5% QoQ) — still manageable
      score = 65;
    }
  } else if (pledgePct < PLEDGE_MODERATE) {
    // Tier 3: Moderate pledge (5–15%)
    if (isStableOrDecreasing) {
      score = 60;
    } else if (isModerateIncrease) {
      score = 55;
    } else {
      // Velocity ≥ 5% QoQ with 5–15% pledge — falls through to high-velocity bucket
      score = 30;
    }
  } else if (pledgePct < PLEDGE_HIGH) {
    // Tier 4: Elevated pledge (15–30%)
    if (isStableOrDecreasing) {
      score = 50;
    } else if (isModerateIncrease) {
      score = 45;
    } else {
      // Velocity ≥ 5% QoQ with 15–30% pledge — falls through to high-velocity bucket
      score = 30;
    }
  } else if (pledgePct <= PLEDGE_SEVERE) {
    // Tier 5: High pledge (30–50%) — always dangerous
    // Whether stable/decreasing or velocity > 5% QoQ, scored at 30
    score = 30;
  } else {
    // Tier 6: Severe pledge (> 50%)
    if (velocityQoQ > VELOCITY_HIGH_THRESHOLD) {
      // FATAL: Accelerating pledge spiral — forced liquidation imminent
      score = 10;
      vetoTriggered = true;
      vetoCode = VETO_CODE;
      emitLog('L19_VETO_TRIGGERED', 'FATAL',
        `PROMOTER_PLEDGE_DISTRESS_VETO: pledge=${pledgePct}%, velocity=${velocityQoQ}% QoQ`,
        { pledgePct, velocityQoQ, vetoCode: VETO_CODE });
    } else {
      // Severe but not accelerating — very low score, no veto
      score = 20;
      emitLog('L19_SEVERE_PLEDGE', 'WARN',
        `Pledge > 50% but velocity contained — severe penalty applied`,
        { pledgePct, velocityQoQ });
    }
  }

  // ── Bulk deal alert penalty ────────────────────────────────────────
  // An additional -5 penalty when bulk deals coincide with elevated pledges.
  // This catches promoters quietly offloading shares while pledges are high.
  if (bulkDealAlert && pledgePct >= PLEDGE_LOW) {
    const penaltyBefore = score;
    score = score - 5;
    emitLog('L19_BULK_DEAL_PENALTY', 'INFO',
      'Applied -5 penalty for bulk deal alert with elevated pledge',
      { scoreBefore: penaltyBefore, scoreAfter: score, pledgePct });
  }

  // ── Final clamping ─────────────────────────────────────────────────
  score = clamp(score);

  emitLog('L19_SCORE_COMPUTED', 'INFO',
    `Promoter pledge score: ${score}`,
    { pledgePct, velocityQoQ, velocityDir, vetoTriggered, bulkDealAlert, promoterPct });

  return {
    ok: true,
    data: {
      score,
      pledgePct,
      velocityQoQ,
      vetoTriggered,
      vetoCode,
      bulkDealAlert,
      velocityDirection: velocityDir,
      promoterHoldingPct: promoterPct,
      hasCorporateActionMask,
      dataSource: DATA_SOURCE
    },
    meta: { fetchedAt: new Date().toISOString(), source: 'calc:calculatePromoterPledgeScore' }
  };
}

module.exports = {
  calculatePromoterPledgeScore
};
