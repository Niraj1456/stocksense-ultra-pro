// ═══════════════════════════════════════════════════════════════════════════
// LAYER 22 — MULTI-TIMEFRAME COHERENCE
// Domain: Trend Alignment (Daily / Weekly / Monthly)
//
// Evaluates whether daily, weekly, and monthly trends are aligned in
// the same direction. Coherent multi-timeframe trends have dramatically
// higher follow-through rates than single-timeframe signals.
//
// Each timeframe's direction is determined by:
//   - EMA20 vs EMA50 relationship (trend structure)
//   - MACD crossover state (momentum confirmation)
//
// The composite alignment classification drives the score and is
// also exported for use in interaction effects by downstream layers.
//
// Alignment Classifications:
//   FULL_BULLISH     → All 3 TFs positive   → 75
//   PARTIAL_BULLISH  → D+W positive, M not  → 62
//   NEUTRAL          → Mixed / sideways      → 50
//   PARTIAL_BEARISH  → D+W negative, M not  → 38
//   MISALIGNED       → Conflicting signals   → 30
//   FULL_BEARISH     → All 3 TFs negative   → 25
// ═══════════════════════════════════════════════════════════════════════════

// ── CONSTANTS ────────────────────────────────────────────────────────────
const LAYER_ID = 'L22';
const DATA_SOURCE = 'technical_indicators';

/**
 * Alignment classification → score mapping.
 * These are the L22 own scores used in the weighted sum.
 * @type {Object<string, number>}
 */
const ALIGNMENT_SCORES = {
  FULL_BULLISH:    75,
  PARTIAL_BULLISH: 62,
  NEUTRAL:         50,
  PARTIAL_BEARISH: 38,
  MISALIGNED:      30,
  FULL_BEARISH:    25
};

// ── STRUCTURED LOGGING ───────────────────────────────────────────────────

/**
 * Emits a structured log entry for Layer 22 events.
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
 * Determines the trend direction for a single timeframe.
 *
 * Rules:
 *   - EMA20 > EMA50 AND macdCrossover != 'BEARISH' → 'POSITIVE'
 *   - EMA20 < EMA50 AND macdCrossover != 'BULLISH' → 'NEGATIVE'
 *   - Otherwise → 'NEUTRAL' (conflicting EMA/MACD signals)
 *
 * @param {Object} tf - Timeframe data object
 * @param {number|null} tf.ema20         - 20-period EMA value
 * @param {number|null} tf.ema50         - 50-period EMA value
 * @param {string|null} tf.macdCrossover - MACD crossover state: 'BULLISH', 'BEARISH', or 'NEUTRAL'/null
 * @returns {'POSITIVE'|'NEGATIVE'|'NEUTRAL'}
 */
function classifyTimeframeTrend(tf) {
  // Guard: if timeframe data is missing or incomplete, return NEUTRAL
  if (!tf || tf.ema20 == null || tf.ema50 == null) {
    return 'NEUTRAL';
  }

  const ema20 = tf.ema20;
  const ema50 = tf.ema50;
  const macd = (tf.macdCrossover || '').toUpperCase();

  if (ema20 > ema50 && macd !== 'BEARISH') {
    // EMA structure is bullish and MACD is not contradicting
    return 'POSITIVE';
  }

  if (ema20 < ema50 && macd !== 'BULLISH') {
    // EMA structure is bearish and MACD is not contradicting
    return 'NEGATIVE';
  }

  // Conflicting signals: EMA says one thing, MACD says another
  return 'NEUTRAL';
}

/**
 * Classifies the overall multi-timeframe alignment from individual
 * timeframe directions.
 *
 * @param {'POSITIVE'|'NEGATIVE'|'NEUTRAL'} daily
 * @param {'POSITIVE'|'NEGATIVE'|'NEUTRAL'} weekly
 * @param {'POSITIVE'|'NEGATIVE'|'NEUTRAL'} monthly
 * @returns {string} Alignment classification
 */
function classifyAlignment(daily, weekly, monthly) {
  // FULL_BULLISH: All three positive
  if (daily === 'POSITIVE' && weekly === 'POSITIVE' && monthly === 'POSITIVE') {
    return 'FULL_BULLISH';
  }

  // FULL_BEARISH: All three negative
  if (daily === 'NEGATIVE' && weekly === 'NEGATIVE' && monthly === 'NEGATIVE') {
    return 'FULL_BEARISH';
  }

  // PARTIAL_BULLISH: Daily + Weekly positive, Monthly is negative or neutral
  if (daily === 'POSITIVE' && weekly === 'POSITIVE' && monthly !== 'POSITIVE') {
    return 'PARTIAL_BULLISH';
  }

  // PARTIAL_BEARISH: Daily + Weekly negative, Monthly is positive or neutral
  if (daily === 'NEGATIVE' && weekly === 'NEGATIVE' && monthly !== 'NEGATIVE') {
    return 'PARTIAL_BEARISH';
  }

  // NEUTRAL: All neutral, or a mix where shorter timeframes agree with neutral monthly
  if (daily === 'NEUTRAL' && weekly === 'NEUTRAL') {
    return 'NEUTRAL';
  }
  if (daily === 'NEUTRAL' || weekly === 'NEUTRAL') {
    // At least one short-term TF is sideways — treat as neutral unless
    // the other short-term TF matches monthly (which would be partial)
    if (monthly === 'NEUTRAL') return 'NEUTRAL';
  }

  // MISALIGNED: Daily and Weekly disagree, or other conflicting combos
  // e.g., Daily POSITIVE + Weekly NEGATIVE, or Daily NEGATIVE + Weekly POSITIVE
  if ((daily === 'POSITIVE' && weekly === 'NEGATIVE') ||
      (daily === 'NEGATIVE' && weekly === 'POSITIVE')) {
    return 'MISALIGNED';
  }

  // Catch-all: any remaining mixed state → NEUTRAL
  return 'NEUTRAL';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates the Layer 22 Multi-Timeframe Coherence score.
 *
 * @param {Object} params
 * @param {Object|null} params.daily   - Daily timeframe: { ema20, ema50, macdCrossover }
 * @param {Object|null} params.weekly  - Weekly timeframe: { ema20, ema50, macdCrossover }
 * @param {Object|null} params.monthly - Monthly timeframe: { ema20, ema50, macdCrossover }
 * @returns {{ ok: boolean, data: Object, meta: Object }}
 */
function calculateMTFCoherence({
  daily = null,
  weekly = null,
  monthly = null
} = {}) {
  // ── Classify each timeframe ────────────────────────────────────────
  const dailyTrend = classifyTimeframeTrend(daily);
  const weeklyTrend = classifyTimeframeTrend(weekly);
  const monthlyTrend = classifyTimeframeTrend(monthly);

  // ── Determine overall alignment ────────────────────────────────────
  const alignment = classifyAlignment(dailyTrend, weeklyTrend, monthlyTrend);

  // ── Map alignment to score ─────────────────────────────────────────
  let score = ALIGNMENT_SCORES[alignment];

  // Defensive: if alignment somehow doesn't match (should never happen),
  // fall back to neutral
  if (score == null) {
    score = ALIGNMENT_SCORES.NEUTRAL;
    emitLog('L22_ALIGNMENT_FALLBACK', 'WARN',
      'Alignment classification fell through to neutral default',
      { dailyTrend, weeklyTrend, monthlyTrend, alignment });
  }

  // ── Clamp to [10, 90] ─────────────────────────────────────────────
  score = clamp(score);

  // ── Logging ────────────────────────────────────────────────────────
  emitLog('L22_SCORE_COMPUTED', 'INFO',
    `Multi-TF coherence: ${alignment} → score ${score}`,
    {
      dailyTrend,
      weeklyTrend,
      monthlyTrend,
      alignment,
      score,
      daily: daily ? { ema20: daily.ema20, ema50: daily.ema50, macd: daily.macdCrossover } : null,
      weekly: weekly ? { ema20: weekly.ema20, ema50: weekly.ema50, macd: weekly.macdCrossover } : null,
      monthly: monthly ? { ema20: monthly.ema20, ema50: monthly.ema50, macd: monthly.macdCrossover } : null
    });

  return {
    ok: true,
    data: {
      score,
      alignment,
      dailyTrend,
      weeklyTrend,
      monthlyTrend,
      dataSource: DATA_SOURCE
    },
    meta: { fetchedAt: new Date().toISOString(), source: 'calc:calculateMTFCoherence' }
  };
}

module.exports = {
  calculateMTFCoherence
};
