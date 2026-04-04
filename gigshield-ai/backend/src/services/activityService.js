/**
 * Activity Verification Service
 *
 * Tracks worker activity patterns and detects suspicious behavior:
 * - Idle state during claims = fraud risk
 * - Motion validation for delivery claims
 * - GPS accuracy checking
 */

const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");

// Motion state constants
const MOTION_STATES = {
  IDLE: "IDLE",
  WALKING: "WALKING",
  DRIVING: "DRIVING",
};

const IDLE_THRESHOLD_MINUTES = 30; // If idle for 30+ mins, suspicious
const FRAUD_SCORE_IDLE = 30; // Points added if inactive during claim
const FRAUD_SCORE_NO_MOVEMENT = 25; // Points if no movement at all

/**
 * Log activity data from worker's mobile device
 */
async function logActivity(workerId, activityData) {
  try {
    const {
      latitude,
      longitude,
      speed_kmh = 0,
      motion_state = MOTION_STATES.IDLE,
      accuracy_meters = 20,
      battery_pct = 100,
      signal_strength = -50,
    } = activityData;

    // Validate motion state
    if (!Object.values(MOTION_STATES).includes(motion_state)) {
      throw new Error(`Invalid motion state: ${motion_state}`);
    }

    const activityLog = {
      id: uuidv4(),
      worker_id: workerId,
      timestamp: new Date().toISOString(),
      latitude,
      longitude,
      speed_kmh,
      motion_state,
      accuracy_meters,
      battery_pct,
      signal_strength,
    };

    // Insert into database
    await db("activity_logs").insert(activityLog);

    return {
      success: true,
      activity_id: activityLog.id,
      message: "Activity logged successfully",
    };
  } catch (error) {
    console.error("Activity logging error:", error.message);
    throw error;
  }
}

/**
 * Get activity history for a worker
 */
async function getActivityHistory(workerId, minutesBack = 60) {
  try {
    const sinceTime = new Date(Date.now() - minutesBack * 60 * 1000);

    const activities = await db("activity_logs")
      .where("worker_id", workerId)
      .andWhere("timestamp", ">=", sinceTime)
      .orderBy("timestamp", "asc");

    return activities;
  } catch (error) {
    console.error("Error retrieving activity history:", error.message);
    throw error;
  }
}

/**
 * Analyze activity during a specific time period
 * Used to verify if worker was actually working during claim time
 */
async function analyzeActivityDuringClaim(workerId, claimTimestamp, timeWindowMinutes = 30) {
  try {
    const claimTime = new Date(claimTimestamp);
    const startTime = new Date(claimTime.getTime() - timeWindowMinutes * 60 * 1000);
    const endTime = new Date(claimTime.getTime() + timeWindowMinutes * 60 * 1000);

    // Get all activities during the window
    const activities = await db("activity_logs")
      .where("worker_id", workerId)
      .andWhere("timestamp", ">=", startTime)
      .andWhere("timestamp", "<=", endTime)
      .orderBy("timestamp", "asc");

    if (activities.length === 0) {
      return {
        was_active: false,
        analysis: "NO_DATA",
        fraud_score_contribution: FRAUD_SCORE_NO_MOVEMENT,
        reason: "No activity data during claim time",
        activities_count: 0,
      };
    }

    // Analyze motion patterns
    const idleCount = activities.filter((a) => a.motion_state === MOTION_STATES.IDLE).length;
    const drivingCount = activities.filter((a) => a.motion_state === MOTION_STATES.DRIVING).length;
    const walkingCount = activities.filter((a) => a.motion_state === MOTION_STATES.WALKING).length;
    const avgSpeed = activities.reduce((sum, a) => sum + (a.speed_kmh || 0), 0) / activities.length;

    // Determine if suspicious
    const idlePercentage = (idleCount / activities.length) * 100;
    const isFullyIdle = idlePercentage > 80;
    const wasMoving = drivingCount > 0 || walkingCount > 0;

    let fraudScore = 0;
    let analysis = "NORMAL";

    if (isFullyIdle) {
      fraudScore = FRAUD_SCORE_IDLE;
      analysis = "SUSPICIOUS_IDLE";
    } else if (!wasMoving) {
      fraudScore = FRAUD_SCORE_NO_MOVEMENT;
      analysis = "NO_MOVEMENT";
    } else if (avgSpeed < 5) {
      fraudScore = 15; // Slow moving but not idle
      analysis = "SLOW_MOTION";
    }

    return {
      was_active: wasMoving,
      analysis,
      fraud_score_contribution: fraudScore,
      reason: analysis,
      activities_count: activities.length,
      motion_breakdown: {
        idle_pct: idlePercentage,
        driving_pct: (drivingCount / activities.length) * 100,
        walking_pct: (walkingCount / activities.length) * 100,
      },
      avg_speed_kmh: avgSpeed,
      time_window: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    };
  } catch (error) {
    console.error("Error analyzing claim activity:", error.message);
    throw error;
  }
}

/**
 * Get idle duration for a worker over a period
 * Returns total idle minutes and continuous idle periods
 */
async function getIdleDuration(workerId, minutesBack = 120) {
  try {
    const sinceTime = new Date(Date.now() - minutesBack * 60 * 1000);

    const activities = await db("activity_logs")
      .where("worker_id", workerId)
      .andWhere("timestamp", ">=", sinceTime)
      .orderBy("timestamp", "asc");

    if (activities.length < 2) {
      return {
        total_idle_minutes: 0,
        max_continuous_idle_minutes: 0,
        idle_events: [],
      };
    }

    let idleMinutes = 0;
    let currentIdleStart = null;
    const idleEvents = [];
    let maxIdleMinutes = 0;

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];

      if (activity.motion_state === MOTION_STATES.IDLE) {
        if (!currentIdleStart) {
          currentIdleStart = new Date(activity.timestamp);
        }
      } else {
        // Transition from idle to moving
        if (currentIdleStart) {
          const duration = (new Date(activity.timestamp) - currentIdleStart) / (60 * 1000);
          idleMinutes += duration;
          if (duration > maxIdleMinutes) {
            maxIdleMinutes = duration;
          }
          idleEvents.push({
            start: currentIdleStart.toISOString(),
            end: new Date(activity.timestamp).toISOString(),
            duration_minutes: Math.round(duration),
          });
          currentIdleStart = null;
        }
      }
    }

    // Handle ongoing idle
    if (currentIdleStart) {
      const lastTime = new Date(activities[activities.length - 1].timestamp);
      const duration = (lastTime - currentIdleStart) / (60 * 1000);
      idleMinutes += duration;
      if (duration > maxIdleMinutes) {
        maxIdleMinutes = duration;
      }
      idleEvents.push({
        start: currentIdleStart.toISOString(),
        end: lastTime.toISOString(),
        duration_minutes: Math.round(duration),
      });
    }

    return {
      total_idle_minutes: Math.round(idleMinutes),
      max_continuous_idle_minutes: Math.round(maxIdleMinutes),
      idle_events: idleEvents,
      suspicious: Math.round(maxIdleMinutes) > IDLE_THRESHOLD_MINUTES,
    };
  } catch (error) {
    console.error("Error calculating idle duration:", error.message);
    throw error;
  }
}

/**
 * Validate GPS location consistency
 * Checks if claimed location matches activity logs
 */
async function validateLocationConsistency(workerId, claimLatitude, claimLongitude, timeWindowMinutes = 30) {
  try {
    const sinceTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const activities = await db("activity_logs")
      .where("worker_id", workerId)
      .andWhere("timestamp", ">=", sinceTime)
      .whereNotNull("latitude")
      .whereNotNull("longitude")
      .orderBy("timestamp", "asc");

    if (activities.length === 0) {
      return {
        is_consistent: false,
        locations_found: 0,
        reason: "No GPS data available",
      };
    }

    // Calculate distance from claim location
    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
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

    const distances = activities.map((a) => ({
      timestamp: a.timestamp,
      distance_km: haversineDistance(claimLatitude, claimLongitude, a.latitude, a.longitude),
    }));

    const avgDistance = distances.reduce((sum, d) => sum + d.distance_km, 0) / distances.length;
    const maxDistance = Math.max(...distances.map((d) => d.distance_km));
    const isConsistent = avgDistance < 2; // Within 2 km is consistent

    return {
      is_consistent: isConsistent,
      locations_found: activities.length,
      avg_distance_km: avgDistance.toFixed(2),
      max_distance_km: maxDistance.toFixed(2),
      accuracy_check: {
        within_2km: isConsistent,
        within_5km: maxDistance < 5,
      },
    };
  } catch (error) {
    console.error("Error validating location consistency:", error.message);
    throw error;
  }
}

module.exports = {
  logActivity,
  getActivityHistory,
  analyzeActivityDuringClaim,
  getIdleDuration,
  validateLocationConsistency,
  MOTION_STATES,
  IDLE_THRESHOLD_MINUTES,
  FRAUD_SCORE_IDLE,
};
