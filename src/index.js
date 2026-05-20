const dotenv = require("dotenv");
dotenv.config();

const { env, validateEnv } = require("./config/env");
const { createApp } = require("./app");
const { runMigrations } = require("./db/migrate");
const { startLayer1Jobs } = require("./jobs/layer1Refresh");
const { logger } = require("./lib/logger");

async function main() {
  for (const w of validateEnv()) {
    logger.warn("env_warning", { warning: w });
  }

  await runMigrations();

  const app = createApp();

  app.listen(env.port, () => {
    logger.info(`Server listening on :${env.port}`);
  });

  startLayer1Jobs();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

