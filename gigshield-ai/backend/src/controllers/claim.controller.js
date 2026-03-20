/**
 * Claim Controller — Claims listing and manual processing
 */

const ClaimService = require("../services/claim.service");

const ClaimController = {
  async getMyClaims(req, res, next) {
    try {
      const claims = await ClaimService.getWorkerClaims(req.user.id);
      res.json({ data: claims });
    } catch (err) {
      next(err);
    }
  },

  async processClaim(req, res, next) {
    try {
      const claim = await ClaimService.processClaim(req.params.id);
      res.json({ message: "Claim processed", data: claim });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ClaimController;
