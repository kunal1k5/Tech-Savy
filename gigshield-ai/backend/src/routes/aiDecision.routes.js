const { Router } = require("express");

const AiDecisionController = require("../controllers/aiDecision.controller");
const { validate } = require("../middleware/validate");
const { aiDecisionSchema } = require("../services/aiDecision.service");

const router = Router();

router.post("/ai-decision", validate(aiDecisionSchema), AiDecisionController.evaluate);

module.exports = router;
