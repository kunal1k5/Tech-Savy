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
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Start even when PostgreSQL is unavailable so the API can run with in-memory fallbacks.
  try {
    await testConnection();
  } catch (err) {
    logger.warn("Database unavailable. Running with in-memory fallbacks and no persistence.");
    logger.warn(`   DB error: ${err.message}`);
  }

  app.listen(PORT, () => {
    logger.info(`GigShield AI backend running on port ${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down gracefully.");
  try { await pool.end(); } catch (_) { /* pool may not be connected */ }
  process.exit(0);
});

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

