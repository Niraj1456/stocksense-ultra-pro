/**
 * overrideExpiryJob.js — Hourly Manual Weight Override Expiration Guard
 *
 * Runs hourly to check if the manual weight override has expired.
 * If expired, calls stored procedure reset_weights_to_static(),
 * deletes the manual_override_expiry key, and logs MANUAL_WEIGHT_OVERRIDE_EXPIRED.
 *
 * Export: async function run()
 */

const { dbQuery } = require('../lib/db');

const LAYER_ID = 'SYSTEM';
const JOB_NAME = 'overrideExpiryJob';

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
 * Runs the manual override expiry guard job.
 */
async function run() {
  log('INFO', 'OVERRIDE_EXPIRY_CHECK_STARTED', 'Checking manual weight override expiration state.');

  // Update running status
  await dbQuery(
    `INSERT INTO jobs (job_name, last_attempt, status)
     VALUES ($1, NOW(), 'RUNNING')
     ON CONFLICT (job_name) DO UPDATE
     SET last_attempt = NOW(), status = 'RUNNING'`,
    [JOB_NAME]
  );

  try {
    const expiryRes = await dbQuery(
      `SELECT value FROM system_config WHERE key = 'manual_override_expiry'`
    );

    if (expiryRes.rows.length > 0) {
      const expiryStr = expiryRes.rows[0].value;
      const expiryDate = new Date(expiryStr);
      const now = new Date();

      log('INFO', 'OVERRIDE_EXPIRY_CHECK', `Found manual override expiry setting: ${expiryStr}. Current time: ${now.toISOString()}`, {
        expiry: expiryStr,
        now: now.toISOString()
      });

      if (now > expiryDate) {
        log('WARN', 'MANUAL_WEIGHT_OVERRIDE_EXPIRED', 'Manual weight override has expired. Resetting weights to static baseline.', {
          expiry_time: expiryStr,
          reset_time: now.toISOString()
        });

        // 1. Call stored procedure to deactivate calibrated logs and disable toggle
        await dbQuery('CALL reset_weights_to_static()');

        // 2. Delete expiry key
        await dbQuery(
          `DELETE FROM system_config WHERE key = 'manual_override_expiry'`
        );

        log('INFO', 'MANUAL_WEIGHT_RESET_COMPLETED', 'Successfully reset weights to static baseline and cleared manual_override_expiry.');
      } else {
        log('INFO', 'OVERRIDE_ACTIVE', `Manual override is still active (expires in ${((expiryDate - now) / (1000 * 60 * 60)).toFixed(2)} hours).`);
      }
    } else {
      log('INFO', 'NO_OVERRIDE_ACTIVE', 'No manual override configuration exists.');
    }

    // Success update
    await dbQuery(
      `UPDATE jobs
       SET last_success = NOW(), status = 'OK', error_message = NULL
       WHERE job_name = $1`,
      [JOB_NAME]
    );

    return { ok: true };

  } catch (err) {
    await dbQuery(
      `UPDATE jobs
       SET status = 'ERROR', error_message = $2
       WHERE job_name = $1`,
      [JOB_NAME, err.message]
    );

    log('ERROR', 'OVERRIDE_EXPIRY_FAILED', 'Failed override expiry guard job execution.', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { run };
