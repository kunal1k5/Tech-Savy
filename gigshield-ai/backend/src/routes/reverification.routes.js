const { Router } = require("express");

const ReverificationController = require("../controllers/reverification.controller");
const { validate } = require("../middleware/validate");
const { reverifyClaimSchema } = require("../services/reverification.service");

const router = Router();

router.post("/reverify-claim", validate(reverifyClaimSchema), ReverificationController.review);

module.exports = router;
