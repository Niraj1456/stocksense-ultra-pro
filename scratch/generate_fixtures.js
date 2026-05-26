const fs = require('fs');
const path = require('path');

// 1. Create simulated_trades.json
// 250 closed trades, 60/40 win/loss (150 wins, 100 losses) distributed uniformly
const trades = [];
const startDate = new Date('2026-05-26T10:00:00.000Z');

for (let i = 0; i < 250; i++) {
  const isWin = i % 5 < 3; // 3 wins, then 2 losses (60% win rate)
  const entryPrice = 100;
  const exitPrice = isWin ? 105 : 97;
  const returnPct = isWin ? 5.0 : -3.0;

  // Space trades by 2 hours to avoid 180-day staleness check
  const entryDate = new Date(startDate.getTime() + i * 2 * 60 * 60 * 1000);
  const exitDate = new Date(entryDate.getTime() + 1 * 60 * 60 * 1000); // 1 hour holding

  // Mock layer scores
  // Layer 19 will be very accurate: 75 score (bullish) for wins, 25 score (bearish) for losses
  // Layer 20 will be inaccurate: 25 score for wins, 75 score for losses
  // Other layers will be semi-accurate or neutral
  const layer_scores_json = {
    layer1_macro: isWin ? 60 : 40,
    layer2_microstructure: isWin ? 62 : 38,
    layer3_technicals: isWin ? 65 : 35,
    layer4_price_action: isWin ? 58 : 42,
    layer5_volume_profile: isWin ? 60 : 40,
    layer6_institutional: isWin ? 55 : 45,
    layer7_derivatives: isWin ? 59 : 41,
    layer8_fundamentals: isWin ? 57 : 43,
    layer9_forensic: isWin ? 55 : 45,
    layer10_valuation: isWin ? 55 : 45,
    layer11_predictive: isWin ? 55 : 45,
    layer15_sentiment: isWin ? 55 : 45,
    layer19_promoter_pledge: isWin ? 75 : 25, // Very accurate
    layer20_earnings_quality: isWin ? 25 : 75, // Inaccurate
    layer21_rs_rating: isWin ? 58 : 42,
    layer22_mtf_coherence: isWin ? 60 : 40,
    layer23_peer_percentile: isWin ? 56 : 44,
    layer24_mgmt_quality: isWin ? 55 : 45
  };

  trades.push({
    id: i + 1,
    symbol: 'RELIANCE',
    entry_ts: entryDate.toISOString(),
    entry_price: entryPrice,
    size: 100,
    sl: 95,
    target: 110,
    exit_ts: exitDate.toISOString(),
    exit_price: exitPrice,
    returnPct,
    entryDate: entryDate.toISOString(),
    exitDate: exitDate.toISOString(),
    mode: 'INTRADAY',
    layer_scores_json,
    json: JSON.stringify({ layer_scores: layer_scores_json })
  });
}

const fixturesDir = path.join(__dirname, '..', 'tests', 'fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

fs.writeFileSync(
  path.join(fixturesDir, 'simulated_trades.json'),
  JSON.stringify(trades, null, 2)
);
console.log('Generated simulated_trades.json');

// 2. Create high_pledge_stock.json
// Mock stock with >50% pledge and >10% velocity
const highPledgeStock = {
  symbol: 'MOCKHIGHPLG',
  pledged_shares_pct: 55.0,
  promoter_holding_pct: 60.0,
  decayRate: 0.0,
  pledge_velocity_qoq: 12.0,
  bulk_deal_alert: true,
  last_updated_at: new Date().toISOString()
};

fs.writeFileSync(
  path.join(fixturesDir, 'high_pledge_stock.json'),
  JSON.stringify(highPledgeStock, null, 2)
);
console.log('Generated high_pledge_stock.json');
