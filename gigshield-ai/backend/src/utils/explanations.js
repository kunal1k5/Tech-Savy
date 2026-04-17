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

function formatNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function titleCase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "Unknown";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildTriggerExplanation({ trigger, triggerType, actualValue, threshold } = {}) {
  const label = titleCase(triggerType || "signal");
  const actual = formatNumber(actualValue);
  const limit = formatNumber(threshold);

  if (!trigger) {
    return `${label} stayed below threshold, so no trigger was activated.`;
  }

  return `${label} exceeded threshold (${actual} vs ${limit}), triggering the policy.`;
}

function buildClaimExplanation({ claimGenerated, severityLevel, payout } = {}) {
  if (!claimGenerated) {
    return "Claim was not generated because trigger conditions were not met.";
  }

  const severity = titleCase(severityLevel || "medium");
  const numericPayout = Math.max(0, Math.round(formatNumber(payout)));

  if (severity.toLowerCase() === "high") {
    return `High severity led to increased payout (${numericPayout}).`;
  }

  return `Claim generated with ${severity.toLowerCase()} severity and payout ${numericPayout}.`;
}

function buildDecisionExplanation({ decision, fraudScore, riskLevel, fraudReason } = {}) {
  const normalizedDecision = String(decision || "pending").trim().toLowerCase();
  const score = Math.max(0, formatNumber(fraudScore));
  const risk = titleCase(riskLevel || "medium");
  const reason = String(fraudReason || "normal behavior pattern").trim();

  if (normalizedDecision === "approved") {
    return `Low fraud risk detected (${score.toFixed(2)}), so the claim was approved.`;
  }

  if (normalizedDecision === "rejected") {
    return `Fraud risk is high (${score.toFixed(2)}), so the claim was rejected.`;
  }

  if (normalizedDecision === "review") {
    return `Moderate fraud risk (${score.toFixed(2)}) requires manual review.`;
  }

  if (normalizedDecision === "no claim") {
    return "No claim was created because trigger conditions were not met.";
  }

  return `${risk} risk detected (${score.toFixed(2)}). ${reason}.`;
}

function buildPipelineExplanation({
  triggerExplanation,
  claimExplanation,
  decisionExplanation,
} = {}) {
  return [triggerExplanation, claimExplanation, decisionExplanation]
    .filter(Boolean)
    .join(" ");
}

module.exports = {
  buildClaimExplanation,
  buildDecisionExplanation,
  buildFraudReason,
  buildPipelineExplanation,
  buildRiskReason,
  buildTriggerExplanation,
  joinReasonParts,
};
