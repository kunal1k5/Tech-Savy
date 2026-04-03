/**
 * Temporary location continuity route for backend -> AI engine integration testing.
 */

const { Router } = require("express");

const { getLocationCheck } = require("../services/location.service");
const logger = require("../utils/logger");

const router = Router();

router.post("/location-check", async (req, res, next) => {
  try {
    const result = await getLocationCheck(req.body);
    return res.json(result);
  } catch (error) {
    logger.error(`Location route failed: ${error.message}`);
    return next(error);
  }
});

module.exports = router;
