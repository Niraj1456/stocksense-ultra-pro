/**
 * rsRatingJob.js — Daily RS Rating Pre-Computation (Layer 8 support)
 *
 * Computes IBD-style Relative Strength ratings for the active universe.
 * Perf = 2*(C_t - C_{t-20})/C_{t-20} + 2*(C_t - C_{t-40})/C_{t-40}
 *      + (C_t - C_{t-65})/C_{t-65} + (C_t - C_{t-252})/C_{t-252}
 *
 * Schedule: daily after market close (e.g. 19:00 IST)
 */

const { dbQuery } = require('../lib/db');

const JOB_NAME = 'rs_rating_job';
const LAYER_ID = 'L08';

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
 * Compute EMA for an array of closing prices.
 * @param {number[]} closes - ordered oldest→newest
 * @param {number} period
 * @returns {number|null}
 */
function computeEMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Compute weighted relative performance score.
 * @param {number} current - current close
 * @param {object} lookbacks - { c20, c40, c65, c252 } past closing prices
 * @returns {number|null}
 */
function computeWeightedPerf(current, lookbacks) {
  const { c20, c40, c65, c252 } = lookbacks;
  if ([c20, c40, c65, c252].some(v => v == null || v === 0)) return null;

  const perf20 = (current - c20) / c20;
  const perf40 = (current - c40) / c40;
  const perf65 = (current - c65) / c65;
  const perf252 = (current - c252) / c252;

  return 2 * perf20 + 2 * perf40 + perf65 + perf252;
}

/**
 * Assign percentile ranks to an array of { symbol, rawScore } objects.
 * Mutates the objects in-place by adding `percentile` property.
 */
function assignPercentileRanks(scores) {
  const sorted = [...scores].sort((a, b) => a.rawScore - b.rawScore);
  const n = sorted.length;
  for (let i = 0; i < n; i++) {
    sorted[i].percentile = Math.round((i / (n - 1)) * 100);
  }
}

async function run() {
  const startedAt = new Date();
  log('INFO', 'RS_RATING_JOB_STARTED', 'RS rating computation started');

  try {
    // 1. Fetch active universe
    const universeRes = await dbQuery(
      `SELECT symbol, isin FROM universe_registry
       WHERE listed_at <= CURRENT_DATE
         AND (delisted_at IS NULL OR delisted_at >= CURRENT_DATE)`
    );
    const symbols = universeRes.rows;

    if (symbols.length === 0) {
      log('WARN', 'RS_RATING_EMPTY_UNIVERSE', 'No active symbols in universe_registry');
      await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, 'Empty universe, nothing to compute');
      return;
    }

    log('INFO', 'RS_RATING_UNIVERSE_LOADED', `Processing ${symbols.length} active symbols`);

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const scoredSymbols = [];

    // 2. Compute raw RS for each symbol
    for (const { symbol, isin } of symbols) {
      try {
        // Fetch last 260 trading days of closes (ordered oldest → newest)
        const priceRes = await dbQuery(
          `SELECT c, ts FROM price_history
           WHERE symbol = $1 AND interval = 'daily' AND c IS NOT NULL
           ORDER BY ts DESC
           LIMIT 260`,
          [symbol]
        );

        const rows = priceRes.rows;
        if (rows.length < 252) {
          log('DEBUG', 'RS_RATING_INSUFFICIENT_HISTORY', `Skipping ${symbol}: only ${rows.length} daily bars`, { symbol });
          continue;
        }

        // rows are DESC, so rows[0] = latest
        const currentClose = rows[0].c;
        const lookbacks = {
          c20: rows.length > 20 ? rows[20].c : null,
          c40: rows.length > 40 ? rows[40].c : null,
          c65: rows.length > 65 ? rows[65].c : null,
          c252: rows.length > 252 ? rows[252 - 1].c : null
        };

        const rawScore = computeWeightedPerf(currentClose, lookbacks);
        if (rawScore == null) continue;

        // Compute EMA50 / EMA200 for uptrend check
        // Need closes oldest→newest
        const closesAsc = rows.map(r => r.c).reverse();
        const ema50 = computeEMA(closesAsc, 50);
        const ema200 = computeEMA(closesAsc, 200);
        const inUptrend = (ema50 != null && ema200 != null)
          ? (currentClose > ema50 && ema50 > ema200)
          : false;

        scoredSymbols.push({ symbol, isin, rawScore, ema50, ema200, inUptrend });
      } catch (err) {
        log('WARN', 'RS_RATING_SYMBOL_ERROR', `Error processing ${symbol}`, { symbol, error: err.message });
      }
    }

    if (scoredSymbols.length === 0) {
      log('WARN', 'RS_RATING_NO_SCORES', 'No symbols produced valid RS scores');
      await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, 'No valid scores computed');
      return;
    }

    // 3. Assign percentile ranks
    assignPercentileRanks(scoredSymbols);

    // 4. Bulk insert into rs_ratings
    let insertedCount = 0;
    for (const s of scoredSymbols) {
      await dbQuery(
        `INSERT INTO rs_ratings (symbol, snapshot_date, weighted_performance, rs_percentile, is_confirmed_uptrend)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (symbol, snapshot_date) DO UPDATE SET
           weighted_performance = EXCLUDED.weighted_performance,
           rs_percentile = EXCLUDED.rs_percentile,
           is_confirmed_uptrend = EXCLUDED.is_confirmed_uptrend`,
        [s.symbol, snapshotDate, s.rawScore, s.percentile, s.inUptrend]
      );
      insertedCount++;
    }

    log('INFO', 'RS_RATING_JOB_COMPLETE', `RS ratings computed for ${insertedCount} symbols`, {
      total_universe: symbols.length,
      scored: scoredSymbols.length,
      snapshot_date: snapshotDate
    });

    await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, `Computed ${insertedCount} RS ratings`);
  } catch (err) {
    log('ERROR', 'RS_RATING_JOB_FAILED', 'RS rating job failed', { error: err.message, stack: err.stack });
    await updateJobStatus(JOB_NAME, 'FAILED', startedAt, err.message);
    throw err;
  }
}

async function updateJobStatus(jobName, status, startedAt, message) {
  try {
    await dbQuery(
      `INSERT INTO jobs (job_name, status, started_at, finished_at, message)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (job_name) DO UPDATE SET
         status = EXCLUDED.status,
         started_at = EXCLUDED.started_at,
         finished_at = EXCLUDED.finished_at,
         message = EXCLUDED.message`,
      [jobName, status, startedAt, message]
    );
  } catch (err) {
    log('ERROR', 'JOB_STATUS_UPDATE_FAILED', 'Failed to update jobs table', { error: err.message });
  }
}

module.exports = { run };
