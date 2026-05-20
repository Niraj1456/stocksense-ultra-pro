const express = require("express");
const router = express.Router();
const { logger } = require("../lib/logger");

// The master quant analyst prompt
const QUANT_PROMPT = `You are a lead Quant Analyst at a top-tier Indian institutional trading desk, with deep expertise in NSE/BSE intraday trading. It is currently 8:45–9:15 AM IST (pre-market window). Use the most current live data available. Your sole objective: identify 5–8 high-probability intraday trades for today's session (9:15 AM – 3:30 PM IST).

Analyze ALL of the following sections thoroughly before producing recommendations:

SECTION A — GLOBAL MACRO: US Markets (Dow, S&P, Nasdaq), European Markets (FTSE, DAX), Asian Markets (Nikkei, Hang Seng, GIFT Nifty), DXY, US 10Y yield.

SECTION B — GEOPOLITICAL RISK: Rate LOW/MEDIUM/HIGH/CRITICAL. Analyze Russia-Ukraine, Middle East, India-Pakistan/China tensions, sanctions, trade wars.

SECTION C — COMMODITIES: Brent crude, gold, silver, copper, aluminium. Impact on ONGC, Oil India, Tata Steel, Hindalco, Vedanta.

SECTION D — CURRENCY & RATES: USD/INR, DXY, RBI/Fed stance, India 10Y G-Sec yield.

SECTION E — INSTITUTIONAL FLOW: FII/DII activity (₹ crore), PCR, max pain, SEBI news.

SECTION F — TECHNICALS: GIFT Nifty gap, Nifty support/resistance, India VIX. For each stock: RSI(14), MACD, EMA(20/50), Bollinger Bands, volume vs 10-day avg, ATR(14), 52-week proximity.

SECTION G — QUANT FILTERS (HARD GATES — any fail = eliminate):
1. Sector index must align with trade direction
2. Longs: price > VWAP | Shorts: price < VWAP
3. Entry only after 15-min ORB confirmation
4. Stock must show Relative Strength vs Nifty 50
5. Mid-cap delivery % > 40%
6. ATR(14) must confirm 2-3% move is feasible

SECTION H — SUCCESS SCORE (1-10): [+2] Price>VWAP, [+2] RS vs Nifty, [+2] Sector aligned, [+2] Volume>1.5x avg, [+2] Macro catalyst. Discard <6.

SECTION I — CATALYSTS: Earnings, order wins, analyst upgrades, insider buying, USFDA approvals, sector rotation.

SECTION J — SENTIMENT SCORE & RISK OVERRIDES: Rate 10 factors as Bullish(+1)/Neutral(0)/Bearish(-1). AVOID longs if: VIX>20, war escalation, global crash >3%, emergency rate action, INR collapse >1.5%.

OUTPUT FORMAT — For each of 5-8 stocks:

MARKET SUMMARY:
- Overall bias, Sentiment score (/10), India VIX, GIFT Nifty gap, Key macro driver, Hedge suggestion

For each STOCK:
- Success Score (/10), Relative Strength, Delivery %
- Entry zone: ₹X – ₹X (after 15-min ORB)
- Target 1 (+2%), Target 2 (+3.5%), Target 3 (+5%)
- Stop loss (strict -1% to -1.2%)
- Trailing logic, Risk:Reward, Hold duration, Confidence
- Why today: Technical signal, Institutional catalyst, Sector alignment, Risk factor

Also include: STOCKS TO AVOID, STRONGEST SECTOR TODAY, SECTOR TO AVOID.

IMPORTANT: Use REAL current data. Today's date is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Be specific with actual price levels, not generic advice.`;

async function callGemini(apiKey) {
  const { GoogleGenAI } = require("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: QUANT_PROMPT,
    config: {
      temperature: 0.7,
      maxOutputTokens: 16000,
    }
  });

  return response.text || "";
}

async function callClaude(apiKey) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    thinking: {
      type: "enabled",
      budget_tokens: 10000
    },
    messages: [
      {
        role: "user",
        content: QUANT_PROMPT
      }
    ]
  });

  // Extract text from content blocks
  let text = "";
  let thinking = "";
  for (const block of message.content) {
    if (block.type === "thinking") thinking = block.thinking || "";
    if (block.type === "text") text += block.text;
  }
  return { text, thinking };
}

// GET /api/ai-assistant/generate
router.get("/generate", async (req, res) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY;

    if (!geminiKey && !claudeKey) {
      return res.status(400).json({
        ok: false,
        error: "No AI API keys configured. Set GEMINI_API_KEY and/or ANTHROPIC_API_KEY in .env"
      });
    }

    logger.info("ai_assistant_start", { hasGemini: !!geminiKey, hasClaude: !!claudeKey });

    const results = {};
    const errors = {};

    // Run both in parallel
    const promises = [];

    if (geminiKey) {
      promises.push(
        callGemini(geminiKey)
          .then(text => { results.gemini = { text, model: "Gemini 2.5 Pro (Thinking)" }; })
          .catch(err => {
            logger.error("gemini_error", { message: err.message });
            errors.gemini = err.message;
          })
      );
    }

    if (claudeKey) {
      promises.push(
        callClaude(claudeKey)
          .then(({ text, thinking }) => {
            results.claude = { text, thinking, model: "Claude Sonnet 4.6" };
          })
          .catch(err => {
            logger.error("claude_error", { message: err.message });
            errors.claude = err.message;
          })
      );
    }

    await Promise.all(promises);

    const timestamp = new Date().toISOString();

    res.json({
      ok: true,
      timestamp,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });

  } catch (err) {
    logger.error("ai_assistant_error", { message: err.message, stack: err.stack });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ai-assistant/status — check which APIs are configured
router.get("/status", (_req, res) => {
  res.json({
    gemini: !!process.env.GEMINI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY
  });
});

const aiAssistantRouter = router;
module.exports = { aiAssistantRouter };
