/**
 * Policy Model — Database access layer for the policies table
 */

const { pool } = require("../database/connection");

const PolicyModel = {
  async create({ worker_id, risk_assessment_id, week_start, week_end, premium_amount, coverage_amount, payment_id }) {
    const result = await pool.query(
      `INSERT INTO policies (worker_id, risk_assessment_id, week_start, week_end, premium_amount, coverage_amount, payment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [worker_id, risk_assessment_id, week_start, week_end, premium_amount, coverage_amount, payment_id]
    );
    return result.rows[0];
  },

  async findActiveByWorker(worker_id) {
    const result = await pool.query(
      `SELECT * FROM policies WHERE worker_id = $1 AND status = 'active' AND week_end >= CURRENT_DATE ORDER BY week_start DESC`,
      [worker_id]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM policies WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async updateStatus(id, status) {
    const result = await pool.query(
      "UPDATE policies SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return result.rows[0];
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
    return result.rows;
  },
};

module.exports = PolicyModel;
