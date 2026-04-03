/**
 * Fraud Orchestrator Service
 *
 * Combines risk, location, behavior, and context validation into a
 * single fraud decision engine for judges and backend workflows.
 */

const aiService = require("../integrations/aiService");
const logger = require("../utils/logger");
const { analyzeBehavior, getBehaviorStatus, validateBehaviorPayload } = require("./behavior.service");
const { getLocationCheck, normalizeFraudSignal } = require("./location.service");
const { validateWeatherPayload } = require("./premium.service");

const DEFAULT_WEATHER_INPUT = {
  temperature: 35,
  humidity: 80,
  precip_mm: 20,
  wind_kph: 25,
  aqi: 200,
};

const DEFAULT_LOCATION_INPUT = {
  current_location: "Zone-A",
  actual_location: "Zone-Z",
  time: "14:00",
};

const DEFAULT_BEHAVIOR_INPUT = {
  claims_count: 3,
  last_claim_time: "02:30",
  working_hours: [9, 18],
  login_attempts: 5,
};

const RISK_SCORE_MAP = {
  LOW: 0,
  MEDIUM: 10,
  HIGH: 20,
};

const LOCATION_SCORE_MAP = {
  LOW: 0,
  MEDIUM: 15,
  HIGH: 30,
};

const BEHAVIOR_SCORE_MAP = {
  NORMAL: 0,
  WARNING: 10,
  ABNORMAL: 25,
};

function validateFraudOrchestratorPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  return payload;
}

function normalizeRiskLevel(risk) {
  const normalized = String(risk || "").trim().toUpperCase();
  if (RISK_SCORE_MAP[normalized] !== undefined) {
    return normalized;
  }
  return "MEDIUM";
}

function normalizeBehaviorStatus(status, score = 0) {
  const normalized = String(status || "").trim().toUpperCase();
  if (BEHAVIOR_SCORE_MAP[normalized] !== undefined) {
    return normalized;
  }
  return getBehaviorStatus(Number(score) || 0);
}

function normalizeContextValidity(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  if (value === undefined) {
    return defaultValue;
  }

  return Boolean(value);
}

function getFraudStatus(score) {
  if (score > 60) {
    return "FRAUD";
  }

  if (score > 30) {
    return "WARNING";
  }

  return "SAFE";
}

function calculateFraudContributions({
  risk,
  locationSignal,
  behaviorStatus,
  contextValid,
}) {
  return {
    risk: RISK_SCORE_MAP[normalizeRiskLevel(risk)] || 0,
    location: LOCATION_SCORE_MAP[normalizeFraudSignal(locationSignal)] || 0,
    behavior: BEHAVIOR_SCORE_MAP[normalizeBehaviorStatus(behaviorStatus)] || 0,
    context: contextValid ? 0 : 40,
  };
}

async function resolveRiskSignal(data) {
  if (data.risk !== undefined) {
    return {
      risk: normalizeRiskLevel(data.risk),
      source: "input",
    };
  }

  const weatherInput = validateWeatherPayload(data.weather || DEFAULT_WEATHER_INPUT);
  try {
    const aiResult = await aiService.predictWeatherRisk(weatherInput);
    return {
      risk: normalizeRiskLevel(aiResult.risk),
      score: aiResult.score,
      source: "ai-engine",
      input: weatherInput,
    };
  } catch (error) {
    logger.error(`Fraud orchestrator risk call failed: ${error.message}`);
    return {
      risk: "MEDIUM",
      source: "fallback",
      warning: "AI risk service unavailable. Using fallback risk level.",
      input: weatherInput,
    };
  }
}

async function resolveLocationSignal(data) {
  if (data.location_signal !== undefined) {
    return {
      location_signal: normalizeFraudSignal(data.location_signal),
      source: "input",
      match: data.location_signal === "LOW" ? true : undefined,
    };
  }

  const locationInput = data.location || DEFAULT_LOCATION_INPUT;
  const result = await getLocationCheck(locationInput);
  return {
    location_signal: normalizeFraudSignal(result.fraud_signal),
    predicted_location: result.predicted_location,
    actual_location: result.actual_location,
    match: result.match,
    source: result.source,
    warning: result.warning,
    input: locationInput,
  };
}

async function resolveBehaviorSignal(data) {
  if (data.behavior_score !== undefined || data.behavior_status !== undefined) {
    const behaviorScore = Number(data.behavior_score || 0);
    return {
      behavior_score: behaviorScore,
      behavior_status: normalizeBehaviorStatus(data.behavior_status, behaviorScore),
      source: "input",
    };
  }

  const behaviorInput = validateBehaviorPayload(data.behavior || DEFAULT_BEHAVIOR_INPUT);
  const result = analyzeBehavior(behaviorInput);
  return {
    ...result,
    source: "backend",
    input: behaviorInput,
  };
}

async function runFraudOrchestrator(data) {
  const payload = validateFraudOrchestratorPayload(data);
  const contextValid = normalizeContextValidity(payload.context_valid, false);

  const [riskResult, locationResult, behaviorResult] = await Promise.all([
    resolveRiskSignal(payload),
    resolveLocationSignal(payload),
    resolveBehaviorSignal(payload),
  ]);

  const contributions = calculateFraudContributions({
    risk: riskResult.risk,
    locationSignal: locationResult.location_signal,
    behaviorStatus: behaviorResult.behavior_status,
    contextValid,
  });

  const fraudScore = contributions.risk + contributions.location + contributions.behavior + contributions.context;
  const status = getFraudStatus(fraudScore);

  return {
    fraud_score: fraudScore,
    status,
    risk: riskResult.risk,
    location_signal: locationResult.location_signal,
    behavior_status: behaviorResult.behavior_status,
    behavior_score: behaviorResult.behavior_score,
    context_valid: contextValid,
    contributions,
    intelligence: {
      risk: riskResult,
      location: locationResult,
      behavior: behaviorResult,
    },
    engine: {
      name: "Fraud Intelligence Engine",
      summary: "We combine multiple intelligence layers into a single fraud decision engine.",
    },
  };
}

module.exports = {
  BEHAVIOR_SCORE_MAP,
  DEFAULT_BEHAVIOR_INPUT,
  DEFAULT_LOCATION_INPUT,
  DEFAULT_WEATHER_INPUT,
  LOCATION_SCORE_MAP,
  RISK_SCORE_MAP,
  calculateFraudContributions,
  getFraudStatus,
  normalizeBehaviorStatus,
  normalizeContextValidity,
  normalizeRiskLevel,
  resolveBehaviorSignal,
  resolveLocationSignal,
  resolveRiskSignal,
  runFraudOrchestrator,
  validateFraudOrchestratorPayload,
};
