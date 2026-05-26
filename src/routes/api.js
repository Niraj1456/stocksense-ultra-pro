const express = require('express');
const router = express.Router();
const { dbQuery } = require('../lib/db');
const { getWeights, WEIGHT_TABLE } = require('../layers/layer13/weightTable');
const { logger } = require('../lib/logger');

// Middleware to validate X-API-KEY
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY || 'stocksense-secret-api-key';
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'unauthorized_api_key' });
  }
  next();
}

// GET /api/health
router.get('/health', authenticate, async (req, res) => {
  let status = 'OK';
  const reasons = [];
  const details = {};

  try {
    // 1. Fetch system config
    const configRes = await dbQuery('SELECT key, value FROM system_config');
    const config = {};
    if (configRes && configRes.rows) {
      for (const row of configRes.rows) {
        config[row.key] = row.value;
      }
    }

    // 2. Fetch jobs status
    const jobsRes = await dbQuery('SELECT job_name, last_success, last_attempt, status, error_message FROM jobs');
    const jobsList = jobsRes && jobsRes.rows ? jobsRes.rows : [];

    const jobTtls = {
      rsRatingJob: Number(config.job_rsRatingJob_ttl_hours || 26),
      peerDataJob: Number(config.job_peerDataJob_ttl_hours || 26),
      weightCalibrationJob: Number(config.job_weightCalibrationJob_ttl_hours || 52),
      bsePledgeScraper: Number(config.job_bsePledgeScraper_ttl_hours || 192),
      bseBulkDealsJob: Number(config.job_bseBulkDealsJob_ttl_hours || 26),
      corporateActionsSyncJob: Number(config.job_corporateActionsSyncJob_ttl_hours || 26),
      partitionMaintenanceJob: Number(config.job_partitionMaintenanceJob_ttl_hours || 744),
      overrideExpiryJob: Number(config.job_overrideExpiryJob_ttl_hours || 2)
    };

    details.jobs = {};
    for (const job of jobsList) {
      const name = job.job_name;
      const lastSuccess = job.last_success;
      let jobStatus = job.status || 'OK';
      let jobReason = null;

      if (!lastSuccess) {
        jobStatus = 'DEGRADED';
        jobReason = 'MISSING_LAST_SUCCESS';
        status = 'DEGRADED';
        reasons.push(`Job ${name} has never succeeded`);
      } else {
        const ttlHours = jobTtls[name] || 26;
        const elapsedHours = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 3600);
        if (elapsedHours > ttlHours) {
          jobStatus = 'DEGRADED';
          jobReason = 'TTL_EXCEEDED';
          status = 'DEGRADED';
          reasons.push(`Job ${name} has exceeded its TTL threshold of ${ttlHours} hours (elapsed: ${elapsedHours.toFixed(1)}h)`);
        }
      }

      if (job.status === 'ERROR') {
        jobStatus = 'DEGRADED';
        jobReason = 'LAST_RUN_FAILED';
        status = 'DEGRADED';
        reasons.push(`Job ${name} last execution failed: ${job.error_message}`);
      }

      details.jobs[name] = {
        last_success: lastSuccess,
        last_attempt: job.last_attempt,
        status: jobStatus,
        reason: jobReason,
        error_message: job.error_message
      };
    }

    // Ensure all 8 jobs are registered, else mark DEGRADED
    const expectedJobs = Object.keys(jobTtls);
    for (const jobName of expectedJobs) {
      if (!details.jobs[jobName]) {
        status = 'DEGRADED';
        reasons.push(`Job ${jobName} is not registered in the jobs table`);
        details.jobs[jobName] = { status: 'DEGRADED', reason: 'NOT_REGISTERED' };
      }
    }

    // 3. Check corporate actions staleness
    const caRes = await dbQuery('SELECT MAX(created_at) AS last_action FROM corporate_actions');
    const lastAction = caRes && caRes.rows && caRes.rows.length > 0 ? caRes.rows[0].last_action : null;
    if (lastAction) {
      const caElapsedHours = (Date.now() - new Date(lastAction).getTime()) / (1000 * 3600);
      details.corporate_actions = { last_action: lastAction, elapsed_hours: caElapsedHours };
      if (caElapsedHours > 336) {
        status = 'DEGRADED';
        reasons.push(`Corporate actions feed is stale. Last announcement sync was ${caElapsedHours.toFixed(1)} hours ago.`);
        details.corporate_actions.status = 'DEGRADED';
        details.corporate_actions.event_code = 'CORPORATE_ACTIONS_FEED_STALE';
      } else {
        details.corporate_actions.status = 'OK';
      }
    } else {
      status = 'DEGRADED';
      reasons.push('Corporate actions table has no records.');
      details.corporate_actions = { status: 'DEGRADED', last_action: null, event_code: 'CORPORATE_ACTIONS_FEED_STALE' };
    }

    // 4. Check Walk-Forward Efficiency (WFE) and Alpha Decay Rate
    details.walk_forward = {};
    const modes = ['INTRADAY', 'INVESTMENT'];
    for (const mode of modes) {
      const wfeVal = config[`wfe_score_${mode}`];
      const decayVal = config[`wfe_decay_rate_${mode}`];
      
      const wfe = wfeVal != null ? parseFloat(wfeVal) : null;
      const decay = decayVal != null ? parseFloat(decayVal) : null;

      details.walk_forward[mode] = { wfe_score: wfe, decay_rate: decay };

      if (wfe != null && wfe < 0.55) {
        status = 'DEGRADED';
        reasons.push(`WFE score for mode ${mode} is below safety threshold: ${wfe} (need >= 0.55)`);
      }
      if (decay != null && decay < -0.10) {
        status = 'DEGRADED';
        reasons.push(`Alpha decay rate for mode ${mode} is warning: ${decay} (need >= -0.10)`);
      }
    }

    // 5. Check if calibration is disabled due to ceiling streak rollback
    const calibrationEnabled = config.weight_calibration_enabled === 'true';
    const resetTime = config.weight_reset_timestamp;
    details.calibration = { enabled: calibrationEnabled, reset_at: resetTime };
    if (!calibrationEnabled && resetTime) {
      status = 'DEGRADED';
      reasons.push(`Weight calibration has been automatically disabled due to safety rollbacks at ${resetTime}`);
    }

    res.json({
      status,
      timestamp: new Date().toISOString(),
      reasons,
      details
    });

  } catch (err) {
    logger.error('health_check_failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_health_check_failed', message: err.message });
  }
});

// POST /api/weights/override
router.post('/weights/override', authenticate, async (req, res) => {
  const { mode, regime, weights, expiry_hours } = req.body;

  // 1. Basic Payload Validation
  if (!mode || !regime || !weights || typeof weights !== 'object' || !expiry_hours) {
    return res.status(400).json({ error: 'invalid_payload_fields' });
  }

  const normalizedMode = mode.toUpperCase() === 'LT' || mode.toUpperCase() === 'INVESTMENT' ? 'INVESTMENT' : 'INTRADAY';
  const normalizedRegime = regime.toUpperCase() === 'HIGH_VIX' ? 'HIGH_VIX' : 'LOW_VIX';

  try {
    // 2. Validate Weight Sum
    let totalWeight = 0;
    const staticWeights = getWeights(normalizedMode, normalizedRegime);
    const layerKeys = Object.keys(staticWeights).filter(k => k !== 'layer12_risk');

    for (const key of layerKeys) {
      const weightVal = weights[key];
      if (weightVal == null || typeof weightVal !== 'number' || isNaN(weightVal)) {
        return res.status(400).json({ error: `Missing or invalid weight value for layer ${key}` });
      }
      totalWeight += weightVal;

      // 3. Validate Floors and Ceilings
      const staticWeight = staticWeights[key] || 0;
      const floor = staticWeight === 0 ? 1.0 : 2.0;
      const ceiling = 30.0;

      if (weightVal < floor || weightVal > ceiling) {
        return res.status(400).json({ 
          error: 'weight_bounds_violation', 
          message: `Weight for ${key} (${weightVal}%) must be between ${floor}% and ${ceiling}%` 
        });
      }
    }

    // Check sum equals exactly 100
    if (Math.abs(totalWeight - 100.0) > 0.0001) {
      return res.status(400).json({ 
        error: 'invalid_weight_sum', 
        message: `Sum of weights must be exactly 100.0%, current sum is ${totalWeight}%` 
      });
    }

    // 4. Apply override weights
    logger.warn('manual_weight_override_activating', {
      mode: normalizedMode,
      regime: normalizedRegime,
      weights,
      expiry_hours
    });

    // Disable auto-calibration
    await dbQuery(
      `INSERT INTO system_config (key, value) VALUES ('weight_calibration_enabled', 'false')
       ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()`
    );

    // Save override weights using stored procedure rotate_active_weights
    // lambda_value = 1.0, wfe_score = 1.00
    await dbQuery(
      `CALL rotate_active_weights($1, $2, 1.0, 1.00, $3, '{}'::jsonb)`,
      [normalizedMode, normalizedRegime, JSON.stringify(weights)]
    );

    // Persist manual override expiry key in system_config
    const expiryTimestamp = new Date(Date.now() + expiry_hours * 3600000).toISOString();
    await dbQuery(
      `INSERT INTO system_config (key, value) VALUES ('manual_override_expiry', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [expiryTimestamp]
    );

    // Log active override to console standard logging format
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      layer_id: 'SYSTEM',
      event_code: 'MANUAL_WEIGHT_OVERRIDE_ACTIVE',
      severity: 'WARN',
      message: `Manual weight override activated for ${normalizedMode} x ${normalizedRegime} with expiry of ${expiry_hours} hours`,
      details: { mode: normalizedMode, regime: normalizedRegime, weights, expiry: expiryTimestamp }
    }));

    res.json({
      ok: true,
      message: `Manual override weights successfully applied for ${normalizedMode} x ${normalizedRegime}`,
      expiry: expiryTimestamp
    });

  } catch (err) {
    logger.error('manual_weight_override_failed', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'manual_override_application_failed', message: err.message });
  }
});

module.exports = { apiRouter: router };
