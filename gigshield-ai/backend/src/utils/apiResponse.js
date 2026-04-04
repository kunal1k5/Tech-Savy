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
    data: null,
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

module.exports = {
  sendError,
  sendSuccess,
};
