/**
 * Global Error Handler Middleware
 *
 * Catches all errors propagated via next(err) and returns
 * a consistent JSON error response.
 */

const logger = require("../utils/logger");

function errorHandler(err, _req, res, _next) {
  logger.error(err.message, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
}

module.exports = { errorHandler };
