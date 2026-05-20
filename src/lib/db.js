const { Pool } = require("pg");
const { env } = require("../config/env");
const { logger } = require("./logger");

let pool;

function getPool() {
  if (pool) return pool;
  if (!env.databaseUrl) return null;
  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000
  });
  pool.on("error", (e) => logger.warn("pg_pool_error", { message: e?.message }));
  return pool;
}

async function dbQuery(text, params) {
  const p = getPool();
  if (!p) throw new Error("db_disabled:DATABASE_URL_missing");
  return p.query(text, params);
}

module.exports = { getPool, dbQuery };

