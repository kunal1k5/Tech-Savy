const Joi = require("joi");
const { buildFraudReason, buildRiskReason, joinReasonParts } = require("../utils/explanations");
const { calculateTrustScore } = require("../utils/trustScore");
const {
  clampInteger,
  ensureObject,
  sanitizeBoolean,
  sanitizeWeatherMetrics,
} = require("../utils/inputSafety");

const RISK_LEVELS = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
});

const STATUS_LEVELS = Object.freeze({
  SAFE: "SAFE",
  WARNING: "WARNING",
  FRAUD: "FRAUD",
});

const DECISION_LEVELS = Object.freeze({
  SAFE: "SAFE",
  VERIFY: "VERIFY",
  FRAUD: "FRAUD",
});

const NEXT_ACTIONS = Object.freeze({
  AUTO_APPROVE_CLAIM: "AUTO_APPROVE_CLAIM",
  UPLOAD_PROOF: "UPLOAD_PROOF",
  REJECT_CLAIM: "REJECT_CLAIM",
});

const LOW_RISK_TRIGGERED_CLAIM_SCORE = 50;
const TOO_MANY_CLAIMS_SCORE = 25;
const TOO_MANY_CLAIMS_THRESHOLD = 5;
const SUSPICIOUS_PATTERN_SCORE = 30;

const aiDecisionSchema = Joi.object({
  aqi: Joi.any().optional(),
  rain: Joi.any().optional(),
  wind: Joi.any().optional(),
  claimsCount: Joi.any().optional(),
  loginAttempts: Joi.any().optional(),
  locationMatch: Joi.any().optional(),
  contextValid: Joi.any().optional(),
  claimTriggered: Joi.any().optional(),
  claim_triggered: Joi.any().optional(),
  suspiciousPattern: Joi.any().optional(),
  suspicious_pattern: Joi.any().optional(),
}).unknown(true);

const RISK_RULES = Object.freeze([
  Object.freeze({
    level: RISK_LEVELS.HIGH,
    conditions: Object.freeze([
      Object.freeze({ field: "aqi", threshold: 300 }),
      Object.freeze({ field: "rain", threshold: 20 }),
      Object.freeze({ field: "wind", threshold: 30 }),
    ]),
  }),
  Object.freeze({
    level: RISK_LEVELS.MEDIUM,
    conditions: Object.freeze([
      Object.freeze({ field: "aqi", threshold: 150 }),
      Object.freeze({ field: "rain", threshold: 5 }),
    ]),
  }),
]);

const FRAUD_RULES = Object.freeze([
  Object.freeze({
    id: "low_risk_claim_triggered",
    points: LOW_RISK_TRIGGERED_CLAIM_SCORE,
    isTriggered: ({ risk, claimTriggered }) =>
      risk === RISK_LEVELS.LOW && claimTriggered === true,
  }),
  Object.freeze({
    id: "high_claims_count",
    points: 20,
    isTriggered: ({ claimsCount }) => claimsCount > 3,
  }),
  Object.freeze({
    id: "too_many_claims",
    points: TOO_MANY_CLAIMS_SCORE,
    isTriggered: ({ claimsCount }) => claimsCount > TOO_MANY_CLAIMS_THRESHOLD,
  }),
  Object.freeze({
    id: "excessive_login_attempts",
    points: 20,
    isTriggered: ({ loginAttempts }) => loginAttempts > 3,
  }),
  Object.freeze({
    id: "suspicious_pattern",
    points: SUSPICIOUS_PATTERN_SCORE,
    isTriggered: ({ suspiciousPattern }) => suspiciousPattern === true,
  }),
  Object.freeze({
    id: "location_mismatch",
    points: 30,
    isTriggered: ({ locationMatch }) => locationMatch === false,
  }),
  Object.freeze({
    id: "invalid_context",
    points: 40,
    isTriggered: ({ contextValid }) => contextValid === false,
  }),
]);

const DECISION_BANDS = Object.freeze([
  Object.freeze({
    maxScore: 30,
    status: STATUS_LEVELS.SAFE,
    decision: DECISION_LEVELS.SAFE,
  }),
  Object.freeze({
    maxScore: 60,
    status: STATUS_LEVELS.WARNING,
    decision: DECISION_LEVELS.VERIFY,
  }),
  Object.freeze({
    maxScore: Number.POSITIVE_INFINITY,
    status: STATUS_LEVELS.FRAUD,
    decision: DECISION_LEVELS.FRAUD,
  }),
]);

const DECISION_ACTIONS = Object.freeze({
  [DECISION_LEVELS.SAFE]: NEXT_ACTIONS.AUTO_APPROVE_CLAIM,
  [DECISION_LEVELS.VERIFY]: NEXT_ACTIONS.UPLOAD_PROOF,
  [DECISION_LEVELS.FRAUD]: NEXT_ACTIONS.REJECT_CLAIM,
});

const CLAIM_DECISIONS = Object.freeze({
  APPROVED: "APPROVED",
  VERIFY: "VERIFY",
  REJECTED: "REJECTED",
});

function isAnyConditionMet(input, conditions) {
  return conditions.some(({ field, threshold }) => Number(input[field]) > threshold);
}

function calculateRisk(input) {
  const matchedRule = RISK_RULES.find((rule) =>
    isAnyConditionMet(input, rule.conditions)
  );

  return matchedRule ? matchedRule.level : RISK_LEVELS.LOW;
}

function calculateFraudBreakdown(input) {
  return FRAUD_RULES.map((rule) => ({
    id: rule.id,
    points: rule.points,
    triggered: rule.isTriggered(input),
  }));
}

function calculateFraudScore(input) {
  return calculateFraudBreakdown(input).reduce(
    (score, rule) => score + (rule.triggered ? rule.points : 0),
    0
  );
}

function getDecisionBand(score) {
  return DECISION_BANDS.find((band) => score <= band.maxScore) || DECISION_BANDS[0];
}

function calculateStatus(score) {
  return getDecisionBand(score).status;
}

function getDecision(score) {
  return getDecisionBand(score).decision;
}

function getNextAction(decision) {
  return DECISION_ACTIONS[decision] || null;
}

function normalizeSuspiciousPattern(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (!normalized || ["false", "none", "normal", "clean", "safe", "legit"].includes(normalized)) {
      return false;
    }

    if (["true", "suspicious", "abnormal", "anomalous", "fake", "detected"].includes(normalized)) {
      return true;
    }
  }

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return Boolean(value);
}

function sanitizeAiDecisionInput(input = {}) {
  const safeInput = ensureObject(input);
  const weatherMetrics = sanitizeWeatherMetrics(safeInput);

  return {
    ...safeInput,
    ...weatherMetrics,
    claimsCount: clampInteger(safeInput?.claimsCount, {
      min: 0,
      max: 1000,
      defaultValue: 0,
    }),
    loginAttempts: clampInteger(safeInput?.loginAttempts, {
      min: 0,
      max: 1000,
      defaultValue: 0,
    }),
    locationMatch: sanitizeBoolean(safeInput?.locationMatch, false),
    contextValid: sanitizeBoolean(safeInput?.contextValid, false),
    claimTriggered: sanitizeBoolean(
      safeInput?.claimTriggered ?? safeInput?.claim_triggered,
      false
    ),
    suspiciousPattern: normalizeSuspiciousPattern(
      safeInput?.suspiciousPattern ??
        safeInput?.suspicious_pattern ??
        safeInput?.claimPattern ??
        safeInput?.claim_pattern,
      false
    ),
  };
}

function createAiDecision(input) {
  const sanitizedInput = sanitizeAiDecisionInput(input);
  const risk = calculateRisk(sanitizedInput);
  const fraudBreakdown = calculateFraudBreakdown({
    ...sanitizedInput,
    risk,
  });
  const fraudScore = fraudBreakdown.reduce(
    (score, rule) => score + (rule.triggered ? rule.points : 0),
    0
  );
  const trustScore = calculateTrustScore(fraudScore);
  const status = calculateStatus(fraudScore);
  const decision = getDecision(fraudScore);
  const nextAction = getNextAction(decision);
  const riskReason = buildRiskReason({
    risk,
    ...sanitizedInput,
  });
  const fraudReason = buildFraudReason(fraudBreakdown);
  const reason = joinReasonParts(
    [riskReason, fraudReason],
    "AI decision explanation unavailable."
  );

  return {
    risk,
    fraudScore,
    trustScore,
    trust_score: trustScore,
    status,
    decision,
    nextAction,
    riskReason,
    fraudReason,
    reason,
  };
}

function clampScore(value, min = 0, max = 100) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function createClaimDecision(input = {}) {
  const baseFraudScore = clampScore(input.fraud_score ?? input.fraudScore ?? 0);
  const aiImageScore = clampScore(input.ai_image_score ?? input.aiImageScore ?? 0);
  const anomalyScore = clampScore(input.anomaly_score ?? input.anomalyScore ?? 0);
  const trustScore = clampScore(input.trust_score ?? input.trustScore ?? 50);
  const warnings = Array.isArray(input.warnings) ? input.warnings.filter(Boolean) : [];
  const explanation = Array.isArray(input.explanation) ? input.explanation.filter(Boolean) : [];
  const activityValid = input.activity_validation?.was_active !== false;
  const withinWorkHours = input.activity_validation?.within_working_hours !== false;
  const weatherMismatch = input.weather_validation?.mismatch === true;
  const workScreenValid =
    input.work_validation?.checked === true ? input.work_validation?.valid !== false : true;
  const tamperingDetected = input.image_validation?.tampering_detected === true;
  const duplicateFound = input.image_validation?.duplicate_found === true;
  const trustPenalty = Math.max(0, 60 - trustScore) * 0.35;
  const anomalyWeight = anomalyScore * 0.35;
  const aiWeight = aiImageScore * 0.2;

  let compositeScore = baseFraudScore + trustPenalty + anomalyWeight + aiWeight;

  if (!activityValid || !withinWorkHours) {
    compositeScore += 10;
  }

  if (weatherMismatch) {
    compositeScore += 8;
  }

  if (!workScreenValid) {
    compositeScore += 8;
  }

  if (tamperingDetected) {
    compositeScore += 12;
  }

  if (duplicateFound) {
    compositeScore += 8;
  }

  compositeScore = clampScore(compositeScore);

  let decision = CLAIM_DECISIONS.APPROVED;
  if (compositeScore >= 70 || tamperingDetected) {
    decision = CLAIM_DECISIONS.REJECTED;
  } else if (compositeScore >= 35 || warnings.length > 0) {
    decision = CLAIM_DECISIONS.VERIFY;
  }

  const confidenceBase = 55 + warnings.length * 8 + Math.abs(compositeScore - 50) * 0.45;
  const confidence = clampScore(confidenceBase);

  return {
    decision,
    confidence: Math.round(confidence),
    fraud_score: Number(compositeScore.toFixed(2)),
    warnings,
    explanation,
  };
}

module.exports = {
  CLAIM_DECISIONS,
  DECISION_ACTIONS,
  DECISION_BANDS,
  DECISION_LEVELS,
  FRAUD_RULES,
  LOW_RISK_TRIGGERED_CLAIM_SCORE,
  NEXT_ACTIONS,
  RISK_LEVELS,
  RISK_RULES,
  SUSPICIOUS_PATTERN_SCORE,
  STATUS_LEVELS,
  TOO_MANY_CLAIMS_SCORE,
  TOO_MANY_CLAIMS_THRESHOLD,
  aiDecisionSchema,
  calculateFraudBreakdown,
  calculateFraudScore,
  calculateRisk,
  calculateStatus,
  calculateTrustScore,
  clampScore,
  createAiDecision,
  createClaimDecision,
  getDecision,
  sanitizeAiDecisionInput,
  getDecisionBand,
  getNextAction,
  normalizeSuspiciousPattern,
};
