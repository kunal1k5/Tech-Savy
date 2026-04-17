/**
 * GigPredict AI — Express Server Entry Point
 *
 * Bootstraps the Express application, connects to PostgreSQL,
 * registers all route modules, and starts listening.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Prefer backend/.env so startup does not depend on the repo folder name.
[
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
].forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
});

const app = require("./app");
const { pool, testConnection } = require("./database/connection");
const { closeMongo, connectMongo } = require("./database/mongo");
const logger = require("./utils/logger");
const TriggerService = require("./services/trigger.service");

const PORT = process.env.PORT || 5000;

function clampMonitoringInterval(intervalMs) {
  const numericInterval = Number(intervalMs);
  if (!Number.isFinite(numericInterval)) {
    return 20000;
  }

  return Math.max(15000, Math.min(numericInterval, 30000));
}

async function startServer() {
  // Start even when PostgreSQL is unavailable so the API can run with in-memory fallbacks.
  try {
    await testConnection();
  } catch (err) {
    logger.warn("Database unavailable. Running with in-memory fallbacks and no persistence.");
    logger.warn(`   DB error: ${err.message}`);
  }

  try {
    await connectMongo();
  } catch (err) {
    logger.warn("MongoDB unavailable. Demo flows will continue with in-memory fallback storage.");
    logger.warn(`   Mongo error: ${err.message}`);
  }

  app.listen(PORT, () => {
    logger.info(`GigShield AI backend running on port ${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);

    const monitorIntervalMs = clampMonitoringInterval(
      process.env.TRIGGER_MONITOR_INTERVAL_MS || 20000
    );
    TriggerService.startAutoMonitoringLoop({ intervalMs: monitorIntervalMs });
    logger.info(`Trigger monitoring loop started (${monitorIntervalMs} ms interval).`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down gracefully.");
  TriggerService.stopAutoMonitoringLoop();
  try { await pool.end(); } catch (_) { /* pool may not be connected */ }
  try { await closeMongo(); } catch (_) { /* mongo may not be connected */ }
  process.exit(0);
});

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

