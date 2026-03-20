/**
 * Admin Routes
 *
 * GET /api/admin/dashboard       — Aggregated platform statistics
 * GET /api/admin/triggers/recent — Recent parametric trigger events
 * GET /api/admin/claims/flagged  — Claims flagged for manual review
 */

const { Router } = require("express");
const AdminController = require("../controllers/admin.controller");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize("super_admin", "analyst", "support"));

router.get("/dashboard", AdminController.getDashboardStats);
router.get("/triggers/recent", AdminController.getRecentTriggers);
router.get("/claims/flagged", AdminController.getFlaggedClaims);

module.exports = router;
