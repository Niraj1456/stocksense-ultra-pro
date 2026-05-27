const { logger } = require("../lib/logger");

/**
 * Middleware to sanitize and validate stock symbols passed via query string or request body.
 * Permits alphanumeric characters, dot (.), and hyphen (-) with length limits.
 */
function validateSymbol(req, res, next) {
  // Extract symbol from query, params, or body
  const rawSymbol = req.query.symbol || req.body.symbol || req.params.symbol;
  
  if (!rawSymbol) {
    return next(); // Let downstream route-specific validators handle missing symbol errors
  }
  
  const symbol = String(rawSymbol).trim();
  
  // Rule 1: Length check (Tickers should be 1 to 20 characters long)
  if (symbol.length === 0 || symbol.length > 20) {
    logger.warn("input_validation_failed", { reason: "invalid_symbol_length", symbol });
    return res.status(400).json({ 
      error: "invalid_symbol_length", 
      message: "Stock symbol length must be between 1 and 20 characters." 
    });
  }
  
  // Rule 2: Character set check (alphanumeric, dot, hyphen, underscore only to prevent shell/command injection or directory traversal)
  const validPattern = /^[a-zA-Z0-9.\-_]+$/;
  if (!validPattern.test(symbol)) {
    logger.warn("input_validation_failed", { reason: "invalid_characters", symbol });
    return res.status(400).json({ 
      error: "invalid_symbol_characters", 
      message: "Stock symbol contains invalid characters. Only alphanumeric characters, dots, underscores, and hyphens are allowed." 
    });
  }
  
  // Save sanitized symbol back to req object
  if (req.query.symbol) req.query.symbol = symbol;
  if (req.body.symbol) req.body.symbol = symbol;
  if (req.params.symbol) req.params.symbol = symbol;
  
  next();
}

module.exports = { validateSymbol };
