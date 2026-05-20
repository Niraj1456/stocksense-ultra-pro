const Anthropic = require("@anthropic-ai/sdk");
const { env } = require("../../config/env");
const { deterministicNlgFallback } = require("./fallbackVerdict");

// MODULE 14.1 — AI PROMPT COMPILER
function compilePrompt({ symbol, mode, master_verdict, score_breakdown, veto_reasons, risk_params }) {
  return `
You are the StockSense Ultra Pro AI.
Your task is to synthesize the quantitative outputs from a 13-Layer Institutional Architecture into a strict executive summary.

SYMBOL: ${symbol}
MODE: ${mode}
MASTER VERDICT: ${master_verdict.verdict} (Conviction: ${master_verdict.conviction_level})
TOTAL SCORE: ${master_verdict.final_score}
VETOES ACTIVE: ${veto_reasons && veto_reasons.length > 0 ? veto_reasons.join(", ") : "NONE"}

KEY DRIVERS:
${JSON.stringify(score_breakdown, null, 2)}

RISK PARAMETERS:
${JSON.stringify(risk_params, null, 2)}

INSTRUCTIONS:
1. Obey the Law of Determinism: Do not invent data. Only reference the JSON provided.
2. Structure your response EXACTLY as follows:
   - SUMMARY: A 2-sentence executive summary.
   - BULL CASE: Top 2 positive drivers.
   - BEAR CASE: Top 2 negative drivers or risks.
   - EXECUTION: Strict action plan based on the Master Verdict and Risk Parameters.
`;
}

// MODULE 14.2 — AI ORCHESTRATOR
async function aiOrchestrator(args) {
  const symbol = args?.symbol;
  const mode = args?.mode || "ST";

  // Handle flexible signature mapping
  let master_verdict = args?.master_verdict;
  if (!master_verdict && args?.verdictData && args?.scoreData) {
    master_verdict = {
      verdict: args.verdictData.verdict,
      conviction_level: args.verdictData.confidence,
      final_score: args.scoreData.totalScore
    };
  }

  let score_breakdown = args?.score_breakdown || args?.scoreData || {};

  let veto_reasons = args?.veto_reasons;
  if (!veto_reasons) {
    veto_reasons = args?.scoreData?.engineResult?.vetoReasons || [];
  }

  let risk_params = args?.risk_params;
  if (!risk_params && args?.context?.layer12) {
    const l12 = args.context.layer12;
    risk_params = {
      recommended_allocation: l12.sizeOut?.data?.allocation || "Standard Kelly",
      position_pct: l12.sizeOut?.data?.shares ? ((l12.sizeOut.data.allocation / 100000) * 100).toFixed(2) : "Optimal"
    };
  }

  if (!env.enableClaude || !env.anthropicApiKey) {
    return deterministicNlgFallback({ symbol, master_verdict, veto_reasons, risk_params });
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const prompt = compilePrompt({ symbol, mode, master_verdict, score_breakdown, veto_reasons, risk_params });

    const resp = await client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 500,
      temperature: 0.0, // Force determinism
      messages: [{ role: "user", content: prompt }]
    });

    const text = resp?.content?.map((c) => c?.text).filter(Boolean).join("\n") || "No response generated.";

    return {
      ok: true,
      data: { 
        symbol, 
        mode, 
        engine: "claude-3-opus", 
        response_text: text 
      },
      meta: { fetchedAt: new Date().toISOString(), source: "layer14:aiOrchestrator" }
    };
  } catch (error) {
    console.error("AI Orchestration failed:", error.message);
    return deterministicNlgFallback({ symbol, master_verdict, veto_reasons, risk_params });
  }
}

module.exports = { aiOrchestrator, compilePrompt };
