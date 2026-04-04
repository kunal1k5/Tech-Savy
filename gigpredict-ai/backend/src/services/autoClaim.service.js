const DEFAULT_HOURLY_RATE = 150;
const { buildRiskReason, joinReasonParts } = require("../utils/explanations");
const { clampInteger, clampNumber, ensureObject, sanitizeBoolean } = require("../utils/inputSafety");
const {
  getClaimCooldownState,
  formatCooldownWait,
} = require("./claimCooldown.service");
const CLAIM_STATES = ["CREATED", "PROCESSING", "PAID"];
const ELIGIBLE_RISK = "HIGH";
const CLAIM_DURATION_THRESHOLD_MINUTES = 30;
const MIN_WORKING_MINUTES_FOR_INCOME_LOSS = 120;

const INCOME_LOSS_REASONS = Object.freeze({
  NO_ORDERS_COMPLETED: "NO_ORDERS_COMPLETED",
  ZERO_EARNINGS_AFTER_THRESHOLD: "ZERO_EARNINGS_AFTER_THRESHOLD",
  EXPLICIT_SIGNAL: "EXPLICIT_SIGNAL",
  NONE: "NONE",
});

function normalizeRisk(risk) {
  return String(risk || "").trim().toUpperCase();
}

function normalizeOptionalNumber(value, fieldName, { integer = false } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = integer
    ? clampInteger(value, { min: 0, max: 100000, defaultValue: 0 })
    : clampNumber(value, { min: 0, max: 100000, defaultValue: 0 });

  return Number.isFinite(numericValue) ? numericValue : null;
}

function validateAutoClaimPayload(payload) {
  const safePayload = ensureObject(payload);
  const requestedRisk = normalizeRisk(safePayload?.risk);
  const risk = ["LOW", "MEDIUM", "HIGH"].includes(requestedRisk) ? requestedRisk : "LOW";
  const hoursLost = clampNumber(safePayload?.hoursLost, {
    min: 0,
    max: 24,
    defaultValue: 0,
  });
  const hourlyRate = clampNumber(safePayload?.hourlyRate, {
    min: 1,
    max: 100000,
    defaultValue: DEFAULT_HOURLY_RATE,
  });

  const ordersCompleted = normalizeOptionalNumber(safePayload?.ordersCompleted, "ordersCompleted", {
    integer: true,
  });
  const duration =
    safePayload?.duration === undefined
      ? normalizeOptionalNumber(safePayload?.workingMinutes, "workingMinutes", {
          integer: true,
        })
      : normalizeOptionalNumber(safePayload?.duration, "duration", {
          integer: true,
        });
  const earnings = normalizeOptionalNumber(safePayload?.earnings, "earnings");
  const isWorking = sanitizeBoolean(safePayload?.isWorking, false);
  const explicitIncomeLoss =
    safePayload?.incomeLoss === undefined
      ? null
      : sanitizeBoolean(safePayload?.incomeLoss, false);

  return {
    risk,
    hoursLost,
    hourlyRate,
    ordersCompleted,
    duration,
    workingMinutes: duration,
    earnings,
    isWorking,
    explicitIncomeLoss,
    lastClaimTime: safePayload?.lastClaimTime ?? safePayload?.last_claim_time ?? null,
  };
}

function calculatePayout(hoursLost, hourlyRate) {
  return Math.round(hoursLost * hourlyRate * 100) / 100;
}

function deriveIncomeLoss({
  isWorking,
  ordersCompleted,
  duration,
  earnings,
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
    duration !== null &&
    duration >= MIN_WORKING_MINUTES_FOR_INCOME_LOSS &&
    earnings === 0
  ) {
    return {
      incomeLoss: true,
      reason: INCOME_LOSS_REASONS.ZERO_EARNINGS_AFTER_THRESHOLD,
    };
  }

  return {
    incomeLoss: false,
    reason: INCOME_LOSS_REASONS.NONE,
  };
}

function describeIncomeLoss(reason) {
  if (reason === INCOME_LOSS_REASONS.NO_ORDERS_COMPLETED) {
    return "no orders completed";
  }

  if (reason === INCOME_LOSS_REASONS.ZERO_EARNINGS_AFTER_THRESHOLD) {
    return "zero earnings after a long active period";
  }

  if (reason === INCOME_LOSS_REASONS.EXPLICIT_SIGNAL) {
    return "income loss explicitly confirmed";
  }

  return "income loss not detected";
}

function buildClaimReason({ isWorking, incomeLoss, incomeLossReason, duration }) {
  return joinReasonParts(
    [
      isWorking ? "active work confirmed" : "active work not confirmed",
      incomeLoss ? describeIncomeLoss(incomeLossReason) : "income loss not detected",
      duration > CLAIM_DURATION_THRESHOLD_MINUTES
        ? "duration above 30 minutes"
        : "duration not above 30 minutes",
    ],
    "Claim conditions were not fully evaluated."
  );
}

function getAutoClaimDecision(payload) {
  const {
    risk,
    hoursLost,
    hourlyRate,
    ordersCompleted,
    duration,
    earnings,
    isWorking,
    explicitIncomeLoss,
    lastClaimTime,
  } = validateAutoClaimPayload(payload);
  const { incomeLoss, reason } = deriveIncomeLoss({
    isWorking,
    ordersCompleted,
    duration,
    earnings,
    explicitIncomeLoss,
  });
  const claimTriggered =
    risk === ELIGIBLE_RISK &&
    isWorking === true &&
    incomeLoss === true &&
    duration > CLAIM_DURATION_THRESHOLD_MINUTES;
  const payout = claimTriggered ? calculatePayout(hoursLost, hourlyRate) : 0;
  const riskReason = buildRiskReason({ risk });
  const claimReason = buildClaimReason({
    isWorking,
    incomeLoss,
    incomeLossReason: reason,
    duration,
  });
  const explanation = joinReasonParts(
    [riskReason, claimReason],
    "Claim decision explanation unavailable."
  );
  const cooldown = claimTriggered ? getClaimCooldownState(lastClaimTime) : null;

  if (cooldown?.active) {
    return {
      blocked: true,
      claimTriggered: false,
      payout: 0,
      status: null,
      claimStates: CLAIM_STATES,
      hoursLost,
      hourlyRate,
      isWorking,
      incomeLoss,
      incomeLossReason: reason,
      riskReason,
      claimReason,
      reason: explanation,
      ordersCompleted,
      duration,
      workingMinutes: duration,
      earnings,
      lastClaimTime: cooldown.lastClaimTime,
      cooldown,
      eligibility: {
        riskEligible: risk === ELIGIBLE_RISK,
        activeWorkConfirmed: isWorking,
        incomeLossDetected: incomeLoss,
        durationThresholdMet: duration > CLAIM_DURATION_THRESHOLD_MINUTES,
      },
      message: `Claim blocked by cooldown. Try again in ${formatCooldownWait(cooldown.remainingMs)}.`,
    };
  }

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
    riskReason,
    claimReason,
    reason: explanation,
    ordersCompleted,
    duration,
    workingMinutes: duration,
    earnings,
    eligibility: {
      riskEligible: risk === ELIGIBLE_RISK,
      activeWorkConfirmed: isWorking,
      incomeLossDetected: incomeLoss,
      durationThresholdMet: duration > CLAIM_DURATION_THRESHOLD_MINUTES,
    },
    message: claimTriggered
      ? "Claim auto-triggered after confirming high risk, active work, income loss, and duration threshold."
      : "No claim triggered. High risk, active work, income loss, and duration threshold must all be confirmed.",
  };
}

module.exports = {
  CLAIM_STATES,
  CLAIM_DURATION_THRESHOLD_MINUTES,
  DEFAULT_HOURLY_RATE,
  INCOME_LOSS_REASONS,
  MIN_WORKING_MINUTES_FOR_INCOME_LOSS,
  calculatePayout,
  deriveIncomeLoss,
  getAutoClaimDecision,
  normalizeOptionalNumber,
  normalizeBoolean: sanitizeBoolean,
  validateAutoClaimPayload,
};
