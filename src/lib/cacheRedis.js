const Redis = require("ioredis");
const { env } = require("../config/env");
const { logger } = require("./logger");

let redis;
global.memoryCache = global.memoryCache || {};

function getRedis() {
  if (redis) return redis;
  if (!env.redisUrl) return null;
  try {
    redis = new Redis(env.redisUrl, { maxRetriesPerRequest: 2 });
    redis.on("error", (e) => logger.warn("redis_error", { message: e?.message }));
    return redis;
  } catch (e) {
    logger.warn("redis_init_error", { message: e?.message });
    return null;
  }
}

async function cacheGet(key) {
  const r = getRedis();
  if (!r) {
    // In-memory fallback for local development without Redis
    return global.memoryCache[key];
  }
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
  if (!r) {
    // In-memory fallback for local development without Redis
    global.memoryCache[key] = value;
    if (ttlSeconds) {
      setTimeout(() => {
        delete global.memoryCache[key];
      }, ttlSeconds * 1000);
    }
    return true;
  }
  const raw = JSON.stringify(value);
  if (ttlSeconds) {
    await r.set(key, raw, "EX", ttlSeconds);
  } else {
    await r.set(key, raw);
  }
  return true;
}

module.exports = { getRedis, cacheGet, cacheSet };

