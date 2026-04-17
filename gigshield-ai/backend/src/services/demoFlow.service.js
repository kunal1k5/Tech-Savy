const { calculateDynamicPayout } = require("./premium.service");
const { calculateRisk } = require("./riskPremium.service");
const { runFraudOrchestrator } = require("./fraudOrchestrator.service");
const {
  buildClaimExplanation,
  buildDecisionExplanation,
  buildPipelineExplanation,
  buildTriggerExplanation,
} = require("../utils/explanations");

const TRIGGER_THRESHOLDS = Object.freeze({
  Rain: 40,
  AQI: 300,
  Demand: 80,
});

const DEFAULT_INPUT = Object.freeze({
  rain: 0,
  aqi: 80,
  demand: 50,
  time: "09:00",
});

const DEMO_BASE_PAYOUT = 500;

function normalizeTimeSlot(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "morning";
  }

  if (["morning", "afternoon", "evening", "night"].includes(normalized)) {
    return normalized;
  }

  const hour = Number.parseInt(normalized.split(":")[0], 10);
  if (!Number.isNaN(hour)) {
    if (hour >= 5 && hour < 12) {
      return "morning";
    }
    if (hour >= 12 && hour < 17) {
      return "afternoon";
    }
    if (hour >= 17 && hour < 22) {
      return "evening";
    }
    return "night";
  }

  return "morning";
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeInput(payload = {}) {
  return {
    rain: clamp(toNumber(payload.rain, DEFAULT_INPUT.rain), 0, 300),
    aqi: clamp(toNumber(payload.aqi, DEFAULT_INPUT.aqi), 0, 500),
    demand: clamp(toNumber(payload.demand, DEFAULT_INPUT.demand), 0, 100),
    time: normalizeTimeSlot(payload.time || DEFAULT_INPUT.time),
  };
}

function buildTriggerCandidates(input) {
  return [
    {
      triggerType: "Rain",
      actualValue: input.rain,
      threshold: TRIGGER_THRESHOLDS.Rain,
      exceededBy: input.rain - TRIGGER_THRESHOLDS.Rain,
    },
    {
      triggerType: "AQI",
      actualValue: input.aqi,
      threshold: TRIGGER_THRESHOLDS.AQI,
      exceededBy: input.aqi - TRIGGER_THRESHOLDS.AQI,
    },
    {
      triggerType: "Demand",
      actualValue: input.demand,
      threshold: TRIGGER_THRESHOLDS.Demand,
      exceededBy: input.demand - TRIGGER_THRESHOLDS.Demand,
    },
  ];
}

function pickDominantTrigger(candidates = []) {
  const triggeredCandidates = candidates.filter((candidate) => candidate.exceededBy >= 0);

  if (!triggeredCandidates.length) {
    return {
      trigger: false,
      triggerType: "Rain",
      actualValue: candidates[0]?.actualValue ?? 0,
      threshold: candidates[0]?.threshold ?? TRIGGER_THRESHOLDS.Rain,
      exceededBy: -1,
    };
  }

  const dominant = [...triggeredCandidates].sort((left, right) => {
    const leftRatio = left.threshold > 0 ? left.actualValue / left.threshold : left.actualValue;
    const rightRatio = right.threshold > 0 ? right.actualValue / right.threshold : right.actualValue;
    return rightRatio - leftRatio;
  })[0];

  return {
    trigger: true,
    ...dominant,
  };
}

function deriveFraudSignals(input, risk, claimGenerated) {
  const timeSlot = normalizeTimeSlot(input.time);
  const isLateNight = timeSlot === "night";
  const demandPressure = input.demand > 90;

  const claimsCount = claimGenerated
    ? risk === "HIGH"
      ? 1
      : 2
    : 0;

  const loginAttempts = isLateNight ? 2 : 1;
  const suspiciousPattern = Boolean(isLateNight && demandPressure);
  const locationMatch = !suspiciousPattern;
  const contextValid = !suspiciousPattern;

  return {
    claimsCount,
    loginAttempts,
    locationMatch,
    contextValid,
    suspiciousPattern,
  };
}

function mapFraudToDecision({ claimGenerated, fraudStatus }) {
  if (!claimGenerated) {
    return "No Claim";
  }

  if (fraudStatus === "FRAUD") {
    return "Rejected";
  }

  if (fraudStatus === "WARNING") {
    return "Review";
  }

  return "Approved";
}

function mapFraudStatusToRiskLevel(fraudStatus) {
  const normalized = String(fraudStatus || "").trim().toUpperCase();

  if (normalized === "FRAUD") {
    return "high";
  }

  if (normalized === "WARNING") {
    return "medium";
  }

  return "low";
}

function getSimulationPayload(payload = {}) {
  return normalizeInput(payload);
}

async function runDemoFlowSimulation(payload = {}) {
  const input = getSimulationPayload(payload);
  const triggerCandidates = buildTriggerCandidates(input);
  const triggerResult = pickDominantTrigger(triggerCandidates);
  const risk = calculateRisk({ aqi: input.aqi, rain: input.rain, wind: 0 });

  const payoutResult = calculateDynamicPayout({
    triggerType: triggerResult.triggerType,
    actualValue: triggerResult.actualValue,
    threshold: triggerResult.threshold,
    basePayout: DEMO_BASE_PAYOUT,
  });

  const claimGenerated = Boolean(triggerResult.trigger && payoutResult.payoutEligible && payoutResult.payout > 0);
  const fraudSignals = deriveFraudSignals(input, risk, claimGenerated);

  const fraudResult = await runFraudOrchestrator({
    risk,
    aqi: input.aqi,
    rain: input.rain,
    wind: 0,
    claimTriggered: claimGenerated,
    claimsCount: fraudSignals.claimsCount,
    loginAttempts: fraudSignals.loginAttempts,
    locationMatch: fraudSignals.locationMatch,
    contextValid: fraudSignals.contextValid,
    suspiciousPattern: fraudSignals.suspiciousPattern,
  });

  const decision = mapFraudToDecision({
    claimGenerated,
    fraudStatus: fraudResult.status,
  });

  const triggerExplanation = buildTriggerExplanation({
    trigger: triggerResult.trigger,
    triggerType: triggerResult.triggerType,
    actualValue: triggerResult.actualValue,
    threshold: triggerResult.threshold,
  });

  const claimExplanation = buildClaimExplanation({
    claimGenerated,
    severityLevel: payoutResult.severityLevel,
    payout: claimGenerated ? payoutResult.payout : 0,
  });

  const decisionExplanation = buildDecisionExplanation({
    decision,
    fraudScore: fraudResult.fraudScore,
    riskLevel: fraudResult.status,
    fraudReason: fraudResult.fraudReason,
  });

  return {
    trigger: triggerResult.trigger,
    claimGenerated,
    payout: claimGenerated ? payoutResult.payout : 0,
    fraudScore: Number(fraudResult.fraudScore ?? 0),
    riskLevel: mapFraudStatusToRiskLevel(fraudResult.status),
    decision,
    explanation: buildPipelineExplanation({
      triggerExplanation,
      claimExplanation,
      decisionExplanation,
      severityLevel: payoutResult.severityLevel,
      payout: claimGenerated ? payoutResult.payout : 0,
    }),
    details: {
      input,
      triggerType: triggerResult.triggerType,
      actualValue: triggerResult.actualValue,
      threshold: triggerResult.threshold,
      severityLevel: payoutResult.severityLevel,
      basePayout: payoutResult.basePayout,
      multiplier: payoutResult.multiplier,
      triggerExplanation,
      claimExplanation,
      decisionExplanation,
    },
  };
}

module.exports = {
  TRIGGER_THRESHOLDS,
  getSimulationPayload,
  runDemoFlowSimulation,
};
