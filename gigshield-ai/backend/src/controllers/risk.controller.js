/**
 * Risk Controller — Risk assessment endpoints
 */

const RiskService = require("../services/risk.service");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const RiskController = {
  async assess(req, res, next) {
    try {
      const assessment = await RiskService.assessRisk(req.user.id);
      return sendSuccess(res, assessment, "Risk assessment completed successfully.");
    } catch (err) {
      next(err);
    }
  },

  async getLatest(req, res, next) {
    try {
      const assessment = await RiskService.getLatestAssessment(req.user.id);
      if (!assessment) {
        return sendError(res, 404, "No risk assessment found");
      }
      return sendSuccess(res, assessment, "Latest risk assessment loaded successfully.");
    } catch (err) {
      next(err);
    }
  },
};

module.exports = RiskController;
