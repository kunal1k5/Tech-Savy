/**
 * Temporary location continuity route for backend -> AI engine integration testing.
 */

const { Router } = require("express");

const { getLocationCheck } = require("../services/location.service");
const logger = require("../utils/logger");
const { buildSystemResponse } = require("../utils/systemResponse");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

async function handleLocationRequest(req, res, next) {
  try {
    const result = await getLocationCheck(req.body);
    return sendSuccess(
      res,
      {
        ...result,
        ...buildSystemResponse({
          location_signal: result.fraud_signal,
          predicted_location: result.predicted_location,
          actual_location: result.actual_location,
          match: result.match,
          suspicious: result?.suspicious || false,
          source: result.source,
          warning: result.warning,
        }),
      },
      "Location check completed successfully."
    );
  } catch (error) {
    logger.error(`Location route failed: ${error.message}`);
    return next(error);
  }
}

router.post("/location-check", handleLocationRequest);
router.post("/predict-location", handleLocationRequest);

module.exports = router;
