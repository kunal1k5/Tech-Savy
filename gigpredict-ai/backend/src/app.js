/**
 * GigPredict AI — Express Application Setup
 *
 * Configures middleware stack, mounts API routes, and sets up
 * global error handling. Exported separately from server.js to
 * enable independent testing with supertest.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// Route modules
const workerRoutes = require("./routes/worker.routes");
const policyRoutes = require("./routes/policy.routes");
const claimRoutes = require("./routes/claim.routes");
const triggerRoutes = require("./routes/trigger.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminRoutes = require("./routes/admin.routes");
const behaviorRoutes = require("./routes/behavior.routes");
const autoClaimRoutes = require("./routes/autoClaim.routes");
const fraudOrchestratorRoutes = require("./routes/fraudOrchestrator.routes");
const riskRoutes = require("./routes/risk.routes");
const sessionRoutes = require("./routes/demo.routes");
const locationFlowRoutes = require("./routes/locationFlow.routes");
const premiumFlowRoutes = require("./routes/premiumFlow.routes");
const riskPremiumRoutes = require("./routes/riskPremium.routes");
const aiProxyRoutes = require("./routes/aiProxy.routes");
const testFlowRoutes = require("./routes/testFlow.routes");
const aiDecisionRoutes = require("./routes/aiDecision.routes");
const disputeRoutes = require("./routes/dispute.routes");
const proofUploadRoutes = require("./routes/proofUpload.routes");
const reverificationRoutes = require("./routes/reverification.routes");
const activityRoutes = require("./routes/activity.routes");
const fraudAnalysisRoutes = require("./routes/fraudAnalysis.routes");
const { sendError, sendSuccess } = require("./utils/apiResponse");

// Middleware
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("etag", false);

function isLoopbackIp(value) {
  const normalizedValue = String(value || "").trim();
  return (
    normalizedValue === "::1" ||
    normalizedValue === "127.0.0.1" ||
    normalizedValue.startsWith("::ffff:127.0.0.1")
  );
}

function isLocalRequest(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  const hostname = String(req.hostname || "");

  return (
    isLoopbackIp(req.ip) ||
    forwardedFor.some(isLoopbackIp) ||
    origin.startsWith("http://localhost:3000") ||
    origin.startsWith("http://127.0.0.1:3000") ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    ...configuredOrigins,
  ]);
}

const allowedOrigins = getAllowedOrigins();

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || "").trim());
}

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
}));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Rate Limiting ───────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || (isProduction ? 1000 : 5000)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: {},
    message: "Handled safely",
  },
  skip(req) {
    return req.path === "/health" || (!isProduction && isLocalRequest(req));
  },
});
app.use("/api", limiter);

// ── Health Check ────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  return sendSuccess(
    res,
    {
      status: "ok",
      service: "gigpredict-ai-backend",
      timestamp: new Date().toISOString(),
    },
    "Health check passed."
  );
});

// ── API Routes ──────────────────────────────────────────────
app.use("/api/workers", workerRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", behaviorRoutes);
app.use("/api", autoClaimRoutes);
app.use("/api", fraudOrchestratorRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api", sessionRoutes);
app.use("/api", locationFlowRoutes);
app.use("/api", premiumFlowRoutes);
app.use("/api", riskPremiumRoutes);
app.use("/api", aiProxyRoutes);
app.use("/api", testFlowRoutes);
app.use("/api", aiDecisionRoutes);
app.use("/api", disputeRoutes);
app.use("/api", proofUploadRoutes);
app.use("/api", reverificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/fraud", fraudAnalysisRoutes);

// ── 404 Catch-All ───────────────────────────────────────────
app.use((_req, res) => {
  return sendError(res, 404, "Route not found");
});

// ── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;

