const { Router } = require("express");

const {
  proxyDetailedRiskPrediction,
  proxyLiveRiskPrediction,
  proxyWeatherLookup,
} = require("../services/aiProxy.service");
const logger = require("../utils/logger");
const { sendSuccess } = require("../utils/apiResponse");

const router = Router();

router.get("/weather/live", async (req, res, next) => {
  try {
    const result = await proxyWeatherLookup(req.query.city);
    return sendSuccess(res, result, "Live weather lookup completed successfully.");
  } catch (error) {
    logger.error(`Weather proxy route failed: ${error.message}`);
    return next(error);
  }
});

router.post("/predict", async (req, res, next) => {
  try {
    const result = await proxyDetailedRiskPrediction(req.body);
    return sendSuccess(res, result, "Risk prediction completed successfully.");
  } catch (error) {
    logger.error(`Risk proxy route failed: ${error.message}`);
    return next(error);
  }
});

router.post("/predict/live", async (req, res, next) => {
  try {
    const result = await proxyLiveRiskPrediction(req.body);
    return sendSuccess(res, result, "Live risk prediction completed successfully.");
  } catch (error) {
    logger.error(`Live risk proxy route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
