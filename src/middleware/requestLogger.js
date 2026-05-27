const { v4: uuidv4 } = require("uuid");
const { logger, asyncLocalStorage } = require("../lib/logger");

/**
 * Express middleware to assign a unique Correlation ID (UUID) to every request.
 * Logs incoming request details and tracks latency upon completion.
 */
function requestLogger(req, res, next) {
  // Try to read correlation ID from request headers (set by client or load balancer)
  // otherwise generate a brand new one
  const correlationId = req.headers["x-request-id"] || uuidv4();
  
  // Assign correlation ID to request object and response header
  req.id = correlationId;
  res.setHeader("X-Request-ID", correlationId);
  
  const startTime = Date.now();
  
  // Wrap execution in AsyncLocalStorage store so all logs within this request carry the CID
  asyncLocalStorage.run({ correlationId }, () => {
    // Log request start
    logger.info("request_start", {
      requestId: correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip
    });
    
    // Capture response finish event
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      
      logger.info("request_end", {
        requestId: correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration
      });
    });
    
    next();
  });
}

module.exports = { requestLogger };
