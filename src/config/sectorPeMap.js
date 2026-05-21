// ═══════════════════════════════════════════════════════════════════════════
// SECTOR PE LOOKUP TABLE — Indian Market Sectors
// Used by valuationScoreEngine to replace the hardcoded null industryPe.
// Values represent median trailing PE ratios and typical ranges for each
// NSE sector, based on historical data and Bloomberg terminal averages.
// Updated periodically — these are structural ranges, not daily values.
// ═══════════════════════════════════════════════════════════════════════════

const SECTOR_PE = {
  // Technology / IT Services
  IT:       { medianPE: 28, range: [22, 38] },
  // Banking & Financial Services
  FIN:      { medianPE: 14, range: [10, 22] },
  BANKING:  { medianPE: 14, range: [10, 22] },
  // Automobiles
  AUTO:     { medianPE: 22, range: [16, 30] },
  // Metals & Mining
  METAL:    { medianPE: 10, range: [6, 18] },
  // Pharmaceuticals & Healthcare
  PHARMA:   { medianPE: 32, range: [24, 45] },
  HEALTHCARE: { medianPE: 35, range: [25, 50] },
  // Fast Moving Consumer Goods
  FMCG:     { medianPE: 45, range: [35, 60] },
  // Energy & Oil
  ENERGY:   { medianPE: 12, range: [8, 20] },
  OIL:      { medianPE: 12, range: [8, 20] },
  // Infrastructure / Capital Goods
  INFRA:    { medianPE: 20, range: [14, 28] },
  CAPITAL_GOODS: { medianPE: 25, range: [18, 35] },
  // Telecom
  TELECOM:  { medianPE: 30, range: [20, 50] },
  // Real Estate
  REALTY:   { medianPE: 25, range: [15, 40] },
  // Media & Entertainment
  MEDIA:    { medianPE: 22, range: [14, 35] },
  // Chemicals
  CHEMICALS: { medianPE: 28, range: [18, 40] },
  // Cement
  CEMENT:   { medianPE: 22, range: [15, 35] },
  // Default for unmapped sectors
  GENERAL:  { medianPE: 20, range: [14, 30] },
};

/**
 * Get sector PE for a given sector name from FMP/internal mapping.
 * Tries exact match first, then fuzzy keyword matching.
 * @param {string} sector - Sector name (e.g. 'IT', 'FIN', 'Technology', etc.)
 * @returns {{ medianPE: number, range: [number, number] }}
 */
function getSectorPE(sector) {
  if (!sector) return SECTOR_PE.GENERAL;

  // Direct match
  const upper = sector.toUpperCase().trim();
  if (SECTOR_PE[upper]) return SECTOR_PE[upper];

  // Fuzzy keyword matching for FMP sector names
  const keywords = {
    'TECHNOLOGY': 'IT', 'INFORMATION': 'IT', 'SOFTWARE': 'IT',
    'FINANCIAL': 'FIN', 'BANK': 'FIN', 'INSURANCE': 'FIN',
    'AUTOMO': 'AUTO', 'VEHICLE': 'AUTO',
    'METAL': 'METAL', 'MINING': 'METAL', 'STEEL': 'METAL',
    'PHARMA': 'PHARMA', 'HEALTH': 'HEALTHCARE', 'HOSPITAL': 'HEALTHCARE', 'DRUG': 'PHARMA',
    'CONSUMER': 'FMCG', 'FOOD': 'FMCG', 'BEVERAGE': 'FMCG',
    'ENERGY': 'ENERGY', 'OIL': 'OIL', 'GAS': 'ENERGY', 'POWER': 'ENERGY',
    'TELECOM': 'TELECOM', 'COMMUNICATION': 'TELECOM',
    'REAL ESTATE': 'REALTY', 'PROPERTY': 'REALTY',
    'CHEMICAL': 'CHEMICALS', 'CEMENT': 'CEMENT',
    'INFRAST': 'INFRA', 'CAPITAL GOODS': 'CAPITAL_GOODS', 'INDUSTRIAL': 'INFRA'
  };

  for (const [keyword, mappedSector] of Object.entries(keywords)) {
    if (upper.includes(keyword)) return SECTOR_PE[mappedSector];
  }

  return SECTOR_PE.GENERAL;
}

module.exports = { SECTOR_PE, getSectorPE };
