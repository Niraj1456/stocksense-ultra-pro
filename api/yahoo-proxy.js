export default async function handler(req, res) {
  try {
    // Vercel rewrites /api/yahoo/* to this function
    // The original URL is preserved in req.url
    // Extract the Yahoo path: /api/yahoo/v8/finance/chart/X.NS?range=1d -> /v8/finance/chart/X.NS?range=1d
    const fullUrl = req.url || '';
    const yahooPathMatch = fullUrl.match(/\/api\/yahoo\/(.*)/);

    if (!yahooPathMatch) {
      return res.status(400).json({ error: 'Invalid Yahoo API path' });
    }

    const yahooPath = yahooPathMatch[1];
    const targetUrl = `https://query1.finance.yahoo.com/${yahooPath}`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    // Set CORS and caching headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json');

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Yahoo proxy error:', err.message);
    return res.status(500).json({
      error: 'proxy_error',
      message: err.message,
      chart: { result: null, error: { description: 'Proxy error' } }
    });
  }
}
