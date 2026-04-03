/**
 * Temporary end-to-end route for verifying backend -> AI engine connectivity.
 */

const { Router } = require("express");
const axios = require("axios");

const logger = require("../utils/logger");

const router = Router();

const SAMPLE_RISK_PAYLOAD = {
  temperature: 35,
  humidity: 80,
  precip_mm: 20,
  wind_kph: 25,
  aqi: 200,
};

const TEST_FLOW_AI_URL =
  process.env.TEST_FLOW_AI_URL || "http://127.0.0.1:5000/predict-risk";

function hasLocalPortConflict(req) {
  try {
    const targetUrl = new URL(TEST_FLOW_AI_URL);
    const backendPort = String(process.env.PORT || req.socket.localPort || 5000);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

    return localHosts.has(targetUrl.hostname) && targetUrl.port === backendPort;
  } catch {
    return false;
  }
}

router.get("/test-flow", async (req, res) => {
  if (hasLocalPortConflict(req)) {
    return res.status(500).json({
      error:
        "Port conflict detected. Backend and Flask AI engine cannot both use the same local port. Run backend on a different port such as 5001, or update TEST_FLOW_AI_URL.",
    });
  }

  try {
    const response = await axios.post(TEST_FLOW_AI_URL, SAMPLE_RISK_PAYLOAD, {
      timeout: Number(process.env.AI_ENGINE_TIMEOUT_MS || 10000),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return res.json({
      message: "Full system working",
      risk: response.data,
    });
  } catch (error) {
    logger.error("Test flow AI call failed:", error.message);

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.response?.data?.detail || error.message,
      message: "Backend to AI engine test failed",
    });
  }
});

module.exports = router;
