const { execSync } = require('child_process');
const fs = require('fs');

const originalFile = fs.readFileSync('hitRatio1Day.js', 'utf8');

// Take only 30 stocks to speed it up
let fastFile = originalFile.replace(
  /const TEST_STOCKS = \[[\s\S]*?\];/,
  `const TEST_STOCKS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT", "BAJFINANCE", "M&M", "MARUTI", "HCLTECH", "SUNPHARMA", "TATAMOTORS", "TITAN", "NTPC", "TATASTEEL", "POWERGRID", "ULTRACEMCO", "KOTAKBANK", "JSWSTEEL", "ADANIENT", "ONGC", "WIPRO", "HINDALCO", "GRASIM", "TECHM", "BAJAJFINSV", "DIVISLAB"];`
);

// Fix the sleep removal
fastFile = fastFile.replace(/if \(attempt > 0\) await sleep\(.*?\);/g, '');
fastFile = fastFile.replace(/await sleep\(.*?\);/g, '');

fs.writeFileSync('fastAudit.js', fastFile);
console.log('Created fastAudit.js');
