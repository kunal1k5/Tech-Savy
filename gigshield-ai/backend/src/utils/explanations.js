function hasFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function joinReasonParts(parts = [], fallback = "No clear reason available") {
  const dedupedParts = [...new Set(parts.filter(Boolean).map((part) => String(part).trim()).filter(Boolean))];

  if (dedupedParts.length === 0) {
    return fallback;
  }

  return dedupedParts.join(" + ");
}

function buildRiskReason({ risk, aqi, rain, wind } = {}) {
  const normalizedRisk = String(risk || "").trim().toUpperCase();
  const parts = [];

  if (normalizedRisk === "HIGH") {
    if (hasFiniteNumber(aqi) && Number(aqi) > 300) {
      parts.push("AQI above 300");
    }
    if (hasFiniteNumber(rain) && Number(rain) > 20) {
      parts.push("rain above 20 mm");
    }
    if (hasFiniteNumber(wind) && Number(wind) > 30) {
      parts.push("wind above 30 km/h");
    }

    return joinReasonParts(parts, "Risk level is HIGH");
  }

  if (normalizedRisk === "MEDIUM") {
    if (hasFiniteNumber(aqi) && Number(aqi) > 150) {
      parts.push("AQI above 150");
    }
    if (hasFiniteNumber(rain) && Number(rain) > 5) {
      parts.push("rain above 5 mm");
    }

    return joinReasonParts(parts, "Risk level is MEDIUM");
  }

  if (normalizedRisk === "LOW") {
    if (
      hasFiniteNumber(aqi) ||
      hasFiniteNumber(rain) ||
      hasFiniteNumber(wind)
    ) {
      return "AQI, rain, and wind stayed within safe thresholds";
    }

    return "Risk level remained LOW";
  }

  return joinReasonParts([], `Risk level received: ${normalizedRisk || "UNKNOWN"}`);
}

const FRAUD_REASON_LABELS = Object.freeze({
  low_risk_claim_triggered: "claim triggered during low risk",
  high_claims_count: "high claim frequency",
  high_claim_frequency: "high claim frequency",
  too_many_claims: "too many claims",
  excessive_login_attempts: "excessive login attempts",
  suspicious_pattern: "suspicious claim pattern",
  location_mismatch: "location mismatch",
  invalid_context: "invalid context",
  behavior_signal_detected: "behavior anomaly detected",
});

function buildFraudReason(items = []) {
  const reasonParts = items
    .map((item) => {
      if (typeof item === "string") {
        return FRAUD_REASON_LABELS[item] || item.replace(/_/g, " ").trim();
      }

      if (item?.triggered) {
        return FRAUD_REASON_LABELS[item.id] || String(item.id || "").replace(/_/g, " ").trim();
      }

      return null;
    })
    .filter(Boolean);

  return joinReasonParts(reasonParts, "no fraud signals detected");
}

module.exports = {
  buildFraudReason,
  buildRiskReason,
  joinReasonParts,
};
