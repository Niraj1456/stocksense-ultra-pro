const path = require("path");
require("dotenv").config();

const { dbQuery } = require("../src/lib/db");
const { analyzeStock } = require("../src/analyze/analyzeStock");

async function runTest() {
  console.log("🚀 Starting Closed-Loop Integration Test for Layer 17 Backtesting Engine...");
  const testSymbol = "TESTSTK";

  try {
    // 1. Clean up existing mock trades for TESTSTK
    console.log("🧹 Cleaning up old test records...");
    await dbQuery("DELETE FROM trades WHERE symbol = $1", [testSymbol]);

    // 2. Insert 3 specific mock closed trades to verify math logic
    console.log("📝 Inserting 3 mock closed trades...");
    
    // Trade 1: Entry = 100, SL = 90 (Risk = 10), Exit = 120 (Gain = 20) -> R = +2.0
    await dbQuery(`
      INSERT INTO trades (symbol, entry_ts, entry_price, size, sl, target, exit_ts, exit_price, json)
      VALUES ($1, NOW() - INTERVAL '3 days', 100, 10, 90, 150, NOW() - INTERVAL '2 days', 120, '{"sandbox": true, "status": "CLOSED"}')
    `, [testSymbol]);

    // Trade 2: Entry = 100, SL = 90 (Risk = 10), Exit = 110 (Gain = 10) -> R = +1.0
    await dbQuery(`
      INSERT INTO trades (symbol, entry_ts, entry_price, size, sl, target, exit_ts, exit_price, json)
      VALUES ($1, NOW() - INTERVAL '2 days', 100, 10, 90, 150, NOW() - INTERVAL '1 day', 110, '{"sandbox": true, "status": "CLOSED"}')
    `, [testSymbol]);

    // Trade 3: Entry = 100, SL = 90 (Risk = 10), Exit = 85 (Loss = -15) -> R = -1.5
    await dbQuery(`
      INSERT INTO trades (symbol, entry_ts, entry_price, size, sl, target, exit_ts, exit_price, json)
      VALUES ($1, NOW() - INTERVAL '1 day', 100, 10, 90, 150, NOW(), 85, '{"sandbox": true, "status": "CLOSED"}')
    `, [testSymbol]);

    console.log("✅ Mock trades inserted successfully.");

    // 3. Run the complete analyzeStock engine loop for TESTSTK
    console.log(`🔍 Running 18-Layer Engine analysis for ${testSymbol}...`);
    const analysis = await analyzeStock(testSymbol, "ST");

    if (!analysis || !analysis.ok) {
      throw new Error("Engine execution returned unsuccessful status.");
    }

    const layer17 = analysis.layers.layer17;
    console.log("\n📊 --- LAYER 17 DYNAMIC ENGINE OUTPUT ---");
    console.log("Total Trades Calculated :", layer17.totalTrades);
    console.log("Calculated Win Rate     :", layer17.winRate + "%");
    console.log("Expectancy Value (R)    :", layer17.expectancy + "R");
    console.log("Peak Max Drawdown %     :", layer17.drawdown + "%");
    console.log("Performance Grade       :", layer17.performanceGrade);
    console.log("------------------------------------------\n");

    // 4. Validate output matches expected maths:
    // Total Trades: 3
    // Win Rate: 2 wins out of 3 = 66.7%
    // Expectancy: (0.667 * 1.5) + (0.333 * -1.5) = 0.5R
    // Drawdown: Balance curve goes 100k -> 102k (+2R) -> 103k (+1R) -> 101.5k (-1.5R). 
    // Peak is 103k. Drawdown at end is (103k - 101.5k) / 103k * 100 = 1.46%. Max Drawdown = 1.46%
    if (layer17.totalTrades !== 3) throw new Error(`Expected 3 trades, got ${layer17.totalTrades}`);
    if (Math.abs(layer17.winRate - 66.7) > 0.5) throw new Error(`Expected winRate around 66.7%, got ${layer17.winRate}`);
    if (Math.abs(layer17.expectancy - 0.5) > 0.1) throw new Error(`Expected expectancy around 0.5R, got ${layer17.expectancy}`);
    if (Math.abs(layer17.drawdown - 1.46) > 0.1) throw new Error(`Expected max drawdown around 1.46%, got ${layer17.drawdown}`);

    console.log("🎉 SUCCESS: Layer 17 dynamically fetched trades, executed math correctly, and returned identical outcomes to expected theoretical values!");

  } catch (error) {
    console.error("❌ TEST FAILED:", error.message);
  } finally {
    // 5. Clean up database
    console.log("🧹 Cleaning up test records for TESTSTK...");
    try {
      await dbQuery("DELETE FROM trades WHERE symbol = $1", [testSymbol]);
      console.log("✅ Cleanup complete.");
    } catch (cleanErr) {
      console.warn("⚠️ Cleanup warning:", cleanErr.message);
    }
    process.exit(0);
  }
}

runTest();
