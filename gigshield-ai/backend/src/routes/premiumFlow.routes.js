/**
 * Temporary dynamic premium route for backend -> AI engine integration testing.
 */

const { Router } = require("express");

const { getPremiumQuote } = require("../services/premium.service");
const logger = require("../utils/logger");
const { buildSystemResponse } = require("../utils/systemResponse");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.post("/calculate-premium", async (req, res, next) => {
  try {
    const result = await getPremiumQuote(req.body);
    return sendSuccess(
      res,
      buildSystemResponse({
        risk: result.risk,
        premium: result.premium,
        source: result.source,
        score: result.score,
        warning: result.warning,
      }),
      "Premium calculated successfully."
    );
  } catch (error) {
    logger.error(`Premium route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
