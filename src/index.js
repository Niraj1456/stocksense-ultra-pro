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

  app.listen(env.port, () => {
    logger.info(`Server listening on :${env.port}`);
  });

  startLayer1Jobs();
  startCacheHydrator();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

