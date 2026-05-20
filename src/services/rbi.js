const axios = require("axios");

const RBI_DBIE_BASE = process.env.RBI_DBIE_BASE || "https://api.dbie.rbi.org.in/DBIE/dbie.rbi";

function rbiHeaders() {
  const apiKey = process.env.RBI_DBIE_API_KEY;
  return apiKey ? { "X-API-KEY": apiKey } : {};
}

async function rbiGetJson(path, params) {
  const resp = await axios.get(`${RBI_DBIE_BASE}${path}`, {
    headers: rbiHeaders(),
    params,
    timeout: 20000,
    validateStatus: () => true
  });
  if (resp.status >= 400) {
    throw new Error(`RBI DBIE ${path} failed: ${resp.status}`);
  }
  return resp.data;
}

module.exports = { rbiGetJson };

