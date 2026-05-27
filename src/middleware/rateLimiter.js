const { logger } = require("../lib/logger");

// Simple in-memory storage for IP rate tracking
const rateMap = new Map();

// Cleanup interval to prevent memory leaks (evict old IPs every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap.entries()) {
    if (now > entry.resetTime) {
      rateMap.delete(ip);
    }
  }
}, 300000); // 5 minutes
if (typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}

/**
 * IP-based sliding window rate limiting middleware.
 * Returns 429 Too Many Requests immediately when limit is exceeded.
 */
function rateLimiter(req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Disable rate limiting for local development testing unless explicitly asked
  if (!isProduction && process.env.ENABLE_DEV_RATE_LIMIT !== "true") {
    return next();
  }

  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown_ip";
  const now = Date.now();
  
  // Rate limits configured from environment variables or defaults
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000); // default 1 minute
  const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100); // default 100 requests per minute
  
  let entry = rateMap.get(ip);
  
  if (!entry) {
    entry = {
      requests: 0,
      resetTime: now + windowMs
    };
    rateMap.set(ip, entry);
  }
  
  // If window elapsed, reset window counter
  if (now > entry.resetTime) {
    entry.requests = 0;
    entry.resetTime = now + windowMs;
  }
  
  entry.requests++;
  
  // Set standard rate limit headers
  const remaining = Math.max(0, maxRequests - entry.requests);
  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));
  
  if (entry.requests > maxRequests) {
    logger.warn("rate_limit_exceeded", { ip, path: req.path, requests: entry.requests });
    
    // Suggest Retry-After header
    res.setHeader("Retry-After", Math.ceil((entry.resetTime - now) / 1000));
    
    return res.status(429).json({
      error: "too_many_requests",
      message: "Too many requests from this IP address. Please try again later."
    });
  }
  
  next();
}

module.exports = { rateLimiter };
