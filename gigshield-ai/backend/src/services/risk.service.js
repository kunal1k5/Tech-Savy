/**
 * Risk Service — Interfaces with the Python AI engine to
 * compute risk scores and determine premium tiers for workers.
 */

const axios = require("axios");
const { pool } = require("../database/connection");
const logger = require("../utils/logger");

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "http://localhost:8000";

const RiskService = {
  /**
   * Request a risk assessment from the AI engine for a given worker.
   * The AI engine uses weather, AQI, traffic, and zone history to
   * produce a risk_score (0-100) and risk_tier.
   */
  async assessRisk(workerId) {
    // 1. Fetch worker info
    const workerResult = await pool.query(
      "SELECT id, city, zone, avg_weekly_income FROM workers WHERE id = $1",
      [workerId]
    );
    const worker = workerResult.rows[0];
    if (!worker) {
      const err = new Error("Worker not found");
      err.statusCode = 404;
      throw err;
    }

    // 2. Call the AI engine
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_ENGINE_URL}/api/risk/assess`, {
        worker_id: worker.id,
        city: worker.city,
        zone: worker.zone,
      });
    } catch (error) {
      logger.error("AI engine risk assessment failed:", error.message);
      const err = new Error("Risk assessment service unavailable");
      err.statusCode = 503;
      throw err;
    }

    const { risk_score, risk_tier, features } = aiResponse.data;

    // 3. Persist the assessment
    const result = await pool.query(
      `INSERT INTO risk_assessments
         (worker_id, risk_score, risk_tier, rainfall_mm, temperature_c, aqi, traffic_index, zone_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        workerId, risk_score, risk_tier,
        features.rainfall_mm, features.temperature_c,
        features.aqi, features.traffic_index,
        JSON.stringify(features.zone_history || {}),
      ]
    );

    return result.rows[0];
  },

  /**
   * Get the latest risk assessment for a worker.
   */
  async getLatestAssessment(workerId) {
    const result = await pool.query(
      "SELECT * FROM risk_assessments WHERE worker_id = $1 ORDER BY assessed_at DESC LIMIT 1",
      [workerId]
    );
    return result.rows[0] || null;
  },
};

module.exports = RiskService;
