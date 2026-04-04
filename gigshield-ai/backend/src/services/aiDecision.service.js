const Joi = require("joi");

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

const aiDecisionSchema = Joi.object({
  aqi: Joi.number().required(),
  rain: Joi.number().min(0).required(),
  wind: Joi.number().min(0).required(),
  claimsCount: Joi.number().integer().min(0).required(),
  loginAttempts: Joi.number().integer().min(0).required(),
  locationMatch: Joi.boolean().required(),
  contextValid: Joi.boolean().required(),
});

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
    id: "high_claims_count",
    points: 20,
    isTriggered: ({ claimsCount }) => claimsCount > 3,
  }),
  Object.freeze({
    id: "excessive_login_attempts",
    points: 20,
    isTriggered: ({ loginAttempts }) => loginAttempts > 3,
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

function createAiDecision(input) {
  const risk = calculateRisk(input);
  const fraudScore = calculateFraudScore(input);
  const status = calculateStatus(fraudScore);
  const decision = getDecision(fraudScore);
  const nextAction = getNextAction(decision);

  return {
    risk,
    fraudScore,
    status,
    decision,
    nextAction,
  };
}

module.exports = {
  DECISION_ACTIONS,
  DECISION_BANDS,
  DECISION_LEVELS,
  FRAUD_RULES,
  NEXT_ACTIONS,
  RISK_LEVELS,
  RISK_RULES,
  STATUS_LEVELS,
  aiDecisionSchema,
  calculateFraudBreakdown,
  calculateFraudScore,
  calculateRisk,
  calculateStatus,
  createAiDecision,
  getDecision,
  getDecisionBand,
  getNextAction,
};
