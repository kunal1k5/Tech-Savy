/**
 * Fraud Analysis & Trust Score API Routes
 *
 * POST /analyze-fraud
 * GET /fraud-score/:workerId
 * GET /trust-score/:workerId
 * POST /update-trust-score
 */

const express = require("express");
const router = express.Router();

const advancedFraudService = require("../services/advancedFraudService");
const trustScoreService = require("../services/trustScoreService");
const anomalyService = require("../services/anomalyService");
const proofValidationService = require("../services/proofValidationService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

/**
 * POST /api/fraud/analyze
 * Comprehensive fraud analysis
 */
router.post("/analyze", async (req, res) => {
  try {
    const { worker_id, claim_data } = req.body;

    if (!worker_id || !claim_data) {
      return sendError(res, "Missing worker_id or claim_data", 400);
    }

    const fraudAnalysis = await advancedFraudService.analyzeFraudRisk(worker_id, claim_data);

    return sendSuccess(res, fraudAnalysis, "Fraud analysis completed");
  } catch (error) {
    console.error("Fraud analysis error:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/fraud/score/:workerId
 * Get current fraud score for worker
 */
router.get("/score/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    // Get recent fraud flags
    const db = require("../database/connection");
    const recentFlags = await db("fraud_flags")
      .where("worker_id", workerId)
      .orderBy("flagged_at", "desc")
      .limit(10);

    const avgScore = recentFlags.length > 0
      ? (recentFlags.reduce((sum, f) => sum + parseFloat(f.flag_value), 0) / recentFlags.length).toFixed(2)
      : 0;

    return sendSuccess(res, {
      worker_id: workerId,
      current_fraud_score: parseFloat(avgScore),
      recent_flags_count: recentFlags.length,
      recent_flags: recentFlags,
    });
  } catch (error) {
    console.error("Error retrieving fraud score:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/trust/score/:workerId
 * Get trust score for worker
 */
router.get("/trust/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;

    const trustScore = await trustScoreService.getTrustScore(workerId);

    return sendSuccess(res, trustScore, "Trust score retrieved");
  } catch (error) {
    console.error("Error retrieving trust score:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/trust/update
 * Update trust score after claim decision
 */
router.post("/trust/update", async (req, res) => {
  try {
    const { worker_id, claim_result } = req.body;

    if (!worker_id || !claim_result) {
      return sendError(res, "Missing worker_id or claim_result", 400);
    }

    const update = await trustScoreService.updateTrustScoreForClaim(worker_id, claim_result);

    return sendSuccess(res, update, "Trust score updated");
  } catch (error) {
    console.error("Error updating trust score:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/trust/history/:workerId
 * Get trust score history
 */
router.get("/trust/history/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const history = await trustScoreService.getTrustHistory(workerId, limit);

    return sendSuccess(res, history);
  } catch (error) {
    console.error("Error retrieving trust history:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/anomalies/:workerId
 * Get anomaly detection results
 */
router.get("/anomalies/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const anomalies = await anomalyService.getAnomalyHistory(workerId, days);

    return sendSuccess(res, anomalies);
  } catch (error) {
    console.error("Error retrieving anomalies:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/proofs/validate
 * Validate a proof upload
 */
router.post("/proofs/validate", async (req, res) => {
  try {
    const { claim_id, worker_id, proof_data } = req.body;

    if (!claim_id || !worker_id || !proof_data) {
      return sendError(res, "Missing claim_id, worker_id, or proof_data", 400);
    }

    const validation = await proofValidationService.validateProof(claim_id, worker_id, proof_data);

    return sendSuccess(res, validation, "Proof validation completed");
  } catch (error) {
    console.error("Error validating proof:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/proofs/:claimId
 * Get all proofs for a claim
 */
router.get("/proofs/:claimId", async (req, res) => {
  try {
    const { claimId } = req.params;

    const proofs = await proofValidationService.getClaimProofs(claimId);

    return sendSuccess(res, proofs);
  } catch (error) {
    console.error("Error retrieving proofs:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/fraud/flag
 * Manually apply fraud flag
 */
router.post("/flag", async (req, res) => {
  try {
    const { worker_id, reason } = req.body;

    if (!worker_id) {
      return sendError(res, "Missing worker_id", 400);
    }

    const result = await trustScoreService.applyFraudFlagPenalty(worker_id, reason);

    return sendSuccess(res, result, "Fraud flag applied");
  } catch (error) {
    console.error("Error applying fraud flag:", error.message);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
