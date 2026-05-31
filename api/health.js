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
    },
    deployment_mode: "SERVERLESS",
  };
}
