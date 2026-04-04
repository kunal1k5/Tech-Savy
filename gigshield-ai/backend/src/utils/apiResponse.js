function sendSuccess(res, data = {}, message = "Request completed successfully.", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

function sendError(res, statusCode = 500, message = "Internal Server Error", options = {}) {
  const payload = {
    success: false,
    data: options.data && typeof options.data === "object" && !Array.isArray(options.data) ? options.data : {},
    message,
  };

  if (options.details !== undefined) {
    payload.details = options.details;
  }

  if (options.stack !== undefined) {
    payload.stack = options.stack;
  }

  return res.status(statusCode).json(payload);
}

function sendHandledError(res, statusCode = 500, details) {
  return sendError(res, statusCode, "Handled safely", {
    data: {},
    ...(details !== undefined ? { details } : {}),
  });
}

module.exports = {
  sendError,
  sendHandledError,
  sendSuccess,
};
