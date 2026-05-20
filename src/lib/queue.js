const Queue = require("bull");
const { env } = require("../config/env");

function createQueue(name) {
  if (!env.redisUrl) {
    throw new Error("queue_disabled:REDIS_URL_missing");
  }
  return new Queue(name, env.redisUrl);
}

module.exports = { createQueue };

