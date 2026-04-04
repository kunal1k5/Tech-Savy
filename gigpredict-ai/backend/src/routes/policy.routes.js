/**
 * Policy Routes
 *
 * GET  /api/policies/quote    — Get a premium quote for the worker
 * POST /api/policies/purchase — Purchase a weekly policy
 * GET  /api/policies/active   — List active policies
 */

const { Router } = require("express");
const Joi = require("joi");
const PolicyController = require("../controllers/policy.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();

const purchaseSchema = Joi.object({
  assessment_id: Joi.string().uuid().required(),
  payment_id: Joi.string().required(),
});

router.get("/quote", authenticate, PolicyController.getQuote);
router.post("/purchase", authenticate, validate(purchaseSchema), PolicyController.purchase);
router.get("/active", authenticate, PolicyController.getActivePolicies);

module.exports = router;
