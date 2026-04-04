const { receiveProofUpload } = require("../services/proofUpload.service");
const { sendSuccess } = require("../utils/apiResponse");

const ProofUploadController = {
  async upload(req, res, next) {
    try {
      const result = receiveProofUpload({
        disputeId: req.body.disputeId,
        geoImage: req.files?.geoImage?.[0],
        workScreenshot: req.files?.workScreenshot?.[0],
      });

      return sendSuccess(res, result, "Proof uploaded successfully.");
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = ProofUploadController;
