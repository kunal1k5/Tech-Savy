/**
 * Request Validation Middleware Factory
 *
 * Uses Joi schemas to validate req.body, req.params, or req.query.
 * Returns 400 with clear error messages on validation failure.
 */

const { sendHandledError } = require("../utils/apiResponse");

function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return sendHandledError(res, 400, { details: messages });
    }

    req[property] = value;
    next();
  };
}

module.exports = { validate };
