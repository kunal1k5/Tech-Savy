/**
 * Claim Model — Database access layer for the claims table
 */

const { pool } = require("../database/connection");

const ClaimModel = {
  async create({ policy_id, worker_id, trigger_id, claim_amount }) {
    const result = await pool.query(
      `INSERT INTO claims (policy_id, worker_id, trigger_id, claim_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [policy_id, worker_id, trigger_id, claim_amount]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM claims WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async findByWorker(worker_id) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE worker_id = $1 ORDER BY created_at DESC",
      [worker_id]
    );
    return result.rows;
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
    if (status === "approved" || status === "rejected" || status === "paid") {
      setClauses.push("processed_at = NOW()");
    }

    const result = await pool.query(
      `UPDATE claims SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async getPendingClaims(limit = 50) {
    const result = await pool.query(
      "SELECT * FROM claims WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1",
      [limit]
    );
    return result.rows;
  },
};

module.exports = ClaimModel;
