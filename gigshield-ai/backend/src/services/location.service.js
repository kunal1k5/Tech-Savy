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
const NUMERIC_LOCATION_FIELDS = [
  "origin_id",
  "day_of_week",
  "hour_of_day",
  "travel_time_mean",
  "lower_bound",
  "upper_bound",
];

function normalizeLocationKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function extractLocationCode(value) {
  const normalizedValue = String(value || "").trim();
  const match = /([A-Za-z]+|\d+)$/.exec(normalizedValue.replace(/\s+/g, ""));
  return match ? match[1] : "";
}

function isSlightMismatch(currentLocation, actualLocation) {
  const currentCode = extractLocationCode(currentLocation);
  const actualCode = extractLocationCode(actualLocation);

  if (currentCode && actualCode) {
    if (/^\d+$/.test(currentCode) && /^\d+$/.test(actualCode)) {
      return Math.abs(Number(currentCode) - Number(actualCode)) <= 1;
    }

    if (currentCode.length === 1 && actualCode.length === 1) {
      return Math.abs(currentCode.toUpperCase().charCodeAt(0) - actualCode.toUpperCase().charCodeAt(0)) <= 2;
    }

    return currentCode[0].toUpperCase() === actualCode[0].toUpperCase();
  }

  return false;
}

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

function isNumericLocationPayload(payload) {
  return NUMERIC_LOCATION_FIELDS.some((field) => payload?.[field] !== undefined);
}

function validateNumericLocationPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const validatedPayload = {};
  const missingFields = [];
  const invalidFields = [];

  for (const field of NUMERIC_LOCATION_FIELDS) {
    if (payload[field] === undefined) {
      missingFields.push(field);
      continue;
    }

    const numericValue = Number(payload[field]);
    if (!Number.isFinite(numericValue)) {
      invalidFields.push(field);
      continue;
    }

    validatedPayload[field] = numericValue;
  }

  if (missingFields.length) {
    const error = new Error(`Missing required fields: ${missingFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (invalidFields.length) {
    const error = new Error(`All location input fields must be numeric. Invalid fields: ${invalidFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (payload.actual_destination_id !== undefined && payload.actual_destination_id !== null && payload.actual_destination_id !== "") {
    const actualDestinationId = Number(payload.actual_destination_id);
    if (!Number.isInteger(actualDestinationId)) {
      const error = new Error("Field 'actual_destination_id' must be an integer.");
      error.statusCode = 400;
      throw error;
    }
    validatedPayload.actual_destination_id = actualDestinationId;
  }

  return validatedPayload;
}

function validateTextLocationPayload(payload) {
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

function validateLocationPayload(payload) {
  return isNumericLocationPayload(payload)
    ? validateNumericLocationPayload(payload)
    : validateTextLocationPayload(payload);
}

function buildFallbackTextLocationResponse(payload) {
  const actualLocation = payload.actual_location || null;
  const match =
    actualLocation === null
      ? null
      : normalizeLocationKey(payload.current_location) === normalizeLocationKey(actualLocation);
  const fraudSignal =
    match === null
      ? "MEDIUM"
      : match
        ? "LOW"
        : isSlightMismatch(payload.current_location, actualLocation)
          ? "MEDIUM"
          : "HIGH";

  return {
    current_location: payload.current_location,
    predicted_location: payload.current_location,
    actual_location: actualLocation,
    time: payload.time || null,
    match,
    fraud_signal: fraudSignal,
    fraud_score_delta: fraudSignalToScore(fraudSignal),
    fraud_status:
      match === true
        ? "Clear"
        : fraudSignal === "HIGH"
          ? "Suspicious"
          : match === false
            ? "Review"
            : "Pending",
    source: "fallback",
    warning: "AI location service unavailable. Using continuity fallback.",
  };
}

function buildFallbackNumericLocationResponse(payload) {
  const predictedDestinationId = Number(payload.actual_destination_id || payload.origin_id || 0);
  const actualDestinationId =
    payload.actual_destination_id !== undefined ? Number(payload.actual_destination_id) : null;
  const match =
    actualDestinationId === null ? null : predictedDestinationId === actualDestinationId;
  const fraudSignal = match === null ? "MEDIUM" : match ? "LOW" : "HIGH";

  return {
    predicted_destination_id: predictedDestinationId,
    predicted_destination_name: `Zone-${String.fromCharCode(65 + (predictedDestinationId % 26))}`,
    predicted_encoded_destination: predictedDestinationId,
    confidence: 0.34,
    top_candidates: [],
    actual_destination_id: actualDestinationId,
    actual_destination_name:
      actualDestinationId === null
        ? null
        : `Zone-${String.fromCharCode(65 + (actualDestinationId % 26))}`,
    predicted_location: `Zone-${String.fromCharCode(65 + (predictedDestinationId % 26))}`,
    actual_location:
      actualDestinationId === null
        ? null
        : `Zone-${String.fromCharCode(65 + (actualDestinationId % 26))}`,
    match,
    fraud_signal: fraudSignal,
    fraud_score_delta: fraudSignalToScore(fraudSignal),
    fraud_status: match === true ? "Clear" : match === false ? "Suspicious" : "Pending",
    source: "fallback",
    warning: "AI location service unavailable. Using numeric route fallback.",
  };
}

function buildFallbackLocationResponse(payload) {
  return isNumericLocationPayload(payload)
    ? buildFallbackNumericLocationResponse(payload)
    : buildFallbackTextLocationResponse(payload);
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
  isNumericLocationPayload,
  normalizeFraudSignal,
  validateLocationPayload,
};
