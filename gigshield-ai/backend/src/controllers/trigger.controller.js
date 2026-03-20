/**
 * Trigger Controller — Parametric trigger evaluation and firing
 */

const TriggerService = require("../services/trigger.service");

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
        return res.json({ message: "No thresholds exceeded", triggers_fired: 0 });
      }

      const results = [];
      for (const triggerData of triggers) {
        triggerData.data_snapshot = req.body;
        const result = await TriggerService.fireTrigger(triggerData);
        results.push(result);
      }

      res.json({
        message: `${results.length} trigger(s) fired`,
        data: results,
      });
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
      res.status(201).json({ message: "Manual trigger fired", data: result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = TriggerController;
