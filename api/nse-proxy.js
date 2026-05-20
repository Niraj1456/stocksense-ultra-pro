export default async function handler(req, res) {
  try {
    // Extract the NSE path: /api/nse/api/option-chain-equities?symbol=X -> /api/option-chain-equities?symbol=X
    const fullUrl = req.url || '';
    const nsePathMatch = fullUrl.match(/\/api\/nse\/(.*)/);

    if (!nsePathMatch) {
      return res.status(400).json({ error: 'Invalid NSE API path' });
    }

    const nsePath = nsePathMatch[1];
    const targetUrl = `https://www.nseindia.com/${nsePath}`;

    // Step 1: Get session cookies from NSE homepage
    const homeRes = await fetch('https://www.nseindia.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // Extract cookies from the homepage response
    const cookies = homeRes.headers.getSetCookie?.() || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

    // Step 2: Fetch the actual NSE API with cookies
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        'Cookie': cookieStr,
      },
    });

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/json');

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('NSE proxy error:', err.message);
    return res.status(500).json({
      error: 'nse_proxy_error',
      message: err.message,
    });
  }
}
