/**
 * Location Service
 *
 * Calls the AI location prediction API, compares expected vs actual
 * location, and returns a fraud-oriented signal for the frontend and
 * demo routes.
 */

const aiService = require("../integrations/aiService");
const logger = require("../utils/logger");

const FRAUD_SCORE_DELTA = {
  LOW: 0,
  MEDIUM: 15,
  HIGH: 30,
};

function normalizeFraudSignal(signal) {
  const normalized = String(signal || "").trim().toUpperCase();
  if (FRAUD_SCORE_DELTA[normalized] !== undefined) {
    return normalized;
  }
  return "MEDIUM";
}

function fraudSignalToScore(signal) {
  return FRAUD_SCORE_DELTA[normalizeFraudSignal(signal)];
}

function validateLocationPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const currentLocation = String(payload.current_location || "").trim();
  if (!currentLocation) {
    const error = new Error("Field 'current_location' is required.");
    error.statusCode = 400;
    throw error;
  }

  const validatedPayload = {
    current_location: currentLocation,
  };

  if (payload.actual_location !== undefined && payload.actual_location !== null && payload.actual_location !== "") {
    validatedPayload.actual_location = String(payload.actual_location).trim();
  }

  if (payload.time !== undefined && payload.time !== null && payload.time !== "") {
    validatedPayload.time = String(payload.time).trim();
  }

  if (payload.day_of_week !== undefined && payload.day_of_week !== null && payload.day_of_week !== "") {
    const dayOfWeek = Number(payload.day_of_week);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      const error = new Error("Field 'day_of_week' must be an integer between 0 and 6.");
      error.statusCode = 400;
      throw error;
    }
    validatedPayload.day_of_week = dayOfWeek;
  }

  return validatedPayload;
}

function buildFallbackLocationResponse(payload) {
  const actualLocation = payload.actual_location || null;
  const match =
    actualLocation === null
      ? null
      : payload.current_location.trim().toLowerCase() === actualLocation.trim().toLowerCase();
  const fraudSignal = match === null ? "MEDIUM" : match ? "LOW" : "MEDIUM";

  return {
    current_location: payload.current_location,
    predicted_location: payload.current_location,
    actual_location: actualLocation,
    time: payload.time || null,
    match,
    fraud_signal: fraudSignal,
    fraud_score_delta: fraudSignalToScore(fraudSignal),
    fraud_status: match === true ? "Clear" : match === false ? "Review" : "Pending",
    source: "fallback",
    warning: "AI location service unavailable. Using continuity fallback.",
  };
}

async function getLocationCheck(payload) {
  const requestPayload = validateLocationPayload(payload);

  try {
    const aiResult = await aiService.predictLocation(requestPayload);
    const fraudSignal = normalizeFraudSignal(aiResult.fraud_signal);

    return {
      ...aiResult,
      fraud_signal: fraudSignal,
      fraud_score_delta: fraudSignalToScore(fraudSignal),
      source: "ai-engine",
    };
  } catch (error) {
    logger.error(`Location flow AI call failed: ${error.message}`);
    return buildFallbackLocationResponse(requestPayload);
  }
}

module.exports = {
  buildFallbackLocationResponse,
  fraudSignalToScore,
  getLocationCheck,
  normalizeFraudSignal,
  validateLocationPayload,
};
