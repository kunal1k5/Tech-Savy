/**
 * Premium Service
 *
 * Calls the AI weather-risk API, converts the returned risk into a
 * premium amount, and falls back safely if the AI engine is unavailable.
 */

const aiService = require("../integrations/aiService");
const logger = require("../utils/logger");

const PREMIUM_BY_RISK = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
};

const DYNAMIC_TRIGGER_TYPES = ["RAIN", "AQI", "DEMAND"];

const FALLBACK_RISK = "MEDIUM";
const REQUIRED_FIELDS = [
  "temperature",
  "humidity",
  "precip_mm",
  "wind_kph",
  "aqi",
];

function normalizeRisk(risk) {
  const normalized = String(risk || "").trim().toUpperCase();
  if (PREMIUM_BY_RISK[normalized]) {
    return normalized;
  }
  return FALLBACK_RISK;
}

function calculatePremium(risk) {
  return PREMIUM_BY_RISK[normalizeRisk(risk)];
}

function normalizeTriggerType(triggerType) {
  const normalized = String(triggerType || "").trim().toUpperCase();

  if (DYNAMIC_TRIGGER_TYPES.includes(normalized)) {
    return normalized;
  }

  return "RAIN";
}

function calculateScale(actualValue, threshold) {
  const numericActual = Number(actualValue);
  const numericThreshold = Number(threshold);

  if (Number.isNaN(numericActual) || Number.isNaN(numericThreshold)) {
    return { multiplier: 0, severityLevel: "low", payoutEligible: false };
  }

  if (numericActual < numericThreshold) {
    return { multiplier: 0, severityLevel: "low", payoutEligible: false };
  }

  if (numericActual <= numericThreshold + 30) {
    return { multiplier: 0.6, severityLevel: "low", payoutEligible: true };
  }

  if (numericActual <= numericThreshold + 70) {
    return { multiplier: 1.2, severityLevel: "medium", payoutEligible: true };
  }

  return { multiplier: 2, severityLevel: "high", payoutEligible: true };
}

function calculateDynamicPayout({
  triggerType,
  actualValue,
  threshold,
  basePayout,
}) {
  const normalizedTriggerType = normalizeTriggerType(triggerType);
  const numericBasePayout = Math.max(0, Number(basePayout) || 0);
  const numericThreshold = Number(threshold) || 0;
  const numericActualValue = Number(actualValue) || 0;
  const scale = calculateScale(numericActualValue, numericThreshold);
  const payout = scale.payoutEligible ? Math.round(numericBasePayout * scale.multiplier) : 0;

  return {
    triggerType: normalizedTriggerType,
    actualValue: numericActualValue,
    threshold: numericThreshold,
    basePayout: numericBasePayout,
    payout,
    dynamicPayout: payout,
    severityLevel: scale.severityLevel,
    multiplier: scale.multiplier,
    payoutEligible: scale.payoutEligible,
    source: "dynamic-payout-engine",
  };
}

function validateWeatherPayload(payload) {
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

async function getPremiumQuote(payload) {
  const weatherPayload = validateWeatherPayload(payload);

  try {
    const aiResult = await aiService.predictWeatherRisk(weatherPayload);
    const risk = normalizeRisk(aiResult.risk);

    return {
      risk,
      premium: calculatePremium(risk),
      source: "ai-engine",
      score: aiResult.score,
    };
  } catch (error) {
    logger.error(`Premium flow AI call failed: ${error.message}`);

    return {
      risk: FALLBACK_RISK,
      premium: calculatePremium(FALLBACK_RISK),
      source: "fallback",
      warning: "AI risk service unavailable. Using fallback premium.",
    };
  }
}

module.exports = {
  calculatePremium,
  calculateDynamicPayout,
  getPremiumQuote,
  validateWeatherPayload,
};
