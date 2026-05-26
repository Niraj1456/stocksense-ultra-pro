/**
 * backAdjustmentJob.js — Price Back-Adjustment for Corporate Actions
 *
 * Triggered by corporateActionsSyncJob after SPLIT/BONUS inserts.
 * Adjusts o/h/l/c/v in price_history for all bars prior to ex_date.
 * Idempotent: checks price_adjustment_log before applying.
 *
 * Export: run(isin, exDate, actionType, details)
 */

const { dbQuery } = require('../lib/db');

const LAYER_ID = 'CORP_ACTIONS';

function log(severity, eventCode, message, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    layer_id: LAYER_ID,
    event_code: eventCode,
    severity,
    message,
    details
  };
  if (severity === 'ERROR') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Compute the adjustment factor from corporate action details.
 *
 * @param {string} actionType - 'SPLIT' or 'BONUS'
 * @param {object} details - action-specific parameters
 *   SPLIT:  { from: 10, to: 2 }  (face value 10 → 2, means 5:1 split)
 *   BONUS:  { ratio: '1:1' }     (1 bonus for every 1 held)
 * @returns {number} factor - divide prices by this, multiply volume by this
 */
function computeAdjustmentFactor(actionType, details) {
  if (actionType === 'SPLIT') {
    const from = Number(details.from);
    const to = Number(details.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to === 0) {
      throw new Error(`Invalid SPLIT details: from=${details.from}, to=${details.to}`);
    }
    // e.g. face value 10 → 2 means each old share becomes 5 new shares
    return from / to;
  }

  if (actionType === 'BONUS') {
    // ratio like "1:1" means 1 bonus for every 1 held → 2 total for 1 old
    const parts = String(details.ratio).split(':').map(Number);
    if (parts.length !== 2 || parts.some(p => !Number.isFinite(p) || p <= 0)) {
      throw new Error(`Invalid BONUS ratio: ${details.ratio}`);
    }
    const [bonus, held] = parts;
    return (bonus + held) / held;
  }

  throw new Error(`Unsupported action type for back-adjustment: ${actionType}`);
}

/**
 * Run back-adjustment for a single corporate action event.
 *
 * @param {string} isin - ISIN of the security
 * @param {string} exDate - ex-date in YYYY-MM-DD format
 * @param {string} actionType - 'SPLIT' or 'BONUS'
 * @param {object} details - action-specific parameters
 */
async function run(isin, exDate, actionType, details) {
  log('INFO', 'BACK_ADJUSTMENT_STARTED', `Processing ${actionType} for ${isin} ex-date ${exDate}`, {
    isin,
    ex_date: exDate,
    action_type: actionType,
    details
  });

  try {
    // 1. Idempotency check
    const existingRes = await dbQuery(
      `SELECT 1 FROM price_adjustment_log
       WHERE isin = $1 AND ex_date = $2 AND action_type = $3`,
      [isin, exDate, actionType]
    );

    if (existingRes.rows.length > 0) {
      log('INFO', 'BACK_ADJUSTMENT_ALREADY_APPLIED', `Adjustment already applied for ${isin} ${actionType} on ${exDate}`, {
        isin,
        ex_date: exDate,
        action_type: actionType
      });
      return { applied: false, reason: 'already_applied' };
    }

    // 2. Compute adjustment factor
    const factor = computeAdjustmentFactor(actionType, details);
    log('INFO', 'BACK_ADJUSTMENT_FACTOR', `Computed factor=${factor} for ${actionType}`, {
      isin,
      factor,
      action_type: actionType,
      details
    });

    if (factor === 1) {
      log('WARN', 'BACK_ADJUSTMENT_NOOP', 'Factor is 1, no adjustment needed', { isin });
      return { applied: false, reason: 'factor_is_1' };
    }

    // 3. Resolve symbol from ISIN (price_history uses symbol, not isin)
    const symbolRes = await dbQuery(
      `SELECT symbol FROM universe_registry WHERE isin = $1`,
      [isin]
    );

    if (symbolRes.rows.length === 0) {
      log('ERROR', 'BACK_ADJUSTMENT_SYMBOL_NOT_FOUND', `No symbol found for ISIN ${isin}`, { isin });
      return { applied: false, reason: 'symbol_not_found' };
    }
    const symbol = symbolRes.rows[0].symbol;

    // 4. Apply adjustment to price_history
    // Prices are divided by factor, volume is multiplied by factor
    const updateRes = await dbQuery(
      `UPDATE price_history
       SET c = c / $1,
           o = o / $1,
           h = h / $1,
           l = l / $1,
           v = v * $1
       WHERE symbol = $2 AND ts < $3::date`,
      [factor, symbol, exDate]
    );

    const rowsAffected = updateRes.rowCount;
    log('INFO', 'BACK_ADJUSTMENT_APPLIED', `Adjusted ${rowsAffected} price bars for ${symbol}`, {
      isin,
      symbol,
      ex_date: exDate,
      factor,
      rows_affected: rowsAffected
    });

    // 5. Log to price_adjustment_log for idempotency
    await dbQuery(
      `INSERT INTO price_adjustment_log (isin, symbol, ex_date, action_type, factor, rows_affected, applied_at, details)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [isin, symbol, exDate, actionType, factor, rowsAffected, JSON.stringify(details)]
    );

    log('INFO', 'BACK_ADJUSTMENT_COMPLETE', `Back-adjustment complete for ${symbol} ${actionType}`, {
      isin,
      symbol,
      ex_date: exDate,
      action_type: actionType,
      factor,
      rows_affected: rowsAffected
    });

    return { applied: true, factor, rowsAffected };
  } catch (err) {
    log('ERROR', 'BACK_ADJUSTMENT_FAILED', `Back-adjustment failed for ${isin}`, {
      isin,
      ex_date: exDate,
      action_type: actionType,
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { run };
