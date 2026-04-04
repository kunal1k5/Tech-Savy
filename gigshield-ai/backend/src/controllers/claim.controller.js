/**
 * Claim Controller — Claims listing and manual processing
 */

const ClaimService = require("../services/claim.service");
const { sendSuccess } = require("../utils/apiResponse");

const ClaimController = {
  async getMyClaims(req, res, next) {
    try {
      const claims = await ClaimService.getWorkerClaims(req.user.id);
      return sendSuccess(res, claims, "Claims loaded successfully.");
    } catch (err) {
      next(err);
    }
  },

  async processClaim(req, res, next) {
    try {
      const claim = await ClaimService.processClaim(req.params.id);
      return sendSuccess(res, claim, "Claim processed successfully.");
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ClaimController;
