const axios = require("axios");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt) {
  // attempt: 1..N
  const base = 300 * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(5000, base + jitter);
}

async function requestWithRetry(config, { retries = 3, retryOnStatuses = [429, 500, 502, 503, 504] } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await axios.request({
        timeout: 20000,
        validateStatus: () => true,
        ...config
      });
      if (resp.status < 400) return resp;

      if (!retryOnStatuses.includes(resp.status) || attempt === retries) {
        const err = new Error(`http_error:${resp.status}`);
        err.response = resp;
        throw err;
      }

      await sleep(backoffMs(attempt));
    } catch (e) {
      lastErr = e;
      if (attempt === retries) throw e;
      await sleep(backoffMs(attempt));
    }
  }
  throw lastErr || new Error("http_unknown_error");
}

module.exports = { requestWithRetry };

