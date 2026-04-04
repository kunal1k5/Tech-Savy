const Joi = require("joi");

const { attachProofUpload, getDisputeById } = require("./dispute.service");
const { uploadProofAndAnalyze } = require("./proofService");

const uploadProofSchema = Joi.object({
  disputeId: Joi.string().trim().optional(),
  user_id: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional(),
  claim_id: Joi.string().trim().optional(),
  claimId: Joi.string().trim().optional(),
  proof_type: Joi.string().trim().valid("PARCEL", "SELFIE", "WORK_SCREEN").optional(),
  proofType: Joi.string().trim().valid("PARCEL", "SELFIE", "WORK_SCREEN").optional(),
  claim_time: Joi.string().isoDate().optional(),
  claimTime: Joi.string().isoDate().optional(),
  latitude: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, "").optional(),
  longitude: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, "").optional(),
  city: Joi.string().allow("", null).optional(),
  zone: Joi.string().allow("", null).optional(),
  metadata_json: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
}).custom((value, helpers) => {
  if (value.disputeId) {
    return value;
  }

  if (!(value.user_id || value.userId)) {
    return helpers.error("any.custom", { message: "user_id is required." });
  }

  if (!(value.claim_id || value.claimId)) {
    return helpers.error("any.custom", { message: "claim_id is required." });
  }

  if (!(value.proof_type || value.proofType)) {
    return helpers.error("any.custom", { message: "proof_type is required." });
  }

  return value;
}, "proof upload contract").messages({
  "any.custom": "{{#message}}",
});

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateImageFile(file, fieldLabel) {
  if (!file) {
    throw createHttpError(`${fieldLabel} is required.`, 400);
  }

  if (!String(file.mimetype || "").startsWith("image/")) {
    throw createHttpError(`${fieldLabel} must be an image file.`, 400);
  }
}

function toStoredFileMeta(file) {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

async function receiveProofUpload({
  disputeId,
  userId,
  claimId,
  proofType,
  file,
  latitude,
  longitude,
  claimTime,
  city,
  zone,
  metadataJson,
  geoImage,
  workScreenshot,
}) {
  if (disputeId) {
    const dispute = getDisputeById(disputeId);
    if (!dispute) {
      throw createHttpError("Dispute not found.", 404);
    }

    validateImageFile(geoImage, "Geo-location image");
    validateImageFile(workScreenshot, "Work app screenshot");

    attachProofUpload(disputeId, {
      geoImage: toStoredFileMeta(geoImage),
      workScreenshot: toStoredFileMeta(workScreenshot),
    });

    return {
      status: "RECEIVED",
    };
  }

  validateImageFile(file, "Proof image");

  return uploadProofAndAnalyze({
    userId,
    claimId,
    proofType,
    file,
    latitude,
    longitude,
    claimTime,
    city,
    zone,
    metadataJson,
  });
}

module.exports = {
  receiveProofUpload,
  uploadProofSchema,
};
