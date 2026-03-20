/**
 * PostgreSQL Connection Pool
 *
 * Uses the 'pg' library to create a shared connection pool.
 * All database queries throughout the backend use this pool.
 */

const { Pool } = require("pg");
const logger = require("../utils/logger");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || "gigshield",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error:", err);
});

/**
 * Verify database connectivity at startup.
 */
async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW()");
    logger.info(`Database connected — server time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection };
