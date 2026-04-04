const { calculatePremium } = require("./premium.service");
const { buildRiskReason } = require("../utils/explanations");
const { ensureObject, sanitizeWeatherMetrics } = require("../utils/inputSafety");

function validateRiskPremiumPayload(payload) {
  const safePayload = ensureObject(payload);
  return sanitizeWeatherMetrics(safePayload);
}

function calculateRisk({ aqi, rain, wind }) {
  if (aqi > 300 || rain > 20 || wind > 30) {
    return "HIGH";
  }

  if (aqi > 150 || rain > 5) {
    return "MEDIUM";
  }

  return "LOW";
}

function getRiskPremium(payload) {
  const validatedPayload = validateRiskPremiumPayload(payload);
  const risk = calculateRisk(validatedPayload);
  const riskReason = buildRiskReason({
    risk,
    ...validatedPayload,
  });

  return {
    risk,
    premium: calculatePremium(risk),
    riskReason,
    reason: riskReason,
  };
}

module.exports = {
  calculateRisk,
  getRiskPremium,
  validateRiskPremiumPayload,
};
