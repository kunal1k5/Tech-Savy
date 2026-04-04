const { createAiDecision } = require("../services/aiDecision.service");
const { sendSuccess } = require("../utils/apiResponse");

const AiDecisionController = {
  async evaluate(req, res, next) {
    try {
      const decision = createAiDecision(req.body);
      return sendSuccess(res, decision, "AI decision generated successfully.");
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = AiDecisionController;
