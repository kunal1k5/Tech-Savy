const { calculatePremium } = require("./premium.service");

const REQUIRED_FIELDS = ["aqi", "rain", "wind"];

function validateRiskPremiumPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => payload[field] === undefined);
  if (missingFields.length) {
    const error = new Error(`Missing required fields: ${missingFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const validatedPayload = {};
  const invalidFields = [];

  for (const field of REQUIRED_FIELDS) {
    const numericValue = Number(payload[field]);
    if (Number.isNaN(numericValue)) {
      invalidFields.push(field);
      continue;
    }

    validatedPayload[field] = numericValue;
  }

  if (invalidFields.length) {
    const error = new Error(`All input fields must be numeric. Invalid fields: ${invalidFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  return validatedPayload;
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

  return {
    risk,
    premium: calculatePremium(risk),
  };
}

module.exports = {
  calculateRisk,
  getRiskPremium,
  validateRiskPremiumPayload,
};
