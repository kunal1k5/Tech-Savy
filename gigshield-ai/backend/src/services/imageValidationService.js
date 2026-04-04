const aiService = require("../integrations/aiService");

const PROOF_TYPES = Object.freeze({
  PARCEL: "PARCEL",
  SELFIE: "SELFIE",
  WORK_SCREEN: "WORK_SCREEN",
});

function clamp(value, min = 0, max = 100) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function hasSignal(value, signals = []) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return signals.some((signal) => normalizedValue.includes(signal));
}

function normalizeProofType(value) {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return PROOF_TYPES[normalizedValue] || PROOF_TYPES.PARCEL;
}

function buildFallbackProofAnalysis({
  file,
  proofType,
  claimContext = {},
  weatherContext = {},
  duplicateFound = false,
}) {
  const fileName = String(file?.originalname || "").trim().toLowerCase();
  const weather = weatherContext?.weather || weatherContext || {};
  const rainLevel = Number(weather.rain ?? weather.rainfall_mm ?? 0) || 0;
  const missingExif =
    proofType === PROOF_TYPES.SELFIE
      ? !hasSignal(fileName, ["live", "camera", "selfie", "capture"])
      : hasSignal(fileName, ["gallery", "stale", "old"]);
  const captureAgeMinutes = hasSignal(fileName, ["gallery", "old", "stale", "late", "past"])
    ? 12
    : 2;
  const isLiveCapture = captureAgeMinutes <= 5 && !missingExif;
  const tamperingDetected = hasSignal(fileName, ["tamper", "edit", "manipulated"]);
  const aiGeneratedProbability = clamp(
    12 +
      (missingExif ? 18 : 0) +
      (duplicateFound ? 20 : 0) +
      (tamperingDetected ? 28 : 0) +
      (hasSignal(fileName, ["ai", "fake", "generated", "synthetic"]) ? 45 : 0) +
      (hasSignal(fileName, ["smooth", "perfect"]) ? 10 : 0)
  );
  const brightnessScore = hasSignal(fileName, ["dark", "night"]) ? 24 : hasSignal(fileName, ["bright", "sunny"]) ? 78 : 54;
  const outdoorProbability =
    proofType === PROOF_TYPES.SELFIE
      ? hasSignal(fileName, ["outdoor", "sky", "street", "rain"])
        ? 84
        : 46
      : 0;
  const rainExpected = rainLevel >= 3;
  const weatherMismatch =
    proofType === PROOF_TYPES.SELFIE &&
    ((rainExpected && hasSignal(fileName, ["dry", "indoor", "sunny"])) ||
      (!rainExpected && hasSignal(fileName, ["rain", "wet", "storm"])));

  const workKeywordHits = ["swiggy", "zomato", "delivery", "order", "active", "earnings"].filter(
    (keyword) => fileName.includes(keyword)
  );
  const workScreenValid =
    proofType !== PROOF_TYPES.WORK_SCREEN
      ? true
      : workKeywordHits.length > 0 && !hasSignal(fileName, ["offline", "idle", "closed", "home"]);
  const workTimestampMatch =
    proofType !== PROOF_TYPES.WORK_SCREEN || !hasSignal(fileName, ["old", "stale", "late", "past"]);
  const parcelValid =
    proofType !== PROOF_TYPES.PARCEL ? true : !hasSignal(fileName, ["blank", "blur", "cropped"]);

  return {
    proof_type: proofType,
    source: "node-fallback",
    image_forensics: {
      ai_generated_probability: aiGeneratedProbability,
      tampering_detected: tamperingDetected,
      duplicate_found: duplicateFound,
      missing_exif: missingExif,
      camera_metadata_present: !missingExif,
      capture_age_minutes: captureAgeMinutes,
      is_live_capture: isLiveCapture,
      metadata: {
        fallback: true,
        file_name: file?.originalname || "",
        mime_type: file?.mimetype || "",
        claim_timestamp: claimContext.claim_timestamp || null,
      },
      heuristics: {
        compression_suspicion: clamp(aiGeneratedProbability * 0.6),
        noise_score: clamp(100 - aiGeneratedProbability),
      },
    },
    weather_validation: {
      checked: proofType === PROOF_TYPES.SELFIE,
      mismatch: weatherMismatch,
      brightness_score: brightnessScore,
      outdoor_probability: outdoorProbability,
      rain_expected: rainExpected,
      reasons: weatherMismatch
        ? ["Fallback weather-image mismatch heuristic triggered."]
        : ["Weather heuristics did not find a mismatch."],
    },
    work_validation: {
      checked: proofType === PROOF_TYPES.WORK_SCREEN,
      valid: workScreenValid && workTimestampMatch,
      timestamp_match: workTimestampMatch,
      app_like_screen: workKeywordHits.length > 0,
      keyword_hits: workKeywordHits,
      ocr_text_excerpt: "",
      reasons:
        proofType === PROOF_TYPES.WORK_SCREEN
          ? workScreenValid && workTimestampMatch
            ? ["Work screen keywords and timing look consistent."]
            : ["Work screen failed keyword or timing heuristics."]
          : [],
    },
    parcel_validation: {
      checked: proofType === PROOF_TYPES.PARCEL,
      valid: parcelValid,
      screenshot_like: parcelValid,
      reasons:
        proofType === PROOF_TYPES.PARCEL
          ? parcelValid
            ? ["Parcel screenshot passed fallback screenshot heuristics."]
            : ["Parcel screenshot looks incomplete or manipulated."]
          : [],
    },
    analysis_flags: [
      ...(duplicateFound ? ["duplicate_found"] : []),
      ...(tamperingDetected ? ["tampering_detected"] : []),
      ...(isLiveCapture ? [] : ["not_live_capture"]),
      ...(weatherMismatch ? ["weather_mismatch"] : []),
      ...(!workScreenValid || !workTimestampMatch ? ["invalid_work_screen"] : []),
    ],
    notes: ["Python proof analyzer unavailable, local fallback heuristics applied."],
  };
}

async function analyzeProof({
  file,
  proofType,
  claimContext,
  weatherContext,
  duplicateFound = false,
  metadata = {},
}) {
  const normalizedProofType = normalizeProofType(proofType);

  try {
    const response = await aiService.analyzeProof({
      proof_type: normalizedProofType,
      file_name: file.originalname,
      mime_type: file.mimetype,
      file_base64: file.buffer.toString("base64"),
      context: {
        claim_context: claimContext,
        weather_context: weatherContext,
        duplicate_found: duplicateFound,
        metadata: {
          ...metadata,
          requested_at: new Date().toISOString(),
        },
      },
    });

    return {
      ...response,
      proof_type: response?.proof_type || normalizedProofType,
      source: response?.source || "python-proof-analyzer",
    };
  } catch (_error) {
    return buildFallbackProofAnalysis({
      file,
      proofType: normalizedProofType,
      claimContext,
      weatherContext,
      duplicateFound,
    });
  }
}

module.exports = {
  PROOF_TYPES,
  analyzeProof,
  buildFallbackProofAnalysis,
  normalizeProofType,
};
