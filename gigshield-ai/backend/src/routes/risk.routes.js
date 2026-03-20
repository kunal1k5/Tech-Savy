/**
 * Risk Routes
 *
 * POST /api/risk/assess — Trigger a new risk assessment
 * GET  /api/risk/latest — Get latest risk assessment for the worker
 */

const { Router } = require("express");
const RiskController = require("../controllers/risk.controller");
const { authenticate } = require("../middleware/auth");

const router = Router();

router.post("/assess", authenticate, RiskController.assess);
router.get("/latest", authenticate, RiskController.getLatest);

module.exports = router;
