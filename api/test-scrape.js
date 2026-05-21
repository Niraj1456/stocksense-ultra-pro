const tls = require('tls');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const symbol = req.query.symbol || 'TCS.NS';
  try {
    const targetQuoteUrl = `https://finance.yahoo.com/quote/${symbol}`;
    const result = await rawSocketGet(targetQuoteUrl);
    
    return res.status(200).json({
      symbol,
      statusCode: result.statusCode,
      headers: result.headersStr.substring(0, 1000),
      bodyLength: result.bodyStr.length,
      bodyPreview: result.bodyStr.substring(0, 2000),
      containsQuoteSummary: result.bodyStr.includes('quoteSummary')
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
}
