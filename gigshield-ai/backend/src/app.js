/**
 * GigShield AI — Express Application Setup
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
const fraudOrchestratorRoutes = require("./routes/fraudOrchestrator.routes");
const riskRoutes = require("./routes/risk.routes");
const demoRoutes = require("./routes/demo.routes");
const locationFlowRoutes = require("./routes/locationFlow.routes");
const premiumFlowRoutes = require("./routes/premiumFlow.routes");
const testFlowRoutes = require("./routes/testFlow.routes");

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
    "http://127.0.0.1:3000",
    ...configuredOrigins,
  ]);
}

const allowedOrigins = getAllowedOrigins();

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// ── Rate Limiting ───────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || (isProduction ? 1000 : 5000)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Slow down for a moment and try again.",
  },
  skip(req) {
    return req.path === "/health" || (!isProduction && isLocalRequest(req));
  },
});
app.use("/api", limiter);

// ── Health Check ────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "gigshield-ai-backend", timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────
app.use("/api/workers", workerRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", behaviorRoutes);
app.use("/api", fraudOrchestratorRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api", demoRoutes);
app.use("/api", locationFlowRoutes);
app.use("/api", premiumFlowRoutes);
app.use("/", behaviorRoutes);
app.use("/", fraudOrchestratorRoutes);
app.use("/", locationFlowRoutes);
app.use("/", premiumFlowRoutes);
app.use("/", testFlowRoutes);

// ── 404 Catch-All ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
