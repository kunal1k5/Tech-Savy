/**
 * Work Sessions Service
 *
 * Tracks worker start/end times and validates claims against working hours
 * - Detects claims outside working hours (fraud indicator)
 * - Calculates daily earnings
 * - Manages session duration
 */

const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");

const FRAUD_SCORE_OUTSIDE_HOURS = 40; // Points if claim outside working hours
const FRAUD_SCORE_LONG_idle_SESSION = 15; // Points if session too long with claim

/**
 * Start a new work session
 */
async function startWorkSession(workerId, location = {}) {
  try {
    const session = {
      id: uuidv4(),
      worker_id: workerId,
      start_time: new Date().toISOString(),
      start_latitude: location.latitude,
      start_longitude: location.longitude,
      status: "active",
      orders_count: 0,
    };

    await db("work_sessions").insert(session);

    return {
      success: true,
      session_id: session.id,
      start_time: session.start_time,
      message: "Work session started",
    };
  } catch (error) {
    console.error("Error starting work session:", error.message);
    throw error;
  }
}

/**
 * End current work session
 */
async function endWorkSession(workerId, endLocation = {}, earnings = 0) {
  try {
    const session = await db("work_sessions")
      .where("worker_id", workerId)
      .andWhere("status", "active")
      .orderBy("start_time", "desc")
      .first();

    if (!session) {
      throw new Error("No active session found");
    }

    const endTime = new Date();
    const durationMinutes = Math.round((endTime - new Date(session.start_time)) / (60 * 1000));

    const updateData = {
      end_time: endTime.toISOString(),
      end_latitude: endLocation.latitude,
      end_longitude: endLocation.longitude,
      duration_minutes: durationMinutes,
      status: "completed",
      earnings_inr: earnings,
    };

    await db("work_sessions").where("id", session.id).update(updateData);

    return {
      success: true,
      session_id: session.id,
      duration_minutes: durationMinutes,
      earnings_inr: earnings,
      message: "Work session ended",
    };
  } catch (error) {
    console.error("Error ending work session:", error.message);
    throw error;
  }
}

/**
 * Get current active session for a worker
 */
async function getActiveSession(workerId) {
  try {
    const session = await db("work_sessions")
      .where("worker_id", workerId)
      .andWhere("status", "active")
      .orderBy("start_time", "desc")
      .first();

    return session || null;
  } catch (error) {
    console.error("Error retrieving active session:", error.message);
    throw error;
  }
}

/**
 * Get all sessions for a day
 */
async function getDailyWorkSessions(workerId, date) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await db("work_sessions")
      .where("worker_id", workerId)
      .andWhere("start_time", ">=", startOfDay.toISOString())
      .andWhere("start_time", "<=", endOfDay.toISOString())
      .orderBy("start_time", "asc");

    const totalEarnings = sessions.reduce((sum, s) => sum + (s.earnings_inr || 0), 0);
    const totalOrders = sessions.reduce((sum, s) => sum + (s.orders_count || 0), 0);
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

    return {
      sessions,
      summary: {
        total_sessions: sessions.length,
        total_earnings_inr: totalEarnings,
        total_orders: totalOrders,
        total_working_minutes: totalMinutes,
        avg_session_duration_minutes: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      },
    };
  } catch (error) {
    console.error("Error retrieving daily sessions:", error.message);
    throw error;
  }
}

/**
 * Check if claim time is within working hours
 * Returns fraud score contribution based on overlap
 */
async function validateClaimWithinWorkingHours(workerId, claimTimestamp) {
  try {
    const claimTime = new Date(claimTimestamp);

    // Get sessions on the claim date
    const dailySessions = await getDailyWorkSessions(workerId, claimTime);

    if (dailySessions.sessions.length === 0) {
      return {
        within_working_hours: false,
        fraud_score_contribution: FRAUD_SCORE_OUTSIDE_HOURS,
        reason: "No working sessions found on claim date",
        sessions_on_date: 0,
      };
    }

    // Check if claim time overlaps with any session
    let isWithinHours = false;
    let overlappingSession = null;

    for (const session of dailySessions.sessions) {
      const sessionStart = new Date(session.start_time);
      const sessionEnd = session.end_time ? new Date(session.end_time) : new Date(); // Assume current time if session still active

      if (claimTime >= sessionStart && claimTime <= sessionEnd) {
        isWithinHours = true;
        overlappingSession = session;
        break;
      }
    }

    if (!isWithinHours) {
      return {
        within_working_hours: false,
        fraud_score_contribution: FRAUD_SCORE_OUTSIDE_HOURS,
        reason: "Claim time outside any work session",
        sessions_on_date: dailySessions.sessions.length,
        working_hours: dailySessions.sessions.map((s) => ({
          start: s.start_time,
          end: s.end_time,
        })),
      };
    }

    return {
      within_working_hours: true,
      fraud_score_contribution: 0,
      reason: "Claim within working hours",
      overlapping_session: {
        id: overlappingSession.id,
        start_time: overlappingSession.start_time,
        end_time: overlappingSession.end_time,
        duration_minutes: overlappingSession.duration_minutes,
      },
    };
  } catch (error) {
    console.error("Error validating claim time:", error.message);
    throw error;
  }
}

/**
 * Get working hours summary for a period
 */
async function getWorkingHoursSummary(workerId, daysBack = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const sessions = await db("work_sessions")
      .where("worker_id", workerId)
      .andWhere("start_time", ">=", startDate.toISOString())
      .orderBy("start_time", "asc");

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const totalEarnings = sessions.reduce((sum, s) => sum + (s.earnings_inr || 0), 0);
    const avgDailyIncome = totalEarnings / Math.max(Math.ceil(daysBack), 1);

    // Group by date
    const byDate = {};
    sessions.forEach((s) => {
      const date = new Date(s.start_time).toDateString();
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(s);
    });

    return {
      period_days: daysBack,
      total_working_minutes: totalMinutes,
      total_earnings_inr: totalEarnings,
      avg_daily_income_inr: avgDailyIncome.toFixed(2),
      working_days: Object.keys(byDate).length,
      sessions_count: sessions.length,
      avg_session_duration_minutes: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      daily_breakdown: Object.keys(byDate)
        .sort()
        .map((date) => {
          const daySessions = byDate[date];
          return {
            date,
            sessions: daySessions.length,
            total_minutes: daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
            earnings: daySessions.reduce((sum, s) => sum + (s.earnings_inr || 0), 0),
          };
        }),
    };
  } catch (error) {
    console.error("Error getting working hours summary:", error.message);
    throw error;
  }
}

module.exports = {
  startWorkSession,
  endWorkSession,
  getActiveSession,
  getDailyWorkSessions,
  validateClaimWithinWorkingHours,
  getWorkingHoursSummary,
  FRAUD_SCORE_OUTSIDE_HOURS,
};
