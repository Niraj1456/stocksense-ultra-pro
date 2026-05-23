const { analyzeStock } = require("../src/analyze/analyzeStock");

async function main() {
  console.log("Starting analyzeStock integration test for RELIANCE...");
  
  try {
    console.log("\n1. Testing Short-Term (ST) analysis:");
    const stResult = await analyzeStock("RELIANCE", "ST");
    console.log("ST Result Status:", stResult.ok ? "SUCCESS ✅" : "FAILED ❌");
    console.log("Master Score:", stResult.data?.masterScore);
    console.log("Verdict:", stResult.data?.verdict);
    console.log("AI Reasoning:", stResult.data?.aiReasoning);
    console.log("Final Up Target:", stResult.layers?.layer13?.scoreOut?.data?.engineResult?.upTarget);
    console.log("Final Down Target:", stResult.layers?.layer13?.scoreOut?.data?.engineResult?.downTarget);
    console.log("Veto Status:", stResult.layers?.layer13?.scoreOut?.data?.engineResult?.isVetoed ? "VETOED 🛡️" : "PASSED");
    if (stResult.layers?.layer13?.scoreOut?.data?.engineResult?.isVetoed) {
      console.log("Veto Reasons:", stResult.layers?.layer13?.scoreOut?.data?.engineResult?.vetoReasons);
    }

    console.log("\n2. Testing Long-Term (LT) analysis:");
    const ltResult = await analyzeStock("RELIANCE", "LT");
    console.log("LT Result Status:", ltResult.ok ? "SUCCESS ✅" : "FAILED ❌");
    console.log("Master Score:", ltResult.data?.masterScore);
    console.log("Verdict:", ltResult.data?.verdict);
    console.log("AI Reasoning:", ltResult.data?.aiReasoning);
    console.log("Final Up Target:", ltResult.layers?.layer13?.scoreOut?.data?.engineResult?.upTarget);
    console.log("Final Down Target:", ltResult.layers?.layer13?.scoreOut?.data?.engineResult?.downTarget);
    console.log("Veto Status:", ltResult.layers?.layer13?.scoreOut?.data?.engineResult?.isVetoed ? "VETOED 🛡️" : "PASSED");
    if (ltResult.layers?.layer13?.scoreOut?.data?.engineResult?.isVetoed) {
      console.log("Veto Reasons:", ltResult.layers?.layer13?.scoreOut?.data?.engineResult?.vetoReasons);
    }
    
  } catch (err) {
    console.error("Integration Test FAILED with error:", err);
  }
}

main();
