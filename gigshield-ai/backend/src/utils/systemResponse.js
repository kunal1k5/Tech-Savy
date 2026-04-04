function normalizeUppercase(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function titleCase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function deriveLocationCheck(match, locationSignal) {
  if (match === true) {
    return "Match";
  }

  if (match === false) {
    return locationSignal === "MEDIUM" ? "Variance" : "Mismatch";
  }

  if (locationSignal === "LOW") {
    return "Match";
  }

  if (locationSignal === "MEDIUM") {
    return "Variance";
  }

  if (locationSignal === "HIGH") {
    return "Mismatch";
  }

  return "Pending";
}

function deriveSuspicious({ status, locationSignal, behaviorStatus, suspicious, match }) {
  if (typeof suspicious === "boolean") {
    return suspicious;
  }

  if (typeof match === "boolean") {
    return match === false;
  }

  return (
    status === "FRAUD" ||
    locationSignal === "HIGH" ||
    behaviorStatus === "ABNORMAL"
  );
}

function buildSystemResponse(data = {}) {
  const risk = normalizeUppercase(data.risk);
  const status = normalizeUppercase(data.status);
  const locationSignal = normalizeUppercase(data.location_signal);
  const behaviorStatus = normalizeUppercase(data.behavior_status);
  const match = typeof data.match === "boolean" ? data.match : null;
  const explicitSuspicious =
    typeof data?.suspicious === "boolean" ? data.suspicious : null;

  return {
    risk,
    premium: normalizeNumber(data.premium),
    fraud_score: normalizeNumber(data.fraud_score),
    status,
    location_check: data.location_check || deriveLocationCheck(match, locationSignal),
    behavior_status: behaviorStatus,
    behavior_label: titleCase(behaviorStatus),
    behavior_score: normalizeNumber(data.behavior_score),
    location_signal: locationSignal,
    match,
    predicted_location: data.predicted_location || null,
    actual_location: data.actual_location || null,
    suspicious:
      explicitSuspicious ??
      deriveSuspicious({
        status,
        locationSignal,
        behaviorStatus,
        match,
      }),
    source: data.source || null,
    score: normalizeNumber(data.score),
    warning: data.warning || null,
    intelligence: data.intelligence || null,
    contributions: data.contributions || null,
    engine: data.engine || null,
    issues: Array.isArray(data.issues) ? data.issues : [],
  };
}

module.exports = {
  buildSystemResponse,
};
