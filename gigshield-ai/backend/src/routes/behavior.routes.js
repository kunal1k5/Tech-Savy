/**
 * Temporary behavior-analysis route for fraud signal integration.
 */

const { Router } = require("express");

const { analyzeBehavior } = require("../services/behavior.service");
const logger = require("../utils/logger");
const { buildSystemResponse } = require("../utils/systemResponse");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.post("/analyze-behavior", async (req, res, next) => {
  try {
    const result = await Promise.resolve(analyzeBehavior(req.body));
    return sendSuccess(
      res,
      buildSystemResponse({
        behavior_status: result.behavior_status,
        behavior_score: result.behavior_score,
        suspicious: result?.suspicious || false,
        issues: result.issues,
      }),
      "Behavior analysis completed successfully."
    );
  } catch (error) {
    logger.error(`Behavior route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
