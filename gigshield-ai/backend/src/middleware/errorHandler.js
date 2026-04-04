/**
 * Global Error Handler Middleware
 *
 * Catches all errors propagated via next(err) and returns
 * a consistent JSON error response.
 */

const logger = require("../utils/logger");
const { sendHandledError } = require("../utils/apiResponse");

function errorHandler(err, _req, res, _next) {
  logger.error(err.message, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  return sendHandledError(res, statusCode, {
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { errorHandler };
