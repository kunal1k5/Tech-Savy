const Joi = require("joi");

const { attachProofUpload, getDisputeById } = require("./dispute.service");

const uploadProofSchema = Joi.object({
  disputeId: Joi.string().trim().required(),
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

function receiveProofUpload({ disputeId, geoImage, workScreenshot }) {
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

module.exports = {
  receiveProofUpload,
  uploadProofSchema,
};
