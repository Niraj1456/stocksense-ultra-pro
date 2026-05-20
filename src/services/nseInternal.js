const axios = require("axios");
const https = require("https");
const http = require("http");
const { logger } = require("../lib/logger");

const httpsAgent = new https.Agent({ family: 6 });
const httpAgent = new http.Agent({ family: 6 });

let cookieHeader = "";
let cookieUpdatedAtMs = 0;
let currentUa = "";
let cookiePromise = null; // Concurrency lock

const apiCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const NSE_BASE = "https://www.nseindia.com";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/17.4.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
];

function getRandomUa() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function nseHeaders() {
  if (!currentUa) currentUa = getRandomUa();
  return {
    "User-Agent": currentUa,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${NSE_BASE}/`,
    Origin: NSE_BASE,
    Connection: "keep-alive",
    Cookie: cookieHeader
  };
}

async function fetchNewCookie() {
  try {
    currentUa = getRandomUa(); // Rotate UA on new session
    const resp = await axios.get(`${NSE_BASE}/`, {
      headers: {
        "User-Agent": currentUa,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      },
      timeout: 15000,
      validateStatus: () => true,
      httpsAgent,
      httpAgent
    });

    const setCookie = resp.headers?.["set-cookie"] || [];
    cookieHeader = Array.isArray(setCookie) ? setCookie.map((c) => c.split(";")[0]).join("; ") : "";
    
    if (cookieHeader) {
      cookieUpdatedAtMs = Date.now();
      logger.info("nse_cookie_refreshed_success", { ua: currentUa.substring(0, 30) });
    } else {
      logger.warn("nse_cookie_empty", { status: resp.status });
    }
  } catch (err) {
    logger.error("nse_cookie_fetch_error", { error: err.message });
  }
}

async function ensureCookie() {
  const ageMs = Date.now() - cookieUpdatedAtMs;
  if (cookieHeader && ageMs < 5 * 60 * 1000) return; // Refresh every 5 mins proactively

  if (!cookiePromise) {
    cookiePromise = fetchNewCookie().finally(() => {
      cookiePromise = null;
    });
  }
  return cookiePromise;
}

// Polite delay to prevent IP bans
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function nseGetJson(path) {
  const cacheKey = path;
  const now = Date.now();
  if (apiCache.has(cacheKey)) {
    const cached = apiCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  await ensureCookie();
  const url = `${NSE_BASE}${path}`;
  
  let resp = await axios.get(url, { headers: nseHeaders(), timeout: 20000, validateStatus: () => true, httpsAgent, httpAgent });

  if (resp.status === 401 || resp.status === 403 || resp.status === 429) {
    logger.warn(`NSE Auth Failure [${resp.status}]. Forcing session refresh.`);
    cookieHeader = ""; // Force clear
    cookieUpdatedAtMs = 0;
    
    await delay(2000); // Polite backoff
    await ensureCookie();
    
    resp = await axios.get(url, { headers: nseHeaders(), timeout: 20000, validateStatus: () => true, httpsAgent, httpAgent });
    
    if (resp.status >= 400) throw new Error(`NSE ${path} failed after retry: ${resp.status}`);
  }

  if (resp.status >= 400) throw new Error(`NSE ${path} failed: ${resp.status}`);
  
  await delay(300); // Rate limit spacing between rapid lambda calls
  
  apiCache.set(cacheKey, { data: resp.data, timestamp: Date.now() });
  return resp.data;
}

module.exports = { nseGetJson };

