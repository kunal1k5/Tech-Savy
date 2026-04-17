const { receiveProofUpload } = require("../services/proofUpload.service");
const { verifyWorkProfileScreenshot } = require("../services/workProfileFraud.service");
const { sendSuccess } = require("../utils/apiResponse");

function resolvePrimaryProofFile(req) {
  return (
    req.files?.file?.[0] ||
    req.files?.parcelScreenshot?.[0] ||
    req.files?.liveSelfie?.[0] ||
    req.files?.workScreen?.[0] ||
    req.files?.selfie?.[0] ||
    null
  );
}

function inferProofType(req) {
  if (req.body.proof_type || req.body.proofType) {
    return req.body.proof_type || req.body.proofType;
  }

  if (req.files?.parcelScreenshot?.length) {
    return "PARCEL";
  }

  if (req.files?.liveSelfie?.length || req.files?.selfie?.length) {
    return "SELFIE";
  }

  if (req.files?.workScreen?.length) {
    return "WORK_SCREEN";
  }

  return undefined;
}

const ProofUploadController = {
  async verifyWorkProfile(req, res, next) {
    try {
      const result = await verifyWorkProfileScreenshot({
        file: req.file || req.files?.file?.[0] || req.files?.workScreenshot?.[0],
        name: req.body.name,
        city: req.body.city,
        workType: req.body.workType || req.body.work_type,
        ocrText: req.body.ocrText,
        metadataJson: req.body.metadata_json,
      });

      return sendSuccess(res, result, "Work profile proof analyzed successfully.");
    } catch (error) {
      return next(error);
    }
  },

  async upload(req, res, next) {
    try {
      const result = await receiveProofUpload({
        disputeId: req.body.disputeId,
        userId: req.body.user_id || req.body.userId,
        claimId: req.body.claim_id || req.body.claimId,
        proofType: inferProofType(req),
        file: resolvePrimaryProofFile(req),
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        claimTime: req.body.claim_time || req.body.claimTime,
        city: req.body.city,
        zone: req.body.zone,
        metadataJson: req.body.metadata_json,
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
