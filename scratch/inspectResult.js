const { analyzeStock } = require("../src/analyze/analyzeStock");
const fs = require("fs");

async function main() {
  console.log("Running ST analysis...");
  let stResult = await analyzeStock("RELIANCE", "ST");
  while (stResult.status === "PROCESSING") {
    console.log("Waiting 2s for ST static cache hydration...");
    console.log("Current memory cache keys:", Object.keys(global.memoryCache || {}));
    await new Promise(resolve => setTimeout(resolve, 2000));
    stResult = await analyzeStock("RELIANCE", "ST");
  }
  fs.writeFileSync("scratch/st_response.json", JSON.stringify(stResult, null, 2));
  console.log("ST Response Saved.");

  console.log("Running LT analysis...");
  let ltResult = await analyzeStock("RELIANCE", "LT");
  while (ltResult.status === "PROCESSING") {
    console.log("Waiting 2s for LT static cache hydration...");
    console.log("Current memory cache keys:", Object.keys(global.memoryCache || {}));
    await new Promise(resolve => setTimeout(resolve, 2000));
    ltResult = await analyzeStock("RELIANCE", "LT");
  }
  fs.writeFileSync("scratch/lt_response.json", JSON.stringify(ltResult, null, 2));
  console.log("LT Response Saved.");

  // Clean up global simulation intervals to let the process exit cleanly
  console.log("Cleaning up simulation intervals...");
  for (const key of Object.keys(global.volatileCache || {})) {
    if (key.startsWith("interval_")) {
      clearInterval(global.volatileCache[key]);
      delete global.volatileCache[key];
    }
  }
}
main().catch(console.error);
