/**
 * Activity & Work Sessions API Routes
 *
 * POST /log-activity
 * POST /start-work
 * POST /end-work
 * GET /work-sessions/:workerId
 * POST /validate-claim-time
 * GET /activity-history/:workerId
 */

const express = require("express");
const router = express.Router();

const activityService = require("../services/activityService");
const workSessionService = require("../services/workSessionService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

/**
 * POST /api/activity/log
 * Log worker activity (GPS, motion state)
 */
router.post("/log", async (req, res) => {
  try {
    const { worker_id, latitude, longitude, speed_kmh, motion_state, accuracy_meters, battery_pct } = req.body;

    if (!worker_id) {
      return sendError(res, "Missing worker_id", 400);
    }

    const result = await activityService.logActivity(worker_id, {
      latitude,
      longitude,
      speed_kmh,
      motion_state,
      accuracy_meters,
      battery_pct,
    });

    return sendSuccess(res, result, "Activity logged successfully");
  } catch (error) {
    console.error("Activity logging error:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/activity/history/:workerId
 * Get activity history
 */
router.get("/history/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const minutes = parseInt(req.query.minutes) || 60;

    const history = await activityService.getActivityHistory(workerId, minutes);

    return sendSuccess(res, { activities: history, count: history.length });
  } catch (error) {
    console.error("Error retrieving activity history:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/activity/analyze-claim
 * Analyze activity during claim
 */
router.post("/analyze-claim", async (req, res) => {
  try {
    const { worker_id, claim_timestamp, time_window_minutes } = req.body;

    if (!worker_id || !claim_timestamp) {
      return sendError(res, "Missing worker_id or claim_timestamp", 400);
    }

    const analysis = await activityService.analyzeActivityDuringClaim(
      worker_id,
      claim_timestamp,
      time_window_minutes || 30,
    );

    return sendSuccess(res, analysis);
  } catch (error) {
    console.error("Error analyzing claim activity:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/activity/idle/:workerId
 * Get idle duration statistics
 */
router.get("/idle/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const minutes = parseInt(req.query.minutes) || 120;

    const idleData = await activityService.getIdleDuration(workerId, minutes);

    return sendSuccess(res, idleData);
  } catch (error) {
    console.error("Error retrieving idle duration:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/work-sessions/start
 * Start a new work session
 */
router.post("/sessions/start", async (req, res) => {
  try {
    const { worker_id, latitude, longitude } = req.body;

    if (!worker_id) {
      return sendError(res, "Missing worker_id", 400);
    }

    const result = await workSessionService.startWorkSession(worker_id, {
      latitude,
      longitude,
    });

    return sendSuccess(res, result, "Work session started");
  } catch (error) {
    console.error("Error starting work session:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/work-sessions/end
 * End current work session
 */
router.post("/sessions/end", async (req, res) => {
  try {
    const { worker_id, latitude, longitude, earnings } = req.body;

    if (!worker_id) {
      return sendError(res, "Missing worker_id", 400);
    }

    const result = await workSessionService.endWorkSession(worker_id, {
      latitude,
      longitude,
      earnings,
    });

    return sendSuccess(res, result, "Work session ended");
  } catch (error) {
    console.error("Error ending work session:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/work-sessions/:workerId
 * Get daily work sessions
 */
router.get("/sessions/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const sessions = await workSessionService.getDailyWorkSessions(workerId, date);

    return sendSuccess(res, sessions);
  } catch (error) {
    console.error("Error retrieving work sessions:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/work-sessions/validate-claim-time
 * Check if claim is within working hours
 */
router.post("/sessions/validate-claim-time", async (req, res) => {
  try {
    const { worker_id, claim_timestamp } = req.body;

    if (!worker_id || !claim_timestamp) {
      return sendError(res, "Missing worker_id or claim_timestamp", 400);
    }

    const validation = await workSessionService.validateClaimWithinWorkingHours(
      worker_id,
      claim_timestamp,
    );

    return sendSuccess(res, validation);
  } catch (error) {
    console.error("Error validating claim time:", error.message);
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/work-sessions/summary/:workerId
 * Get working hours summary for period
 */
router.get("/sessions/summary/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const daysBack = parseInt(req.query.days) || 7;

    const summary = await workSessionService.getWorkingHoursSummary(workerId, daysBack);

    return sendSuccess(res, summary);
  } catch (error) {
    console.error("Error retrieving working summary:", error.message);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
