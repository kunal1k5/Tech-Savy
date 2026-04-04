const { Router } = require("express");

const logger = require("../utils/logger");
const { getAutoClaimDecision } = require("../services/autoClaim.service");
const { sendHandledError, sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.post("/auto-claim", (req, res, next) => {
  try {
    const result = getAutoClaimDecision(req.body);
    return sendSuccess(res, result, "Auto-claim decision generated successfully.");
  } catch (error) {
    logger.error(`Auto claim route failed: ${error.message}`);
    return sendHandledError(res, error.statusCode || 500);
  }
});

module.exports = router;
