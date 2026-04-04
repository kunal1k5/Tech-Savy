const { Router } = require("express");

const logger = require("../utils/logger");
const { getRiskPremium } = require("../services/riskPremium.service");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.post("/risk-premium", (req, res, next) => {
  try {
    const result = getRiskPremium(req.body);
    return sendSuccess(res, result, "Risk and premium calculated successfully.");
  } catch (error) {
    logger.error(`Risk premium route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
