/**
 * Tier 4: Sector-Relative Scoring
 * Normalizes individual stock scores against their broader sector momentum.
 * Prevents buying into strong stocks in a crashing sector, and finds hidden gems in rallying sectors.
 */

const SECTOR_MAP = {
  // IT
  'TCS': 'IT', 'INFY': 'IT', 'HCLTECH': 'IT', 'WIPRO': 'IT', 'TECHM': 'IT', 'LTIM': 'IT',
  // Banking & Fin
  'HDFCBANK': 'FIN', 'ICICIBANK': 'FIN', 'SBIN': 'FIN', 'AXISBANK': 'FIN', 'KOTAKBANK': 'FIN', 'INDUSINDBK': 'FIN', 'BAJFINANCE': 'FIN', 'BAJAJFINSV': 'FIN',
  // Auto
  'TATAMOTORS': 'AUTO', 'M&M': 'AUTO', 'MARUTI': 'AUTO', 'BAJAJ-AUTO': 'AUTO', 'HEROMOTOCO': 'AUTO', 'EICHERMOT': 'AUTO', 'TVSMOTOR': 'AUTO',
  // Metal
  'TATASTEEL': 'METAL', 'HINDALCO': 'METAL', 'JSWSTEEL': 'METAL', 'VEDL': 'METAL', 'COALINDIA': 'METAL',
  // Pharma
  'SUNPHARMA': 'PHARMA', 'CIPLA': 'PHARMA', 'DRREDDY': 'PHARMA', 'DIVISLAB': 'PHARMA', 'APOLLOHOSP': 'PHARMA', 'LUPIN': 'PHARMA', 'AUROPHARMA': 'PHARMA',
  // FMCG
  'ITC': 'FMCG', 'HINDUNILVR': 'FMCG', 'NESTLEIND': 'FMCG', 'BRITANNIA': 'FMCG', 'TATACONSUM': 'FMCG',
  // Energy / Oil
  'RELIANCE': 'ENERGY', 'ONGC': 'ENERGY', 'NTPC': 'ENERGY', 'POWERGRID': 'ENERGY', 'TATAPOWER': 'ENERGY', 'BPCL': 'ENERGY'
};

const sectorCache = {}; // { 'IT': { totalScore: 500, count: 10, avg: 50, lastUpdated: 123 } }

function updateSectorScore(stock, score) {
  const sector = SECTOR_MAP[stock] || 'GENERAL';
  if (!sectorCache[sector]) {
    sectorCache[sector] = { totalScore: 0, count: 0, stocks: {} };
  }
  
  const sec = sectorCache[sector];
  if (sec.stocks[stock]) {
    sec.totalScore -= sec.stocks[stock];
    sec.count -= 1;
  }
  sec.stocks[stock] = score;
  sec.totalScore += score;
  sec.count += 1;
  sec.avg = sec.totalScore / sec.count;
}

function applySectorNormalization(stock, score) {
  const sector = SECTOR_MAP[stock] || 'GENERAL';
  const sec = sectorCache[sector];
  
  if (!sec || sec.count < 2) return score; // Not enough data for sector relative

  const sectorAvg = sec.avg;
  const sectorStrength = sectorAvg - 50; // -50 to +50
  
  let normalizedScore = score;
  
  // 1. Sector Tailwind Bonus
  if (sectorStrength > 5 && score > 55) {
    normalizedScore += 3; // Bullish stock in a bullish sector
  }
  
  // 2. Sector Headwind Penalty
  if (sectorStrength < -5 && score > 55) {
    normalizedScore -= 4; // Bullish stock in a bearish sector (highly likely to fail breakout)
  }
  
  // 3. Shorting Tailwinds
  if (sectorStrength < -5 && score < 40) {
    normalizedScore -= 2; // Bearish stock in bearish sector
  }
  
  // 4. Shorting Headwinds
  if (sectorStrength > 5 && score < 40) {
    normalizedScore += 4; // Bearish stock in a bullish sector (dangerous short)
  }

  // 5. Relative Strength Overperformance
  if (score > sectorAvg + 10 && sectorStrength > 0) {
    normalizedScore += 2; // Sector leader
  }

  return Math.max(5, Math.min(95, normalizedScore));
}

module.exports = {
  updateSectorScore,
  applySectorNormalization,
  SECTOR_MAP,
  getSectorAvg: (sector) => sectorCache[sector]?.avg || 50
};
