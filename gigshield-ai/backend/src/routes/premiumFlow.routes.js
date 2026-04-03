/**
 * Temporary dynamic premium route for backend -> AI engine integration testing.
 */

const { Router } = require("express");

const { getPremiumQuote } = require("../services/premium.service");
const logger = require("../utils/logger");

const router = Router();

router.post("/calculate-premium", async (req, res, next) => {
  try {
    const result = await getPremiumQuote(req.body);
    return res.json({
      risk: result.risk,
      premium: result.premium,
      ...(result.source ? { source: result.source } : {}),
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (error) {
    logger.error(`Premium route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
