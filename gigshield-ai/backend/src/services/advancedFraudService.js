/**
 * Advanced Fraud Engine V2
 *
 * Combines:
 * - Behavior score (existing)
 * - Location mismatch
 * - Context (weather)
 * - Activity validation
 * - Anomaly score
 * - Trust score modifier
 *
 * Final decision: SAFE / WARNING / FRAUD
 * With explainable reasons and confidence score
 */

const activityService = require("./activityService");
const trustScoreService = require("./trustScoreService");
const anomalyService = require("./anomalyService");
const workSessionService = require("./workSessionService");
const proofValidationService = require("./proofValidationService");

const db = require("../database/connection");

// Fraud score weights
const FRAUD_WEIGHTS = {
  ACTIVITY: 0.25, // 25% of score
  LOCATION: 0.2, // 20%
  CONTEXT: 0.15, // 15%
  BEHAVIOR: 0.15, // 15%
  ANOMALY: 0.15, // 15%
  TRUST: -0.1, // -10% (modifier, reduces score for high-trust users)
};

// Decision thresholds
const DECISION_THRESHOLDS = {
  SAFE: 30,
  WARNING: 60,
  FRAUD: 80,
};

// Confidence calculation
const CONFIDENCE_WEIGHTS = {
  ACTIVITY_CHECK: 0.25,
  LOCATION_CHECK: 0.2,
  TIME_CHECK: 0.15,
  BEHAVIORAL_CHECK: 0.15,
  ANOMALY_CHECK: 0.15,
  TRUST_CHECK: 0.1,
};

/**
 * Main fraud detection pipeline
 */
async function analyzeFraudRisk(workerId, claimData) {
  try {
    const analysisStart = Date.now();
    const reasons = [];
    let confidenceChecks = 0;

    // 1. Get activity validation
    const activityAnalysis = await analyzeActivityScore(workerId, claimData);
    confidenceChecks += activityAnalysis.checks_performed;

    // 2. Get location validation
    const locationAnalysis = await analyzeLocationScore(workerId, claimData);
    confidenceChecks += locationAnalysis.checks_performed;

    // 3. Get time correlation
    const timeAnalysis = await analyzeTimeCorrelationScore(workerId, claimData);
    confidenceChecks += timeAnalysis.checks_performed;

    // 4. Get behavior score (existing data)
    const behaviorAnalysis = analyzeBehaviorScore(claimData);
    confidenceChecks += behaviorAnalysis.checks_performed;

    // 5. Get anomaly detection
    const anomalyAnalysis = await analyzeAnomalyScore(workerId, claimData);
    confidenceChecks += anomalyAnalysis.checks_performed;

    // 6. Get trust modifier
    const trustAnalysis = await analyzeTrustScore(workerId);
    confidenceChecks += trustAnalysis.checks_performed;

    // Calculate combined fraud score
    let fraudScore =
      activityAnalysis.score * FRAUD_WEIGHTS.ACTIVITY +
      locationAnalysis.score * FRAUD_WEIGHTS.LOCATION +
      timeAnalysis.score * FRAUD_WEIGHTS.CONTEXT +
      behaviorAnalysis.score * FRAUD_WEIGHTS.BEHAVIOR +
      anomalyAnalysis.score * FRAUD_WEIGHTS.ANOMALY -
      trustAnalysis.modifier * FRAUD_WEIGHTS.TRUST;

    fraudScore = Math.min(100, Math.max(0, fraudScore)); // Clamp 0-100

    // Determine decision
    let decision = "SAFE";
    let nextAction = "AUTO_APPROVE_CLAIM";

    if (fraudScore >= DECISION_THRESHOLDS.FRAUD) {
      decision = "FRAUD";
      nextAction = "REJECT_CLAIM";
    } else if (fraudScore >= DECISION_THRESHOLDS.WARNING) {
      decision = "WARNING";
      nextAction = "UPLOAD_PROOF";
    }

    // Build reasons
    if (activityAnalysis.is_suspicious) {
      reasons.push(`Activity: ${activityAnalysis.reason}`);
    }
    if (locationAnalysis.is_suspicious) {
      reasons.push(`Location: ${locationAnalysis.reason}`);
    }
    if (timeAnalysis.is_suspicious) {
      reasons.push(`Timing: ${timeAnalysis.reason}`);
    }
    if (anomalyAnalysis.is_suspicious) {
      reasons.push(`Anomaly: ${anomalyAnalysis.reason}`);
    }
    if (trustAnalysis.tier === "BRONZE" || trustAnalysis.tier === "UNVERIFIED") {
      reasons.push(`Trust: Low reputation score (${trustAnalysis.score})`);
    }

    // Calculate confidence
    const confidence = Math.min(100, (fraudScore * 1.2 + confidenceChecks * 10).toFixed(1));

    // Log fraud detection
    await logFraudDetection(workerId, claimData.claim_id, fraudScore, decision, {
      activity: activityAnalysis,
      location: locationAnalysis,
      time: timeAnalysis,
      behavior: behaviorAnalysis,
      anomaly: anomalyAnalysis,
      trust: trustAnalysis,
    });

    const analysisTime = Date.now() - analysisStart;

    return {
      decision,
      fraud_score: parseFloat(fraudScore.toFixed(2)),
      confidence: parseFloat(confidence),
      next_action: nextAction,
      reasons: reasons.length > 0 ? reasons : ["No suspicious patterns detected"],
      analysis_breakdown: {
        activity_score: parseFloat(activityAnalysis.score.toFixed(2)),
        location_score: parseFloat(locationAnalysis.score.toFixed(2)),
        time_score: parseFloat(timeAnalysis.score.toFixed(2)),
        behavior_score: parseFloat(behaviorAnalysis.score.toFixed(2)),
        anomaly_score: parseFloat(anomalyAnalysis.score.toFixed(2)),
        trust_modifier: parseFloat(trustAnalysis.modifier.toFixed(2)),
      },
      checks_performed: confidenceChecks,
      analysis_time_ms: analysisTime,
    };
  } catch (error) {
    console.error("Error in fraud analysis:", error.message);
    throw error;
  }
}

/**
 * Activity validation score
 */
async function analyzeActivityScore(workerId, claimData) {
  try {
    const activityAnalysis = await activityService.analyzeActivityDuringClaim(
      workerId,
      claimData.claim_timestamp || new Date().toISOString(),
    );

    const baseScore = activityAnalysis.fraud_score_contribution;
    const isSuspicious = baseScore > 0;

    return {
      score: Math.min(100, baseScore),
      is_suspicious: isSuspicious,
      reason: activityAnalysis.reason,
      details: {
        was_active: activityAnalysis.was_active,
        analysis_type: activityAnalysis.analysis,
      },
      checks_performed: 1,
    };
  } catch (error) {
    console.error("Error analyzing activity score:", error.message);
    return {
      score: 0,
      is_suspicious: false,
      reason: "Unable to verify activity",
      details: { error: error.message },
      checks_performed: 1,
    };
  }
}

/**
 * Location validation score
 */
async function analyzeLocationScore(workerId, claimData) {
  try {
    if (!claimData.latitude || !claimData.longitude) {
      return {
        score: 0,
        is_suspicious: false,
        reason: "No location data provided",
        details: {},
        checks_performed: 0,
      };
    }

    const locationValidation = await activityService.validateLocationConsistency(
      workerId,
      claimData.latitude,
      claimData.longitude,
    );

    const score = locationValidation.is_consistent ? 0 : 35;
    const isSuspicious = !locationValidation.is_consistent;

    return {
      score: Math.min(100, score),
      is_suspicious: isSuspicious,
      reason: isSuspicious ? `Location mismatch: ${locationValidation.avg_distance_km}km away` : "Location matches activity",
      details: {
        is_consistent: locationValidation.is_consistent,
        avg_distance_km: locationValidation.avg_distance_km,
      },
      checks_performed: 1,
    };
  } catch (error) {
    console.error("Error analyzing location score:", error.message);
    return {
      score: 0,
      is_suspicious: false,
      reason: "Unable to verify location",
      details: { error: error.message },
      checks_performed: 1,
    };
  }
}

/**
 * Time correlation score (working hours validation)
 */
async function analyzeTimeCorrelationScore(workerId, claimData) {
  try {
    const timeValidation = await workSessionService.validateClaimWithinWorkingHours(
      workerId,
      claimData.claim_timestamp || new Date().toISOString(),
    );

    const score = timeValidation.fraud_score_contribution;
    const isSuspicious = score > 0;

    return {
      score: Math.min(100, score),
      is_suspicious: isSuspicious,
      reason: timeValidation.reason,
      details: {
        within_hours: timeValidation.within_working_hours,
      },
      checks_performed: 1,
    };
  } catch (error) {
    console.error("Error analyzing time correlation:", error.message);
    return {
      score: 0,
      is_suspicious: false,
      reason: "Unable to verify working hours",
      details: { error: error.message },
      checks_performed: 1,
    };
  }
}

/**
 * Behavior analysis (simplified from existing system)
 */
function analyzeBehaviorScore(claimData) {
  let score = 0;
  const reasons = [];

  // Check login attempts
  if ((claimData.loginAttempts || 0) > 5) {
    score += 20;
    reasons.push("Multiple login attempts");
  }

  // Check claim count
  if ((claimData.claimsCount || 0) > 3) {
    score += 15;
    reasons.push("High claim frequency");
  }

  // Check weather consistency
  // (assuming context is already validated in existing system)

  return {
    score: Math.min(100, score),
    is_suspicious: score > 0,
    reason: reasons.join(", ") || "Normal behavior",
    checks_performed: 2,
  };
}

/**
 * Anomaly detection score
 */
async function analyzeAnomalyScore(workerId, claimData) {
  try {
    const anomalies = await anomalyService.detectAnomalies(workerId, claimData);

    return {
      score: Math.min(100, anomalies.anomaly_score),
      is_suspicious: anomalies.anomaly_detected,
      reason: anomalies.anomaly_detected
        ? `Anomaly detected: ${anomalies.anomaly_types.join(", ")}`
        : "No anomalies detected",
      details: {
        anomaly_types: anomalies.anomaly_types,
        severity: anomalies.severity,
      },
      checks_performed: 1,
    };
  } catch (error) {
    console.error("Error analyzing anomalies:", error.message);
    return {
      score: 0,
      is_suspicious: false,
      reason: "Unable to perform anomaly detection",
      details: { error: error.message },
      checks_performed: 1,
    };
  }
}

/**
 * Trust score modifier
 */
async function analyzeTrustScore(workerId) {
  try {
    const trust = await trustScoreService.getTrustScore(workerId);

    return {
      score: trust.score,
      tier: trust.tier,
      modifier: Math.max(0, trust.score - 50), // Positive modifier for trust scores above 50
      strategy: trust.approval_strategy,
      checks_performed: 1,
    };
  } catch (error) {
    console.error("Error analyzing trust score:", error.message);
    return {
      score: 50,
      tier: "SILVER",
      modifier: 0,
      strategy: { level: "MEDIUM_TRUST" },
      checks_performed: 1,
    };
  }
}

/**
 * Log fraud detection event
 */
async function logFraudDetection(workerId, claimId, fraudScore, decision, analysisDetails) {
  try {
    const fraudFlag = {
      id: require("uuid").v4(),
      worker_id: workerId,
      claim_id: claimId,
      flag_type: "COMPREHENSIVE_FRAUD_CHECK",
      flag_value: fraudScore,
      flag_reason: decision,
      confidence: Math.min(100, fraudScore * 1.2),
      details: JSON.stringify(analysisDetails),
    };

    await db("fraud_flags").insert(fraudFlag);
    return fraudFlag;
  } catch (error) {
    console.error("Error logging fraud detection:", error.message);
    // Don't throw - this is just logging
  }
}

module.exports = {
  analyzeFraudRisk,
  analyzeActivityScore,
  analyzeLocationScore,
  analyzeTimeCorrelationScore,
  analyzeBehaviorScore,
  analyzeAnomalyScore,
  analyzeTrustScore,
  FRAUD_WEIGHTS,
  DECISION_THRESHOLDS,
};
