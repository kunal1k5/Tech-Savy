/**
 * Worker Routes
 *
 * POST /api/workers/register   — Create a new worker account
 * POST /api/workers/login      — Authenticate and get JWT
 * GET  /api/workers/profile    — Get authenticated worker's profile
 */

const { Router } = require("express");
const Joi = require("joi");
const WorkerController = require("../controllers/worker.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();

const registerSchema = Joi.object({
  full_name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({ "string.pattern.base": "Phone must be a valid 10-digit Indian number" }),
  password: Joi.string().min(8).max(128).required(),
  platform: Joi.string().valid("zomato", "swiggy", "amazon", "dunzo", "other").required(),
  city: Joi.string().max(100).required(),
  zone: Joi.string().max(100).required(),
  avg_weekly_income: Joi.number().positive().required(),
  vehicle_type: Joi.string().valid("bicycle", "motorcycle", "scooter", "car").optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post("/register", validate(registerSchema), WorkerController.register);
router.post("/login", validate(loginSchema), WorkerController.login);
router.get("/profile", authenticate, WorkerController.getProfile);

module.exports = router;
