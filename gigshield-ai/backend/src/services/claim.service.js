/**
 * Claim Service — Claims processing with fraud detection integration.
 */

const axios = require("axios");
const ClaimModel = require("../models/claim.model");
const PolicyModel = require("../models/policy.model");
const { pool } = require("../database/connection");
const logger = require("../utils/logger");

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";

const ClaimService = {
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

    // Run fraud detection
    let fraudResult;
    try {
      const response = await axios.post(`${AI_ENGINE_URL}/api/fraud/check`, {
        claim_id: claim.id,
        worker_id: claim.worker_id,
        policy_id: claim.policy_id,
        trigger_id: claim.trigger_id,
        claim_amount: claim.claim_amount,
      });
      fraudResult = response.data;
    } catch (error) {
      logger.error("Fraud detection service unavailable:", error.message);
      // If fraud service is down, flag for manual review
      fraudResult = { fraud_score: 50, flags: ["fraud_service_unavailable"] };
    }

    // Log the fraud check
    await pool.query(
      `INSERT INTO fraud_logs (claim_id, worker_id, check_type, result, confidence, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        claim.id, claim.worker_id, "automated_check",
        fraudResult.fraud_score < 60 ? "pass" : fraudResult.fraud_score < 80 ? "flag" : "block",
        fraudResult.fraud_score,
        JSON.stringify(fraudResult.flags || []),
      ]
    );

    // Determine claim status based on fraud score
    let newStatus;
    if (fraudResult.fraud_score < 60) {
      newStatus = "approved";
    } else if (fraudResult.fraud_score < 80) {
      newStatus = "flagged";
    } else {
      newStatus = "rejected";
    }

    const updatedClaim = await ClaimModel.updateStatus(claimId, newStatus, {
      fraud_score: fraudResult.fraud_score,
      fraud_flags: fraudResult.flags,
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
};

module.exports = ClaimService;
