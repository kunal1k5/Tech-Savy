/**
 * Winston Logger
 *
 * Centralised logging for the backend. Logs to console in dev,
 * and can be extended to file / external service in production.
 */

const { createLogger, format, transports } = require("winston");
const isTestEnvironment = process.env.NODE_ENV === "test";

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new transports.Console({ silent: isTestEnvironment })],
});

module.exports = logger;
