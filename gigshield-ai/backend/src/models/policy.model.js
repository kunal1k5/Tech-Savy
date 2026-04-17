/**
 * Policy Model — Database access layer for the policies table
 */

const { pool } = require("../database/connection");

function withAiDefaults(policy) {
  if (!policy) {
    return policy;
  }

  const basePayout = policy.base_payout ?? policy.coverage_amount ?? null;

  return {
    ...policy,
    base_payout: basePayout,
    basePayout,
    dynamic_enabled: policy.dynamic_enabled ?? true,
    dynamicEnabled: policy.dynamic_enabled ?? true,
    ai_suggested: policy.ai_suggested ?? false,
    explanation: policy.explanation ?? null,
  };
}

const PolicyModel = {
  async create({
    worker_id,
    risk_assessment_id,
    week_start,
    week_end,
    premium_amount,
    coverage_amount,
    payment_id,
    basePayout = null,
    dynamicEnabled = true,
    aiSuggested = false,
    explanation = null,
  }) {
    const baseValues = [
      worker_id,
      risk_assessment_id,
      week_start,
      week_end,
      premium_amount,
      coverage_amount,
      payment_id,
    ];
    const normalizedBasePayout = basePayout ?? coverage_amount;

    try {
      const result = await pool.query(
        `INSERT INTO policies (
          worker_id,
          risk_assessment_id,
          week_start,
          week_end,
          premium_amount,
          coverage_amount,
          payment_id,
          base_payout,
          dynamic_enabled,
          ai_suggested,
          explanation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [...baseValues, normalizedBasePayout, dynamicEnabled, aiSuggested, explanation]
      );

      return withAiDefaults(result.rows[0]);
    } catch (error) {
      if (error?.code !== "42703") {
        throw error;
      }

      const result = await pool.query(
        `INSERT INTO policies (worker_id, risk_assessment_id, week_start, week_end, premium_amount, coverage_amount, payment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        baseValues
      );

      return withAiDefaults({
        ...result.rows[0],
        ai_suggested: Boolean(aiSuggested),
        explanation,
      });
    }
  },

  async findActiveByWorker(worker_id) {
    const result = await pool.query(
      `SELECT * FROM policies WHERE worker_id = $1 AND status = 'active' AND week_end >= CURRENT_DATE ORDER BY week_start DESC`,
      [worker_id]
    );
    return result.rows.map(withAiDefaults);
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM policies WHERE id = $1", [id]);
    return withAiDefaults(result.rows[0] || null);
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      "UPDATE policies SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return withAiDefaults(result.rows[0]);
  },

  async getActivePoliciesForZone(city, zone) {
    const result = await pool.query(
      `SELECT p.*, w.full_name, w.phone, w.avg_weekly_income
       FROM policies p
       JOIN workers w ON w.id = p.worker_id
       WHERE w.city = $1 AND w.zone = $2
         AND p.status = 'active'
         AND p.week_end >= CURRENT_DATE`,
      [city, zone]
    );
    return result.rows.map(withAiDefaults);
  },

  async getAllActivePolicies() {
    const result = await pool.query(
      `SELECT p.*, w.full_name, w.phone, w.avg_weekly_income, w.city, w.zone
       FROM policies p
       JOIN workers w ON w.id = p.worker_id
       WHERE p.status = 'active'
         AND p.week_end >= CURRENT_DATE
       ORDER BY p.created_at DESC`
    );

    return result.rows.map(withAiDefaults);
  },
};

module.exports = PolicyModel;
