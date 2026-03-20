/**
 * Trigger Service — Parametric disruption trigger engine.
 *
 * Monitors external data sources (weather, AQI, traffic) and
 * automatically fires triggers when predefined thresholds are met.
 *
 * Threshold definitions (Phase-1):
 *   - Extreme Weather:  rainfall > 50mm/hr  OR  temperature > 45°C  OR  temperature < 5°C
 *   - High AQI:         AQI > 300 (hazardous)
 *   - Flooding:         rainfall > 100mm/hr
 *   - Heatwave:         temperature > 44°C for 3+ hours
 *   - Zone Shutdown:    manual trigger by admin (curfew, protests, etc.)
 */

const { pool } = require("../database/connection");
const ClaimModel = require("../models/claim.model");
const PolicyModel = require("../models/policy.model");
const logger = require("../utils/logger");

// Configurable thresholds
const THRESHOLDS = {
  extreme_weather: {
    rainfall_mm: 50,
    temp_high_c: 45,
    temp_low_c: 5,
  },
  high_aqi: {
    aqi: 300,
  },
  flooding: {
    rainfall_mm: 100,
  },
  heatwave: {
    temperature_c: 44,
  },
};

const TriggerService = {
  /**
   * Evaluate weather/environment data against thresholds.
   * Returns an array of triggered events.
   */
  evaluateTriggers(data) {
    const { city, zone, rainfall_mm, temperature_c, aqi } = data;
    const triggers = [];

    // Extreme weather check
    if (rainfall_mm > THRESHOLDS.extreme_weather.rainfall_mm ||
        temperature_c > THRESHOLDS.extreme_weather.temp_high_c ||
        temperature_c < THRESHOLDS.extreme_weather.temp_low_c) {
      triggers.push({
        trigger_type: "extreme_weather",
        city, zone,
        severity: rainfall_mm > 80 || temperature_c > 48 ? "critical" : "high",
        threshold_met: `rainfall=${rainfall_mm}mm, temp=${temperature_c}°C`,
      });
    }

    // AQI check
    if (aqi > THRESHOLDS.high_aqi.aqi) {
      triggers.push({
        trigger_type: "high_aqi",
        city, zone,
        severity: aqi > 400 ? "critical" : "high",
        threshold_met: `AQI=${aqi}`,
      });
    }

    // Flooding check
    if (rainfall_mm > THRESHOLDS.flooding.rainfall_mm) {
      triggers.push({
        trigger_type: "flooding",
        city, zone,
        severity: "critical",
        threshold_met: `rainfall=${rainfall_mm}mm (flooding threshold)`,
      });
    }

    return triggers;
  },

  /**
   * Record a trigger event and auto-initiate claims for all
   * active policies in the affected zone.
   */
  async fireTrigger(triggerData) {
    // 1. Record the trigger event
    const result = await pool.query(
      `INSERT INTO parametric_triggers (trigger_type, city, zone, severity, data_snapshot, threshold_met)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        triggerData.trigger_type, triggerData.city, triggerData.zone,
        triggerData.severity, JSON.stringify(triggerData.data_snapshot || {}),
        triggerData.threshold_met,
      ]
    );
    const trigger = result.rows[0];

    // 2. Find all active policies in the affected zone
    const activePolicies = await PolicyModel.getActivePoliciesForZone(
      triggerData.city, triggerData.zone
    );

    // 3. Auto-create claims for each affected policy
    const claims = [];
    for (const policy of activePolicies) {
      // Payout = coverage_amount × severity multiplier
      const severityMultiplier = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
      const claimAmount = Math.round(
        policy.coverage_amount * (severityMultiplier[triggerData.severity] || 0.5) * 100
      ) / 100;

      const claim = await ClaimModel.create({
        policy_id: policy.id,
        worker_id: policy.worker_id,
        trigger_id: trigger.id,
        claim_amount: claimAmount,
      });
      claims.push(claim);
    }

    logger.info(
      `Trigger ${trigger.id} fired: ${triggerData.trigger_type} in ${triggerData.city}/${triggerData.zone} — ${claims.length} claims auto-created`
    );

    return { trigger, claims_created: claims.length };
  },
};

module.exports = TriggerService;
