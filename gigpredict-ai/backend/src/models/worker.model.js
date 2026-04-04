/**
 * Worker Model — Database access layer for the workers table
 */

const { pool } = require("../database/connection");

const WorkerModel = {
  async create({ full_name, email, phone, password_hash, platform, city, zone, avg_weekly_income, vehicle_type }) {
    const result = await pool.query(
      `INSERT INTO workers (full_name, email, phone, password_hash, platform, city, zone, avg_weekly_income, vehicle_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, full_name, email, phone, platform, city, zone, avg_weekly_income, vehicle_type, created_at`,
      [full_name, email, phone, password_hash, platform, city, zone, avg_weekly_income, vehicle_type]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await pool.query("SELECT * FROM workers WHERE email = $1", [email]);
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await pool.query(
      "SELECT id, full_name, email, phone, platform, city, zone, avg_weekly_income, vehicle_type, is_verified, created_at FROM workers WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  },

  async updateProfile(id, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");

    const result = await pool.query(
      `UPDATE workers SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  },

  async listByCity(city, limit = 50, offset = 0) {
    const result = await pool.query(
      "SELECT id, full_name, platform, city, zone, is_verified, created_at FROM workers WHERE city = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [city, limit, offset]
    );
    return result.rows;
  },
};

module.exports = WorkerModel;
