const https = require("https");
const { dbQuery } = require("../../lib/db");
const { getSectorPE } = require("../../config/sectorPeMap");
const { logger } = require("../../lib/logger");

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ═══════════════════════════════════════════════════════════
// Yahoo Crumb Authentication (required for v10 API since 2024)
// Flow: 1) GET yahoo.com → session cookie
//       2) GET crumb endpoint → crumb token
//       3) Pass cookie + crumb on every v10 request
// ═══════════════════════════════════════════════════════════
let cachedCrumb = null;
let cachedCookie = null;
let crumbExpiry = 0;

function httpsGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*', ...opts.headers },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getYahooCrumb() {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  // Step 1: Get session cookie from Yahoo consent page
  const consentRes = await httpsGet('https://fc.yahoo.com', {
    headers: { 'Accept': 'text/html' }
  });
  // Extract Set-Cookie header
  const rawCookies = consentRes.headers['set-cookie'];
  let cookie = '';
  if (rawCookies) {
    cookie = rawCookies.map(c => c.split(';')[0]).join('; ');
  }

  // Step 2: Get crumb using session cookie
  const crumbRes = await httpsGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'Cookie': cookie }
  });

  if (crumbRes.status !== 200 || !crumbRes.body || crumbRes.body.length > 50) {
    throw new Error(`Yahoo crumb fetch failed: ${crumbRes.status}`);
  }

  cachedCrumb = crumbRes.body.trim();
  cachedCookie = cookie;
  crumbExpiry = Date.now() + 30 * 60 * 1000; // Cache for 30 minutes

  logger.info("yahoo_crumb_ok", { crumbLength: cachedCrumb.length });
  return { crumb: cachedCrumb, cookie: cachedCookie };
}

async function yahooV10(symbolNS, modules) {
  const { crumb, cookie } = await getYahooCrumb();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbolNS)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

  const res = await httpsGet(url, {
    headers: { 'Cookie': cookie, 'Accept': 'application/json' }
  });

  if (res.status === 401) {
    // Crumb expired, invalidate and retry once
    cachedCrumb = null;
    cachedCookie = null;
    crumbExpiry = 0;
    const { crumb: newCrumb, cookie: newCookie } = await getYahooCrumb();
    const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbolNS)}?modules=${modules}&crumb=${encodeURIComponent(newCrumb)}`;
    const retryRes = await httpsGet(retryUrl, {
      headers: { 'Cookie': newCookie, 'Accept': 'application/json' }
    });
    return JSON.parse(retryRes.body);
  }

  return JSON.parse(res.body);
}


async function financials(symbol) {
  try {
    const symbolNS = `${symbol}.NS`;

    // Fetch quoteSummary with all needed modules via crumb-authenticated v10 API
    const modules = 'financialData,defaultKeyStatistics,summaryDetail,price,assetProfile';
    const body = await yahooV10(symbolNS, modules);
    const result = body?.quoteSummary?.result?.[0];

    if (!result) {
      throw new Error(`Yahoo v10 returned no data for ${symbolNS}`);
    }

    const fd = result.financialData || {};
    const dks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const price = result.price || {};
    const profile = result.assetProfile || {};

    // Helper: extract .raw value from Yahoo v10 response objects
    const raw = (obj) => (obj && typeof obj === 'object' && 'raw' in obj) ? obj.raw : (typeof obj === 'number' ? obj : null);

    // Resolve sector PE from the company's sector/industry
    const sector = profile.sector || profile.industry || null;
    const sectorPeData = getSectorPE(sector);

    // Yahoo v10 returns debtToEquity as percentage (e.g., 150.00 for 1.5x ratio)
    // So we DO divide by 100 here to normalize to a ratio
    const rawDE = raw(fd.debtToEquity);

    const payload = {
      // FIX RC3: Correctly label as ROE (was mislabeled as ROCE)
      roe: raw(fd.returnOnEquity) != null ? raw(fd.returnOnEquity) * 100 : null,
      // Yahoo v10 returns D/E as percentage (150 = 1.5x), divide by 100 to get ratio
      debtToEquity: rawDE != null ? rawDE / 100 : null,
      currentRatio: raw(fd.currentRatio),
      peRatio: raw(sd.trailingPE) || raw(sd.forwardPE) || null,
      pbRatio: raw(dks.priceToBook),
      pegRatio: raw(dks.pegRatio),
      marketCap: raw(price.marketCap),
      // FIX RC4: Use sector PE lookup instead of hardcoded null
      industryPe: sectorPeData.medianPE,
      industryPeRange: sectorPeData.range,
      sector: sector,
      industry: profile.industry || null,
      companyName: price.longName || price.shortName || symbol,
      dividendYield: raw(sd.dividendYield) != null ? raw(sd.dividendYield) * 100 : null,
      beta: raw(sd.beta) || raw(dks.beta) || null,
      averageVolume: raw(sd.averageVolume) || raw(price.averageDailyVolume3Month) || null,
    };

    try {
      await dbQuery(
        "INSERT INTO fundamentals(symbol, period, ts, source, json) VALUES($1,$2,now(),$3,$4::jsonb)",
        [symbol, "latest", "yahoo", JSON.stringify(payload)]
      );
    } catch {
      // DB optional in hybrid mode.
    }

    logger.info("layer8_financials_ok", { symbol, sector, pe: payload.peRatio, de: payload.debtToEquity });

    return {
      ok: true,
      data: payload,
      meta: { fetchedAt: new Date().toISOString(), source: "layer8:financials (yahoo-v10)" }
    };
  } catch (err) {
    logger.warn("layer8_financials_fail", { symbol, error: err.message });
    return { ok: false, error: err.message, meta: { source: "layer8:financials (yahoo-v10)" } };
  }
}

module.exports = { financials };

