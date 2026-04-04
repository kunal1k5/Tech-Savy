/**
 * Fraud orchestrator route for end-to-end fraud intelligence checks.
 */

const { Router } = require("express");

const { runFraudOrchestrator } = require("../services/fraudOrchestrator.service");
const { calculatePremium } = require("../services/premium.service");
const logger = require("../utils/logger");
const { buildSystemResponse } = require("../utils/systemResponse");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.post("/fraud-check", async (req, res, next) => {
  try {
    const result = await runFraudOrchestrator(req.body);
    const systemResponse = buildSystemResponse({
      ...result,
      premium: calculatePremium(result.risk),
      predicted_location: result.intelligence?.location?.predicted_location,
      actual_location: result.intelligence?.location?.actual_location,
      match: result.intelligence?.location?.match,
      suspicious:
        Boolean(result.intelligence?.behavior?.suspicious) ||
        Boolean(result.intelligence?.location?.suspicious) ||
        Boolean(result.intelligence?.context?.suspicious) ||
        Boolean(result.intelligence?.anomaly?.suspicious) ||
        result.status === "FRAUD",
      source: "fraud-orchestrator",
    });

    return sendSuccess(
      res,
      {
        ...systemResponse,
        fraudScore: result.fraud_score,
        details: result.details,
        contextValid: result.context_valid,
        context_valid: result.context_valid,
        locationMatch: result.locationMatch,
        claimsCount: result.claimsCount,
        loginAttempts: result.loginAttempts,
        claimTriggered: result.claimTriggered,
        suspiciousPattern: result.suspiciousPattern,
        anomalyScore: result.anomaly_score,
        anomaly_score: result.anomaly_score,
      },
      "Fraud check completed successfully."
    );
  } catch (error) {
    logger.error(`Fraud orchestrator route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
