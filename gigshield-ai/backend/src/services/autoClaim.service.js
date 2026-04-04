const DEFAULT_HOURLY_RATE = 150;
const CLAIM_STATES = ["CREATED", "PROCESSING", "PAID"];
const ELIGIBLE_RISK = "HIGH";
const MIN_HOURS_LOST = 2;
const MIN_WORKING_MINUTES_FOR_INCOME_LOSS = 120;

const INCOME_LOSS_REASONS = Object.freeze({
  NO_ORDERS_COMPLETED: "NO_ORDERS_COMPLETED",
  ZERO_EARNINGS_AFTER_THRESHOLD: "ZERO_EARNINGS_AFTER_THRESHOLD",
  HOURS_LOST_FALLBACK: "HOURS_LOST_FALLBACK",
  EXPLICIT_SIGNAL: "EXPLICIT_SIGNAL",
  NONE: "NONE",
});

function normalizeRisk(risk) {
  return String(risk || "").trim().toUpperCase();
}

function normalizeBoolean(value, fallbackValue = false) {
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
    return fallbackValue;
  }

  return Boolean(value);
}

function normalizeOptionalNumber(value, fieldName, { integer = false } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    const error = new Error(`${fieldName} must be a non-negative number when provided.`);
    error.statusCode = 400;
    throw error;
  }

  if (integer && !Number.isInteger(numericValue)) {
    const error = new Error(`${fieldName} must be a non-negative integer when provided.`);
    error.statusCode = 400;
    throw error;
  }

  return numericValue;
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

  const ordersCompleted = normalizeOptionalNumber(payload.ordersCompleted, "ordersCompleted", {
    integer: true,
  });
  const workingMinutes =
    payload.workingMinutes === undefined
      ? Math.round(hoursLost * 60)
      : normalizeOptionalNumber(payload.workingMinutes, "workingMinutes", {
          integer: true,
        });
  const earnings = normalizeOptionalNumber(payload.earnings, "earnings");
  const isWorking = normalizeBoolean(
    payload.isWorking,
    (workingMinutes ?? 0) > 0 || hoursLost > 0
  );
  const explicitIncomeLoss =
    payload.incomeLoss === undefined
      ? null
      : normalizeBoolean(payload.incomeLoss, false);

  return {
    risk,
    hoursLost,
    hourlyRate,
    ordersCompleted,
    workingMinutes,
    earnings,
    isWorking,
    explicitIncomeLoss,
  };
}

function calculatePayout(hoursLost, hourlyRate) {
  return Math.round(hoursLost * hourlyRate * 100) / 100;
}

function deriveIncomeLoss({
  isWorking,
  ordersCompleted,
  workingMinutes,
  earnings,
  hoursLost,
  explicitIncomeLoss,
}) {
  if (explicitIncomeLoss !== null) {
    return {
      incomeLoss: explicitIncomeLoss,
      reason: explicitIncomeLoss ? INCOME_LOSS_REASONS.EXPLICIT_SIGNAL : INCOME_LOSS_REASONS.NONE,
    };
  }

  if (isWorking && ordersCompleted === 0) {
    return {
      incomeLoss: true,
      reason: INCOME_LOSS_REASONS.NO_ORDERS_COMPLETED,
    };
  }

  if (
    isWorking &&
    workingMinutes !== null &&
    workingMinutes >= MIN_WORKING_MINUTES_FOR_INCOME_LOSS &&
    earnings === 0
  ) {
    return {
      incomeLoss: true,
      reason: INCOME_LOSS_REASONS.ZERO_EARNINGS_AFTER_THRESHOLD,
    };
  }

  if (
    isWorking &&
    ordersCompleted === null &&
    earnings === null &&
    hoursLost >= MIN_HOURS_LOST
  ) {
    return {
      incomeLoss: true,
      reason: INCOME_LOSS_REASONS.HOURS_LOST_FALLBACK,
    };
  }

  return {
    incomeLoss: false,
    reason: INCOME_LOSS_REASONS.NONE,
  };
}

function getAutoClaimDecision(payload) {
  const {
    risk,
    hoursLost,
    hourlyRate,
    ordersCompleted,
    workingMinutes,
    earnings,
    isWorking,
    explicitIncomeLoss,
  } = validateAutoClaimPayload(payload);
  const { incomeLoss, reason } = deriveIncomeLoss({
    isWorking,
    ordersCompleted,
    workingMinutes,
    earnings,
    hoursLost,
    explicitIncomeLoss,
  });
  const claimTriggered = risk === ELIGIBLE_RISK && isWorking === true && incomeLoss === true;
  const payout = claimTriggered ? calculatePayout(hoursLost, hourlyRate) : 0;

  return {
    claimTriggered,
    payout,
    status: claimTriggered ? "PAID" : null,
    claimStates: CLAIM_STATES,
    hoursLost,
    hourlyRate,
    isWorking,
    incomeLoss,
    incomeLossReason: reason,
    ordersCompleted,
    workingMinutes,
    earnings,
    eligibility: {
      riskEligible: risk === ELIGIBLE_RISK,
      activeWorkConfirmed: isWorking,
      incomeLossDetected: incomeLoss,
    },
    message: claimTriggered
      ? "Claim auto-triggered after confirming active work and income loss."
      : "No claim triggered. Active work and income loss could not both be confirmed.",
  };
}

module.exports = {
  CLAIM_STATES,
  DEFAULT_HOURLY_RATE,
  INCOME_LOSS_REASONS,
  MIN_WORKING_MINUTES_FOR_INCOME_LOSS,
  calculatePayout,
  deriveIncomeLoss,
  getAutoClaimDecision,
  normalizeBoolean,
  normalizeOptionalNumber,
  validateAutoClaimPayload,
};
