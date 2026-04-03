/**
 * Behavior Service
 *
 * Detects abnormal worker behavior patterns so the fraud system can
 * consider claim frequency, odd claim timing, and repeated login attempts.
 */

const ISSUE_SCORE = 20;

function parseTimeToMinutes(timeText) {
  const value = String(timeText || "").trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    const error = new Error("Field 'last_claim_time' must be in HH:MM format.");
    error.statusCode = 400;
    throw error;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeWorkingHours(workingHours) {
  if (!Array.isArray(workingHours) || workingHours.length !== 2) {
    const error = new Error("Field 'working_hours' must be an array with [startHour, endHour].");
    error.statusCode = 400;
    throw error;
  }

  const [startHour, endHour] = workingHours.map((value) => Number(value));
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 0 ||
    endHour > 23 ||
    startHour >= endHour
  ) {
    const error = new Error("Field 'working_hours' must contain valid hours like [9, 18].");
    error.statusCode = 400;
    throw error;
  }

  return [startHour, endHour];
}

function validateBehaviorPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Request body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const numericFields = ["claims_count", "login_attempts"];
  const validatedPayload = {};

  for (const field of numericFields) {
    if (payload[field] === undefined) {
      const error = new Error(`Field '${field}' is required.`);
      error.statusCode = 400;
      throw error;
    }

    const numericValue = Number(payload[field]);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      const error = new Error(`Field '${field}' must be a non-negative number.`);
      error.statusCode = 400;
      throw error;
    }

    validatedPayload[field] = numericValue;
  }

  if (payload.last_claim_time === undefined) {
    const error = new Error("Field 'last_claim_time' is required.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.working_hours === undefined) {
    const error = new Error("Field 'working_hours' is required.");
    error.statusCode = 400;
    throw error;
  }

  validatedPayload.last_claim_time = String(payload.last_claim_time).trim();
  validatedPayload.working_hours = normalizeWorkingHours(payload.working_hours);

  return validatedPayload;
}

function isClaimOutsideWorkingHours(lastClaimTime, workingHours) {
  const claimMinutes = parseTimeToMinutes(lastClaimTime);
  const [startHour, endHour] = workingHours;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  return claimMinutes < startMinutes || claimMinutes > endMinutes;
}

function getBehaviorStatus(score) {
  if (score >= 50) {
    return "ABNORMAL";
  }

  if (score >= ISSUE_SCORE) {
    return "WARNING";
  }

  return "NORMAL";
}

function analyzeBehavior(data) {
  const payload = validateBehaviorPayload(data);
  const issues = [];
  let behaviorScore = 0;

  if (payload.claims_count >= 3) {
    behaviorScore += ISSUE_SCORE;
    issues.push("claims_count_high");
  }

  if (isClaimOutsideWorkingHours(payload.last_claim_time, payload.working_hours)) {
    behaviorScore += ISSUE_SCORE;
    issues.push("claim_outside_working_hours");
  }

  if (payload.login_attempts > 3) {
    behaviorScore += ISSUE_SCORE;
    issues.push("login_attempts_high");
  }

  return {
    behavior_status: getBehaviorStatus(behaviorScore),
    behavior_score: behaviorScore,
    issues,
    suspicious: behaviorScore >= ISSUE_SCORE,
    fraud_score_delta: behaviorScore,
  };
}

module.exports = {
  ISSUE_SCORE,
  analyzeBehavior,
  getBehaviorStatus,
  isClaimOutsideWorkingHours,
  normalizeWorkingHours,
  parseTimeToMinutes,
  validateBehaviorPayload,
};
