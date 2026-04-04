const Joi = require("joi");

const {
  attachReverificationResult,
  getDisputeById,
} = require("./dispute.service");

const REVERIFICATION_OUTCOMES = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

const REVERIFICATION_SCORE_RULES = Object.freeze({
  locationMatch: 30,
  timeMatch: 20,
  activityValid: 30,
});

const reverifyClaimSchema = Joi.object({
  disputeId: Joi.string().trim().required(),
  claimTime: Joi.string().trim().required(),
  userLocation: Joi.string().trim().required(),
  geoImage: Joi.any().optional(),
  workScreenshot: Joi.any().optional(),
});

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function fileNameHasSignal(fileName, signals) {
  const normalizedName = normalizeText(fileName);
  return signals.some((signal) => normalizedName.includes(signal));
}

function simulateExtractedLocation(geoImage, userLocation) {
  const fileName = geoImage?.originalName || "";
  const mismatchSignals = ["outside", "wrong", "mismatch", "spoof", "other-zone"];

  if (fileNameHasSignal(fileName, mismatchSignals)) {
    return "Zone-X";
  }

  return String(userLocation || "").trim();
}

function simulateExtractedTimestamp(geoImage, claimTime) {
  const fileName = geoImage?.originalName || "";
  const mismatchSignals = ["late", "old", "delay", "stale", "past"];

  if (fileNameHasSignal(fileName, mismatchSignals)) {
    return "12:00";
  }

  return String(claimTime || "").trim();
}

function simulateActivityValidity(workScreenshot) {
  const fileName = workScreenshot?.originalName || "";
  const invalidSignals = ["offline", "idle", "closed", "inactive", "home"];

  return !fileNameHasSignal(fileName, invalidSignals);
}

function calculateReverificationScore({ locationMatch, timeMatch, activityValid }) {
  let score = 0;

  if (locationMatch) {
    score += REVERIFICATION_SCORE_RULES.locationMatch;
  }

  if (timeMatch) {
    score += REVERIFICATION_SCORE_RULES.timeMatch;
  }

  if (activityValid) {
    score += REVERIFICATION_SCORE_RULES.activityValid;
  }

  return score;
}

function getFinalStatus(score) {
  return score > 60
    ? REVERIFICATION_OUTCOMES.APPROVED
    : REVERIFICATION_OUTCOMES.REJECTED;
}

function calculateConfidence(score) {
  return Math.min(score + 5, 100);
}

function buildClaimUpdate(finalStatus) {
  if (finalStatus === REVERIFICATION_OUTCOMES.APPROVED) {
    return {
      claimStatus: "PAID",
      payoutStatus: "PAYOUT_RELEASED",
      fraudStatus: "verified",
    };
  }

  return {
    claimStatus: "REJECTED",
    payoutStatus: "BLOCKED",
    fraudStatus: "flagged",
  };
}

function reverifyClaim({ disputeId, claimTime, userLocation }) {
  const dispute = getDisputeById(disputeId);
  if (!dispute) {
    throw createHttpError("Dispute not found.", 404);
  }

  if (!dispute.proof?.geoImage || !dispute.proof?.workScreenshot) {
    throw createHttpError("Proof upload is required before re-verification.", 400);
  }

  const extractedLocation = simulateExtractedLocation(dispute.proof.geoImage, userLocation);
  const extractedTimestamp = simulateExtractedTimestamp(dispute.proof.geoImage, claimTime);
  const activityValid = simulateActivityValidity(dispute.proof.workScreenshot);
  const locationMatch = normalizeText(extractedLocation) === normalizeText(userLocation);
  const timeMatch = normalizeText(extractedTimestamp) === normalizeText(claimTime);
  const score = calculateReverificationScore({
    locationMatch,
    timeMatch,
    activityValid,
  });
  const finalStatus = getFinalStatus(score);
  const confidence = calculateConfidence(score);
  const claimUpdate = buildClaimUpdate(finalStatus);

  attachReverificationResult(disputeId, {
    finalStatus,
    confidence,
    score,
    checks: {
      locationMatch,
      timeMatch,
      activityValid,
    },
    extracted: {
      location: extractedLocation,
      timestamp: extractedTimestamp,
    },
    claimUpdate,
  });

  return {
    finalStatus,
    confidence,
    claimUpdate,
  };
}

module.exports = {
  REVERIFICATION_OUTCOMES,
  REVERIFICATION_SCORE_RULES,
  calculateConfidence,
  calculateReverificationScore,
  getFinalStatus,
  reverifyClaim,
  reverifyClaimSchema,
};
