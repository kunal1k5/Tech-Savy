/**
 * Claim Service — Claims processing with fraud detection integration.
 */

const ClaimModel = require("../models/claim.model");
const PolicyModel = require("../models/policy.model");
const { pool } = require("../database/connection");
const aiService = require("../integrations/aiService");
const PremiumService = require("./premium.service");
const { runFraudOrchestrator } = require("./fraudOrchestrator.service");
const logger = require("../utils/logger");

function normalizeFraudAnalysis(rawResult = {}) {
  const fraudScore = Number(rawResult.fraudScore ?? rawResult.fraud_score ?? 0);
  const riskLevel = String(rawResult.riskLevel ?? rawResult.risk_level ?? "medium").toLowerCase();
  const decision = String(rawResult.decision || rawResult.status || "pending").toLowerCase();
  const reason =
    rawResult.reason ||
    rawResult.decisionReason ||
    rawResult.decision_reason ||
    rawResult.fraudReason ||
    rawResult.riskReason ||
    "Normal behavior pattern";

  return {
    fraudScore,
    riskLevel: ["low", "medium", "high"].includes(riskLevel) ? riskLevel : "medium",
    decision: ["approve", "reject", "pending"].includes(decision) ? decision : "pending",
    decisionReason: reason,
    rawResult,
  };
}

async function analyzeClaimFraud(claim, { useDelay = false, context = {} } = {}) {
  if (useDelay) {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.CLAIM_FRAUD_DELAY_MS || 0)));
  }

  const safeContext = context && typeof context === "object" && !Array.isArray(context)
    ? context
    : {};

  try {
    const result = await runFraudOrchestrator({
      claim_id: claim.id,
      worker_id: claim.worker_id,
      policy_id: claim.policy_id,
      trigger_id: claim.trigger_id,
      claim_amount: claim.claim_amount,
      risk: claim.riskLevel || claim.risk_level || "medium",
      claimsCount: safeContext.claimsCount ?? claim.claims_count ?? 1,
      loginAttempts: safeContext.loginAttempts ?? claim.login_attempts ?? 1,
      locationMatch: safeContext.locationMatch ?? true,
      contextValid: safeContext.contextValid ?? true,
      claimTriggered: safeContext.claimTriggered ?? true,
      suspiciousPattern: safeContext.suspiciousPattern ?? false,
      aqi: safeContext.aqi,
      rain: safeContext.rain ?? safeContext.rainfall,
      wind: safeContext.wind,
      weather: {
        aqi: safeContext.aqi,
        rain: safeContext.rain ?? safeContext.rainfall,
        temperature: safeContext.temperature,
        condition: safeContext.condition,
      },
    });

    return normalizeFraudAnalysis({
      ...result,
      decision:
        result.status === "FRAUD"
          ? "reject"
          : result.status === "WARNING"
            ? "pending"
            : "approve",
      decisionReason: result.reason,
      riskLevel:
        result.status === "FRAUD"
          ? "high"
          : result.status === "WARNING"
            ? "medium"
            : "low",
    });
  } catch (error) {
    logger.warn(`Fraud orchestrator unavailable for claim ${claim.id}: ${error.message}`);

    try {
      const fallback = await aiService.checkFraud({
        claim_id: claim.id,
        worker_id: claim.worker_id,
        policy_id: claim.policy_id,
        trigger_id: claim.trigger_id,
        claim_amount: claim.claim_amount,
      });

      return normalizeFraudAnalysis({
        fraudScore: fallback.fraud_score,
        riskLevel:
          fallback.fraud_score > 80 ? "high" : fallback.fraud_score > 30 ? "medium" : "low",
        decision:
          fallback.fraud_score > 80 ? "reject" : fallback.fraud_score > 30 ? "pending" : "approve",
        decisionReason: fallback.reason || fallback.fraudReason || fallback.riskReason,
      });
    } catch (fallbackError) {
      logger.error("Fraud detection service unavailable:", fallbackError.message);
      return normalizeFraudAnalysis({
        fraudScore: 50,
        riskLevel: "medium",
        decision: "pending",
        decisionReason: "Fraud service unavailable; claim queued for manual review.",
      });
    }
  }
}

async function buildDynamicPayout(triggeredPolicyData = {}, policy = {}) {
  const basePayout = Number(
    triggeredPolicyData.basePayout ??
      triggeredPolicyData.base_payout ??
      policy.base_payout ??
      policy.basePayout ??
      policy.coverage_amount ??
      0
  );

  const dynamicQuote = PremiumService.calculateDynamicPayout({
    triggerType: triggeredPolicyData.triggerType,
    actualValue: triggeredPolicyData.actualValue,
    threshold: triggeredPolicyData.threshold,
    basePayout,
  });

  return {
    basePayout,
    finalPayout: dynamicQuote.payout,
    severityLevel: dynamicQuote.severityLevel,
    multiplier: dynamicQuote.multiplier,
    payoutEligible: dynamicQuote.payoutEligible,
    triggerType: dynamicQuote.triggerType,
    actualValue: dynamicQuote.actualValue,
    threshold: dynamicQuote.threshold,
  };
}

function mapDecisionToStatus(decision, fraudScore) {
  const normalizedDecision = String(decision || "").toLowerCase();

  if (normalizedDecision === "approve") {
    return "approved";
  }

  if (normalizedDecision === "reject") {
    return "rejected";
  }

  if (fraudScore > 80) {
    return "rejected";
  }

  if (fraudScore > 30) {
    return "pending";
  }

  return "approved";
}

const ClaimService = {
  async analyzeClaimFraud(claim, options = {}) {
    return analyzeClaimFraud(claim, options);
  },

  async buildDynamicPayout(triggeredPolicyData, policy = {}) {
    return buildDynamicPayout(triggeredPolicyData, policy);
  },

  /**
   * Process a pending claim:
   *   1. Run fraud detection via AI engine
   *   2. If fraud score < 60 → auto-approve
   *   3. If fraud score 60-80 → flag for manual review
   *   4. If fraud score > 80 → auto-reject
   */
  async processClaim(claimId) {
    const claim = await ClaimModel.findById(claimId);
    if (!claim) {
      const err = new Error("Claim not found");
      err.statusCode = 404;
      throw err;
    }

    const fraudResult = await analyzeClaimFraud(claim);
    logger.info(`Claim processed with fraud score ${fraudResult.fraudScore}`);

    // Log the fraud check
    await pool.query(
      `INSERT INTO fraud_logs (claim_id, worker_id, check_type, result, confidence, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        claim.id, claim.worker_id, "automated_check",
        fraudResult.fraudScore < 60 ? "pass" : fraudResult.fraudScore < 80 ? "flag" : "block",
        fraudResult.fraudScore,
        JSON.stringify({
          decision: fraudResult.decision,
          decisionReason: fraudResult.decisionReason,
          riskLevel: fraudResult.riskLevel,
        }),
      ]
    );

    // Determine claim status based on fraud score
    const newStatus = mapDecisionToStatus(fraudResult.decision, fraudResult.fraudScore);

    const updatedClaim = await ClaimModel.updateStatus(claimId, newStatus, {
      fraudScore: fraudResult.fraudScore,
      riskLevel: fraudResult.riskLevel,
      decisionReason: fraudResult.decisionReason,
      processedAt: new Date().toISOString(),
      fraud_flags: {
        ai_decision: {
          fraudScore: fraudResult.fraudScore,
          riskLevel: fraudResult.riskLevel,
          decision: fraudResult.decision,
          decisionReason: fraudResult.decisionReason,
          processedAt: new Date().toISOString(),
        },
      },
    });

    // If approved, mark policy as claimed
    if (newStatus === "approved") {
      await PolicyModel.updateStatus(claim.policy_id, "claimed");
    }

    return updatedClaim;
  },

  async getWorkerClaims(workerId) {
    return ClaimModel.findByWorker(workerId);
  },

  async getClaimsFeed(user) {
    const role = String(user?.role || "worker").toLowerCase();
    const workerId = role === "worker" ? user?.id : null;

    const rows = await ClaimModel.getClaimsFeed({ workerId });

    const claims = rows.map((row) => {
      const autoClaimMeta = row.fraud_flags?.auto_claim || {};
      const aiDecisionMeta = row.fraud_flags?.ai_decision || {};
      const dynamicMeta = autoClaimMeta.dynamic || {};
      const triggerType = autoClaimMeta.triggerType || row.trigger_type || "Unknown";
      const statusLower = String(row.status || "pending").toLowerCase();
      const normalizedStatus = statusLower.toUpperCase();
      const policyName = autoClaimMeta.policyName || `Policy ${String(row.policy_id || "").slice(0, 8)}`;
      const payout = Number(row.claim_amount || 0);
      const basePayout = Number(
        row.base_payout ?? autoClaimMeta.basePayout ?? autoClaimMeta.base_payout ?? dynamicMeta.basePayout ?? payout
      );
      const fraudScore = Number(
        row.fraud_score ?? aiDecisionMeta.fraudScore ?? aiDecisionMeta.fraud_score ?? 0
      );
      const riskLevel = String(
        row.risk_level ?? aiDecisionMeta.riskLevel ?? aiDecisionMeta.risk_level ?? "medium"
      ).toLowerCase();
      const severityLevel = String(
        row.severity_level ?? autoClaimMeta.severityLevel ?? autoClaimMeta.severity_level ?? dynamicMeta.severityLevel ?? "medium"
      ).toLowerCase();
      const decisionReason =
        row.decision_reason ?? aiDecisionMeta.decisionReason ?? aiDecisionMeta.decision_reason ??
        (statusLower === "approved"
          ? "Normal behavior pattern"
          : statusLower === "rejected"
            ? "Suspicious behavior detected"
            : "Claim awaiting review");
      const decision =
        String(
          row.decision ??
            aiDecisionMeta.decision ??
            (statusLower === "approved"
              ? "approve"
              : statusLower === "rejected"
                ? "reject"
                : "pending")
        ).toLowerCase();
      const processedAt = row.processed_at ?? aiDecisionMeta.processedAt ?? aiDecisionMeta.processed_at ?? null;

      return {
        id: row.id,
        claimId: row.id,
        policyId: row.policy_id,
        policyName,
        triggerType,
        triggerValue: autoClaimMeta.triggerValue ?? null,
        basePayout,
        payout,
        finalPayout: payout,
        amount: payout,
        status: ["pending", "approved", "rejected", "paid"].includes(statusLower)
          ? statusLower
          : "pending",
        fraudScore,
        riskLevel,
        decision,
        severityLevel,
        decisionReason,
        processedAt,
        statusLabel: ["PENDING", "APPROVED", "REJECTED", "PAID"].includes(normalizedStatus)
          ? normalizedStatus
          : "PENDING",
        createdAt: row.created_at,
        detectedAt: row.created_at,
        updatedAt: row.created_at,
        headline: `${triggerType} threshold crossed`,
        eventType: triggerType,
        area: row.threshold_met || "Live monitoring zone",
        fraudStatus: riskLevel === "high" ? "flagged" : riskLevel === "medium" ? "warning" : "verified",
        flags: [],
        source: autoClaimMeta.generated ? "AUTO" : "MANUAL",
      };
    });

    const flaggedClaim = claims.find((claim) => claim.fraudStatus === "flagged");
    const fraudWatch = flaggedClaim
      ? {
          status: "flagged",
          summary: "Suspicious activity found. Manual review is active.",
          latestAudit: "Anomaly detected during claim processing.",
          activeFlags: flaggedClaim.flags,
          lastCheckedAt: flaggedClaim.updatedAt,
        }
      : {
          status: "verified",
          summary: "Claims and route activity look normal.",
          latestAudit: "No active anomalies found in the last claim cycle.",
          activeFlags: [],
          lastCheckedAt: new Date().toISOString(),
        };

    return {
      claims,
      list: claims,
      fraudWatch,
    };
  },
};

module.exports = ClaimService;
