/**
 * Policy Service — Business logic for weekly insurance policies.
 *
 * Premium calculation strategy:
 *   Weekly Premium = Base Premium + (Risk Score × Risk Factor)
 *
 *   Tier        | Base (₹) | Risk Factor | Example Premium
 *   ------------|----------|-------------|----------------
 *   Low         |   10     |    0.10     |  ₹10-15
 *   Medium      |   18     |    0.15     |  ₹18-30
 *   High        |   30     |    0.25     |  ₹30-50
 *   Critical    |   45     |    0.35     |  ₹45-80
 *
 *   Coverage Amount = avg_weekly_income × coverage_multiplier (default 0.8 = 80%)
 */

const PolicyModel = require("../models/policy.model");
const RiskService = require("./risk.service");
const { pool } = require("../database/connection");

// Premium configuration — easily tunable
const PREMIUM_CONFIG = {
  low:      { base: 10, riskFactor: 0.10 },
  medium:   { base: 18, riskFactor: 0.15 },
  high:     { base: 30, riskFactor: 0.25 },
  critical: { base: 45, riskFactor: 0.35 },
};

const COVERAGE_MULTIPLIER = 0.8; // 80% of avg weekly income

const PolicyService = {
  /**
   * Calculate weekly premium for a worker based on their latest risk assessment.
   */
  calculatePremium(riskScore, riskTier) {
    const config = PREMIUM_CONFIG[riskTier] || PREMIUM_CONFIG.medium;
    const premium = config.base + (riskScore * config.riskFactor);
    return Math.round(premium * 100) / 100; // round to 2 decimal places
  },

  /**
   * Generate a premium quote for a worker (without purchasing).
   */
  async getQuote(workerId) {
    // Get or create a fresh risk assessment
    let assessment = await RiskService.getLatestAssessment(workerId);
    if (!assessment) {
      assessment = await RiskService.assessRisk(workerId);
    }

    const worker = (await pool.query("SELECT avg_weekly_income FROM workers WHERE id = $1", [workerId])).rows[0];
    const premium = this.calculatePremium(assessment.risk_score, assessment.risk_tier);
    const coverage = Math.round(worker.avg_weekly_income * COVERAGE_MULTIPLIER * 100) / 100;

    return {
      worker_id: workerId,
      risk_score: assessment.risk_score,
      risk_tier: assessment.risk_tier,
      weekly_premium: premium,
      coverage_amount: coverage,
      assessment_id: assessment.id,
    };
  },

  /**
   * Purchase a weekly policy after payment.
   */
  async purchasePolicy(workerId, assessmentId, paymentId) {
    const assessment = (await pool.query("SELECT * FROM risk_assessments WHERE id = $1", [assessmentId])).rows[0];
    if (!assessment) {
      const err = new Error("Risk assessment not found");
      err.statusCode = 404;
      throw err;
    }

    const worker = (await pool.query("SELECT avg_weekly_income FROM workers WHERE id = $1", [workerId])).rows[0];
    const premium = this.calculatePremium(assessment.risk_score, assessment.risk_tier);
    const coverage = Math.round(worker.avg_weekly_income * COVERAGE_MULTIPLIER * 100) / 100;

    // Week starts today, ends 6 days later
    const weekStart = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 6);

    const policy = await PolicyModel.create({
      worker_id: workerId,
      risk_assessment_id: assessmentId,
      week_start: weekStart.toISOString().split("T")[0],
      week_end: weekEnd.toISOString().split("T")[0],
      premium_amount: premium,
      coverage_amount: coverage,
      payment_id: paymentId,
    });

    return policy;
  },
};

module.exports = PolicyService;
