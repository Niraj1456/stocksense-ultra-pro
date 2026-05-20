const { SmartAPI } = require("smartapi-javascript");
const { env } = require("../../../config/env");

async function createSmartApiSession() {
  if (!env.enableSmartApi) {
    return { ok: false, error: "smartapi_disabled", meta: { source: "smartapi" } };
  }
  if (!env.angelApiKey || !env.angelClientId || !env.angelMpin || !env.angelTotp) {
    return { ok: false, error: "smartapi_missing_env", meta: { source: "smartapi" } };
  }

  const smart = new SmartAPI({ api_key: env.angelApiKey });
  const sess = await smart.generateSession(env.angelClientId, env.angelMpin, env.angelTotp);

  const jwtToken = sess?.data?.jwtToken || sess?.data?.jwt_token || sess?.jwtToken;
  const feedToken = sess?.data?.feedToken || sess?.data?.feed_token || sess?.feedToken;

  if (!jwtToken || !feedToken) {
    return { ok: false, error: "smartapi_session_tokens_missing", meta: { source: "smartapi" } };
  }

  return {
    ok: true,
    data: { jwtToken, feedToken },
    meta: { fetchedAt: new Date().toISOString(), source: "smartapi:generateSession" }
  };
}

module.exports = { createSmartApiSession };

