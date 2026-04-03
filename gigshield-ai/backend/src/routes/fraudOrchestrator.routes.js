/**
 * Fraud orchestrator route for end-to-end fraud intelligence checks.
 */

const { Router } = require("express");

const { runFraudOrchestrator } = require("../services/fraudOrchestrator.service");
const logger = require("../utils/logger");

const router = Router();

router.post("/fraud-check", async (req, res, next) => {
  try {
    const result = await runFraudOrchestrator(req.body);
    return res.json(result);
  } catch (error) {
    logger.error(`Fraud orchestrator route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
