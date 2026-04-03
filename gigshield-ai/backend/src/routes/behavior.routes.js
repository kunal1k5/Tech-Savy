/**
 * Temporary behavior-analysis route for fraud signal integration.
 */

const { Router } = require("express");

const { analyzeBehavior } = require("../services/behavior.service");
const logger = require("../utils/logger");

const router = Router();

router.post("/analyze-behavior", async (req, res, next) => {
  try {
    const result = await Promise.resolve(analyzeBehavior(req.body));
    return res.json(result);
  } catch (error) {
    logger.error(`Behavior route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
