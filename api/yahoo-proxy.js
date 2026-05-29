const tls = require('tls');
const { URL } = require('url');

// Module-level cache — persists across warm invocations on Vercel
let cachedCrumb = null;
let cachedCookie = null;
let cacheExpiry = 0;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes

/**
 * Fetch a URL using a raw TLS socket to bypass HTTP header size limits in Node.
 * Supports up to 3 redirects.
 */
function rawSocketGet(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) {
      return reject(new Error('Too many redirects'));
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const host = parsedUrl.hostname || 'finance.yahoo.com';
      const path = parsedUrl.pathname + parsedUrl.search;

      const socket = tls.connect(443, host, { servername: host }, () => {
        const request = [
          `GET ${path} HTTP/1.1`,
          `Host: ${host}`,
          `User-Agent: ${UA}`,
          `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8`,
          `Accept-Language: en-US,en;q=0.5`,
          `Connection: close`,
          '',
          ''
        ].join('\r\n');
        socket.write(request);
      });

      let responseData = '';
      socket.on('data', (chunk) => {
        responseData += chunk.toString('utf8');
      });

      socket.on('end', () => {
        const headerEndIndex = responseData.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) {
          return reject(new Error('Invalid HTTP response from socket'));
        }

        const headersStr = responseData.substring(0, headerEndIndex);
        const bodyStr = responseData.substring(headerEndIndex + 4);

        const statusLine = headersStr.split('\r\n')[0];
        const statusMatch = statusLine.match(/HTTP\/1\.[01]\s+(\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

        // Handle redirects
        if (statusCode === 301 || statusCode === 302) {
          const locationMatch = headersStr.match(/location:\s*([^\r\n]+)/i);
          if (locationMatch) {
            let redirectUrl = locationMatch[1].trim();
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = `https://${host}${redirectUrl}`;
            }
            console.log(`[Socket Redirect] Following redirect to: ${redirectUrl}`);
            return resolve(rawSocketGet(redirectUrl, redirectCount + 1));
          }
        }

        resolve({ statusCode, headersStr, bodyStr });
      });

      socket.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Extract quoteSummary JSON from Yahoo Finance quote page HTML.
 */
function extractQuoteSummaryFromHtml(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.includes('quoteSummary') && content.includes('"status":200')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed && parsed.body) {
          const bodyObj = JSON.parse(parsed.body);
          if (bodyObj && bodyObj.quoteSummary) {
            return bodyObj;
          }
        }
      } catch (e) {
        // ignore and continue
      }
    }
  }
  return null;
}

/**
 * Fetch a fresh crumb + cookie pair from Yahoo Finance.
 * Step 1: GET https://fc.yahoo.com  → grab set-cookie header (session cookie)
 * Step 2: GET https://query2.finance.yahoo.com/v1/test/getcrumb with that cookie → plain-text crumb
 */
async function fetchCrumb() {
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });

  const setCookieHeaders = cookieRes.headers.getSetCookie
    ? cookieRes.headers.getSetCookie()
    : [cookieRes.headers.get('set-cookie')].filter(Boolean);

  if (!setCookieHeaders.length) {
    throw new Error('Failed to obtain Yahoo session cookies');
  }

  const cookie = setCookieHeaders
    .map((c) => c.split(';')[0])
    .join('; ');

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

  cachedCrumb = crumb;
  cachedCookie = cookie;
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return { crumb, cookie };
}

function invalidateCache() {
  cachedCrumb = null;
  cachedCookie = null;
  cacheExpiry = 0;
}

async function getCrumb() {
  if (cachedCrumb && Date.now() < cacheExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }
  return fetchCrumb();
}

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
    invalidateCache();
    return fetchWithCrumb(targetUrl, true);
  }

  return response;
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.query && req.query.debug === 'true') {
      const debugSymbol = req.query.symbol || 'TCS.NS';
      console.log(`[Proxy Debug] Running rawSocketGet for symbol: ${debugSymbol}`);
      const targetQuoteUrl = `https://finance.yahoo.com/quote/${debugSymbol}`;
      try {
        const socketResult = await rawSocketGet(targetQuoteUrl);
        const parsedSummary = extractQuoteSummaryFromHtml(socketResult.bodyStr);
        return res.status(200).json({
          symbol: debugSymbol,
          statusCode: socketResult.statusCode,
          headers: socketResult.headersStr.substring(0, 1000),
          bodyLength: socketResult.bodyStr.length,
          bodyPreview: socketResult.bodyStr.substring(0, 1500),
          containsQuoteSummary: socketResult.bodyStr.includes('quoteSummary'),
          parsedSummary: parsedSummary ? "SUCCESSFULLY PARSED" : "FAILED TO PARSE",
          summaryKeys: parsedSummary ? Object.keys(parsedSummary) : null
        });
      } catch (err) {
        return res.status(500).json({
          error: err.message,
          stack: err.stack
        });
      }
    }

    let originalPath = '';
    let queryString = '';

    if (req.query && req.query.path) {
      originalPath = req.query.path;
      const { path, ...restQuery } = req.query;
      const queryParams = new URLSearchParams(restQuery).toString();
      queryString = queryParams ? `?${queryParams}` : '';
    } else {
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

    // Intercept news sentiment request
    if (originalPath === 'news-sentiment') {
      const symbol = req.query.symbol || 'TCS';
      const apiKey = process.env.ALPHA_VANTAGE_KEY || '3A1S2PQ8RLS76HVQ';
      const clean = symbol.replace('.NS', '').replace('.BO', '').trim();
      const avUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${clean}&limit=15&apikey=${apiKey}`;

      try {
        console.log(`[Proxy] Fetching news sentiment for: ${clean}`);
        const avRes = await fetch(avUrl);
        if (!avRes.ok) {
          throw new Error(`Alpha Vantage API returned HTTP ${avRes.status}`);
        }
        const avData = await avRes.json();

        if (avData.Note || avData['Error Message']) {
          console.warn(`[Proxy] Alpha Vantage API warning: ${avData.Note || avData['Error Message']}`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({
            avgSentiment: 0.15,
            sentimentLabel: 'NEUTRAL',
            articleCount: 0,
            note: avData.Note || avData['Error Message']
          });
        }

        const feed = avData.feed || [];
        if (feed.length === 0) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({
            avgSentiment: 0.0,
            sentimentLabel: 'NEUTRAL',
            articleCount: 0
          });
        }

        const articles = feed.map(article => {
          const tickerSentiment = (article.ticker_sentiment || []).find(
            ts => ts.ticker === clean || ts.ticker === `BSE:${clean}` || ts.ticker === `NSE:${clean}`
          );
          const useTickerData = tickerSentiment && parseFloat(tickerSentiment.relevance_score) > 0.1;

          return {
            sentiment: useTickerData
              ? parseFloat(tickerSentiment.ticker_sentiment_score)
              : parseFloat(article.overall_sentiment_score || 0),
            label: useTickerData
              ? tickerSentiment.ticker_sentiment_label
              : (article.overall_sentiment_label || "Neutral")
          };
        });

        const relevantArticles = articles.filter(a => Math.abs(a.sentiment) > 0.01);
        const avgSentiment = relevantArticles.length > 0
          ? relevantArticles.reduce((sum, a) => sum + a.sentiment, 0) / relevantArticles.length
          : 0;

        let sentimentLabel = 'NEUTRAL';
        if (avgSentiment > 0.25) sentimentLabel = 'STRONGLY_BULLISH';
        else if (avgSentiment > 0.1) sentimentLabel = 'BULLISH';
        else if (avgSentiment < -0.25) sentimentLabel = 'STRONGLY_BEARISH';
        else if (avgSentiment < -0.1) sentimentLabel = 'BEARISH';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.setHeader('Content-Type', 'application/json');

        return res.status(200).json({
          avgSentiment: +avgSentiment.toFixed(4),
          sentimentLabel,
          articleCount: relevantArticles.length
        });
      } catch (err) {
        console.error(`[Proxy] News sentiment failure for ${symbol}:`, err.message);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          avgSentiment: 0.0,
          sentimentLabel: 'NEUTRAL',
          articleCount: 0,
          error: err.message
        });
      }
    }

    // Intercept quoteSummary requests and try SvelteKit scraping via raw socket first
    const isQuoteSummary = originalPath.includes('v10/finance/quoteSummary');
    if (isQuoteSummary) {
      const symbolMatch = originalPath.match(/quoteSummary\/([^/?]+)/);
      if (symbolMatch) {
        const symbol = symbolMatch[1];
        console.log(`[Proxy] Scraping Yahoo Finance page for symbol: ${symbol}`);
        try {
          const targetQuoteUrl = `https://finance.yahoo.com/quote/${symbol}`;
          const socketResult = await rawSocketGet(targetQuoteUrl);
          
          if (socketResult.statusCode === 200) {
            const parsedSummary = extractQuoteSummaryFromHtml(socketResult.bodyStr);
            if (parsedSummary) {
              console.log(`[Proxy] Successfully scraped and parsed SvelteKit quoteSummary for: ${symbol}`);
              res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
              res.setHeader('Content-Type', 'application/json');
              return res.status(200).json(parsedSummary);
            } else {
              console.warn(`[Proxy] Script containing quoteSummary not found in scraped HTML for: ${symbol}`);
            }
          } else {
            console.warn(`[Proxy] Scraper returned non-200 status: ${socketResult.statusCode} for: ${symbol}`);
          }
        } catch (scrapeErr) {
          console.error(`[Proxy] Scraper error for ${symbol}:`, scrapeErr.message);
        }
        console.log(`[Proxy] Falling back to standard API crumb endpoint for: ${symbol}`);
      }
    }

    const isV10 = originalPath.includes('v10');
    const targetUrl = `https://query1.finance.yahoo.com/${originalPath}${queryString}`;

    let response;

    if (isV10) {
      response = await fetchWithCrumb(targetUrl);
    } else {
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
