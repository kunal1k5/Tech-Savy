const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const { pool } = require("../database/connection");
const aiService = require("../integrations/aiService");
const ClaimModel = require("../models/claim.model");
const logger = require("../utils/logger");
const { createClaimDecision } = require("./aiDecision.service");
const { analyzeProof, normalizeProofType } = require("./imageValidationService");
const { buildWarnings } = require("./warningService");

const PROOF_UPLOAD_DIR = path.resolve(__dirname, "../../uploads/proofs");
const DEFAULT_CITY = process.env.DEFAULT_WEATHER_CITY || "Bengaluru";
const DEFAULT_ZONE = process.env.DEFAULT_WORK_ZONE || "Central";
const DEFAULT_COORDINATES = Object.freeze({
  Bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  Bangalore: { latitude: 12.9716, longitude: 77.5946 },
  Delhi: { latitude: 28.6139, longitude: 77.209 },
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
});

const memoryStore = {
  proofs: new Map(),
  analyses: new Map(),
  hashes: new Map(),
  logs: [],
};

function createHttpError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeJsonParse(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function ensureImageFile(file) {
  if (!file) {
    throw createHttpError("Proof file is required.", 400);
  }

  if (!String(file.mimetype || "").startsWith("image/")) {
    throw createHttpError("Proof file must be an image.", 400);
  }
}

async function ensureUploadDir() {
  await fs.mkdir(PROOF_UPLOAD_DIR, { recursive: true });
}

function getDefaultCoordinates(city) {
  return DEFAULT_COORDINATES[city] || DEFAULT_COORDINATES[DEFAULT_CITY] || {
    latitude: 12.9716,
    longitude: 77.5946,
  };
}

function buildStoredFileName({ proofId, claimId, proofType, originalName }) {
  const extension = path.extname(originalName || "").toLowerCase() || ".bin";
  const safeClaimId = normalizeString(claimId, "claim").replace(/[^a-z0-9_-]/gi, "-");
  return `${safeClaimId}-${proofType.toLowerCase()}-${proofId}${extension}`;
}

async function writeProofFile({ proofId, claimId, proofType, file }) {
  await ensureUploadDir();
  const fileName = buildStoredFileName({
    proofId,
    claimId,
    proofType,
    originalName: file.originalname,
  });
  const absolutePath = path.join(PROOF_UPLOAD_DIR, fileName);
  await fs.writeFile(absolutePath, file.buffer);

  return {
    absolutePath,
    relativePath: path.posix.join("uploads", "proofs", fileName),
  };
}

async function safeQuery(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    logger.warn(`Proof pipeline DB fallback activated: ${error.message}`);
    return null;
  }
}

async function resolveWorkerContext(userId) {
  if (!isUuid(userId)) {
    return null;
  }

  const result = await safeQuery(
    `SELECT id, city, zone
     FROM workers
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result?.rows?.[0] || null;
}

async function resolveClaimContext({
  userId,
  claimId,
  claimTime,
  latitude,
  longitude,
  city,
  zone,
}) {
  const normalizedClaimId = normalizeString(claimId, `demo-claim-${Date.now()}`);
  const normalizedUserId = normalizeString(userId, "demo-user");

  if (isUuid(normalizedClaimId)) {
    const claimResult = await safeQuery(
      `SELECT c.id,
              c.worker_id,
              c.created_at AS claim_timestamp,
              c.fraud_score,
              w.city,
              w.zone
       FROM claims c
       LEFT JOIN workers w ON w.id = c.worker_id
       WHERE c.id = $1
       LIMIT 1`,
      [normalizedClaimId]
    );

    const row = claimResult?.rows?.[0];
    if (row) {
      const coordinates = getDefaultCoordinates(row.city || city || DEFAULT_CITY);
      return {
        claim_id: row.id,
        user_id: row.worker_id || normalizedUserId,
        claim_timestamp: row.claim_timestamp ? new Date(row.claim_timestamp).toISOString() : nowIso(),
        city: row.city || city || DEFAULT_CITY,
        zone: row.zone || zone || DEFAULT_ZONE,
        latitude: normalizeNumber(latitude, coordinates.latitude),
        longitude: normalizeNumber(longitude, coordinates.longitude),
        existing_fraud_score: normalizeNumber(row.fraud_score, 0) || 0,
        persisted: true,
      };
    }
  }

  const worker = await resolveWorkerContext(normalizedUserId);
  const resolvedCity = city || worker?.city || DEFAULT_CITY;
  const resolvedZone = zone || worker?.zone || DEFAULT_ZONE;
  const coordinates = getDefaultCoordinates(resolvedCity);

  return {
    claim_id: normalizedClaimId,
    user_id: worker?.id || normalizedUserId,
    claim_timestamp: normalizeString(claimTime, nowIso()),
    city: resolvedCity,
    zone: resolvedZone,
    latitude: normalizeNumber(latitude, coordinates.latitude),
    longitude: normalizeNumber(longitude, coordinates.longitude),
    existing_fraud_score: 0,
    persisted: false,
  };
}

async function resolveWeatherContext(claimContext) {
  try {
    return await aiService.fetchWeather(claimContext.city || DEFAULT_CITY);
  } catch (_error) {
    return {
      city: claimContext.city || DEFAULT_CITY,
      source: "proof-service-fallback",
      weather: {
        temperature: 27,
        humidity: 72,
        rain: claimContext.city === "Mumbai" ? 7 : 1,
        cloud: 58,
        wind: 14,
        pm25: 42,
        pm10: 64,
      },
    };
  }
}

async function lookupDuplicateHash(fileHash) {
  const memoryMatch = memoryStore.hashes.get(fileHash);
  if (memoryMatch) {
    return {
      duplicateFound: true,
      existing: memoryMatch,
    };
  }

  const result = await safeQuery(
    `SELECT proof_id, claim_id, user_id, image_hash
     FROM image_hashes
     WHERE image_hash = $1
     LIMIT 1`,
    [fileHash]
  );
  const existing = result?.rows?.[0] || null;

  return {
    duplicateFound: Boolean(existing),
    existing,
  };
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function validateActivity({ userId, claimTimestamp, fileName }) {
  const claimTime = new Date(claimTimestamp);
  const fallbackInactive = /idle|offline|closed|home/i.test(String(fileName || ""));

  if (!isUuid(userId)) {
    return {
      was_active: !fallbackInactive,
      within_working_hours: !fallbackInactive,
      activities_count: fallbackInactive ? 0 : 3,
      movement_detected: !fallbackInactive,
      reason: fallbackInactive
        ? "Fallback activity heuristic marked the worker inactive."
        : "Demo activity heuristic assumes the worker was active.",
    };
  }

  const activityResult = await safeQuery(
    `SELECT motion_state, speed_kmh, timestamp
     FROM activity_logs
     WHERE worker_id = $1
       AND timestamp BETWEEN $2::timestamptz - INTERVAL '30 minutes'
                         AND $2::timestamptz + INTERVAL '30 minutes'
     ORDER BY timestamp ASC`,
    [userId, claimTime.toISOString()]
  );
  const activityRows = activityResult?.rows || [];

  const movementDetected = activityRows.some((row) => {
    const speed = normalizeNumber(row.speed_kmh, 0) || 0;
    const state = String(row.motion_state || "").toUpperCase();
    return speed > 4 || state === "DRIVING" || state === "WALKING";
  });

  const workSessionResult = await safeQuery(
    `SELECT id, start_time, end_time
     FROM work_sessions
     WHERE worker_id = $1
       AND start_time <= $2::timestamptz
       AND COALESCE(end_time, NOW()) >= $2::timestamptz
     ORDER BY start_time DESC
     LIMIT 1`,
    [userId, claimTime.toISOString()]
  );
  const overlappingSession = workSessionResult?.rows?.[0] || null;

  return {
    was_active: movementDetected && activityRows.length > 0,
    within_working_hours: Boolean(overlappingSession),
    activities_count: activityRows.length,
    movement_detected: movementDetected,
    overlapping_session_id: overlappingSession?.id || null,
    reason:
      activityRows.length === 0
        ? "No activity logs were recorded near the claim time."
        : !movementDetected
          ? "Activity logs show no meaningful movement near the claim time."
          : overlappingSession
            ? "Activity and work session logs support the claim."
            : "Activity exists, but the claim time sits outside tracked work sessions.",
  };
}

async function getTrustScore(userId) {
  if (!isUuid(userId)) {
    return { score: 50, source: "fallback" };
  }

  const result = await safeQuery(
    `SELECT score
     FROM user_trust_score
     WHERE worker_id = $1
     LIMIT 1`,
    [userId]
  );

  return {
    score: normalizeNumber(result?.rows?.[0]?.score, 50) || 50,
    source: result?.rows?.length ? "database" : "fallback",
  };
}

async function calculateAnomalyScore({ userId, claimContext }) {
  if (!isUuid(userId)) {
    return {
      anomaly_score: 12,
      reasons: ["Using demo anomaly baseline because no persisted worker record exists."],
    };
  }

  const reasons = [];
  let anomalyScore = 0;

  const recentClaimResult = await safeQuery(
    `SELECT COUNT(*)::int AS count
     FROM claims
     WHERE worker_id = $1
       AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  const recentClaims = recentClaimResult?.rows?.[0]?.count || 0;

  if (recentClaims > 3) {
    anomalyScore += 35;
    reasons.push(`High claim frequency detected: ${recentClaims} claims in the last 24 hours.`);
  }

  const nearbyProofResult = await safeQuery(
    `SELECT lat, lng
     FROM proofs
     WHERE user_id = $1
       AND timestamp >= NOW() - INTERVAL '7 days'
       AND lat IS NOT NULL
       AND lng IS NOT NULL`,
    [userId]
  );
  const nearbyCount = (nearbyProofResult?.rows || []).filter((row) => {
    const lat = normalizeNumber(row.lat);
    const lng = normalizeNumber(row.lng);
    if (lat === null || lng === null) {
      return false;
    }

    return (
      haversineDistanceKm(
        claimContext.latitude,
        claimContext.longitude,
        lat,
        lng
      ) <= 1
    );
  }).length;

  if (nearbyCount >= 2) {
    anomalyScore += 18;
    reasons.push("Multiple recent proof uploads are clustered within the same 1km radius.");
  }

  return {
    anomaly_score: Math.min(100, anomalyScore),
    reasons,
  };
}

function calculateFraudScore({
  baseFraudScore,
  proofType,
  imageValidation,
  activityValidation,
  weatherValidation,
  workValidation,
}) {
  let fraudScore = normalizeNumber(baseFraudScore, 0) || 0;

  if (imageValidation.is_live_capture === false) {
    fraudScore += 30;
  }

  if (
    Number(imageValidation.ai_generated_probability || 0) > 70 ||
    imageValidation.tampering_detected === true
  ) {
    fraudScore += 40;
  }

  if (imageValidation.duplicate_found) {
    fraudScore += 20;
  }

  if (proofType === "SELFIE" && weatherValidation.mismatch) {
    fraudScore += 30;
  }

  if (proofType === "WORK_SCREEN" && workValidation.checked && workValidation.valid === false) {
    fraudScore += 25;
  }

  if (activityValidation.was_active === false || activityValidation.within_working_hours === false) {
    fraudScore += 35;
  }

  return Math.min(100, fraudScore);
}

async function persistProofArtifacts({
  proofId,
  analysisId,
  claimContext,
  proofType,
  storedFile,
  capturedAt,
  file,
  fileHash,
  imageValidation,
  weatherValidation,
  activityValidation,
  workValidation,
  parcelValidation,
  warningPayload,
  finalDecision,
  rawAnalysis,
  metadata,
}) {
  const proofRecord = {
    id: proofId,
    user_id: claimContext.user_id,
    claim_id: claimContext.claim_id,
    type: proofType,
    file_path: storedFile.relativePath,
    timestamp: capturedAt,
    lat: claimContext.latitude,
    lng: claimContext.longitude,
    metadata_json: {
      original_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      file_hash: fileHash,
      is_live_capture: imageValidation.is_live_capture,
      ...metadata,
    },
  };

  const analysisRecord = {
    id: analysisId,
    proof_id: proofId,
    user_id: claimContext.user_id,
    claim_id: claimContext.claim_id,
    ai_generated_probability: imageValidation.ai_generated_probability,
    tampering_detected: imageValidation.tampering_detected,
    duplicate_found: imageValidation.duplicate_found,
    weather_mismatch: weatherValidation.mismatch || false,
    activity_valid:
      activityValidation.was_active !== false && activityValidation.within_working_hours !== false,
    work_screen_valid: workValidation.checked ? workValidation.valid !== false : true,
    is_live_capture: imageValidation.is_live_capture,
    fraud_score_delta: finalDecision.fraud_score,
    warning_reasons: warningPayload.reasons,
    analysis_json: {
      image_validation: imageValidation,
      weather_validation: weatherValidation,
      activity_validation: activityValidation,
      work_validation: workValidation,
      parcel_validation: parcelValidation,
      decision: finalDecision,
      raw_analysis: rawAnalysis,
    },
  };

  const detectorLogs = [
    {
      id: uuidv4(),
      proof_id: proofId,
      claim_id: claimContext.claim_id,
      detector_name: "image_forensics",
      result_json: imageValidation,
    },
    {
      id: uuidv4(),
      proof_id: proofId,
      claim_id: claimContext.claim_id,
      detector_name: "proof_analyzer",
      result_json: rawAnalysis,
    },
  ];

  const canPersistIds = isUuid(claimContext.claim_id) && isUuid(claimContext.user_id);
  if (!canPersistIds) {
    memoryStore.proofs.set(proofId, proofRecord);
    memoryStore.analyses.set(analysisId, analysisRecord);
    memoryStore.hashes.set(fileHash, {
      proof_id: proofId,
      claim_id: claimContext.claim_id,
      user_id: claimContext.user_id,
      image_hash: fileHash,
    });
    memoryStore.logs.push(...detectorLogs);
    return;
  }

  const proofInsert = await safeQuery(
    `INSERT INTO proofs (id, user_id, claim_id, type, file_path, timestamp, lat, lng, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      proofRecord.id,
      proofRecord.user_id,
      proofRecord.claim_id,
      proofRecord.type,
      proofRecord.file_path,
      proofRecord.timestamp,
      proofRecord.lat,
      proofRecord.lng,
      JSON.stringify(proofRecord.metadata_json),
    ]
  );

  if (!proofInsert) {
    memoryStore.proofs.set(proofId, proofRecord);
    memoryStore.analyses.set(analysisId, analysisRecord);
    memoryStore.hashes.set(fileHash, {
      proof_id: proofId,
      claim_id: claimContext.claim_id,
      user_id: claimContext.user_id,
      image_hash: fileHash,
    });
    memoryStore.logs.push(...detectorLogs);
    return;
  }

  await safeQuery(
    `INSERT INTO proof_analysis (
       id,
       proof_id,
       user_id,
       claim_id,
       ai_generated_probability,
       tampering_detected,
       duplicate_found,
       weather_mismatch,
       activity_valid,
       work_screen_valid,
       is_live_capture,
       fraud_score_delta,
       warning_reasons,
       analysis_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      analysisRecord.id,
      analysisRecord.proof_id,
      analysisRecord.user_id,
      analysisRecord.claim_id,
      analysisRecord.ai_generated_probability,
      analysisRecord.tampering_detected,
      analysisRecord.duplicate_found,
      analysisRecord.weather_mismatch,
      analysisRecord.activity_valid,
      analysisRecord.work_screen_valid,
      analysisRecord.is_live_capture,
      analysisRecord.fraud_score_delta,
      JSON.stringify(analysisRecord.warning_reasons),
      JSON.stringify(analysisRecord.analysis_json),
    ]
  );

  await safeQuery(
    `INSERT INTO image_hashes (id, proof_id, user_id, claim_id, image_hash)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), proofId, claimContext.user_id, claimContext.claim_id, fileHash]
  );

  for (const detectorLog of detectorLogs) {
    await safeQuery(
      `INSERT INTO ai_detection_logs (id, proof_id, claim_id, detector_name, result_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        detectorLog.id,
        detectorLog.proof_id,
        detectorLog.claim_id,
        detectorLog.detector_name,
        JSON.stringify(detectorLog.result_json),
      ]
    );
  }
}

async function updateClaimDecisionIfPersisted(claimId, finalDecision, warningPayload) {
  if (!isUuid(claimId)) {
    return null;
  }

  try {
    const existingClaim = await ClaimModel.findById(claimId);
    if (!existingClaim) {
      return null;
    }

    const nextStatus =
      finalDecision.decision === "APPROVED"
        ? "approved"
        : finalDecision.decision === "REJECTED"
          ? "rejected"
          : "flagged";

    return ClaimModel.updateStatus(claimId, nextStatus, {
      fraud_score: finalDecision.fraud_score,
      fraud_flags: {
        warnings: warningPayload.reasons,
        explanation: finalDecision.explanation,
        decision: finalDecision.decision,
        confidence: finalDecision.confidence,
      },
    });
  } catch (error) {
    logger.warn(`Claim update skipped during proof automation: ${error.message}`);
    return null;
  }
}

async function uploadProofAndAnalyze(input) {
  const proofType = normalizeProofType(input.proofType);
  const file = input.file;
  ensureImageFile(file);

  const proofId = uuidv4();
  const analysisId = uuidv4();
  const capturedAt = nowIso();
  const metadata = safeJsonParse(input.metadataJson, {});
  const claimContext = await resolveClaimContext({
    userId: input.userId,
    claimId: input.claimId,
    claimTime: input.claimTime || capturedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city,
    zone: input.zone,
  });
  const storedFile = await writeProofFile({
    proofId,
    claimId: claimContext.claim_id,
    proofType,
    file,
  });
  const fileHash = hashBuffer(file.buffer);
  const duplicateInfo = await lookupDuplicateHash(fileHash);
  const weatherContext = await resolveWeatherContext(claimContext);
  const rawAnalysis = await analyzeProof({
    file,
    proofType,
    claimContext,
    weatherContext,
    duplicateFound: duplicateInfo.duplicateFound,
    metadata,
  });

  const imageValidation = {
    ai_generated_probability: normalizeNumber(
      rawAnalysis?.image_forensics?.ai_generated_probability,
      0
    ) || 0,
    tampering_detected: Boolean(rawAnalysis?.image_forensics?.tampering_detected),
    duplicate_found:
      duplicateInfo.duplicateFound || Boolean(rawAnalysis?.image_forensics?.duplicate_found),
    is_live_capture: rawAnalysis?.image_forensics?.is_live_capture !== false,
    capture_age_minutes: normalizeNumber(rawAnalysis?.image_forensics?.capture_age_minutes),
    camera_metadata_present: rawAnalysis?.image_forensics?.camera_metadata_present !== false,
    metadata: rawAnalysis?.image_forensics?.metadata || {},
  };
  const weatherValidation = rawAnalysis?.weather_validation || {
    checked: false,
    mismatch: false,
    reasons: [],
  };
  const workValidation = rawAnalysis?.work_validation || {
    checked: false,
    valid: true,
    reasons: [],
    keyword_hits: [],
  };
  const parcelValidation = rawAnalysis?.parcel_validation || {
    checked: false,
    valid: true,
    reasons: [],
  };
  const activityValidation = await validateActivity({
    userId: claimContext.user_id,
    claimTimestamp: claimContext.claim_timestamp,
    fileName: file.originalname,
  });
  const trustScore = await getTrustScore(claimContext.user_id);
  const anomalyResult = await calculateAnomalyScore({
    userId: claimContext.user_id,
    claimContext,
  });

  const fraudScore = calculateFraudScore({
    baseFraudScore: claimContext.existing_fraud_score,
    proofType,
    imageValidation,
    activityValidation,
    weatherValidation,
    workValidation,
  });

  const warningPayload = buildWarnings({
    imageValidation,
    activityValidation,
    weatherValidation,
    workValidation,
    fraudScore,
  });
  const finalDecision = createClaimDecision({
    fraud_score: fraudScore,
    ai_image_score: imageValidation.ai_generated_probability,
    anomaly_score: anomalyResult.anomaly_score,
    trust_score: trustScore.score,
    image_validation: imageValidation,
    activity_validation: activityValidation,
    weather_validation: weatherValidation,
    work_validation: workValidation,
    warnings: warningPayload.reasons,
    explanation: [
      ...warningPayload.explanation,
      ...anomalyResult.reasons,
      `Trust score snapshot: ${trustScore.score}.`,
    ],
  });

  await persistProofArtifacts({
    proofId,
    analysisId,
    claimContext,
    proofType,
    storedFile,
    capturedAt,
    file,
    fileHash,
    imageValidation,
    weatherValidation,
    activityValidation,
    workValidation,
    parcelValidation,
    warningPayload,
    finalDecision,
    rawAnalysis,
    metadata,
  });

  const claimUpdate = await updateClaimDecisionIfPersisted(
    claimContext.claim_id,
    finalDecision,
    warningPayload
  );

  return {
    status: "RECEIVED",
    proof_id: proofId,
    user_id: claimContext.user_id,
    claim_id: claimContext.claim_id,
    proof_type: proofType,
    timestamp: capturedAt,
    latitude: claimContext.latitude,
    longitude: claimContext.longitude,
    is_live_capture: imageValidation.is_live_capture,
    ai_generated_probability: imageValidation.ai_generated_probability,
    tampering_detected: imageValidation.tampering_detected,
    duplicate_found: imageValidation.duplicate_found,
    warning: warningPayload.warning,
    message: warningPayload.message,
    reasons: warningPayload.reasons,
    decision: finalDecision,
    analysis: {
      image_validation: imageValidation,
      weather_validation: weatherValidation,
      activity_validation: activityValidation,
      work_validation: workValidation,
      parcel_validation: parcelValidation,
      anomaly_score: anomalyResult.anomaly_score,
      trust_score: trustScore.score,
      weather: weatherContext,
      claim_update: claimUpdate,
      file_path: storedFile.relativePath,
      analyzer_source: rawAnalysis?.source || "node-fallback",
    },
  };
}

module.exports = {
  PROOF_UPLOAD_DIR,
  calculateFraudScore,
  uploadProofAndAnalyze,
};
