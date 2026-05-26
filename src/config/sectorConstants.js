/**
 * Centralized BFSI Sector Constants for StockSense Ultra Pro 26-Layer Engine
 * 
 * These sector identifiers are used by:
 * - L20 (Earnings Quality) to bypass accruals ratio checks for financial companies
 * - L23 (Peer Percentile) for broad sector grouping fallback
 * - L24 (Management Quality) for ROCE slope adjustments on BFSI companies
 */

const BFSI_SECTORS = [
    'Financial Services',
    'Banking',
    'Banks',
    'Private Banks',
    'Public Banks',
    'Insurance',
    'NBFC',
    'Non-Banking Financial Company',
    'Housing Finance',
    'Microfinance',
    'Capital Markets',
    'Stock Exchanges',
    'Asset Management',
    'Mutual Fund',
    'Brokerage',
    'Financial Technology',
    'Fintech'
];

// Sectors with naturally high accruals ratios that need adjusted thresholds (0.35 instead of 0.20)
const ASSET_HEAVY_SECTORS = [
    'Infrastructure',
    'Construction',
    'Real Estate',
    'Power',
    'Utilities',
    'Mining',
    'Oil & Gas'
];

// Broad sector grouping for L23 peer percentile fallback when sub-sector peer count < 5
const BROAD_SECTOR_MAP = {
    'Private Banks': 'Financial Services',
    'Public Banks': 'Financial Services',
    'NBFC': 'Financial Services',
    'Housing Finance': 'Financial Services',
    'Microfinance': 'Financial Services',
    'Insurance': 'Financial Services',
    'Capital Markets': 'Financial Services',
    'Stock Exchanges': 'Financial Services',
    'Asset Management': 'Financial Services',
    'Mutual Fund': 'Financial Services',
    'Brokerage': 'Financial Services',
    'Financial Technology': 'Financial Services',
    'Fintech': 'Financial Services',
    'IT Services': 'Information Technology',
    'Software': 'Information Technology',
    'IT Consulting': 'Information Technology',
    'Cloud Computing': 'Information Technology',
    'Semiconductors': 'Information Technology',
    'Pharmaceuticals': 'Healthcare',
    'Hospitals': 'Healthcare',
    'Diagnostics': 'Healthcare',
    'API Manufacturing': 'Healthcare',
    'Generic Drugs': 'Healthcare',
    'Specialty Chemicals': 'Chemicals',
    'Agrochemicals': 'Chemicals',
    'Petrochemicals': 'Chemicals',
    'Passenger Vehicles': 'Automobile',
    'Commercial Vehicles': 'Automobile',
    'Two Wheelers': 'Automobile',
    'Auto Components': 'Automobile',
    'Tyres': 'Automobile',
    'Cement': 'Building Materials',
    'Paints': 'Building Materials',
    'Pipes': 'Building Materials',
    'Steel': 'Metals & Mining',
    'Aluminium': 'Metals & Mining',
    'Copper': 'Metals & Mining',
    'Mining': 'Metals & Mining',
    'Power Generation': 'Power',
    'Power Distribution': 'Power',
    'Renewable Energy': 'Power',
    'Solar Energy': 'Power',
    'Wind Energy': 'Power',
    'Oil Exploration': 'Oil & Gas',
    'Oil Refining': 'Oil & Gas',
    'Gas Distribution': 'Oil & Gas',
    'Telecom': 'Telecom & Media',
    'Media': 'Telecom & Media',
    'Entertainment': 'Telecom & Media',
    'Digital Media': 'Telecom & Media'
};

module.exports = {
    BFSI_SECTORS,
    ASSET_HEAVY_SECTORS,
    BROAD_SECTOR_MAP
};
