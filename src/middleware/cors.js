const cors = require("cors");
const { logger } = require("../lib/logger");

/**
 * Configure strict CORS validation based on ALLOWED_ORIGINS environment variable.
 */
function configureCors() {
  const isProduction = process.env.NODE_ENV === "production";
  const originsEnv = process.env.ALLOWED_ORIGINS;
  
  let whitelist = [];
  if (originsEnv) {
    whitelist = originsEnv.split(",").map(o => o.trim().toLowerCase());
  }

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow server-to-server requests or tool requests (no origin)
      if (!origin) {
        return callback(null, true);
      }
      
      const parsedOrigin = origin.trim().toLowerCase();
      
      // Allow whitelisted origins
      if (whitelist.includes(parsedOrigin)) {
        return callback(null, true);
      }
      
      // Allow localhost in non-production as a safe development fallback
      if (!isProduction) {
        if (
          parsedOrigin.startsWith("http://localhost:") ||
          parsedOrigin.startsWith("http://127.0.0.1:") ||
          parsedOrigin.startsWith("https://localhost:") ||
          parsedOrigin.startsWith("https://127.0.0.1:")
        ) {
          return callback(null, true);
        }
      }
      
      logger.warn("cors_origin_rejected", { origin });
      callback(new Error(`Origin '${origin}' blocked by security CORS policy.`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY", "X-Request-ID"],
    credentials: true,
    maxAge: 86400 // 24 hours preflight cache
  };

  return cors(corsOptions);
}

module.exports = { configureCors };
