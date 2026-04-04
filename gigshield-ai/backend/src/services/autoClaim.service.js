const DEFAULT_HOURLY_RATE = 150;
const CLAIM_STATES = ["CREATED", "PROCESSING", "PAID"];
const ELIGIBLE_RISK = "HIGH";
const MIN_HOURS_LOST = 2;

function normalizeRisk(risk) {
  return String(risk || "").trim().toUpperCase();
}

function validateAutoClaimPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const risk = normalizeRisk(payload.risk);
  if (!risk) {
    const error = new Error("risk is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(risk)) {
    const error = new Error("risk must be one of LOW, MEDIUM, or HIGH.");
    error.statusCode = 400;
    throw error;
  }

  const hoursLost = Number(payload.hoursLost);
  if (Number.isNaN(hoursLost) || hoursLost < 0) {
    const error = new Error("hoursLost must be a non-negative number.");
    error.statusCode = 400;
    throw error;
  }

  const hourlyRate =
    payload.hourlyRate === undefined ? DEFAULT_HOURLY_RATE : Number(payload.hourlyRate);
  if (Number.isNaN(hourlyRate) || hourlyRate <= 0) {
    const error = new Error("hourlyRate must be a positive number.");
    error.statusCode = 400;
    throw error;
  }

  return {
    risk,
    hoursLost,
    hourlyRate,
  };
}

function calculatePayout(hoursLost, hourlyRate) {
  return Math.round(hoursLost * hourlyRate * 100) / 100;
}

function getAutoClaimDecision(payload) {
  const { risk, hoursLost, hourlyRate } = validateAutoClaimPayload(payload);
  const claimTriggered = risk === ELIGIBLE_RISK && hoursLost >= MIN_HOURS_LOST;
  const payout = claimTriggered ? calculatePayout(hoursLost, hourlyRate) : 0;

  return {
    claimTriggered,
    payout,
    status: claimTriggered ? "PAID" : null,
    claimStates: CLAIM_STATES,
    hoursLost,
    hourlyRate,
    message: claimTriggered
      ? "Claim automatically triggered due to high risk"
      : "No claim triggered. Eligibility not met.",
  };
}

module.exports = {
  CLAIM_STATES,
  DEFAULT_HOURLY_RATE,
  calculatePayout,
  getAutoClaimDecision,
  validateAutoClaimPayload,
};
