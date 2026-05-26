/**
 * weightCalibrationJob.js — Self-Learning Weight Calibration (L25 / L26)
 *
 * AND-gated trigger: 48 hours since last calibration + 10 new closed trades.
 * Runs L25 ensembleCalibration → L26 walkForward → rotate_active_weights().
 *
 * Schedule: periodic check (every 4 hours, actual execution is AND-gated)
 */

const { dbQuery } = require('../lib/db');
const { getWeights } = require('../layers/layer13/weightTable');
const ensembleCalibration = require('../layers/layer25/ensembleCalibration');
const walkForward = require('../layers/layer26/walkForward');

const JOB_NAME = 'weightCalibrationJob';
const LAYER_ID = 'L25';
const MIN_HOURS_SINCE_LAST = 48;
const MIN_NEW_TRADES = 10;
const L25_MIN_TRADES = 130;

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
 * Check if the AND-gate conditions are met:
 * 1. At least MIN_HOURS_SINCE_LAST hours since last successful calibration
 * 2. At least MIN_NEW_TRADES new closed trades since last calibration
 */
async function checkGateConditions() {
  const lastRunRes = await dbQuery(
    `SELECT finished_at FROM jobs
     WHERE job_name = $1 AND status = 'SUCCESS'
     ORDER BY finished_at DESC LIMIT 1`,
    [JOB_NAME]
  );

  let hoursSinceLast = Infinity;
  let lastFinishedAt = null;

  if (lastRunRes && lastRunRes.rows && lastRunRes.rows.length > 0) {
    lastFinishedAt = new Date(lastRunRes.rows[0].finished_at);
    hoursSinceLast = (Date.now() - lastFinishedAt.getTime()) / (1000 * 60 * 60);
  }

  if (hoursSinceLast < MIN_HOURS_SINCE_LAST) {
    return { pass: false, reason: `Only ${hoursSinceLast.toFixed(1)}h since last calibration (need ${MIN_HOURS_SINCE_LAST}h)` };
  }

  const tradeCountRes = await dbQuery(
    `SELECT COUNT(*) AS cnt FROM trades
     WHERE exit_ts IS NOT NULL
       AND ($1::timestamptz IS NULL OR exit_ts > $1)`,
     [lastFinishedAt]
  );

  const newTrades = parseInt(tradeCountRes.rows[0].cnt, 10);
  if (newTrades < MIN_NEW_TRADES) {
    return { pass: false, reason: `Only ${newTrades} new trades (need ${MIN_NEW_TRADES})` };
  }

  return { pass: true, hoursSinceLast, newTrades };
}

/**
 * Normalizes trade mode values to INTRADAY or INVESTMENT
 */
function getNormalizedMode(trade) {
  if (trade.mode) {
    const m = trade.mode.toUpperCase();
    if (m === 'LT' || m === 'INVESTMENT' || m === 'POSITIONAL') return 'INVESTMENT';
  }
  return 'INTRADAY';
}

/**
 * Normalizes VIX regime values to LOW_VIX or HIGH_VIX
 */
function getNormalizedRegime(trade) {
  let js = {};
  if (typeof trade.json === 'object' && trade.json !== null) {
    js = trade.json;
  } else if (typeof trade.json === 'string') {
    try {
      js = JSON.parse(trade.json);
    } catch (e) {}
  }
  const reg = js.vixRegime || js.engineResult?.vixRegime || 'LOW_VIX';
  return reg === 'HIGH_VIX' ? 'HIGH_VIX' : 'LOW_VIX';
}

async function run() {
  const startedAt = new Date();
  log('INFO', 'WEIGHT_CALIBRATION_JOB_STARTED', 'Weight calibration check started');

  try {
    // 1. Check if weight calibration is enabled
    const enabledRes = await dbQuery(
      `SELECT value FROM system_config WHERE key = 'weight_calibration_enabled'`
    );
    if (!enabledRes || !enabledRes.rows || enabledRes.rows.length === 0 || enabledRes.rows[0].value !== 'true') {
      log('INFO', 'WEIGHT_CALIBRATION_DISABLED', 'Weight calibration is disabled in system_config');
      await updateJobStatus(JOB_NAME, 'SKIPPED', startedAt, 'Calibration disabled');
      return;
    }

    // 2. Validate engine_upgrade_date
    const upgradeDateRes = await dbQuery(
      `SELECT value FROM system_config WHERE key = 'engine_upgrade_date'`
    );
    if (!upgradeDateRes || !upgradeDateRes.rows || upgradeDateRes.rows.length === 0 || !upgradeDateRes.rows[0].value) {
      log('ERROR', 'ENGINE_UPGRADE_DATE_MISSING', 'engine_upgrade_date not found in system_config');
      await updateJobStatus(JOB_NAME, 'FAILED', startedAt, 'ENGINE_UPGRADE_DATE_MISSING');
      throw new Error('CRITICAL_UPGRADE_DATE_MISSING_ERROR');
    }

    const engineUpgradeDateStr = upgradeDateRes.rows[0].value;
    const engineUpgradeDate = new Date(engineUpgradeDateStr);
    if (isNaN(engineUpgradeDate.getTime())) {
      log('ERROR', 'ENGINE_UPGRADE_DATE_INVALID', 'engine_upgrade_date is not a valid date', {
        raw_value: engineUpgradeDateStr
      });
      await updateJobStatus(JOB_NAME, 'FAILED', startedAt, 'ENGINE_UPGRADE_DATE_INVALID');
      throw new Error('CRITICAL_UPGRADE_DATE_INVALID_ERROR');
    }

    // 3. Check AND-gate conditions
    const gate = await checkGateConditions();
    if (!gate.pass) {
      log('INFO', 'WEIGHT_CALIBRATION_GATE_NOT_MET', gate.reason);
      await updateJobStatus(JOB_NAME, 'SKIPPED', startedAt, gate.reason);
      return;
    }

    log('INFO', 'WEIGHT_CALIBRATION_GATE_PASSED', 'AND-gate conditions met', {
      hours_since_last: gate.hoursSinceLast,
      new_trades: gate.newTrades
    });

    // 4. Fetch closed trades after engine_upgrade_date
    const tradesRes = await dbQuery(
      `SELECT id, symbol, entry_ts, entry_price, exit_ts, exit_price, mae, json, mode
       FROM trades
       WHERE exit_ts IS NOT NULL
         AND entry_ts >= $1
       ORDER BY entry_ts ASC`,
      [engineUpgradeDate]
    );

    const closedTrades = tradesRes ? tradesRes.rows : [];
    if (closedTrades.length < L25_MIN_TRADES) {
      log('WARN', 'INSUFFICIENT_TRADE_HISTORY_FOR_SELF_LEARNING',
        `Only ${closedTrades.length} closed trades, need minimum ${L25_MIN_TRADES}`, {
          trade_count: closedTrades.length,
          min_required: L25_MIN_TRADES,
          since: engineUpgradeDate.toISOString()
        });
      await updateJobStatus(JOB_NAME, 'SKIPPED', startedAt,
        `INSUFFICIENT_TRADE_HISTORY_FOR_SELF_LEARNING: ${closedTrades.length} < ${L25_MIN_TRADES}`);
      return;
    }

    // Map and filter trades by mode and regime
    const modes = ['INTRADAY', 'INVESTMENT'];
    const regimes = ['LOW_VIX', 'HIGH_VIX'];

    for (const m of modes) {
      // Filter trades for this mode
      const modeTrades = closedTrades.filter(t => getNormalizedMode(t) === m);
      
      // Format trades for L26 (mapping keys)
      const formattedModeTrades = modeTrades.map(t => ({
        entryPrice: Number(t.entry_price),
        exitPrice: Number(t.exit_price),
        entryDate: t.entry_ts,
        exitDate: t.exit_ts,
        mode: m,
        layer_scores_json: t.json?.layer_scores || t.json?.layer_scores_json || t.json?.data?.rawScores || {}
      }));

      // Check minimum mode trades
      if (formattedModeTrades.length < L25_MIN_TRADES) {
        log('INFO', 'INSUFFICIENT_MODE_TRADES_FOR_WALKFORWARD',
          `Mode ${m} has only ${formattedModeTrades.length} closed trades. Skipping walk-forward.`, {
            mode: m,
            trade_count: formattedModeTrades.length
          });
        continue;
      }

      // 5. Invoke L26 walk-forward evaluation for this mode
      let wfeResult;
      try {
        wfeResult = walkForward.computeWalkForward({
          trades: formattedModeTrades,
          mode: m,
          windowSize: 130,
          stepSize: 50
        });

        // Save WFE metrics in system_config
        await dbQuery(
          `INSERT INTO system_config (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [`wfe_score_${m}`, String(wfeResult.data.wfeScore)]
        );
        await dbQuery(
          `INSERT INTO system_config (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [`wfe_decay_rate_${m}`, String(wfeResult.data.decayRate)]
        );
        await dbQuery(
          `INSERT INTO system_config (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [`wfe_alpha_decay_veto_${m}`, String(wfeResult.data.alphaDecayVeto)]
        );

        if (wfeResult.data.alphaDecayVeto) {
          log('ERROR', 'ALPHA_DECAY_HALT_ALERT', `Alpha decay halt veto triggered for mode ${m}!`, {
            mode: m,
            decay_rate: wfeResult.data.decayRate
          });
        }
      } catch (err) {
        log('ERROR', 'L26_WALK_FORWARD_FAILED', `Walk-forward evaluation failed for mode ${m}`, { error: err.message });
        continue;
      }

      // 6. Calibrate weights for each regime in this mode
      const wfeScore = wfeResult.data.wfeScore;

      for (const r of regimes) {
        // Filter trades for this specific mode and regime combination
        const combinationTrades = modeTrades.filter(t => getNormalizedRegime(t) === r);

        if (combinationTrades.length < L25_MIN_TRADES) {
          log('INFO', 'INSUFFICIENT_COMBINATION_TRADES',
            `Combination ${m} x ${r} has only ${combinationTrades.length} trades. Skipping calibration.`, {
              mode: m,
              regime: r,
              trade_count: combinationTrades.length
            });
          continue;
        }

        // Fetch static weights
        const staticWeights = getWeights(m, r);

        // Fetch latest active ceiling hit streak
        const streakRes = await dbQuery(
          `SELECT ceiling_hit_streak FROM weight_calibration_log
           WHERE mode = $1 AND regime = $2 AND is_active = TRUE
           ORDER BY calibrated_at DESC LIMIT 1`,
          [m, r]
        );
        const ceilingHitStreak = streakRes && streakRes.rows && streakRes.rows.length > 0 ? streakRes.rows[0].ceiling_hit_streak : {};

        // Fetch dirichlet multipliers from config
        const multRes = await dbQuery(
          `SELECT key, value FROM system_config WHERE key LIKE 'l25_dirichlet_multiplier%'`
        );
        const dirichletMultipliers = {};
        if (multRes && multRes.rows) {
          for (const row of multRes.rows) {
            if (row.key === 'l25_dirichlet_multiplier') {
              dirichletMultipliers.default = parseInt(row.value, 10);
            } else {
              const layer = row.key.replace('l25_dirichlet_multiplier_', '').toLowerCase();
              dirichletMultipliers[layer] = parseInt(row.value, 10);
            }
          }
        }

        // Run L25 calibration
        let calResult;
        try {
          calResult = ensembleCalibration.calibrateWeights({
            staticWeights,
            tradeHistory: combinationTrades,
            wfeScore,
            dirichletMultipliers,
            ceilingHitStreak,
            engineUpgradeDate
          });
        } catch (err) {
          log('ERROR', 'L25_CALIBRATION_FAILED', `Calibration failed for combination ${m} x ${r}`, { error: err.message });
          continue;
        }

        // Handle reset or rotation
        if (calResult.shouldReset) {
          log('ERROR', 'SYSTEM_WEIGHTS_RESET_ALERT', `Ceiling hit limit reached for ${m} x ${r}. Resetting to static.`, {
            mode: m,
            regime: r
          });
          await dbQuery(`CALL reset_weights_to_static()`);
        } else {
          // Call stored procedure to rotate weights
          await dbQuery(
            `CALL rotate_active_weights($1, $2, $3, $4, $5, $6)`,
            [
              m,
              r,
              calResult.lambda,
              wfeScore,
              JSON.stringify(calResult.calibratedWeights),
              JSON.stringify(calResult.newCeilingHitStreak)
            ]
          );

          log('INFO', 'WEIGHTS_ROTATED', `Active weights rotated for combination ${m} x ${r}`, {
            mode: m,
            regime: r,
            lambda: calResult.lambda,
            wfe_score: wfeScore
          });
        }
      }
    }

    log('INFO', 'WEIGHT_CALIBRATION_JOB_COMPLETE', 'Weight calibration completed successfully');
    await updateJobStatus(JOB_NAME, 'SUCCESS', startedAt, `Completed calibration cycle at ${new Date().toISOString()}`);
  } catch (err) {
    log('ERROR', 'WEIGHT_CALIBRATION_JOB_FAILED', 'Weight calibration job failed', {
      error: err.message,
      stack: err.stack
    });
    await updateJobStatus(JOB_NAME, 'FAILED', startedAt, err.message);
    throw err;
  }
}

async function updateJobStatus(jobName, status, startedAt, message) {
  try {
    await dbQuery(
      `INSERT INTO jobs (job_name, status, last_attempt, last_success, error_message)
       VALUES ($1, $2, NOW(), CASE WHEN $2 = 'SUCCESS' THEN NOW() ELSE NULL END, $3)
       ON CONFLICT (job_name) DO UPDATE SET
         status = EXCLUDED.status,
         last_attempt = EXCLUDED.last_attempt,
         last_success = CASE WHEN EXCLUDED.status = 'SUCCESS' THEN EXCLUDED.last_success ELSE jobs.last_success END,
         error_message = EXCLUDED.error_message`,
      [jobName, status, message]
    );
  } catch (err) {
    log('ERROR', 'JOB_STATUS_UPDATE_FAILED', 'Failed to update jobs table', { error: err.message });
  }
}

module.exports = { run };
