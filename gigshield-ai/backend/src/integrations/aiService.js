const axios = require("axios");

const logger = require("../utils/logger");

const AI_ENGINE_URL = (process.env.AI_ENGINE_URL || "http://localhost:8000").replace(/\/$/, "");
const AI_ENGINE_TIMEOUT_MS = Number(process.env.AI_ENGINE_TIMEOUT_MS || 10000);

const client = axios.create({
  baseURL: AI_ENGINE_URL,
  timeout: AI_ENGINE_TIMEOUT_MS,
});

function normalizeAiError(error, fallbackMessage) {
  const upstreamMessage =
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage;

  const wrapped = new Error(upstreamMessage || fallbackMessage);
  wrapped.statusCode = error?.response?.status || 503;
  wrapped.cause = error;
  return wrapped;
}

async function request(method, url, data, config = {}) {
  try {
    const response = await client.request({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error) {
    logger.error(`AI integration call failed: ${method.toUpperCase()} ${url}`, error.message);
    throw normalizeAiError(error, "AI engine request failed");
  }
}

module.exports = {
  health() {
    return request("get", "/health");
  },

  assessRisk(payload) {
    return request("post", "/api/risk/assess", payload);
  },

  checkFraud(payload) {
    return request("post", "/api/fraud/check", payload);
  },

  calculatePremium(payload) {
    return request("post", "/api/premium/calculate", payload);
  },

  fetchWeather(city) {
    return request("get", "/weather/live", undefined, { params: { city } });
  },

  predictRisk(payload) {
    return request("post", "/predict", payload);
  },

  predictWeatherRisk(payload) {
    return request("post", "/predict-risk", payload);
  },

  predictLiveRisk(payload) {
    return request("post", "/predict/live", payload);
  },

  predictLocation(payload) {
    return request("post", "/predict-location", payload);
  },
};
