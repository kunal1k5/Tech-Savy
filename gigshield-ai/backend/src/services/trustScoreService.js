/**
 * Trust Score Service
 *
 * Dynamic reputation system for workers
 * - Base score: 50
 * - Good claim: +5
 * - Fraud flag: -20
 * - High trust → auto approve, Low trust → strict verification
 */

const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");

const DEFAULT_SCORE = 50;
const GOOD_CLAIM_POINTS = 5;
const FRAUD_FLAG_PENALTY = -20;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

/**
 * Initialize trust score for a new worker
 */
async function initializeTrustScore(workerId) {
  try {
    const existing = await db("user_trust_score").where("worker_id", workerId).first();

    if (existing) {
      return existing;
    }

    const trustScore = {
      id: uuidv4(),
      worker_id: workerId,
      score: DEFAULT_SCORE,
      total_claims: 0,
      successful_claims: 0,
      fraud_flags: 0,
      history: JSON.stringify([
        {
          timestamp: new Date().toISOString(),
          action: "INITIALIZED",
          score: DEFAULT_SCORE,
          reason: "New worker registration",
        },
      ]),
    };

    await db("user_trust_score").insert(trustScore);

    return trustScore;
  } catch (error) {
    console.error("Error initializing trust score:", error.message);
    throw error;
  }
}

/**
 * Get current trust score for a worker
 */
async function getTrustScore(workerId) {
  try {
    let trustScore = await db("user_trust_score").where("worker_id", workerId).first();

    if (!trustScore) {
      trustScore = await initializeTrustScore(workerId);
    }

    return {
      worker_id: workerId,
      score: parseFloat(trustScore.score),
      tier: calculateTrustTier(parseFloat(trustScore.score)),
      total_claims: trustScore.total_claims,
      successful_claims: trustScore.successful_claims,
      fraud_flags: trustScore.fraud_flags,
      approval_strategy: getApprovalStrategy(parseFloat(trustScore.score)),
    };
  } catch (error) {
    console.error("Error getting trust score:", error.message);
    throw error;
  }
}

/**
 * Update trust score after a claim decision
 */
async function updateTrustScoreForClaim(workerId, claimResult) {
  try {
    let trustScore = await db("user_trust_score").where("worker_id", workerId).first();

    if (!trustScore) {
      trustScore = await initializeTrustScore(workerId);
    }

    let scoreChange = 0;
    let reason = "";
    const claimStatus = claimResult.decision || claimResult.status;

    // Update claim counts
    let newTotalClaims = (trustScore.total_claims || 0) + 1;
    let newSuccessfulClaims = trustScore.successful_claims || 0;

    if (claimStatus === "approved" || claimStatus === "APPROVED" || claimStatus === "SAFE") {
      scoreChange = GOOD_CLAIM_POINTS;
      reason = "Successful claim approved";
      newSuccessfulClaims += 1;
    } else if (claimStatus === "flagged" || claimStatus === "FRAUD") {
      scoreChange = FRAUD_FLAG_PENALTY;
      reason = "Fraud detected in claim";
    } else if (claimStatus === "rejected" || claimStatus === "REJECTED") {
      scoreChange = FRAUD_FLAG_PENALTY * 0.5; // Less penalty for rejection
      reason = "Claim rejected";
    }

    // Calculate new score
    let newScore = parseFloat(trustScore.score) + scoreChange;
    newScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, newScore)); // Clamp

    // Update history
    const history = JSON.parse(trustScore.history || "[]");
    history.push({
      timestamp: new Date().toISOString(),
      action: "CLAIM_PROCESSED",
      previous_score: parseFloat(trustScore.score),
      new_score: newScore,
      change: scoreChange,
      reason,
      claim_result: claimStatus,
    });

    // Update database
    const updateData = {
      score: newScore,
      total_claims: newTotalClaims,
      successful_claims: newSuccessfulClaims,
      history: JSON.stringify(history),
      last_updated: new Date().toISOString(),
    };

    if (claimStatus === "flagged" || claimStatus === "FRAUD") {
      updateData.fraud_flags = (trustScore.fraud_flags || 0) + 1;
    }

    await db("user_trust_score").where("worker_id", workerId).update(updateData);

    return {
      previous_score: parseFloat(trustScore.score),
      new_score: newScore,
      score_change: scoreChange,
      reason,
      new_tier: calculateTrustTier(newScore),
    };
  } catch (error) {
    console.error("Error updating trust score:", error.message);
    throw error;
  }
}

/**
 * Add fraud flag penalty (manual or automatic)
 */
async function applyFraudFlagPenalty(workerId, reason = "") {
  try {
    let trustScore = await db("user_trust_score").where("worker_id", workerId).first();

    if (!trustScore) {
      trustScore = await initializeTrustScore(workerId);
    }

    const scoreChange = FRAUD_FLAG_PENALTY;
    let newScore = parseFloat(trustScore.score) + scoreChange;
    newScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, newScore));

    const history = JSON.parse(trustScore.history || "[]");
    history.push({
      timestamp: new Date().toISOString(),
      action: "FRAUD_FLAG_APPLIED",
      previous_score: parseFloat(trustScore.score),
      new_score: newScore,
      change: scoreChange,
      reason,
    });

    const updateData = {
      score: newScore,
      fraud_flags: (trustScore.fraud_flags || 0) + 1,
      history: JSON.stringify(history),
      last_updated: new Date().toISOString(),
    };

    await db("user_trust_score").where("worker_id", workerId).update(updateData);

    return {
      success: true,
      previous_score: parseFloat(trustScore.score),
      new_score: newScore,
      new_tier: calculateTrustTier(newScore),
      message: "Fraud flag applied",
    };
  } catch (error) {
    console.error("Error applying fraud flag:", error.message);
    throw error;
  }
}

/**
 * Get approval strategy based on trust score
 */
function getApprovalStrategy(score) {
  if (score >= 75) {
    return {
      level: "HIGH_TRUST",
      auto_approve: true,
      verification_required: false,
      description: "Auto-approve claims with minimal checks",
    };
  } else if (score >= 50) {
    return {
      level: "MEDIUM_TRUST",
      auto_approve: false,
      verification_required: true,
      description: "Standard verification process",
    };
  } else if (score >= 25) {
    return {
      level: "LOW_TRUST",
      auto_approve: false,
      verification_required: true,
      proof_required: true,
      description: "Strict verification with proof upload mandatory",
    };
  } else {
    return {
      level: "CRITICAL_TRUST",
      auto_approve: false,
      verification_required: true,
      proof_required: true,
      manual_review: true,
      description: "Manual review by admin required for all claims",
    };
  }
}

/**
 * Calculate trust tier from score
 */
function calculateTrustTier(score) {
  if (score >= 80) return "PLATINUM";
  if (score >= 70) return "GOLD";
  if (score >= 50) return "SILVER";
  if (score >= 30) return "BRONZE";
  return "UNVERIFIED";
}

/**
 * Get trust history for a worker
 */
async function getTrustHistory(workerId, limit = 20) {
  try {
    const trustScore = await db("user_trust_score").where("worker_id", workerId).first();

    if (!trustScore) {
      return { worker_id: workerId, history: [] };
    }

    const history = JSON.parse(trustScore.history || "[]");
    return {
      worker_id: workerId,
      current_score: parseFloat(trustScore.score),
      history: history.slice(-limit),
    };
  } catch (error) {
    console.error("Error getting trust history:", error.message);
    throw error;
  }
}

/**
 * Bulk get trust scores for multiple workers
 */
async function getTrustScoresBatch(workerIds) {
  try {
    const trustScores = await db("user_trust_score").whereIn("worker_id", workerIds);

    const result = {};
    workerIds.forEach((id) => {
      const score = trustScores.find((s) => s.worker_id === id);
      if (score) {
        result[id] = {
          score: parseFloat(score.score),
          tier: calculateTrustTier(parseFloat(score.score)),
        };
      } else {
        result[id] = {
          score: DEFAULT_SCORE,
          tier: calculateTrustTier(DEFAULT_SCORE),
        };
      }
    });

    return result;
  } catch (error) {
    console.error("Error getting trust scores batch:", error.message);
    throw error;
  }
}

module.exports = {
  initializeTrustScore,
  getTrustScore,
  updateTrustScoreForClaim,
  applyFraudFlagPenalty,
  getApprovalStrategy,
  calculateTrustTier,
  getTrustHistory,
  getTrustScoresBatch,
  DEFAULT_SCORE,
  GOOD_CLAIM_POINTS,
  FRAUD_FLAG_PENALTY,
};
