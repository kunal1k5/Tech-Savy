const { createAiDecision } = require("../services/aiDecision.service");
const { sendHandledError, sendSuccess } = require("../utils/apiResponse");

const AiDecisionController = {
  async evaluate(req, res, next) {
    try {
      const decision = createAiDecision(req.body);
      return sendSuccess(res, decision, "AI decision generated successfully.");
    } catch (error) {
      return sendHandledError(res, error.statusCode || 500);
    }
  },
};

module.exports = AiDecisionController;
