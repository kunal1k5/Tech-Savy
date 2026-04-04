/**
 * Anomaly Detection Service
 *
 * Rule-based anomaly detection (NO ML training required)
 * - High frequency claims (>3 in 24h) → anomaly
 * - Same location repeated claims → clustering anomaly
 * - Sudden behavior change → anomaly
 * - Returns anomaly_score (0-100) and triggering conditions
 */

const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");

const ANOMALY_THRESHOLDS = {
  HIGH_CLAIM_FREQUENCY: 3, // Claims in 24h
  LOCATION_CLUSTER_DISTANCE_KM: 1, // Claims within 1km
  CLAIM_TIME_DEVIATION_MINUTES: 60, // Unusual claim time
};

const ANOMALY_SCORES = {
  HIGH_FREQUENCY: 35,
  LOCATION_CLUSTER: 30,
  RAPID_SUCCESS_SPIKE: 25,
  BEHAVIOR_CHANGE: 20,
  UNUSUAL_CLAIM_TIME: 15,
};

/**
 * Detect anomalies for a claim
 */
async function detectAnomalies(workerId, claimData = {}) {
  try {
    const conditions = [];
    let anomalyScore = 0;
    const anomalyType = [];

    // Check claim frequency in last 24 hours
    const frequencyCheck = await checkClaimFrequency(workerId);
    if (frequencyCheck.count > ANOMALY_THRESHOLDS.HIGH_CLAIM_FREQUENCY) {
      anomalyScore += ANOMALY_SCORES.HIGH_FREQUENCY;
      conditions.push({
        condition: "HIGH_CLAIM_FREQUENCY",
        count: frequencyCheck.count,
        threshold: ANOMALY_THRESHOLDS.HIGH_CLAIM_FREQUENCY,
        score_contribution: ANOMALY_SCORES.HIGH_FREQUENCY,
      });
      anomalyType.push("high_frequency");
    }

    // Check location clustering
    if (claimData.latitude && claimData.longitude) {
      const locationCheck = await checkLocationClustering(
        workerId,
        claimData.latitude,
        claimData.longitude,
      );
      if (locationCheck.is_clustered) {
        anomalyScore += ANOMALY_SCORES.LOCATION_CLUSTER;
        conditions.push({
          condition: "LOCATION_CLUSTERING",
          cluster_size: locationCheck.cluster_count,
          avg_distance_km: locationCheck.avg_distance_km,
          score_contribution: ANOMALY_SCORES.LOCATION_CLUSTER,
        });
        anomalyType.push("location_cluster");
      }
    }

    // Check claim success pattern
    const successCheck = await checkSuccessPatternAnomaly(workerId);
    if (successCheck.is_anomalous) {
      anomalyScore += ANOMALY_SCORES.RAPID_SUCCESS_SPIKE;
      conditions.push({
        condition: "RAPID_SUCCESS_SPIKE",
        recent_success_rate: successCheck.recent_success_rate,
        historical_rate: successCheck.historical_rate,
        score_contribution: ANOMALY_SCORES.RAPID_SUCCESS_SPIKE,
      });
      anomalyType.push("behavior_change");
    }

    // Determine severity
    let severity = "low";
    if (anomalyScore > 60) {
      severity = "high";
    } else if (anomalyScore > 40) {
      severity = "medium";
    }

    // Log anomaly
    if (anomalyScore > 0) {
      await logAnomaly(workerId, null, anomalyScore, anomalyType.join(","), conditions, severity);
    }

    return {
      anomaly_detected: anomalyScore > 0,
      anomaly_score: Math.min(100, anomalyScore),
      severity,
      anomaly_types: anomalyType,
      conditions,
    };
  } catch (error) {
    console.error("Error detecting anomalies:", error.message);
    throw error;
  }
}

/**
 * Check if claim frequency is abnormally high
 */
async function checkClaimFrequency(workerId) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentClaims = await db("claims")
      .where("worker_id", workerId)
      .andWhere("created_at", ">=", oneDayAgo);

    return {
      count: recentClaims.length,
      threshold: ANOMALY_THRESHOLDS.HIGH_CLAIM_FREQUENCY,
      is_anomalous: recentClaims.length > ANOMALY_THRESHOLDS.HIGH_CLAIM_FREQUENCY,
    };
  } catch (error) {
    console.error("Error checking claim frequency:", error.message);
    throw error;
  }
}

/**
 * Check if claims are geographically clustered
 */
async function checkLocationClustering(workerId, claimLatitude, claimLongitude) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get claims with location data in last 7 days
    const recentClaims = await db.raw(
      `
      SELECT c.*, pm.latitude, pm.longitude
      FROM claims c
      LEFT JOIN parametric_triggers pm ON c.trigger_id = pm.id
      WHERE c.worker_id = ?::uuid
      AND c.created_at >= ?
      AND pm.latitude IS NOT NULL
      AND pm.longitude IS NOT NULL
    `,
      [workerId, sevenDaysAgo.toISOString()],
    );

    if (!recentClaims.rows || recentClaims.rows.length === 0) {
      return {
        is_clustered: false,
        cluster_count: 0,
        avg_distance_km: 0,
      };
    }

    // Calculate distances to current claim
    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const distances = recentClaims.rows
      .map((claim) => ({
        distance_km: haversineDistance(
          claimLatitude,
          claimLongitude,
          parseFloat(claim.latitude),
          parseFloat(claim.longitude),
        ),
      }))
      .map((d) => d.distance_km);

    const clusteredCount = distances.filter(
      (d) => d <= ANOMALY_THRESHOLDS.LOCATION_CLUSTER_DISTANCE_KM,
    ).length;
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    return {
      is_clustered: clusteredCount >= 2,
      cluster_count: clusteredCount,
      avg_distance_km: parseFloat(avgDistance.toFixed(2)),
      threshold_km: ANOMALY_THRESHOLDS.LOCATION_CLUSTER_DISTANCE_KM,
    };
  } catch (error) {
    console.error("Error checking location clustering:", error.message);
    return {
      is_clustered: false,
      cluster_count: 0,
      avg_distance_km: 0,
    };
  }
}

/**
 * Check if recent success rate is anomalously high
 */
async function checkSuccessPatternAnomaly(workerId) {
  try {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Recent claims (7 days)
    const recentClaims = await db("claims")
      .where("worker_id", workerId)
      .andWhere("created_at", ">=", last7Days)
      .count("id as count")
      .first();

    const recentApproved = await db("claims")
      .where("worker_id", workerId)
      .andWhere("created_at", ">=", last7Days)
      .whereIn("status", ["approved", "paid"])
      .count("id as count")
      .first();

    // Historical claims (30 days)
    const historicalClaims = await db("claims")
      .where("worker_id", workerId)
      .andWhere("created_at", ">=", last30Days)
      .andWhere("created_at", "<", last7Days)
      .count("id as count")
      .first();

    const historicalApproved = await db("claims")
      .where("worker_id", workerId)
      .andWhere("created_at", ">=", last30Days)
      .andWhere("created_at", "<", last7Days)
      .whereIn("status", ["approved", "paid"])
      .count("id as count")
      .first();

    const recentCount = parseInt(recentClaims.count) || 0;
    const recentSuccessCount = parseInt(recentApproved.count) || 0;
    const historicalCount = parseInt(historicalClaims.count) || 0;
    const historicalSuccessCount = parseInt(historicalApproved.count) || 0;

    const recentRate = recentCount > 0 ? recentSuccessCount / recentCount : 0;
    const historicalRate = historicalCount > 0 ? historicalSuccessCount / historicalCount : 0;

    const rateIncrease = recentRate - historicalRate;
    const isAnomalous = rateIncrease > 0.3 && recentCount > 2; // 30% increase with at least 3 claims

    return {
      is_anomalous: isAnomalous,
      recent_success_rate: parseFloat((recentRate * 100).toFixed(2)),
      historical_rate: parseFloat((historicalRate * 100).toFixed(2)),
      rate_increase_pct: parseFloat((rateIncrease * 100).toFixed(2)),
    };
  } catch (error) {
    console.error("Error checking success pattern:", error.message);
    return {
      is_anomalous: false,
      recent_success_rate: 0,
      historical_rate: 0,
      rate_increase_pct: 0,
    };
  }
}

/**
 * Log an anomaly detection event
 */
async function logAnomaly(workerId, claimId, anomalyScore, anomalyType, conditions, severity) {
  try {
    const anomalyLog = {
      id: uuidv4(),
      worker_id: workerId,
      claim_id: claimId,
      anomaly_score: anomalyScore,
      anomaly_type: anomalyType,
      conditions: JSON.stringify(conditions),
      severity,
    };

    await db("anomaly_logs").insert(anomalyLog);
    return anomalyLog;
  } catch (error) {
    console.error("Error logging anomaly:", error.message);
    throw error;
  }
}

/**
 * Get anomaly history for a worker
 */
async function getAnomalyHistory(workerId, days = 30) {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const anomalies = await db("anomaly_logs")
      .where("worker_id", workerId)
      .andWhere("detected_at", ">=", since)
      .orderBy("detected_at", "desc")
      .limit(50);

    return {
      worker_id: workerId,
      period_days: days,
      anomalies_count: anomalies.length,
      anomalies,
    };
  } catch (error) {
    console.error("Error getting anomaly history:", error.message);
    throw error;
  }
}

module.exports = {
  detectAnomalies,
  checkClaimFrequency,
  checkLocationClustering,
  checkSuccessPatternAnomaly,
  logAnomaly,
  getAnomalyHistory,
  ANOMALY_THRESHOLDS,
  ANOMALY_SCORES,
};
