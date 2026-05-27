const { logger } = require("../lib/logger");

/**
 * Authentication middleware to validate X-API-KEY header against configured keys.
 * Enforces zero-fallback security in production environments.
 */
function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const isProduction = process.env.NODE_ENV === "production";
  
  // Sourcing keys from env
  const envKey = process.env.API_KEY;
  const envKeysList = process.env.API_AUTH_KEYS;
  
  // Parse allowed keys
  const allowedKeys = [];
  if (envKey) allowedKeys.push(envKey);
  if (envKeysList) {
    envKeysList.split(",").forEach(key => {
      const trimmed = key.trim();
      if (trimmed) allowedKeys.push(trimmed);
    });
  }
  
  // Fallback keys ONLY in non-production
  if (!isProduction && allowedKeys.length === 0) {
    allowedKeys.push("stocksense-secret-api-key");
    logger.warn("SECURITY WARNING: Sourcing fallback API key 'stocksense-secret-api-key' because no API_KEY or API_AUTH_KEYS environment variables are configured.");
  }
  
  if (allowedKeys.length === 0) {
    logger.error("SECURITY CRITICAL: Denying API request because no API keys are configured in environment variables and system is running in production mode.");
    return res.status(401).json({ error: "unauthorized_security_configuration_missing" });
  }
  
  if (!apiKey || !allowedKeys.includes(apiKey)) {
    logger.warn("unauthorized_api_access_attempt", { 
      ip: req.ip, 
      method: req.method, 
      path: req.path,
      hasKey: !!apiKey
    });
    return res.status(401).json({ error: "unauthorized_api_key" });
  }
  
  next();
}

module.exports = { authenticate };
