/**
 * Fraud Orchestrator Service
 *
 * Multi-layer fraud engine that combines behavior, location, and
 * context validation into one final fraud score and status.
 */

const { buildFraudReason, buildRiskReason, joinReasonParts } = require("../utils/explanations");

const BEHAVIOR_SIGNAL_SCORE = 20;
const LOCATION_MISMATCH_SCORE = 30;
const CONTEXT_INVALID_SCORE = 40;
const LOW_RISK_TRIGGERED_CLAIM_SCORE = 50;
const TOO_MANY_CLAIMS_SCORE = 25;
const SUSPICIOUS_PATTERN_SCORE = 30;
const TOO_MANY_CLAIMS_THRESHOLD = 5;

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

function normalizeBooleanFlag(value, defaultValue = false) {
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

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return Boolean(value);
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

function resolveAnomalySignal(payload, risk, behavior) {
  const nestedBehavior =
    payload?.behavior && typeof payload.behavior === "object" && !Array.isArray(payload.behavior)
      ? payload.behavior
      : {};

  const claimTriggered = normalizeBooleanFlag(
    payload.claimTriggered ??
      payload.claim_triggered ??
      payload.auto_claim_triggered ??
      nestedBehavior.claim_triggered,
    false
  );
  const suspiciousPattern = normalizeSuspiciousPattern(
    payload.suspiciousPattern ??
      payload.suspicious_pattern ??
      payload.claimPattern ??
      payload.claim_pattern ??
      payload.pattern ??
      nestedBehavior.suspicious_pattern ??
      nestedBehavior.claim_pattern,
    false
  );

  let anomalyScore = 0;
  const issues = [];

  if (risk === "LOW" && claimTriggered) {
    anomalyScore += LOW_RISK_TRIGGERED_CLAIM_SCORE;
    issues.push("low_risk_claim_triggered");
  }

  if (behavior.claimsCount > TOO_MANY_CLAIMS_THRESHOLD) {
    anomalyScore += TOO_MANY_CLAIMS_SCORE;
    issues.push("too_many_claims");
  }

  if (suspiciousPattern) {
    anomalyScore += SUSPICIOUS_PATTERN_SCORE;
    issues.push("suspicious_pattern");
  }

  return {
    claimTriggered,
    suspiciousPattern,
    anomaly_score: anomalyScore,
    detail: anomalyScore > 0 ? "Detected" : "Normal",
    suspicious: anomalyScore > 0,
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

function calculateFraudContributions({ behavior, location, context, anomaly }) {
  return {
    behavior: behavior.behavior_score,
    location: location.match ? 0 : LOCATION_MISMATCH_SCORE,
    context: context.context_valid ? 0 : CONTEXT_INVALID_SCORE,
    anomaly: anomaly.anomaly_score,
  };
}

function resolveRiskSignals(payload = {}) {
  const nestedWeather =
    payload?.weather && typeof payload.weather === "object" && !Array.isArray(payload.weather)
      ? payload.weather
      : {};

  return {
    aqi: payload.aqi ?? nestedWeather.aqi,
    rain: payload.rain ?? payload.rainfall ?? nestedWeather.rain ?? nestedWeather.rainfall,
    wind: payload.wind ?? nestedWeather.wind ?? nestedWeather.wind_kph,
  };
}

async function runFraudOrchestrator(data) {
  const payload = validateFraudOrchestratorPayload(data);
  const risk = normalizeRiskLevel(payload.risk);
  const behavior = resolveBehaviorSignal(payload);
  const location = resolveLocationSignal(payload);
  const context = resolveContextSignal(payload);
  const anomaly = resolveAnomalySignal(payload, risk, behavior);
  const contributions = calculateFraudContributions({
    behavior,
    location,
    context,
    anomaly,
  });
  const fraudScore = Object.values(contributions).reduce((total, score) => total + score, 0);
  const status = getFraudStatus(fraudScore);
  const issues = [
    ...behavior.issues,
    ...(location.suspicious ? ["location_mismatch"] : []),
    ...(context.suspicious ? ["invalid_context"] : []),
    ...anomaly.issues,
  ];
  const riskReason = buildRiskReason({
    risk,
    ...resolveRiskSignals(payload),
  });
  const fraudReason = buildFraudReason(issues);
  const reason = joinReasonParts(
    [riskReason, fraudReason],
    "Fraud decision explanation unavailable."
  );

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
    claimTriggered: anomaly.claimTriggered,
    suspiciousPattern: anomaly.suspiciousPattern,
    anomaly_score: anomaly.anomaly_score,
    riskReason,
    fraudReason,
    reason,
    details: {
      behavior: behavior.detail,
      location: location.detail,
      context: context.detail,
      anomaly: anomaly.detail,
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
      anomaly: {
        claim_triggered: anomaly.claimTriggered,
        suspicious_pattern: anomaly.suspiciousPattern,
        anomaly_score: anomaly.anomaly_score,
        suspicious: anomaly.suspicious,
        issues: anomaly.issues,
      },
    },
    engine: {
      name: "Fraud Intelligence Engine",
      summary: "We combine behavior, location, context, and anomaly intelligence to detect fraud in real-time.",
    },
    suspicious: status === "FRAUD" || anomaly.suspicious,
    behavior_label: titleCase(behavior.detail),
  };
}

module.exports = {
  BEHAVIOR_SIGNAL_SCORE,
  BEHAVIOR_STATUS_SCORES,
  CONTEXT_INVALID_SCORE,
  LOW_RISK_TRIGGERED_CLAIM_SCORE,
  LOCATION_MISMATCH_SCORE,
  SUSPICIOUS_PATTERN_SCORE,
  TOO_MANY_CLAIMS_SCORE,
  TOO_MANY_CLAIMS_THRESHOLD,
  calculateFraudContributions,
  getFraudStatus,
  normalizeBooleanFlag,
  normalizeContextValidity,
  normalizeLocationMatch,
  normalizeRiskLevel,
  normalizeSuspiciousPattern,
  resolveAnomalySignal,
  resolveBehaviorSignal,
  resolveContextSignal,
  resolveLocationSignal,
  runFraudOrchestrator,
  validateFraudOrchestratorPayload,
};
