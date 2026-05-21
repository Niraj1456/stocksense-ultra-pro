// Module-level cache — persists across warm invocations on Vercel
let cachedCrumb = null;
let cachedCookie = null;
let cacheExpiry = 0;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes

/**
 * Fetch a fresh crumb + cookie pair from Yahoo Finance.
 * Step 1: GET https://fc.yahoo.com  → grab set-cookie header (session cookie)
 * Step 2: GET https://query2.finance.yahoo.com/v1/test/getcrumb with that cookie → plain-text crumb
 */
async function fetchCrumb() {
  // Step 1 – obtain session cookies
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual', // don't follow redirects, we just need the cookies
  });

  const setCookieHeaders = cookieRes.headers.getSetCookie
    ? cookieRes.headers.getSetCookie()
    : [cookieRes.headers.get('set-cookie')].filter(Boolean);

  if (!setCookieHeaders.length) {
    throw new Error('Failed to obtain Yahoo session cookies');
  }

  // Extract only the cookie key=value pairs (strip attributes like Path, Domain, etc.)
  const cookie = setCookieHeaders
    .map((c) => c.split(';')[0])
    .join('; ');

  // Step 2 – fetch crumb using the session cookie
  const crumbRes = await fetch(
    'https://query2.finance.yahoo.com/v1/test/getcrumb',
    {
      headers: {
        'User-Agent': UA,
        Cookie: cookie,
      },
    }
  );

  if (!crumbRes.ok) {
    throw new Error(`Crumb request failed with status ${crumbRes.status}`);
  }

  const crumb = await crumbRes.text();

  if (!crumb || crumb.includes('<') || crumb.length > 50) {
    throw new Error('Received invalid crumb from Yahoo');
  }

  // Cache the pair
  cachedCrumb = crumb;
  cachedCookie = cookie;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return { crumb, cookie };
}

/** Invalidate the cached crumb/cookie so the next call fetches fresh ones. */
function invalidateCache() {
  cachedCrumb = null;
  cachedCookie = null;
  cacheExpiry = 0;
}

/** Return cached crumb+cookie if still valid, otherwise fetch fresh. */
async function getCrumb() {
  if (cachedCrumb && Date.now() < cacheExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }
  return fetchCrumb();
}

/**
 * Make an authenticated request to a v10 Yahoo Finance endpoint.
 * If Yahoo responds with 401, invalidate the cache and retry once with a fresh crumb.
 */
async function fetchWithCrumb(targetUrl, isRetry = false) {
  const { crumb, cookie } = await getCrumb();

  const separator = targetUrl.includes('?') ? '&' : '?';
  const urlWithCrumb = `${targetUrl}${separator}crumb=${encodeURIComponent(crumb)}`;

  const response = await fetch(urlWithCrumb, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Cookie: cookie,
    },
  });

  if (response.status === 401 && !isRetry) {
    // Crumb expired or became invalid — retry once with a fresh pair
    invalidateCache();
    return fetchWithCrumb(targetUrl, true);
  }

  return response;
}

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let originalPath = '';
    let queryString = '';

    if (req.query && req.query.path) {
      originalPath = req.query.path;
      const { path, ...restQuery } = req.query;
      const queryParams = new URLSearchParams(restQuery).toString();
      queryString = queryParams ? `?${queryParams}` : '';
    } else {
      // Fallback: extract path from req.url
      const fullUrl = req.url || '';
      const yahooPathMatch = fullUrl.match(/\/api\/yahoo\/(.*)/);
      if (yahooPathMatch) {
        const parts = yahooPathMatch[1].split('?');
        originalPath = parts[0];
        queryString = parts[1] ? `?${parts[1]}` : '';
      }
    }

    if (!originalPath) {
      return res.status(400).json({ error: 'Invalid Yahoo API path' });
    }

    const isV10 = originalPath.includes('v10');
    const targetUrl = `https://query1.finance.yahoo.com/${originalPath}${queryString}`;

    let response;

    if (isV10) {
      // v10 endpoints require crumb + cookie authentication
      response = await fetchWithCrumb(targetUrl);
    } else {
      // v7, v8 chart, etc. — simple passthrough (no crumb needed)
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
        },
      });
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json');

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Yahoo proxy error:', err.message);
    return res.status(500).json({
      error: 'proxy_error',
      message: err.message,
      chart: { result: null, error: { description: 'Proxy error' } },
    });
  }
}
