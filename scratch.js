const { analyzeStock } = require("./src/analyze/analyzeStock");

async function main() {
  const symbol = "RELIANCE";
  try {
    const result = await analyzeStock(symbol, "ST");
    console.log("Analyze Stock Output:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error analyzing stock:", error);
  }
}

main();
