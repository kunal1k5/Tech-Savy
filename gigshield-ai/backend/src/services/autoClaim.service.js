const DEFAULT_HOURLY_RATE = 150;
const { pool } = require("../database/connection");
const ClaimModel = require("../models/claim.model");
const PolicyModel = require("../models/policy.model");
const logger = require("../utils/logger");
const { runFraudOrchestrator } = require("./fraudOrchestrator.service");
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

const TRIGGER_TYPE_TO_DB = {
  Rain: "extreme_weather",
  AQI: "high_aqi",
  Demand: "zone_shutdown",
};

const INCOME_LOSS_REASONS = Object.freeze({
  NO_ORDERS_COMPLETED: "NO_ORDERS_COMPLETED",
  ZERO_EARNINGS_AFTER_THRESHOLD: "ZERO_EARNINGS_AFTER_THRESHOLD",
  EXPLICIT_SIGNAL: "EXPLICIT_SIGNAL",
  NONE: "NONE",
});

function normalizeRisk(risk) {
  return String(risk || "").trim().toUpperCase();
}

function normalizeTriggerType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "aqi") {
    return "AQI";
  }
  if (normalized === "demand") {
    return "Demand";
  }
  return "Rain";
}

function buildPayoutRef(eventId) {
  return `auto-claim-${eventId}`;
}

async function ensureTriggerRecord({
  triggerType,
  actualValue,
  threshold,
  city,
  zone,
  signals = {},
}) {
  const dbTriggerType = TRIGGER_TYPE_TO_DB[triggerType] || "zone_shutdown";
  const severity = triggerType === "Rain" && Number(actualValue) > Number(threshold) + 20
    ? "critical"
    : "high";

  const result = await pool.query(
    `INSERT INTO parametric_triggers (trigger_type, city, zone, severity, data_snapshot, threshold_met)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      dbTriggerType,
      city || "Unknown",
      zone || "Unknown",
      severity,
      JSON.stringify({
        triggerType,
        actualValue,
        threshold,
        source: "trigger_monitor",
        signals,
      }),
      `${triggerType} value ${actualValue} crossed threshold ${threshold}`,
    ]
  );

  return result.rows[0];
}

async function buildPolicyContext(triggeredPolicy) {
  const policyId = triggeredPolicy.policyId;
  const policy = await PolicyModel.findById(policyId);

  if (!policy) {
    const error = new Error(`Policy not found for auto-claim (${policyId})`);
    error.statusCode = 404;
    throw error;
  }

  return {
    policy,
    workerId: policy.worker_id,
    payout: Number(policy.coverage_amount ?? policy.base_payout ?? policy.basePayout ?? 0),
  };
}

function mapFraudStatusToRiskLevel(status) {
  const normalized = String(status || "SAFE").trim().toUpperCase();
  if (normalized === "FRAUD") {
    return "high";
  }

  if (normalized === "WARNING") {
    return "medium";
  }

  return "low";
}

function mapRiskLevelToClaimStatus(riskLevel) {
  const normalized = String(riskLevel || "medium").trim().toLowerCase();
  if (normalized === "low") {
    return "approved";
  }

  if (normalized === "high") {
    return "rejected";
  }

  return "pending";
}

async function runFraudCheck({ userId, policyId, triggerType, triggerValue, signals = {}, location = {} }) {
  const fraudPayload = {
    userId,
    policyId,
    triggerType,
    triggerValue,
    risk: "MEDIUM",
    claimTriggered: true,
    locationMatch: true,
    contextValid: true,
    suspiciousPattern: false,
    claimsCount: 1,
    loginAttempts: 1,
    aqi: Number(signals?.aqi ?? 0),
    rain: Number(signals?.rain ?? signals?.rainfall ?? 0),
    weather: {
      aqi: Number(signals?.aqi ?? 0),
      rain: Number(signals?.rain ?? signals?.rainfall ?? 0),
      temperature: Number(signals?.temperature ?? 0),
      condition: String(signals?.condition || "Unknown"),
    },
    location: {
      current_location: location?.city || "Unknown",
      actual_location: location?.city || "Unknown",
    },
  };

  const orchestratorResult = await runFraudOrchestrator(fraudPayload);
  const fraudScore = Number(orchestratorResult?.fraudScore ?? orchestratorResult?.fraud_score ?? 0);
  const riskLevel = mapFraudStatusToRiskLevel(orchestratorResult?.status);

  return {
    fraudScore,
    riskLevel,
    decision: riskLevel === "low" ? "approve" : "reject",
    reason: orchestratorResult?.reason || "Fraud analysis completed.",
  };
}

function processAutoClaimFraudAsync({
  claimId,
  userId,
  policyId,
  triggerType,
  triggerValue,
  signals,
  location,
  autoClaimMetadata,
}) {
  setImmediate(() => {
    void (async () => {
      try {
        const result = await runFraudCheck({
          userId,
          policyId,
          triggerType,
          triggerValue,
          signals,
          location,
        });
        const processedAt = new Date().toISOString();
        const nextStatus = mapRiskLevelToClaimStatus(result.riskLevel);

        await ClaimModel.updateStatus(claimId, nextStatus, {
          fraudScore: result.fraudScore,
          riskLevel: result.riskLevel,
          decisionReason: result.reason,
          processedAt,
          fraud_flags: {
            auto_claim: autoClaimMetadata,
            ai_decision: {
              fraudScore: result.fraudScore,
              riskLevel: result.riskLevel,
              decision: result.decision,
              decisionReason: result.reason,
              processedAt,
            },
          },
        });

        console.log(`Claim processed: ${result.decision} (score: ${result.fraudScore})`);
        logger.info(`Claim processed: ${result.decision} (score: ${result.fraudScore})`);
      } catch (error) {
        logger.warn(`Auto-claim fraud processing failed for claim ${claimId}: ${error.message}`);
      }
    })();
  });
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
  async createAutoClaim(triggeredPolicyData) {
    const triggerType = normalizeTriggerType(triggeredPolicyData?.triggerType);
    const actualValue = Number(triggeredPolicyData?.actualValue || 0);
    const threshold = Number(triggeredPolicyData?.threshold || 0);
    const triggerWeather = triggeredPolicyData?.weather || {};
    const triggerRain = Number(
      triggerType === "Rain"
        ? actualValue
        : triggerWeather.rain ?? triggerWeather.rainfall ?? triggeredPolicyData?.rain ?? 0
    );
    const triggerAqi = Number(
      triggerType === "AQI"
        ? actualValue
        : triggeredPolicyData?.aqi ?? triggerWeather.aqi ?? 0
    );
    const triggerTemperature = Number(triggerWeather.temperature ?? triggeredPolicyData?.temperature ?? 0);
    const triggerCondition = String(triggerWeather.condition ?? triggeredPolicyData?.condition ?? "Unknown");

    const eventId =
      triggeredPolicyData?.eventId ||
      `${triggeredPolicyData?.policyId}-${triggerType}-${Date.now()}`;
    const payoutRef = buildPayoutRef(eventId);
    const { policy, workerId, payout } = await buildPolicyContext(triggeredPolicyData);

    const existingClaim = await ClaimModel.findByPayoutRef(payoutRef);
    const samePolicyDuplicate =
      existingClaim && String(existingClaim.policy_id) === String(policy.id);

    if (samePolicyDuplicate) {
      return {
        created: false,
        duplicate: true,
        claim: {
          claimId: existingClaim.id,
          userId: existingClaim.worker_id,
          policyId: existingClaim.policy_id,
          triggerType,
          triggerValue: actualValue,
          payout: Number(existingClaim.claim_amount || payout),
          status: String(existingClaim.status || "pending").toUpperCase(),
          createdAt: existingClaim.created_at || null,
        },
      };
    }

    const triggerRecord = await ensureTriggerRecord({
      triggerType,
      actualValue,
      threshold,
      city: triggeredPolicyData?.location?.city,
      zone: triggeredPolicyData?.location?.zone,
      signals: {
        rain: triggerRain,
        aqi: triggerAqi,
        temperature: triggerTemperature,
        condition: triggerCondition,
      },
    });

    const createdClaim = await ClaimModel.create({
      policy_id: policy.id,
      worker_id: workerId,
      trigger_id: triggerRecord.id,
      claim_amount: payout,
    });

    const autoClaimMetadata = {
      generated: true,
      eventId,
      triggerType,
      triggerValue: actualValue,
      threshold,
      signals: {
        rain: triggerRain,
        aqi: triggerAqi,
        temperature: triggerTemperature,
        condition: triggerCondition,
      },
      basePayout: payout,
      finalPayout: payout,
      severityLevel: "medium",
      multiplier: 1,
      policyName:
        triggeredPolicyData?.policyName ||
        `Policy ${String(policy.id).slice(0, 8)}`,
      generatedAt: new Date().toISOString(),
    };

    const enrichedClaim = await ClaimModel.updateStatus(createdClaim.id, "pending", {
      payout_ref: payoutRef,
      fraud_flags: {
        auto_claim: autoClaimMetadata,
      },
    });

    logger.info(`Auto claim generated for policy ${policy.id}`);

    // Fraud evaluation runs in the background so trigger->claim creation stays non-blocking.
    processAutoClaimFraudAsync({
      claimId: enrichedClaim.id,
      userId: workerId,
      policyId: policy.id,
      triggerType,
      triggerValue: actualValue,
      signals: {
        rain: triggerRain,
        aqi: triggerAqi,
        temperature: triggerTemperature,
        condition: triggerCondition,
      },
      location: {
        city: triggeredPolicyData?.location?.city,
        zone: triggeredPolicyData?.location?.zone,
      },
      autoClaimMetadata,
    });

    return {
      created: true,
      duplicate: false,
      claim: {
        claimId: enrichedClaim.id,
        userId: workerId,
        policyId: policy.id,
        triggerType,
        triggerValue: actualValue,
        triggerSignals: {
          rain: triggerRain,
          aqi: triggerAqi,
          temperature: triggerTemperature,
          condition: triggerCondition,
        },
        basePayout: payout,
        finalPayout: payout,
        payout,
        severityLevel: "medium",
        status: "PENDING",
        createdAt: enrichedClaim.created_at,
      },
    };
  },
  async createAutoClaimsFromTriggeredPolicies(triggeredPolicies = []) {
    const results = [];

    for (const triggeredPolicy of triggeredPolicies) {
      try {
        const result = await this.createAutoClaim(triggeredPolicy);
        results.push(result);
      } catch (error) {
        logger.warn(
          `Auto claim generation failed for policy ${triggeredPolicy?.policyId}: ${error.message}`
        );
      }
    }

    return results;
  },
  normalizeOptionalNumber,
  normalizeBoolean: sanitizeBoolean,
  validateAutoClaimPayload,
};
