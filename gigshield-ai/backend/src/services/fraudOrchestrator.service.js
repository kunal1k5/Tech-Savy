/**
 * Fraud Orchestrator Service
 *
 * Multi-layer fraud engine that combines behavior, location, and
 * context validation into one final fraud score and status.
 */

const BEHAVIOR_SIGNAL_SCORE = 20;
const LOCATION_MISMATCH_SCORE = 30;
const CONTEXT_INVALID_SCORE = 40;

const BEHAVIOR_STATUS_SCORES = {
  NORMAL: 0,
  WARNING: 20,
  ABNORMAL: 40,
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
  if (["LOW", "MEDIUM", "HIGH"].includes(normalized)) {
    return normalized;
  }

  return "MEDIUM";
}

function normalizeContextValidity(value, defaultValue = true) {
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

function normalizeLocationMatch(value, fallbackValue = true) {
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

  return fallbackValue;
}

function normalizeNonNegativeNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function titleCase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

function resolveBehaviorSignal(payload) {
  const nestedBehavior =
    payload?.behavior && typeof payload.behavior === "object" && !Array.isArray(payload.behavior)
      ? payload.behavior
      : {};

  const claimsCount =
    normalizeNonNegativeNumber(
      payload.claimsCount ?? payload.claims_count ?? nestedBehavior.claims_count
    ) ?? 0;
  const loginAttempts =
    normalizeNonNegativeNumber(
      payload.loginAttempts ?? payload.login_attempts ?? nestedBehavior.login_attempts
    ) ?? 0;

  let behaviorScore = 0;
  const issues = [];

  if (claimsCount > 3) {
    behaviorScore += BEHAVIOR_SIGNAL_SCORE;
    issues.push("high_claim_frequency");
  }

  if (loginAttempts > 3) {
    behaviorScore += BEHAVIOR_SIGNAL_SCORE;
    issues.push("excessive_login_attempts");
  }

  if (!issues.length) {
    const legacyBehaviorStatus = String(
      payload.behavior_status ?? nestedBehavior.behavior_status ?? ""
    )
      .trim()
      .toUpperCase();
    const legacyBehaviorScore = normalizeNonNegativeNumber(
      payload.behavior_score ?? nestedBehavior.behavior_score
    );

    if (legacyBehaviorScore !== null) {
      if (legacyBehaviorScore >= 40) {
        behaviorScore = 40;
        issues.push("behavior_signal_detected");
      } else if (legacyBehaviorScore > 0) {
        behaviorScore = 20;
        issues.push("behavior_signal_detected");
      }
    } else if (BEHAVIOR_STATUS_SCORES[legacyBehaviorStatus] !== undefined) {
      behaviorScore = BEHAVIOR_STATUS_SCORES[legacyBehaviorStatus];
      if (behaviorScore > 0) {
        issues.push("behavior_signal_detected");
      }
    }
  }

  let behaviorStatus = "NORMAL";
  if (behaviorScore >= 40) {
    behaviorStatus = "ABNORMAL";
  } else if (behaviorScore > 0) {
    behaviorStatus = "WARNING";
  }

  return {
    claimsCount,
    loginAttempts,
    behavior_score: behaviorScore,
    behavior_status: behaviorStatus,
    detail: behaviorStatus === "ABNORMAL" ? "Abnormal" : behaviorStatus === "WARNING" ? "Warning" : "Normal",
    suspicious: behaviorScore > 0,
    issues,
  };
}

function resolveLocationSignal(payload) {
  const nestedLocation =
    payload?.location && typeof payload.location === "object" && !Array.isArray(payload.location)
      ? payload.location
      : {};

  const explicitMatch = payload.locationMatch ?? payload.location_match ?? payload.match;
  const explicitSignal = String(payload.location_signal ?? "").trim().toUpperCase();
  const currentLocation = String(
    nestedLocation.current_location ?? payload.current_location ?? ""
  ).trim();
  const actualLocation = String(
    nestedLocation.actual_location ?? payload.actual_location ?? ""
  ).trim();

  let locationMatch = true;
  if (explicitMatch !== undefined) {
    locationMatch = normalizeLocationMatch(explicitMatch, true);
  } else if (explicitSignal) {
    locationMatch = explicitSignal === "LOW";
  } else if (currentLocation || actualLocation) {
    locationMatch = currentLocation !== "" && currentLocation === actualLocation;
  }

  return {
    match: locationMatch,
    location_signal: locationMatch ? "LOW" : "HIGH",
    detail: locationMatch ? "Match" : "Mismatch",
    suspicious: !locationMatch,
    predicted_location: currentLocation || null,
    actual_location: actualLocation || null,
  };
}

function resolveContextSignal(payload) {
  const contextValid = normalizeContextValidity(
    payload.contextValid ?? payload.context_valid,
    true
  );

  return {
    context_valid: contextValid,
    detail: contextValid ? "Valid" : "Invalid",
    suspicious: !contextValid,
  };
}

function calculateFraudContributions({ behavior, location, context }) {
  return {
    behavior: behavior.behavior_score,
    location: location.match ? 0 : LOCATION_MISMATCH_SCORE,
    context: context.context_valid ? 0 : CONTEXT_INVALID_SCORE,
  };
}

async function runFraudOrchestrator(data) {
  const payload = validateFraudOrchestratorPayload(data);
  const risk = normalizeRiskLevel(payload.risk);
  const behavior = resolveBehaviorSignal(payload);
  const location = resolveLocationSignal(payload);
  const context = resolveContextSignal(payload);
  const contributions = calculateFraudContributions({
    behavior,
    location,
    context,
  });
  const fraudScore = contributions.behavior + contributions.location + contributions.context;
  const status = getFraudStatus(fraudScore);
  const issues = [
    ...behavior.issues,
    ...(location.suspicious ? ["location_mismatch"] : []),
    ...(context.suspicious ? ["invalid_context"] : []),
  ];

  return {
    risk,
    fraud_score: fraudScore,
    fraudScore,
    status,
    behavior_status: behavior.behavior_status,
    behavior_score: behavior.behavior_score,
    location_signal: location.location_signal,
    location_check: location.detail,
    match: location.match,
    context_valid: context.context_valid,
    locationMatch: location.match,
    claimsCount: behavior.claimsCount,
    loginAttempts: behavior.loginAttempts,
    details: {
      behavior: behavior.detail,
      location: location.detail,
      context: context.detail,
    },
    contributions,
    issues,
    intelligence: {
      behavior: {
        claims_count: behavior.claimsCount,
        login_attempts: behavior.loginAttempts,
        behavior_score: behavior.behavior_score,
        behavior_status: behavior.behavior_status,
        suspicious: behavior.suspicious,
        issues: behavior.issues,
      },
      location: {
        match: location.match,
        predicted_location: location.predicted_location,
        actual_location: location.actual_location,
        location_signal: location.location_signal,
        fraud_signal: location.location_signal,
        suspicious: location.suspicious,
      },
      context: {
        context_valid: context.context_valid,
        suspicious: context.suspicious,
      },
    },
    engine: {
      name: "Fraud Intelligence Engine",
      summary: "We combine behavior, location, and contextual intelligence to detect fraud in real-time.",
    },
    suspicious: status === "FRAUD",
    behavior_label: titleCase(behavior.detail),
  };
}

module.exports = {
  BEHAVIOR_SIGNAL_SCORE,
  BEHAVIOR_STATUS_SCORES,
  CONTEXT_INVALID_SCORE,
  LOCATION_MISMATCH_SCORE,
  calculateFraudContributions,
  getFraudStatus,
  normalizeContextValidity,
  normalizeLocationMatch,
  normalizeRiskLevel,
  resolveBehaviorSignal,
  resolveContextSignal,
  resolveLocationSignal,
  runFraudOrchestrator,
  validateFraudOrchestratorPayload,
};
