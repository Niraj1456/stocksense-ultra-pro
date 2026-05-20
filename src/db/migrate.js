const fs = require("fs");
const path = require("path");
const { getPool } = require("../lib/db");
const { logger } = require("../lib/logger");

async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    logger.warn("migrations_skipped", { reason: "db_disabled" });
    return { ok: false, skipped: true };
  }

  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  await pool.query(sql);
  logger.info("migrations_ok");
  return { ok: true };
}

module.exports = { runMigrations };

