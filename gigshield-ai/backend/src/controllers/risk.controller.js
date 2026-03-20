/**
 * Risk Controller — Risk assessment endpoints
 */

const RiskService = require("../services/risk.service");

const RiskController = {
  async assess(req, res, next) {
    try {
      const assessment = await RiskService.assessRisk(req.user.id);
      res.json({ data: assessment });
    } catch (err) {
      next(err);
    }
  },

  async getLatest(req, res, next) {
    try {
      const assessment = await RiskService.getLatestAssessment(req.user.id);
      if (!assessment) {
        return res.status(404).json({ error: "No risk assessment found" });
      }
      res.json({ data: assessment });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = RiskController;
