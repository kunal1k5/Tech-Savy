/**
 * Trigger Controller — Parametric trigger evaluation and firing
 */

const TriggerService = require("../services/trigger.service");
const { sendSuccess } = require("../utils/apiResponse");

const TriggerController = {
  /**
   * POST /api/triggers/evaluate
   * Accepts zone weather data, evaluates thresholds, and fires triggers.
   * Called by a cron job or webhook from weather data pipeline.
   */
  async evaluate(req, res, next) {
    try {
      const triggers = TriggerService.evaluateTriggers(req.body);

      if (triggers.length === 0) {
        return sendSuccess(res, { triggers_fired: 0 }, "No thresholds exceeded.");
      }

      const results = [];
      for (const triggerData of triggers) {
        triggerData.data_snapshot = req.body;
        const result = await TriggerService.fireTrigger(triggerData);
        results.push(result);
      }

      return sendSuccess(res, results, `${results.length} trigger(s) fired.`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/triggers/manual
   * Admin-initiated trigger (e.g., curfew, zone shutdown).
   */
  async manualTrigger(req, res, next) {
    try {
      const result = await TriggerService.fireTrigger({
        ...req.body,
        data_snapshot: { source: "admin_manual", admin_id: req.user.id },
      });
      return sendSuccess(res, result, "Manual trigger fired successfully.", 201);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = TriggerController;
