const { Router } = require("express");

const DisputeController = require("../controllers/dispute.controller");
const { validate } = require("../middleware/validate");
const { startDisputeSchema } = require("../services/dispute.service");

const router = Router();

router.post("/start-dispute", validate(startDisputeSchema), DisputeController.start);

module.exports = router;
