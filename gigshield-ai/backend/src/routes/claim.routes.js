/**
 * Claim Routes
 *
 * GET  /api/claims/my          — Get all claims for authenticated worker
 * POST /api/claims/:id/process — Process a pending claim (admin)
 */

const { Router } = require("express");
const ClaimController = require("../controllers/claim.controller");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();

router.get("/my", authenticate, ClaimController.getMyClaims);
router.post("/:id/process", authenticate, authorize("super_admin", "analyst"), ClaimController.processClaim);

module.exports = router;
