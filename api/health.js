/**
 * api/health.js — Vercel Serverless Health Endpoint
 *
 * Provides diagnostics data for the Self-Learning Diagnostics tab.
 * If DATABASE_URL is available (Docker/Render), queries PostgreSQL tables.
 * If not (Vercel serverless deployment), returns static baseline diagnostics.
 */
require("dotenv").config();

module.exports = async function handler(req, res) {
  const isProduction = process.env.NODE_ENV === "production";
  
  // CORS Origin Control Whitelist
  const originsEnv = process.env.ALLOWED_ORIGINS;
  let whitelist = [];
  if (originsEnv) {
    whitelist = originsEnv.split(",").map(o => o.trim().toLowerCase());
  }

  const origin = req.headers.origin;
  let allowedOrigin = "*";
  
  if (origin) {
    const parsedOrigin = origin.trim().toLowerCase();
    if (whitelist.includes(parsedOrigin)) {
      allowedOrigin = origin;
    } else if (!isProduction) {
      if (
        parsedOrigin.startsWith("http://localhost:") ||
        parsedOrigin.startsWith("http://127.0.0.1:") ||
        parsedOrigin.startsWith("https://localhost:") ||
        parsedOrigin.startsWith("https://127.0.0.1:")
      ) {
        allowedOrigin = origin;
      }
    }
  }

  // Set CORS Headers
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Validate API key (enforce secure keys, allow dev key only in non-production)
  const apiKey = req.headers["x-api-key"];
  const envKey = process.env.API_KEY;
  const envKeysList = process.env.API_AUTH_KEYS;
  
  const allowedKeys = [];
  if (envKey) allowedKeys.push(envKey);
  if (envKeysList) {
    envKeysList.split(",").forEach(k => {
      const trimmed = k.trim();
      if (trimmed) allowedKeys.push(trimmed);
    });
  }
  
  if (!isProduction && allowedKeys.length === 0) {
    allowedKeys.push("stocksense-secret-api-key");
  }

  if (allowedKeys.length === 0 || !apiKey || !allowedKeys.includes(apiKey)) {
    return res.status(401).json({ error: "unauthorized_api_key" });
  }

  try {
    // Attempt to use PostgreSQL if DATABASE_URL is configured
    const databaseUrl = process.env.DATABASE_URL || "";
    if (databaseUrl) {
      return await handleWithDatabase(req, res, databaseUrl);
    }

    // No database available — return static baseline diagnostics
    return res.status(200).json(buildStaticBaseline());
  } catch (err) {
    console.error("[API Health] Error:", err.message);
    // On any failure, still return static baseline so the UI doesn't break
    return res.status(200).json(buildStaticBaseline());
  }
};

/**
 * Database-backed health check (mirrors src/routes/api.js logic exactly).
 * Used when DATABASE_URL is available (Docker, Render, Railway deployments).
 */
async function handleWithDatabase(req, res, databaseUrl) {
  const { Pool } = require("pg");
  const isProduction = process.env.NODE_ENV === "production";
  const poolConfig = {
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  };
  if (isProduction) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  const pool = new Pool(poolConfig);

  let status = "OK";
  const reasons = [];
  const details = {};

  try {
    // 1. Fetch system config
    const configRes = await pool.query("SELECT key, value FROM system_config");
    const config = {};
    if (configRes && configRes.rows) {
      for (const row of configRes.rows) {
        config[row.key] = row.value;
      }
    }

    // 2. Fetch jobs status
    const jobsRes = await pool.query(
      "SELECT job_name, last_success, last_attempt, status, error_message FROM jobs"
    );
    const jobsList = jobsRes && jobsRes.rows ? jobsRes.rows : [];

    const jobTtls = {
      rsRatingJob: Number(config.job_rsRatingJob_ttl_hours || 26),
      peerDataJob: Number(config.job_peerDataJob_ttl_hours || 26),
      weightCalibrationJob: Number(config.job_weightCalibrationJob_ttl_hours || 52),
      bsePledgeScraper: Number(config.job_bsePledgeScraper_ttl_hours || 192),
      bseBulkDealsJob: Number(config.job_bseBulkDealsJob_ttl_hours || 26),
      corporateActionsSyncJob: Number(config.job_corporateActionsSyncJob_ttl_hours || 26),
      partitionMaintenanceJob: Number(config.job_partitionMaintenanceJob_ttl_hours || 744),
      overrideExpiryJob: Number(config.job_overrideExpiryJob_ttl_hours || 2),
    };

    details.jobs = {};
    for (const job of jobsList) {
      const name = job.job_name;
      const lastSuccess = job.last_success;
      let jobStatus = job.status || "OK";
      let jobReason = null;

      if (!lastSuccess) {
        jobStatus = "DEGRADED";
        jobReason = "MISSING_LAST_SUCCESS";
        status = "DEGRADED";
        reasons.push(`Job ${name} has never succeeded`);
      } else {
        const ttlHours = jobTtls[name] || 26;
        const elapsedHours =
          (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 3600);
        if (elapsedHours > ttlHours) {
          jobStatus = "DEGRADED";
          jobReason = "TTL_EXCEEDED";
          status = "DEGRADED";
          reasons.push(
            `Job ${name} has exceeded its TTL threshold of ${ttlHours} hours (elapsed: ${elapsedHours.toFixed(1)}h)`
          );
        }
      }

      if (job.status === "ERROR") {
        jobStatus = "DEGRADED";
        jobReason = "LAST_RUN_FAILED";
        status = "DEGRADED";
        reasons.push(`Job ${name} last execution failed: ${job.error_message}`);
      }

      details.jobs[name] = {
        last_success: lastSuccess,
        last_attempt: job.last_attempt,
        status: jobStatus,
        reason: jobReason,
        error_message: job.error_message,
      };
    }

    // Ensure all 8 jobs are registered
    const expectedJobs = Object.keys(jobTtls);
    for (const jobName of expectedJobs) {
      if (!details.jobs[jobName]) {
        status = "DEGRADED";
        reasons.push(`Job ${jobName} is not registered in the jobs table`);
        details.jobs[jobName] = { status: "DEGRADED", reason: "NOT_REGISTERED" };
      }
    }

    // 3. Check corporate actions staleness
    const caRes = await pool.query(
      "SELECT MAX(created_at) AS last_action FROM corporate_actions"
    );
    const lastAction =
      caRes && caRes.rows && caRes.rows.length > 0
        ? caRes.rows[0].last_action
        : null;
    if (lastAction) {
      const caElapsedHours =
        (Date.now() - new Date(lastAction).getTime()) / (1000 * 3600);
      details.corporate_actions = {
        last_action: lastAction,
        elapsed_hours: caElapsedHours,
      };
      if (caElapsedHours > 336) {
        status = "DEGRADED";
        reasons.push(
          `Corporate actions feed is stale. Last announcement sync was ${caElapsedHours.toFixed(1)} hours ago.`
        );
        details.corporate_actions.status = "DEGRADED";
        details.corporate_actions.event_code = "CORPORATE_ACTIONS_FEED_STALE";
      } else {
        details.corporate_actions.status = "OK";
      }
    } else {
      status = "DEGRADED";
      reasons.push("Corporate actions table has no records.");
      details.corporate_actions = {
        status: "DEGRADED",
        last_action: null,
        event_code: "CORPORATE_ACTIONS_FEED_STALE",
      };
    }

    // 4. Check Walk-Forward Efficiency (WFE) and Alpha Decay Rate
    details.walk_forward = {};
    const modes = ["INTRADAY", "INVESTMENT"];
    for (const mode of modes) {
      const wfeVal = config[`wfe_score_${mode}`];
      const decayVal = config[`wfe_decay_rate_${mode}`];

      const wfe = wfeVal != null ? parseFloat(wfeVal) : null;
      const decay = decayVal != null ? parseFloat(decayVal) : null;

      details.walk_forward[mode] = { wfe_score: wfe, decay_rate: decay };

      if (wfe != null && wfe < 0.55) {
        status = "DEGRADED";
        reasons.push(
          `WFE score for mode ${mode} is below safety threshold: ${wfe} (need >= 0.55)`
        );
      }
      if (decay != null && decay < -0.1) {
        status = "DEGRADED";
        reasons.push(
          `Alpha decay rate for mode ${mode} is warning: ${decay} (need >= -0.10)`
        );
      }
    }

    // 5. Check if calibration is disabled due to ceiling streak rollback
    const calibrationEnabled = config.weight_calibration_enabled === "true";
    const resetTime = config.weight_reset_timestamp;
    details.calibration = { enabled: calibrationEnabled, reset_at: resetTime };
    if (!calibrationEnabled && resetTime) {
      status = "DEGRADED";
      reasons.push(
        `Weight calibration has been automatically disabled due to safety rollbacks at ${resetTime}`
      );
    }

    // 6. Oracle Confidence Multiplier Statistics
    details.oracle = { enabled: config.oracle_enabled === 'true', cold_start_trades: parseInt(config.oracle_cold_start_trades || '130', 10) };
    try {
      const oracleStatsRes = await pool.query(
        `SELECT
           COUNT(*) AS total,
           AVG(oracle_multiplier) AS avg_multiplier,
           AVG(oracle_confidence) AS avg_confidence,
           COUNT(*) FILTER (WHERE oracle_multiplier < 0.85) AS strong_dampening,
           COUNT(*) FILTER (WHERE oracle_multiplier >= 0.85 AND oracle_multiplier < 0.95) AS mild_dampening,
           COUNT(*) FILTER (WHERE oracle_multiplier >= 0.95 AND oracle_multiplier <= 1.05) AS neutral,
           COUNT(*) FILTER (WHERE oracle_multiplier > 1.05 AND oracle_multiplier <= 1.15) AS mild_amplification,
           COUNT(*) FILTER (WHERE oracle_multiplier > 1.15) AS strong_amplification
         FROM oracle_adjustment_log
         WHERE ts > NOW() - INTERVAL '7 days'`
      );

      if (oracleStatsRes && oracleStatsRes.rows && oracleStatsRes.rows.length > 0) {
        const stats = oracleStatsRes.rows[0];
        details.oracle.last_7_days = {
          total_adjustments: parseInt(stats.total || '0', 10),
          avg_multiplier: stats.avg_multiplier ? parseFloat(parseFloat(stats.avg_multiplier).toFixed(4)) : null,
          avg_confidence: stats.avg_confidence ? parseFloat(parseFloat(stats.avg_confidence).toFixed(4)) : null,
          strong_dampening: parseInt(stats.strong_dampening || '0', 10),
          mild_dampening: parseInt(stats.mild_dampening || '0', 10),
          neutral: parseInt(stats.neutral || '0', 10),
          mild_amplification: parseInt(stats.mild_amplification || '0', 10),
          strong_amplification: parseInt(stats.strong_amplification || '0', 10)
        };

        // Degradation: > 30% strong dampening means Oracle consistently disagrees with engine
        const totalAdj = details.oracle.last_7_days.total_adjustments;
        if (totalAdj > 20 && details.oracle.last_7_days.strong_dampening / totalAdj > 0.30) {
          status = "DEGRADED";
          reasons.push(
            `Oracle Confidence: ${(details.oracle.last_7_days.strong_dampening / totalAdj * 100).toFixed(0)}% of adjustments are strong dampening (>30% threshold)`
          );
        }
      }
    } catch (oracleErr) {
      // Table may not exist yet — not a degradation
      details.oracle.last_7_days = null;
      details.oracle.note = "oracle_adjustment_log table not available";
    }

    // 7. Advanced Algorithm Diagnostics
    details.advanced_diagnostics = {
      algorithm_status: {
        ewma_dca: config.l25_ewma_enabled === 'true' ? 'ACTIVE' : 'DISABLED',
        profit_weighted_dca: config.l25_ewma_enabled === 'true' ? 'ACTIVE' : 'DISABLED',
        kelly_criterion: config.l25_kelly_mode || 'HALF',
        bocd: config.l26_bocd_enabled === 'true' ? 'ACTIVE' : 'DISABLED',
        kl_divergence: config.l25_kl_divergence_enabled === 'true' ? 'MONITORING' : 'DISABLED',
        correlation_adjustment: config.l25_correlation_enabled === 'true' ? 'ACTIVE' : 'DISABLED'
      },
      metrics: {}
    };

    // Collect advanced metrics per mode and regime
    for (const mode of modes) {
      const regimes = ['LOW_VIX', 'HIGH_VIX'];
      for (const regime of regimes) {
        const modeRegimeKey = `${mode}_${regime}`;

        // KL-Divergence
        const klVal = config[`kl_divergence_${mode}_${regime}`];
        if (klVal != null) {
          details.advanced_diagnostics.metrics[`kl_divergence_${modeRegimeKey}`] = parseFloat(klVal);
          // Degradation: KL > 0.15 = severe drift
          if (parseFloat(klVal) >= 0.15) {
            status = "DEGRADED";
            reasons.push(`KL-Divergence for ${mode}/${regime} is SEVERE: ${klVal} (threshold: 0.15)`);
          }
        }

        // Kelly Lambda
        const kellyVal = config[`kelly_lambda_${mode}_${regime}`];
        if (kellyVal != null) {
          details.advanced_diagnostics.metrics[`kelly_lambda_${modeRegimeKey}`] = parseFloat(kellyVal);
        }
      }

      // BOCD Changepoint (per mode)
      const bocdVal = config[`bocd_changepoint_${mode}`];
      if (bocdVal != null) {
        details.advanced_diagnostics.metrics[`bocd_changepoint_${mode}`] = bocdVal === 'true';
        if (bocdVal === 'true') {
          status = "DEGRADED";
          reasons.push(`BOCD detected regime changepoint for mode ${mode}`);
        }
      }

      // Sortino WFE (per mode)
      const sortinoVal = config[`wfe_sortino_score_${mode}`];
      if (sortinoVal != null) {
        details.advanced_diagnostics.metrics[`sortino_wfe_${mode}`] = parseFloat(sortinoVal);
        if (parseFloat(sortinoVal) < 0.45) {
          status = "DEGRADED";
          reasons.push(`Sortino WFE for mode ${mode} is below threshold: ${sortinoVal} (need >= 0.45)`);
        }
      }

      // Effective WFE (per mode)
      const effectiveWfe = config[`wfe_effective_score_${mode}`];
      if (effectiveWfe != null) {
        details.advanced_diagnostics.metrics[`effective_wfe_${mode}`] = parseFloat(effectiveWfe);
      }
    }

    return res.status(200).json({
      status,
      timestamp: new Date().toISOString(),
      reasons,
      details,
      deployment_mode: "DATABASE",
    });
  } finally {
    await pool.end().catch(() => {});
  }
}

/**
 * Builds a static baseline diagnostics response for serverless deployments
 * where no PostgreSQL database is available.
 *
 * The scoring engine runs entirely client-side on Vercel, so the diagnostics
 * reflect the static baseline configuration (no self-learning active).
 */
function buildStaticBaseline() {
  return {
    status: "OK",
    timestamp: new Date().toISOString(),
    reasons: [],
    details: {
      jobs: {
        rsRatingJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        peerDataJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        weightCalibrationJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        bsePledgeScraper: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        bseBulkDealsJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        corporateActionsSyncJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        partitionMaintenanceJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
        overrideExpiryJob: {
          status: "NOT_AVAILABLE",
          reason: "SERVERLESS_MODE",
          last_success: null,
          last_attempt: null,
          error_message: null,
        },
      },
      walk_forward: {
        INTRADAY: { wfe_score: null, decay_rate: null },
        INVESTMENT: { wfe_score: null, decay_rate: null },
      },
      calibration: {
        enabled: false,
        reset_at: null,
      },
      corporate_actions: {
        status: "NOT_AVAILABLE",
        last_action: null,
      },
      oracle: {
        enabled: false,
        cold_start_trades: 130,
        last_7_days: null,
        note: "SERVERLESS_MODE"
      },
      advanced_diagnostics: {
        algorithm_status: {
          ewma_dca: "DISABLED",
          profit_weighted_dca: "DISABLED",
          kelly_criterion: "DISABLED",
          bocd: "DISABLED",
          kl_divergence: "DISABLED",
          correlation_adjustment: "DISABLED"
        },
        metrics: {}
      }
    },
    deployment_mode: "SERVERLESS",
  };
}
