const Redis = require("ioredis");
const { env } = require("../config/env");
const { logger } = require("./logger");

let redis;

function getRedis() {
  if (redis) return redis;
  if (!env.redisUrl) return null;
  redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 2 });
  redis.on("error", (e) => logger.warn("redis_error", { message: e?.message }));
  return redis;
}

async function cacheGet(key) {
  const r = getRedis();
  if (!r) return undefined;
  const raw = await r.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  const r = getRedis();
  if (!r) return false;
  const raw = JSON.stringify(value);
  if (ttlSeconds) {
    await r.set(key, raw, "EX", ttlSeconds);
  } else {
    await r.set(key, raw);
  }
  return true;
}

module.exports = { getRedis, cacheGet, cacheSet };

