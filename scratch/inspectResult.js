const { analyzeStock } = require("../src/analyze/analyzeStock");
const fs = require("fs");

async function main() {
  console.log("Running ST analysis...");
  const stResult = await analyzeStock("RELIANCE", "ST");
  fs.writeFileSync("scratch/st_response.json", JSON.stringify(stResult, null, 2));

  console.log("Running LT analysis...");
  const ltResult = await analyzeStock("RELIANCE", "LT");
  fs.writeFileSync("scratch/lt_response.json", JSON.stringify(ltResult, null, 2));

  console.log("LT Response Saved.");
}
main().catch(console.error);
