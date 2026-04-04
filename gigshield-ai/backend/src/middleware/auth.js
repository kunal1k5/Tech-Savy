/**
 * JWT Authentication Middleware
 *
 * Verifies the Bearer token from the Authorization header
 * and attaches the decoded payload to req.user.
 */

const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/apiResponse");

const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret";

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Authentication required");
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return sendError(res, 401, "Invalid or expired token");
  }
}

/**
 * Role-based authorization middleware factory.
 * Usage: authorize('super_admin', 'analyst')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, "Insufficient permissions");
    }
    next();
  };
}

module.exports = { authenticate, authorize };
