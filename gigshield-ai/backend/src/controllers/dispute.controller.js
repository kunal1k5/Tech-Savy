const { startDispute } = require("../services/dispute.service");
const { sendSuccess } = require("../utils/apiResponse");

const DisputeController = {
  async start(req, res, next) {
    try {
      const result = startDispute(req.body);
      return sendSuccess(res, result, "Dispute started successfully.", 201);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = DisputeController;
