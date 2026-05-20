const express = require("express");
const { runVerification } = require("../verify/runVerification");

const verifyRouter = express.Router();

verifyRouter.get("/", async (_req, res, next) => {
  try {
    const out = await runVerification();
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { verifyRouter };

