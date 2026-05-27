const dotenv = require("dotenv");
dotenv.config();

const { env, validateEnv } = require("./config/env");
const { createApp } = require("./app");
const { runMigrations } = require("./db/migrate");
const { startLayer1Jobs } = require("./jobs/layer1Refresh");
const { logger } = require("./lib/logger");

const { startCacheHydrator } = require("./workers/cacheHydrator");

async function main() {
  for (const w of validateEnv()) {
    logger.warn("env_warning", { warning: w });
  }

  await runMigrations();

  // Validate NSE Holiday Calendar year
  try {
    const fs = require("fs");
    const path = require("path");
    const calendarPath = path.join(__dirname, "config", "nseHolidayCalendar.json");
    if (fs.existsSync(calendarPath)) {
      const calendar = JSON.parse(fs.readFileSync(calendarPath, "utf8"));
      const currentYear = new Date().getFullYear();
      if (calendar.year !== currentYear) {
        // Must emit warning log NSE_HOLIDAY_CALENDAR_YEAR_STALE_RESTART_WARNING to stdout
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          layer_id: "SYSTEM",
          event_code: "NSE_HOLIDAY_CALENDAR_YEAR_STALE_RESTART_WARNING",
          severity: "WARN",
          message: `NSE Holiday Calendar year (${calendar.year}) is stale. Current year is ${currentYear}. Update nseHolidayCalendar.json.`
        }));
      }
    }
  } catch (e) {
    logger.warn("holiday_calendar_check_failed", { message: e.message });
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Server listening on :${env.port}`);
  });

  startLayer1Jobs();
  startCacheHydrator();

  // Register graceful shutdown handlers
  async function gracefulShutdown(signal) {
    logger.info(`graceful_shutdown_initiated`, { signal });
    
    // 1. Close HTTP server immediately to reject new incoming connections
    server.close(async () => {
      logger.info("http_server_closed_no_longer_accepting_requests");
      
      try {
        // 2. Cleanly end PostgreSQL Pool
        const { getPool } = require("./lib/db");
        const pool = getPool();
        if (pool) {
          logger.info("db_pool_closing");
          await pool.end();
          logger.info("db_pool_closed");
        }
        
        // 3. Cleanly close Puppeteer Shared browser
        const { closeSharedBrowser } = require("./scrapers/browser");
        await closeSharedBrowser();
        
        logger.info("graceful_shutdown_completed_successfully");
        process.exit(0);
      } catch (err) {
        logger.error("graceful_shutdown_failed", { error: err.message, stack: err.stack });
        process.exit(1);
      }
    });

    // Enforce a hard timeout limit of 10 seconds to force-kill if hanging occurs
    setTimeout(() => {
      logger.error("graceful_shutdown_timed_out_force_killing");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

