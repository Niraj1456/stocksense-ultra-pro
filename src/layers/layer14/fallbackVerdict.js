// MODULE 14.3 — DETERMINISTIC NLG FALLBACK ENGINE
function deterministicNlgFallback({ symbol, master_verdict, veto_reasons, risk_params }) {
  const verdict = master_verdict?.verdict || "UNKNOWN";
  const score = master_verdict?.final_score || 0;
  
  let summary = "";
  let action_plan = "";

  // 1. Synthesize Veto Case
  if (veto_reasons && veto_reasons.length > 0) {
    summary = `The system has triggered a hard VETO on ${symbol} due to critical risk factors: ${veto_reasons.join(", ")}.`;
    action_plan = `Execution is blocked. Do not allocate capital. Wait for veto clearance.`;
  } 
  // 2. Synthesize Buy Case
  else if (score >= 70) {
    summary = `Quantitative analysis of ${symbol} yields a ${verdict} with a score of ${score}/100. Confluence across macro, order flow, and technical layers indicates high probability accumulation.`;
    action_plan = `Proceed with execution. Suggested risk allocation: ${risk_params?.recommended_allocation || "Standard Kelly"} at max ${risk_params?.position_pct || "Optimal"}% portfolio weight. Trail stops aggressively if R-Multiple exceeds 2.0.`;
  } 
  // 3. Synthesize Neutral/Sell Case
  else if (score < 40) {
    summary = `Systematic evaluation of ${symbol} yields a ${verdict} (Score: ${score}/100), reflecting severe deterioration in momentum, institutional backing, or relative valuation.`;
    action_plan = `Avoid long exposure. Look for short-entry pullbacks or liquidate current positions.`;
  } 
  // 4. Default / Watch Case
  else {
    summary = `${symbol} currently prints a ${verdict} (Score: ${score}/100). The asset is in a mixed regime, lacking extreme confluence in either direction.`;
    action_plan = `Remain sidelined. Setup does not meet the minimum asymmetrical risk/reward threshold.`;
  }

  const response_text = `
SUMMARY:
${summary}

EXECUTION PLAN:
${action_plan}
  `.trim();

  return {
    ok: true,
    data: {
      symbol,
      engine: "deterministic_nlg_fallback",
      response_text
    },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:deterministicNlgFallback" }
  };
}

module.exports = { deterministicNlgFallback };
