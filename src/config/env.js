function boolEnv(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

const env = {
  port: Number(process.env.PORT || 3000),
  logLevel: process.env.LOG_LEVEL || "info",

  enableSmartApi: boolEnv("ENABLE_SMARTAPI", false),
  enableClaude: boolEnv("ENABLE_CLAUDE", false),

  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",

  angelClientId: process.env.ANGEL_CLIENT_ID || "",
  angelApiKey: process.env.ANGEL_API_KEY || "",
  angelPin: process.env.ANGEL_PIN || process.env.ANGEL_MPIN || "",
  angelTotpSecret: process.env.ANGEL_TOTP_SECRET || process.env.ANGEL_TOTP || "",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  truthProtocolSecret: process.env.TRUTH_PROTOCOL_SECRET || "",

  // Alternative Data APIs
  alphaVantageKey: process.env.ALPHA_VANTAGE_KEY || "",
  fmpApiKey: process.env.FMP_API_KEY || "",

  // Zerodha Kite Connect API
  kiteApiKey: process.env.KITE_API_KEY || "",
  kiteApiSecret: process.env.KITE_API_SECRET || "",
  kiteAccessToken: process.env.KITE_ACCESS_TOKEN || "",

  rbiDbieBase: process.env.RBI_DBIE_BASE || "https://api.dbie.rbi.org.in/DBIE/dbie.rbi",
  rbiDbieApiKey: process.env.RBI_DBIE_API_KEY || ""
};

function validateEnv() {
  const warnings = [];

  if (!env.databaseUrl) warnings.push("DATABASE_URL missing (Postgres disabled)");
  if (!env.redisUrl) warnings.push("REDIS_URL missing (Redis cache disabled)");
  if (!env.truthProtocolSecret) warnings.push("SECURITY CRITICAL: TRUTH_PROTOCOL_SECRET is missing. No fallback secret will be accepted in production mode.");

  if (env.enableSmartApi) {
    if (!env.angelApiKey) warnings.push("ENABLE_SMARTAPI=true but ANGEL_API_KEY missing");
    if (!env.angelClientId) warnings.push("ENABLE_SMARTAPI=true but ANGEL_CLIENT_ID missing");
    if (!env.angelPin) warnings.push("ENABLE_SMARTAPI=true but ANGEL_PIN/ANGEL_MPIN missing");
    if (!env.angelTotpSecret) warnings.push("ENABLE_SMARTAPI=true but ANGEL_TOTP_SECRET/ANGEL_TOTP missing");
  }

  if (env.enableClaude && !env.anthropicApiKey) {
    warnings.push("ENABLE_CLAUDE=true but ANTHROPIC_API_KEY missing");
  }

  // Validate Kite Connect parameters if any are configured
  if (env.kiteApiKey || env.kiteApiSecret) {
    if (!env.kiteApiKey) warnings.push("KITE_API_KEY missing");
    if (!env.kiteApiSecret) warnings.push("KITE_API_SECRET missing");
  }

  return warnings;
}

module.exports = { env, validateEnv, boolEnv };

