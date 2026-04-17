/**
 * Trigger Routes
 *
 * POST /api/triggers/evaluate — Evaluate weather data against thresholds
 * POST /api/triggers/manual   — Admin-initiated manual trigger
 */

const { Router } = require("express");
const Joi = require("joi");
const TriggerController = require("../controllers/trigger.controller");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();

const evaluateSchema = Joi.object({
  city: Joi.string().required(),
  zone: Joi.string().required(),
  rainfall_mm: Joi.number().min(0).required(),
  temperature_c: Joi.number().required(),
  aqi: Joi.number().integer().min(0).required(),
  traffic_index: Joi.number().min(0).optional(),
});

const manualSchema = Joi.object({
  trigger_type: Joi.string().valid("curfew", "zone_shutdown").required(),
  city: Joi.string().required(),
  zone: Joi.string().required(),
  severity: Joi.string().valid("low", "medium", "high", "critical").required(),
  threshold_met: Joi.string().required(),
});

router.post("/evaluate", authenticate, validate(evaluateSchema), TriggerController.evaluate);
router.post("/manual", authenticate, authorize("super_admin"), validate(manualSchema), TriggerController.manualTrigger);
// Keep list endpoint public for the dashboard live feed; write operations stay protected.
router.get("/", TriggerController.listActive);

module.exports = router;
