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
const riskRoutes = require("./routes/risk.routes");

// Middleware
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

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
app.use("/api/risk", riskRoutes);

// ── 404 Catch-All ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
