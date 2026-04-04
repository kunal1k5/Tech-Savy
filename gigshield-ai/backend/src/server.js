/**
 * GigShield AI — Express Server Entry Point
 *
 * Bootstraps the Express application, connects to PostgreSQL,
 * registers all route modules, and starts listening.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const app = require("./app");
const { pool, testConnection } = require("./database/connection");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Try to connect to database, but start server even if DB is unavailable (demo mode)
  try {
    await testConnection();
  } catch (err) {
    logger.warn("⚠️  Database unavailable — running in DEMO MODE (no persistence)");
    logger.warn(`   DB error: ${err.message}`);
  }

  app.listen(PORT, () => {
    logger.info(`🚀 GigShield AI Backend running on port ${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down gracefully");
  try { await pool.end(); } catch (_) { /* pool may not be connected */ }
  process.exit(0);
});

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
