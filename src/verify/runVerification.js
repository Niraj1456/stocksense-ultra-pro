const { analyzeStock } = require("../analyze/analyzeStock");
const { getPool } = require("../lib/db");
const { getRedis } = require("../lib/cacheRedis");
const { env } = require("../config/env");
const { createSmartApiSession } = require("../layers/layer2/smartapi/session");
const { aiOrchestrator } = require("../layers/layer14");

async function checkDb() {
  try {
    const p = getPool();
    if (!p) return { ok: false, error: "DATABASE_URL_missing" };
    await p.query("SELECT 1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "db_failed" };
  }
}

async function checkRedis() {
  try {
    const r = getRedis();
    if (!r) return { ok: false, error: "REDIS_URL_missing" };
    await r.set("verify:ping", "1", "EX", 30);
    const v = await r.get("verify:ping");
    return { ok: v === "1", value: v };
  } catch (e) {
    return { ok: false, error: e?.message || "redis_failed" };
  }
}

async function checkSmartApi() {
  if (!env.enableSmartApi) return { ok: false, error: "ENABLE_SMARTAPI_false" };
  try {
    return await createSmartApiSession();
  } catch (e) {
    return { ok: false, error: e?.message || "smartapi_failed" };
  }
}

async function checkClaude() {
  if (!env.enableClaude || !env.anthropicApiKey) return { ok: false, error: "ENABLE_CLAUDE_false_or_key_missing" };
  try {
    const out = await aiOrchestrator({
      symbol: "RELIANCE",
      mode: "LT",
      context: { test: true },
      scoreData: { totalScore: 60 },
      verdictData: { verdict: "WATCH" }
    });
    return { ok: Boolean(out?.ok), engine: out?.data?.engine || null };
  } catch (e) {
    return { ok: false, error: e?.message || "claude_failed" };
  }
}

async function runVerification() {
  const [db, redis, smartapi, claude] = await Promise.all([checkDb(), checkRedis(), checkSmartApi(), checkClaude()]);

  const reliance = await analyzeStock("RELIANCE", "LT");
  const nifty = await analyzeStock("NIFTY", "ST");

  return {
    ok: true,
    checks: { db, redis, smartapi, claude },
    analyze: {
      RELIANCE_LT: { ok: reliance.ok, final: reliance.final },
      NIFTY_ST: { ok: nifty.ok, final: nifty.final }
    }
  };
}

module.exports = { runVerification };

