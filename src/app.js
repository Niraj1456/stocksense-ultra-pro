const express = require("express");
const helmet = require("helmet");

const { configureCors } = require("./middleware/cors");
const { requestLogger } = require("./middleware/requestLogger");
const { rateLimiter } = require("./middleware/rateLimiter");
const { validateSymbol } = require("./middleware/inputValidator");
const { authenticate } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");

const { layer1Router } = require("./routes/layer1");
const { layer6Router } = require("./routes/layer6");
const { layer7Router } = require("./routes/layer7");
const { layer8Router } = require("./routes/layer8");
const { layer9Router } = require("./routes/layer9");
const { layer10Router } = require("./routes/layer10");
const { layer11Router } = require("./routes/layer11");
const { layer15Router } = require("./routes/layer15");
const { layer16Router } = require("./routes/layer16");
const { layer17Router } = require("./routes/layer17");
const { analyzeRouter } = require("./routes/analyze");
const { kiteRouter } = require("./routes/kite");
const { apiRouter } = require("./routes/api");

function createApp() {
  const app = express();

  // 1. Core security headers (Helmet)
  app.use(helmet());

  // 2. Correlation ID tracking & latency logging
  app.use(requestLogger);

  // 3. CORS origin whitelist lockdown
  app.use(configureCors());

  // 4. Global body parsing limits
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // 5. Global rate limiter (except for non-production defaults)
  app.use(rateLimiter);

  // Unprotected health check for basic cluster/load-balancer pings
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 6. Security Guards & Route Registrations
  
  // Public route: Kite Connect OAuth Redirect (Zerodha redirects here without headers)
  app.use("/api/kite", kiteRouter);

  // Protected routes: Require validation and authentication
  app.use("/api/layer1", authenticate, validateSymbol, layer1Router);
  app.use("/api/layer6", authenticate, validateSymbol, layer6Router);
  app.use("/api/layer7", authenticate, validateSymbol, layer7Router);
  app.use("/api/layer8", authenticate, validateSymbol, layer8Router);
  app.use("/api/layer9", authenticate, validateSymbol, layer9Router);
  app.use("/api/layer10", authenticate, validateSymbol, layer10Router);
  app.use("/api/layer11", authenticate, validateSymbol, layer11Router);
  app.use("/api/layer15", authenticate, validateSymbol, layer15Router);
  app.use("/api/layer16", authenticate, validateSymbol, layer16Router);
  app.use("/api/layer17", authenticate, validateSymbol, layer17Router);
  
  app.use("/api/analyze", authenticate, validateSymbol, analyzeRouter);
  app.use("/api/v1/analyze", authenticate, validateSymbol, analyzeRouter);
  
  // Base API routes (health and weight override - double layers of security)
  app.use("/api", authenticate, apiRouter);

  // 7. Centralized global error handling middleware
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

