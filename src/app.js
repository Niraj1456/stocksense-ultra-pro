const express = require("express");
const cors = require("cors");

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
const { logger } = require("./lib/logger");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use((req, _res, next) => {
    logger.info("request", { method: req.method, path: req.path });
    next();
  });

  app.use("/api/layer1", layer1Router);
  app.use("/api/layer6", layer6Router);
  app.use("/api/layer7", layer7Router);
  app.use("/api/layer8", layer8Router);
  app.use("/api/layer9", layer9Router);
  app.use("/api/layer10", layer10Router);
  app.use("/api/layer11", layer11Router);
  app.use("/api/layer15", layer15Router);
  app.use("/api/layer16", layer16Router);
  app.use("/api/layer17", layer17Router);
  app.use("/api/analyze", analyzeRouter);
  app.use("/api/v1/analyze", analyzeRouter);
  app.use("/api/kite", kiteRouter);
  app.use("/api", apiRouter);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error("unhandled_error", { message: err?.message, stack: err?.stack });
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

module.exports = { createApp };

