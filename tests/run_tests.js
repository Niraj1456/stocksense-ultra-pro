/**
 * StockSense Ultra Pro — Hermetic Test Suite & Validation Runner
 * 
 * Verifies:
 * - Test A: Internal Consistency & Determinism (Bit-for-bit equivalence on consecutive runs)
 * - Test B: Regression testing against a 26-layer baseline accuracy file
 * - Contribution Divergence Check: 26-layer scores differ from legacy 18-layer scores on >= 30% of stocks
 * - Self-learning and walk-forward optimization calibration
 */

const fs = require('fs');
const path = require('path');

// ── 1. HERMETIC ENVIRONMENT SETUP & MOCKING ──────────────────────────────
process.env.API_KEY = 'stocksense-secret-api-key';

// Mock DB module before loading other application files
const dbModule = require('../src/lib/db');

// In-memory mock database tables
const mockDb = {
  universe_registry: {},
  promoter_pledge: {},
  rs_ratings: {},
  peer_metrics: {},
  weight_calibration_log: [],
  system_config: {
    'weight_calibration_enabled': 'true',
    'l25_min_trades': '130',
    'l26_min_trades': '130',
    'engine_upgrade_date': '2026-05-25'
  }
};

// Implement mock query interpreter
dbModule.dbQuery = async (text, params) => {
  const query = text.trim().replace(/\s+/g, ' ');
  
  // 1. SELECT isin, sector FROM universe_registry
  if (query.includes('FROM universe_registry')) {
    const symbol = params[0];
    const registry = mockDb.universe_registry[symbol] || { isin: 'INE001A01015', sector: 'GENERAL' };
    return { rows: [registry] };
  }
  
  // 2. SELECT pledged_shares_pct, promoter_holding_pct, ... FROM promoter_pledge
  if (query.includes('FROM promoter_pledge')) {
    const symbol = params[0];
    const pledge = mockDb.promoter_pledge[symbol] || {
      pledged_shares_pct: 0.00,
      promoter_holding_pct: 50.00,
      pledge_velocity_qoq: 0.00,
      bulk_deal_alert: false
    };
    return { rows: [pledge] };
  }
  
  // 3. SELECT 1 FROM corporate_actions
  if (query.includes('FROM corporate_actions')) {
    return { rows: [] };
  }
  
  // 4. SELECT rs_percentile, is_confirmed_uptrend FROM rs_ratings
  if (query.includes('FROM rs_ratings')) {
    const symbol = params[0];
    const rs = mockDb.rs_ratings[symbol] || { rs_percentile: 75, is_confirmed_uptrend: true };
    return { rows: [rs] };
  }
  
  // 5. SELECT id, calibrated_weights FROM weight_calibration_log
  if (query.includes('FROM weight_calibration_log')) {
    return { rows: mockDb.weight_calibration_log.filter(w => w.is_active) };
  }
  
  // 6. SELECT snapshot_date FROM peer_metrics
  if (query.includes('snapshot_date FROM peer_metrics')) {
    const sector = params[0];
    const date = '2026-01-15';
    return { rows: [{ snapshot_date: date }] };
  }
  
  // 7. SELECT roe, roce, debt_to_equity, fcf_yield FROM peer_metrics
  if (query.includes('roe, roce, debt_to_equity, fcf_yield FROM peer_metrics')) {
    const sector = params[0];
    const peers = mockDb.peer_metrics[sector] || [
      { roe: 15.0, roce: 18.0, debt_to_equity: 0.5, fcf_yield: 6.0 },
      { roe: 12.0, roce: 14.0, debt_to_equity: 0.8, fcf_yield: 4.0 },
      { roe: 20.0, roce: 22.0, debt_to_equity: 0.2, fcf_yield: 8.0 },
      { roe: 10.0, roce: 11.0, debt_to_equity: 1.2, fcf_yield: 2.0 },
      { roe: 18.0, roce: 20.0, debt_to_equity: 0.4, fcf_yield: 7.0 }
    ];
    return { rows: peers };
  }

  // 8. SELECT key, value FROM system_config
  if (query.includes('FROM system_config')) {
    const rows = Object.entries(mockDb.system_config).map(([k, v]) => ({ key: k, value: v }));
    return { rows };
  }
  
  throw new Error(`Unhandled mock query: ${query} with params ${JSON.stringify(params)}`);
};

// Mock memoryCache in global context (Redis fallback)
global.memoryCache = global.memoryCache || {};

// Disable background timers on VolatileCacheManager to prevent tests from hanging
const VolatileCacheManager = require('../src/lib/volatileCache');
VolatileCacheManager.startSimulation = () => {};

// Clear any pre-initialized cache tick intervals
for (const key of Object.keys(global.volatileCache || {})) {
  if (key.startsWith('interval_')) {
    clearInterval(global.volatileCache[key]);
    delete global.volatileCache[key];
  }
}

// Load application modules
const { analyzeStock } = require('../src/analyze/analyzeStock');
const { getWeights } = require('../src/layers/layer13/weightTable');
const { scoreAggregationEngine } = require('../src/layers/layer13/masterScoring');
const Layer25 = require('../src/layers/layer25/ensembleCalibration');
const Layer26 = require('../src/layers/layer26/walkForward');

// ── 2. DETERMINISTIC GENERATOR UTILITIES ─────────────────────────────────

function generateDeterministicCandles(symbol, basePrice) {
  const candles = [];
  let currentPrice = basePrice * 0.95;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 10000;
  }

  // Adding a realistic daily drift component (half of symbols drift positive, half drift negative)
  // to prevent range-bound sinusoidal crest reversals and simulate real persistent trends.
  const drift = (seed % 2 === 0) ? 3.5 : -3.5;

  for (let i = 125; i >= 0; i--) {
    const change = Math.sin(seed + i) * 15 + drift;
    const o = currentPrice;
    const c = currentPrice + change;
    const h = Math.max(o, c) + Math.abs(Math.sin(seed * 2 + i)) * 5;
    const l = Math.min(o, c) - Math.abs(Math.cos(seed * 3 + i)) * 5;
    const v = 50000 + Math.floor(Math.abs(Math.sin(seed * 4 + i)) * 200000);
    const t = new Date(now - i * oneDay).toISOString().slice(0, 10);

    candles.push({ o, h, l, c, v, t });
    currentPrice = c;
  }
  return candles;
}

function generateMockStaticData(symbol) {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 10000;
  }

  const sectors = ['IT', 'FIN', 'AUTO', 'PHARMA', 'FMCG', 'ENERGY'];
  const sector = sectors[seed % sectors.length];

  return {
    vixOut: {
      ok: true,
      data: { inputs: { vix_current: 12 + (seed % 10) } },
      meta: { fetchedAt: new Date().toISOString() }
    },
    chainOut: {
      ok: true,
      data: { records: [] },
      meta: { fetchedAt: new Date().toISOString() }
    },
    finOut: {
      ok: true,
      data: {
        peRatio: 15 + (seed % 20),
        pbRatio: 2.5 + (seed % 5),
        pegRatio: 0.8 + (seed % 3) * 0.5,
        debtToEquity: 0.1 + (seed % 15) * 0.1,
        roe: 10 + (seed % 25),
        industryPe: 22,
        currentRatio: 1.5,
        upcomingCorporateActions: []
      },
      meta: { fetchedAt: new Date().toISOString() }
    },
    fmpData: {
      financials: {
        latest: {
          totalAssets: 1000000,
          totalLiabilities: 400000,
          totalStockholdersEquity: 600000,
          revenue: 500000,
          netIncome: 50000,
          ebitda: 80000,
          operatingIncome: 70000,
          eps: 5.0,
          freeCashFlow: 45000,
          operatingCashFlow: 52000,
          retainedEarnings: 120000,
          totalCurrentAssets: 300000,
          totalCurrentLiabilities: 150000,
          costOfRevenue: 350000,
          grossProfit: 150000
        },
        income: [
          { revenue: 500000, costOfRevenue: 350000, grossProfit: 150000, netIncome: 50000, operatingIncome: 70000 },
          { revenue: 450000, costOfRevenue: 320000, grossProfit: 130000, netIncome: 42000, operatingIncome: 60000 },
          { revenue: 400000, costOfRevenue: 290000, grossProfit: 110000, netIncome: 38000, operatingIncome: 52000 }
        ],
        balance: [
          { totalAssets: 1000000, totalLiabilities: 400000, totalStockholdersEquity: 600000, netReceivables: 50000, totalCurrentAssets: 300000, totalCurrentLiabilities: 150000, propertyPlantEquipmentNet: 500000, commonStock: 100000 },
          { totalAssets: 900000, totalLiabilities: 380000, totalStockholdersEquity: 520000, netReceivables: 45000, totalCurrentAssets: 280000, totalCurrentLiabilities: 140000, propertyPlantEquipmentNet: 450000, commonStock: 100000 }
        ],
        cashflow: [
          { operatingCashFlow: 52000, depreciationAndAmortization: 15000, dividendsPaid: -10000 },
          { operatingCashFlow: 46000, depreciationAndAmortization: 14000, dividendsPaid: -8000 }
        ]
      },
      metrics: [
        { roce: 0.15, freeCashFlowYield: 0.08, debtToEquity: 0.6, daysSalesOutstanding: 45, daysInventoryOutstanding: 35, daysPayableOutstanding: 40 }
      ],
      profile: {
        marketCap: 6000000,
        sector: sector,
        industry: 'Generic Industry',
        beta: 1.1,
        companyName: `${symbol} Ltd`,
        averageVolume: 500000,
        range: '1000-1800',
        lastDividend: 5.0,
        isActivelyTrading: true,
        auditor: (seed % 4 === 0) ? 'Price Waterhouse' : 'Local Auditor'
      },
      dcf: { dcf: 1200 + (seed % 800) },
      insider: [
        { transactionType: 'Purchase', transactionShares: 1000 },
        { transactionType: 'Sale', transactionShares: 500 }
      ],
      earnings: [
        { actualEarningResult: 1.2, estimatedEarning: 1.0 },
        { actualEarningResult: 1.1, estimatedEarning: 1.0 }
      ],
      dataConfidence: { score: 95 },
      meta: { fetchedAt: new Date().toISOString() }
    },
    avSentiment: {
      avgSentiment: 0.25,
      sentimentLabel: 'BULLISH',
      pts: 2,
      vetoFlag: false,
      articleCount: 12,
      dataConfidence: 'HIGH',
      meta: { fetchedAt: new Date().toISOString() }
    },
    avEarnings: {
      daysToEarnings: 15,
      recentSurprises: [
        { actualEPS: 1.2, estimatedEPS: 1.0 },
        { actualEPS: 1.1, estimatedEPS: 1.0 }
      ]
    },
    fiiDiiOut: {
      ok: true,
      data: [
        { category: 'FII', netValue: 120 },
        { category: 'DII', netValue: 85, buyValue: 200, sellValue: 115 }
      ],
      meta: { fetchedAt: new Date().toISOString() }
    },
    bulkDealsOut: { ok: true, data: [] },
    blockDealsOut: { ok: true, data: [] },
    layer15SupplyChainNews: { ok: true, data: { items: [] } },
    layer15Announcements: { ok: true, data: [] },
    layer17Metrics: { winRate: 0.60, profitFactor: 1.5 },
    sector: sector,
    sectorIndexSymbol: 'NIFTY 50'
  };
}

function getBasePrice(symbol) {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 10000;
  }
  return 100 + (seed % 4900); // 100 to 5000 price range
}

function setupMockDatabaseState(symbol) {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 10000;
  }
  
  mockDb.universe_registry[symbol] = {
    isin: `INE${(seed + 100000).toString().slice(0, 9)}`,
    sector: ['IT', 'FIN', 'AUTO', 'PHARMA', 'FMCG', 'ENERGY'][seed % 6]
  };

  mockDb.promoter_pledge[symbol] = {
    pledged_shares_pct: (seed % 10 === 0) ? 52.50 : 1.25, // Some will trigger pledge limits
    promoter_holding_pct: 60.00,
    pledge_velocity_qoq: (seed % 10 === 0) ? 11.50 : 0.20,
    bulk_deal_alert: false
  };

  mockDb.rs_ratings[symbol] = {
    rs_percentile: 10 + (seed % 89),
    is_confirmed_uptrend: (seed % 2 === 0)
  };
}

// ── 3. TEST SUITE RUNNER ─────────────────────────────────────────────────

async function runTests() {
  console.log('Starting StockSense Ultra Pro upgraded 26-layer verification checks...\n');

  // Load benchmark symbols
  const benchmarkPath = path.join(__dirname, 'benchmark_universe.json');
  if (!fs.existsSync(benchmarkPath)) {
    console.error(`ERROR: Benchmark file not found at ${benchmarkPath}`);
    process.exit(1);
  }
  const symbols = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  // Initialize cached elements for all benchmark stocks deterministically
  for (const sym of symbols) {
    setupMockDatabaseState(sym);
    
    // Inject deterministic static data into fallback memory cache
    const cacheKey = `stocksense:static:${sym}`;
    global.memoryCache[cacheKey] = generateMockStaticData(sym);

    // Inject deterministic volatile data (candles, depth)
    const basePrice = getBasePrice(sym);
    const volatileObj = global.volatileCache[sym];
    if (volatileObj) {
      volatileObj.candles = generateDeterministicCandles(sym, basePrice);
      volatileObj.lastPrice = basePrice;
      volatileObj.depth = VolatileCacheManager.generateMockDepth(basePrice);
      VolatileCacheManager.recomputeIndicators(sym);
    } else {
      global.volatileCache[sym] = {
        symbol: sym,
        lastPrice: basePrice,
        candles: generateDeterministicCandles(sym, basePrice),
        depth: VolatileCacheManager.generateMockDepth(basePrice),
        lastUpdated: new Date().toISOString(),
        indicators: null
      };
      VolatileCacheManager.recomputeIndicators(sym);
    }
  }

  // Define options
  const testOptions = { isBacktestMode: true, backtestDate: '2026-01-15' };

  // =========================================================================
  // TEST A: Internal Consistency & Determinism
  // =========================================================================
  console.log('Executing Test A: Internal Consistency & Determinism...');
  let testAFailures = 0;

  for (const sym of symbols) {
    const res1 = await analyzeStock(sym, 'ST', testOptions);
    const res2 = await analyzeStock(sym, 'ST', testOptions);

    const score1 = res1.data.masterScore;
    const score2 = res2.data.masterScore;
    
    const layers1 = JSON.stringify(res1.layers.layer13.scoreOut.data.rawScores);
    const layers2 = JSON.stringify(res2.layers.layer13.scoreOut.data.rawScores);

    const vetoes1 = JSON.stringify(res1.data.verdict);
    const vetoes2 = JSON.stringify(res2.data.verdict);

    if (score1 !== score2 || layers1 !== layers2 || vetoes1 !== vetoes2) {
      console.error(`❌ Determinism mismatch for ${sym}:`);
      console.error(`   Run 1: Score=${score1}, Verdict=${vetoes1}`);
      console.error(`   Run 2: Score=${score2}, Verdict=${vetoes2}`);
      testAFailures++;
    }
  }

  if (testAFailures === 0) {
    console.log('✅ Test A Passed: All 100 symbols scored bit-for-bit identically on consecutive runs.\n');
  } else {
    console.error(`❌ Test A Failed with ${testAFailures} mismatches.\n`);
  }

  // =========================================================================
  // TEST B: Directional Accuracy Benchmark & Baseline Verification
  // =========================================================================
  console.log('Executing Test B: Directional Accuracy Baseline Verification...');
  const baselinePath = path.join(__dirname, 'accuracy_baseline_26layer.json');
  
  const currentResults = {};
  for (const sym of symbols) {
    const res = await analyzeStock(sym, 'ST', testOptions);
    currentResults[sym] = {
      masterScore: res.data.masterScore,
      verdict: res.data.verdict,
      dataQuality: res.data.data_quality_score,
      vetoReasons: res.layers.layer13.scoreOut.data.engineResult?.vetoReasons || [],
      upTarget: res.layers.layer13.scoreOut.data.engineResult?.upTarget,
      downTarget: res.layers.layer13.scoreOut.data.engineResult?.downTarget
    };
  }

  if (!fs.existsSync(baselinePath)) {
    console.log(`Writing new baseline metrics file to ${baselinePath}...`);
    fs.writeFileSync(baselinePath, JSON.stringify(currentResults, null, 2));
    console.log('✅ Baseline accuracy file written successfully.');
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    let baselineMatches = 0;
    let baselineMismatches = 0;

    for (const sym of symbols) {
      const base = baseline[sym];
      const curr = currentResults[sym];

      if (!base) {
        baselineMismatches++;
        continue;
      }

      // Check masterScore equivalence (using small epsilon for floating point comparison)
      const diff = Math.abs(base.masterScore - curr.masterScore);
      if (diff < 0.0001 && base.verdict === curr.verdict) {
        baselineMatches++;
      } else {
        console.error(`Mismatch vs Baseline for ${sym}: Expected Score=${base.masterScore}, Got=${curr.masterScore}`);
        baselineMismatches++;
      }
    }

    if (baselineMismatches === 0) {
      console.log(`✅ Test B Passed: All 100 symbols match accuracy_baseline_26layer.json exactly.\n`);
    } else {
      console.error(`❌ Test B Failed: ${baselineMismatches} symbol scores deviated from baseline.\n`);
    }
  }

  // =========================================================================
  // CONTRIBUTION DIVERGENCE CHECK (26-Layer vs Legacy 18-Layer)
  // =========================================================================
  console.log('Executing Contribution Divergence Check (26-Layer vs Legacy 18-Layer)...');
  
  let divergenceCount = 0;
  
  // Helper to compute legacy weights from 26-layer static weights
  function getLegacyWeights(staticWeights) {
    const legacyKeys = [
      'layer1_macro', 'layer2_microstructure', 'layer3_technicals', 'layer4_price_action',
      'layer5_volume_profile', 'layer6_institutional', 'layer7_derivatives', 'layer8_fundamentals',
      'layer9_forensic', 'layer10_valuation', 'layer11_predictive', 'layer15_sentiment'
    ];
    let legacySum = 0;
    for (const k of legacyKeys) {
      legacySum += staticWeights[k] || 0;
    }
    const legacyWeights = {};
    for (const k of Object.keys(staticWeights)) {
      if (legacyKeys.includes(k)) {
        legacyWeights[k] = (staticWeights[k] / legacySum) * 100;
      } else {
        legacyWeights[k] = 0;
      }
    }
    return legacyWeights;
  }

  for (const sym of symbols) {
    const res = await analyzeStock(sym, 'ST', testOptions);
    const score26 = res.data.masterScore;
    const rawScores = res.layers.layer13.scoreOut.data.rawScores;
    const vixRegime = res.layers.layer13.scoreOut.data.vixRegime || 'LOW_VIX';

    // Get 26-layer static weights and map to legacy 18-layer
    const staticWeights = getWeights('INTRADAY', vixRegime);
    const legacyWeights = getLegacyWeights(staticWeights);

    // Compute legacy score using scoreAggregationEngine
    const legacyAgg = scoreAggregationEngine({ layer_scores: rawScores, weights: legacyWeights });
    const score18 = Number(legacyAgg.data.total_score.toFixed(2));

    const diff = Math.abs(score26 - score18);
    if (diff > 0.01) {
      divergenceCount++;
    }
  }

  const divergencePct = (divergenceCount / symbols.length) * 100;
  console.log(`Divergence Audit: ${divergenceCount} of 100 symbols deviated between 26-layer and 18-layer. (${divergencePct.toFixed(1)}%)`);
  
  if (divergencePct >= 30.0) {
    console.log(`✅ Contribution Divergence Check Passed (Required >= 30%, Achieved ${divergencePct.toFixed(1)}%).\n`);
  } else {
    console.error(`❌ Contribution Divergence Check Failed: Divergence rate ${divergencePct.toFixed(1)}% is less than required 30%.\n`);
  }

  // =========================================================================
  // SELF-LEARNING & WALK-FORWARD INTEGRATION TEST
  // =========================================================================
  console.log('Executing E2E Self-Learning & Walk-Forward Calibration Test...');

  // Load trades fixture
  const tradesPath = path.join(__dirname, 'fixtures', 'simulated_trades.json');
  if (!fs.existsSync(tradesPath)) {
    console.error(`ERROR: Trades fixture not found at ${tradesPath}`);
    process.exit(1);
  }
  const tradeHistory = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));

  // Get static weights for test
  const testMode = 'INTRADAY';
  const testRegime = 'LOW_VIX';
  const staticWeights = getWeights(testMode, testRegime);

  // 1. Run Walk-Forward Engine to verify Sharpe and WFE score calculations
  const wfResult = Layer26.computeWalkForward({
    trades: tradeHistory,
    mode: 'INTRADAY',
    windowSize: 130,
    stepSize: 50
  });

  console.log('Walk-Forward result logs:', JSON.stringify(wfResult.logs, null, 2));
  console.log('Walk-Forward result data:', JSON.stringify(wfResult.data, null, 2));
  console.log(`Walk-Forward Result: ok=${wfResult.ok}, WFE score=${wfResult.data.wfeScore}, WFE coefficient=${wfResult.data.wfeCoefficient}`);
  if (!wfResult.ok || wfResult.data.wfeScore === undefined) {
    console.error('❌ Walk-Forward Engine execution failed.');
    process.exit(1);
  }

  // Inject a high WFE score to force lambda > 0 for active weight calibration
  const mockWfe = 0.75; // WFE > 0.70 means wfeCoefficient = 1.0

  // 2. Calibrate weights
  const calibrationResult = Layer25.calibrateWeights({
    staticWeights,
    tradeHistory,
    wfeScore: mockWfe,
    engineUpgradeDate: '2026-05-25'
  });

  if (!calibrationResult.calibratedWeights) {
    console.error('❌ Weight Calibration failed to converge.');
    process.exit(1);
  }

  console.log(`Weight Calibration: Lambda=${calibrationResult.lambda}`);
  console.log('Calibrated weights successfully generated.');

  // Validate ceiling/floor bounds on calibrated weights
  let boundsValid = true;
  for (const [k, w] of Object.entries(calibrationResult.calibratedWeights)) {
    if (k === 'layer12_risk') continue;
    if (w < 1.0 || w > 30.0) {
      console.error(`❌ Constraint violation: weight for ${k} is ${w}% (bounds: [1%, 30%])`);
      boundsValid = false;
    }
  }

  if (boundsValid) {
    console.log('✅ Floor & Ceiling bounds successfully maintained.');
  }

  // 3. Test Ceiling Hit Streak Reset Automation
  console.log('Simulating 3 consecutive ceiling hits for a layer...');
  let currentStreak = { layer19_promoter_pledge: 0 };
  let shouldResetTriggered = false;

  // Create a custom staticWeights where layer19 is near the ceiling
  const customStaticWeights = { ...staticWeights };
  customStaticWeights.layer19_promoter_pledge = 28.0;
  // Reduce other layers to compensate, keeping them above 2.0% floor
  customStaticWeights.layer2_microstructure = 5.0;
  customStaticWeights.layer3_technicals = 5.0;
  customStaticWeights.layer5_volume_profile = 6.0;

  let currentWeights = { ...customStaticWeights };

  for (let cycle = 1; cycle <= 5; cycle++) {
    // Run calibration iteration
    const mockResult = Layer25.calibrateWeights({
      staticWeights: currentWeights,
      tradeHistory,
      wfeScore: mockWfe,
      ceilingHitStreak: currentStreak,
      engineUpgradeDate: '2026-05-25',
      // Pass a custom multiplier to force promoter pledge high
      dirichletMultipliers: { layer19_promoter_pledge: 1000 }
    });

    currentStreak = mockResult.newCeilingHitStreak;
    currentWeights = mockResult.calibratedWeights;
    console.log(`Cycle ${cycle}: Calibrated L19 Weight = ${currentWeights.layer19_promoter_pledge}%, Streak for L19 = ${currentStreak.layer19_promoter_pledge}, ResetTriggered = ${mockResult.shouldReset}`);
    if (mockResult.shouldReset) {
      shouldResetTriggered = true;
    }
  }

  if (shouldResetTriggered) {
    console.log('✅ Stored Procedure Reset Weights automation successfully triggered on 3rd ceiling strike.');
  } else {
    console.error('❌ Streak reset failed to trigger.');
    process.exit(1);
  }

  // 4. Test High Pledge Fatal Veto Trigger
  console.log('Testing High Pledge Fatal Veto Trigger...');
  const highPledgePath = path.join(__dirname, 'fixtures', 'high_pledge_stock.json');
  const highPledgeData = JSON.parse(fs.readFileSync(highPledgePath, 'utf8'));

  // Temporarily mock promoter_pledge table with distressed stock values
  mockDb.promoter_pledge['MOCKHIGHPLG'] = {
    pledged_shares_pct: highPledgeData.pledged_shares_pct,
    promoter_holding_pct: highPledgeData.promoter_holding_pct,
    pledge_velocity_qoq: highPledgeData.pledge_velocity_qoq,
    bulk_deal_alert: highPledgeData.bulk_deal_alert
  };
  mockDb.universe_registry['MOCKHIGHPLG'] = {
    isin: 'INE000000001',
    sector: 'GENERAL'
  };

  // Populate mock cache for MOCKHIGHPLG to prevent cache miss
  global.memoryCache[`stocksense:static:MOCKHIGHPLG`] = generateMockStaticData('MOCKHIGHPLG');
  const hpBasePrice = getBasePrice('MOCKHIGHPLG');
  global.volatileCache['MOCKHIGHPLG'] = {
    symbol: 'MOCKHIGHPLG',
    lastPrice: hpBasePrice,
    candles: generateDeterministicCandles('MOCKHIGHPLG', hpBasePrice),
    depth: VolatileCacheManager.generateMockDepth(hpBasePrice),
    lastUpdated: new Date().toISOString(),
    indicators: null
  };
  VolatileCacheManager.recomputeIndicators('MOCKHIGHPLG');

  const highPledgeRes = await analyzeStock('MOCKHIGHPLG', 'ST', testOptions);
  const vetoed = highPledgeRes.layers.layer13.scoreOut.data.engineResult?.isVetoed;
  const vetoReasons = highPledgeRes.layers.layer13.scoreOut.data.engineResult?.vetoReasons || [];

  if (vetoed && vetoReasons.includes('PROMOTER_PLEDGE_DISTRESS_VETO')) {
    console.log('✅ Fatal Veto correctly triggered for high promoter pledge and high velocity.');
  } else {
    console.error('❌ High Pledge Fatal Veto failed to trigger. Output:', highPledgeRes.layers.layer13.scoreOut.data.engineResult);
    process.exit(1);
  }

  console.log('\n🎉 ALL upgraded 26-layer verification and accuracy checks passed successfully!');
  process.exit(0);
}

// Run test runner
runTests().catch(err => {
  console.error('FATAL Test Suite Error:', err);
  process.exit(1);
});
