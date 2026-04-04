const { Router } = require("express");

const AiDecisionController = require("../controllers/aiDecision.controller");

const router = Router();

router.post("/ai-decision", AiDecisionController.evaluate);

module.exports = router;
