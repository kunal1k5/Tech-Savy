const { reverifyClaim } = require("../services/reverification.service");
const { sendSuccess } = require("../utils/apiResponse");

const ReverificationController = {
  async review(req, res, next) {
    try {
      const result = reverifyClaim(req.body);
      return sendSuccess(res, result, "Claim re-verification completed.");
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = ReverificationController;
