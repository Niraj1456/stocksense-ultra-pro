const { logger } = require("../lib/logger");

/**
 * Centralized Express global error handling middleware.
 * Returns sanitized error messages in production to protect system internals.
 */
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = req.id || "no_request_id";
  
  // Log the complete error trace
  logger.error("unhandled_express_error", {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path
  });
  
  // Check if headers have already been sent to client
  if (res.headersSent) {
    return next(err);
  }
  
  const response = {
    error: "internal_error"
  };
  
  // Include diagnostic information ONLY in non-production environments
  if (!isProduction) {
    response.message = err.message;
    response.stack = err.stack;
  }
  
  res.status(500).json(response);
}

module.exports = { errorHandler };
