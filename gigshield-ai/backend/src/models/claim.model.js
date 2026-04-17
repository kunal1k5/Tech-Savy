/**
 * Claim Model — Database access layer for the claims table
 */

const { pool } = require("../database/connection");

function normalizeAiDecisionMetadata(row = {}) {
  const fraudFlags = row.fraud_flags || {};
  const aiDecision = fraudFlags.ai_decision || fraudFlags.fraud_analysis || {};

  return {
    fraudScore: row.fraud_score ?? aiDecision.fraudScore ?? aiDecision.fraud_score ?? null,
    riskLevel: row.risk_level ?? aiDecision.riskLevel ?? aiDecision.risk_level ?? null,
    decision: row.decision ?? aiDecision.decision ?? null,
    decisionReason:
      row.decision_reason ?? aiDecision.decisionReason ?? aiDecision.decision_reason ?? null,
    processedAt: row.processed_at ?? aiDecision.processedAt ?? aiDecision.processed_at ?? null,
  };
}

function applyAiDecisionDefaults(row = {}) {
  const aiDecision = normalizeAiDecisionMetadata(row);

  return {
    ...row,
    ...aiDecision,
  };
}

const ClaimModel = {
  async create({
    policy_id,
    worker_id,
    trigger_id,
    claim_amount,
    fraudScore = null,
    riskLevel = null,
    decisionReason = null,
    processedAt = null,
  }) {
    const baseValues = [policy_id, worker_id, trigger_id, claim_amount];

    try {
      const result = await pool.query(
        `INSERT INTO claims (
          policy_id,
          worker_id,
          trigger_id,
          claim_amount,
          fraud_score,
          risk_level,
          decision_reason,
          processed_at
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          ...baseValues,
          fraudScore,
          riskLevel,
          decisionReason,
          processedAt,
        ]
      );

      return applyAiDecisionDefaults(result.rows[0]);
    } catch (error) {
      if (error?.code !== "42703") {
        throw error;
      }

      const result = await pool.query(
        `INSERT INTO claims (policy_id, worker_id, trigger_id, claim_amount)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        baseValues
      );

      return applyAiDecisionDefaults({
        ...result.rows[0],
        fraud_score: fraudScore,
        risk_level: riskLevel,
        decision_reason: decisionReason,
        processed_at: processedAt,
      });
    }
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM claims WHERE id = $1", [id]);
    return applyAiDecisionDefaults(result.rows[0] || null);
  },

  async findByWorker(worker_id) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE worker_id = $1 ORDER BY created_at DESC",
      [worker_id]
    );
    return result.rows.map(applyAiDecisionDefaults);
  },

  async findLatestByWorker(worker_id) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE worker_id = $1 ORDER BY created_at DESC LIMIT 1",
      [worker_id]
    );
    return applyAiDecisionDefaults(result.rows[0] || null);
  },

  async updateStatus(id, status, extras = {}) {
    const setClauses = ["status = $2"];
    const values = [id, status];
    let idx = 3;

    if (extras.fraud_score !== undefined) {
      setClauses.push(`fraud_score = $${idx}`);
      values.push(extras.fraud_score);
      idx++;
    }
    if (extras.fraud_flags) {
      setClauses.push(`fraud_flags = $${idx}`);
      values.push(JSON.stringify(extras.fraud_flags));
      idx++;
    }
    if (extras.payout_ref) {
      setClauses.push(`payout_ref = $${idx}`);
      values.push(extras.payout_ref);
      idx++;
    }
    if (extras.fraudScore !== undefined || extras.fraud_score !== undefined) {
      setClauses.push(`fraud_score = $${idx}`);
      values.push(extras.fraudScore ?? extras.fraud_score);
      idx++;
    }
    if (extras.riskLevel !== undefined || extras.risk_level !== undefined) {
      setClauses.push(`risk_level = $${idx}`);
      values.push(extras.riskLevel ?? extras.risk_level);
      idx++;
    }
    if (extras.decisionReason !== undefined || extras.decision_reason !== undefined) {
      setClauses.push(`decision_reason = $${idx}`);
      values.push(extras.decisionReason ?? extras.decision_reason);
      idx++;
    }
    if (extras.processedAt !== undefined || extras.processed_at !== undefined) {
      setClauses.push(`processed_at = $${idx}`);
      values.push(extras.processedAt ?? extras.processed_at);
      idx++;
    } else if (status === "approved" || status === "rejected" || status === "paid") {
      setClauses.push("processed_at = NOW()");
    }

    try {
      const result = await pool.query(
        `UPDATE claims SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
        values
      );
      return applyAiDecisionDefaults(result.rows[0]);
    } catch (error) {
      if (error?.code !== "42703") {
        throw error;
      }

      const fallbackClauses = ["status = $2"];
      const fallbackValues = [id, status];

      if (extras.fraud_flags) {
        fallbackClauses.push("fraud_flags = $3");
        fallbackValues.push(JSON.stringify(extras.fraud_flags));
      }
      if (extras.payout_ref) {
        fallbackClauses.push(`payout_ref = $${fallbackValues.length + 1}`);
        fallbackValues.push(extras.payout_ref);
      }
      if (extras.processedAt !== undefined || extras.processed_at !== undefined) {
        fallbackClauses.push(`processed_at = $${fallbackValues.length + 1}`);
        fallbackValues.push(extras.processedAt ?? extras.processed_at);
      } else if (status === "approved" || status === "rejected" || status === "paid") {
        fallbackClauses.push("processed_at = NOW()");
      }

      const result = await pool.query(
        `UPDATE claims SET ${fallbackClauses.join(", ")} WHERE id = $1 RETURNING *`,
        fallbackValues
      );

      return applyAiDecisionDefaults({
        ...result.rows[0],
        fraud_score: extras.fraudScore ?? extras.fraud_score ?? result.rows[0]?.fraud_score,
        risk_level: extras.riskLevel ?? extras.risk_level ?? result.rows[0]?.risk_level,
        decision_reason:
          extras.decisionReason ?? extras.decision_reason ?? result.rows[0]?.decision_reason,
        processed_at: extras.processedAt ?? extras.processed_at ?? result.rows[0]?.processed_at,
      });
    }
  },

  async getPendingClaims(limit = 50) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1",
      [limit]
    );
    return result.rows.map(applyAiDecisionDefaults);
  },

  async findByPayoutRef(payoutRef) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE payout_ref = $1 ORDER BY created_at DESC LIMIT 1",
      [payoutRef]
    );
    return applyAiDecisionDefaults(result.rows[0] || null);
  },

  async getClaimsFeed({ workerId } = {}) {
    const values = [];
    const whereClauses = [];

    if (workerId) {
      values.push(workerId);
      whereClauses.push(`c.worker_id = $${values.length}`);
    }

    const whereQuery = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT
        c.id,
        c.policy_id,
        c.worker_id,
        c.claim_amount,
        c.status,
        c.created_at,
        c.fraud_flags,
        p.id AS policy_ref,
        p.payment_id,
        t.trigger_type,
        t.threshold_met
      FROM claims c
      LEFT JOIN policies p ON p.id = c.policy_id
      LEFT JOIN parametric_triggers t ON t.id = c.trigger_id
      ${whereQuery}
      ORDER BY c.created_at DESC`,
      values
    );

    return result.rows.map(applyAiDecisionDefaults);
  },
};

module.exports = ClaimModel;
