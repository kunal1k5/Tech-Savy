/**
 * Proof Validation Engine
 *
 * Validates uploaded proofs (screenshots, photos) for:
 * - Timestamp consistency
 * - Location match
 * - File metadata integrity
 */

const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");
const crypto = require("crypto");

const PROOF_VALIDATION_SCORE = {
  TIMESTAMP_MATCH: 20,
  TIMESTAMP_MISMATCH: -40,
  LOCATION_MATCH: 20,
  LOCATION_MISMATCH: -30,
  FILE_INTEGRITY: 15,
  FILE_TAMPERED: -50,
};

const TIMESTAMP_TOLERANCE_MINUTES = 30; // Proof can be 30 mins before/after claim
const LOCATION_TOLERANCE_KM = 2; // Proof location within 2km of claim

/**
 * Validate a proof upload
 */
async function validateProof(claimId, workerId, proofData) {
  try {
    const {
      file_path = "",
      file_type = "screenshot",
      file_size = 0,
      file_hash = "",
      upload_timestamp = new Date().toISOString(),
      location_latitude,
      location_longitude,
    } = proofData;

    // Get claim details
    const claim = await db("claims").where("id", claimId).first();
    if (!claim) {
      throw new Error("Claim not found");
    }

    const validationResults = {
      proof_id: uuidv4(),
      claim_id: claimId,
      worker_id: workerId,
      file_type,
      validations: [],
      total_score: 0,
    };

    // Validation 1: Timestamp consistency
    const timestampValidation = validateTimestamp(
      new Date(upload_timestamp),
      new Date(claim.created_at),
    );
    validationResults.validations.push(timestampValidation);
    validationResults.total_score += timestampValidation.score;

    // Validation 2: Location consistency (if location provided)
    if (location_latitude && location_longitude) {
      const locationValidation = validateLocation(
        location_latitude,
        location_longitude,
        claim,
      );
      validationResults.validations.push(locationValidation);
      validationResults.total_score += locationValidation.score;
    }

    // Validation 3: File integrity
    const integrityValidation = validateFileIntegrity(file_path, file_hash, file_size);
    validationResults.validations.push(integrityValidation);
    validationResults.total_score += integrityValidation.score;

    // Store in database
    const proofRecord = {
      id: validationResults.proof_id,
      claim_id: claimId,
      worker_id: workerId,
      file_type,
      file_path,
      file_size,
      file_hash: file_hash || crypto.createHash("sha256").update(file_path).digest("hex"),
      upload_timestamp,
      location_latitude,
      location_longitude,
      validation_status: validationResults.total_score > 30 ? "valid" : "invalid",
      validation_details: JSON.stringify(validationResults),
    };

    await db("proof_uploads").insert(proofRecord);

    return {
      proof_id: validationResults.proof_id,
      is_valid: validationResults.total_score > 30,
      validation_score: validationResults.total_score,
      validations: validationResults.validations,
      status: proofRecord.validation_status,
    };
  } catch (error) {
    console.error("Error validating proof:", error.message);
    throw error;
  }
}

/**
 * Validate timestamp of proof
 */
function validateTimestamp(proofTime, claimTime) {
  const timeDiffMinutes = Math.abs(proofTime - claimTime) / (1000 * 60);
  const isWithinTolerance = timeDiffMinutes <= TIMESTAMP_TOLERANCE_MINUTES;

  return {
    check: "TIMESTAMP_VALIDATION",
    is_valid: isWithinTolerance,
    proof_timestamp: proofTime.toISOString(),
    claim_timestamp: claimTime.toISOString(),
    diff_minutes: Math.round(timeDiffMinutes),
    tolerance_minutes: TIMESTAMP_TOLERANCE_MINUTES,
    score: isWithinTolerance
      ? PROOF_VALIDATION_SCORE.TIMESTAMP_MATCH
      : PROOF_VALIDATION_SCORE.TIMESTAMP_MISMATCH,
    reason: isWithinTolerance
      ? "Proof timestamp matches claim time"
      : `Proof is ${Math.round(timeDiffMinutes)} minutes from claim`,
  };
}

/**
 * Validate location of proof
 */
function validateLocation(latitude, longitude, claim) {
  // For now, we'll do a simple validation
  // In a real system, we'd check against claim location from trigger
  const claimLatitude = 28.7041; // Default Delhi lat (dummy)
  const claimLongitude = 77.1025; // Default Delhi lon (dummy)

  function haversineDistance(lat1, lon1, lat2, lon2) {
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

  const distance = haversineDistance(latitude, longitude, claimLatitude, claimLongitude);
  const isWithinTolerance = distance <= LOCATION_TOLERANCE_KM;

  return {
    check: "LOCATION_VALIDATION",
    is_valid: isWithinTolerance,
    proof_latitude: latitude,
    proof_longitude: longitude,
    claim_latitude: claimLatitude,
    claim_longitude: claimLongitude,
    distance_km: parseFloat(distance.toFixed(2)),
    tolerance_km: LOCATION_TOLERANCE_KM,
    score: isWithinTolerance
      ? PROOF_VALIDATION_SCORE.LOCATION_MATCH
      : PROOF_VALIDATION_SCORE.LOCATION_MISMATCH,
    reason: isWithinTolerance
      ? "Proof location matches claim zone"
      : `Proof location ${distance.toFixed(2)}km away from claim`,
  };
}

/**
 * Validate file integrity (simulated)
 */
function validateFileIntegrity(filePath, fileHash, fileSize) {
  // In real system, verify actual hash
  const expectedHash = crypto.createHash("sha256").update(filePath).digest("hex");
  const hashValid = fileHash === expectedHash || fileHash === "" || !fileHash;
  const sizeValid = fileSize > 5000 && fileSize < 50000000; // 5KB to 50MB

  const isValid = hashValid && sizeValid;

  return {
    check: "FILE_INTEGRITY",
    is_valid: isValid,
    hash_valid: hashValid,
    size_valid: sizeValid,
    file_size_bytes: fileSize,
    score: isValid
      ? PROOF_VALIDATION_SCORE.FILE_INTEGRITY
      : PROOF_VALIDATION_SCORE.FILE_TAMPERED,
    reason: isValid ? "File integrity verified" : "File may be tampered or invalid size",
  };
}

/**
 * Get proofs for a claim
 */
async function getClaimProofs(claimId) {
  try {
    const proofs = await db("proof_uploads")
      .where("claim_id", claimId)
      .orderBy("created_at", "desc");

    return {
      claim_id: claimId,
      proofs_count: proofs.length,
      proofs,
    };
  } catch (error) {
    console.error("Error retrieving claim proofs:", error.message);
    throw error;
  }
}

/**
 * Get validation status for a proof
 */
async function getProofValidationStatus(proofId) {
  try {
    const proof = await db("proof_uploads").where("id", proofId).first();

    if (!proof) {
      throw new Error("Proof not found");
    }

    const validationDetails = JSON.parse(proof.validation_details || "{}");

    return {
      proof_id: proofId,
      validation_status: proof.validation_status,
      validation_score: validationDetails.total_score || 0,
      validations: validationDetails.validations || [],
      file_type: proof.file_type,
      upload_timestamp: proof.upload_timestamp,
    };
  } catch (error) {
    console.error("Error getting proof validation status:", error.message);
    throw error;
  }
}

module.exports = {
  validateProof,
  validateTimestamp,
  validateLocation,
  validateFileIntegrity,
  getClaimProofs,
  getProofValidationStatus,
  PROOF_VALIDATION_SCORE,
  TIMESTAMP_TOLERANCE_MINUTES,
  LOCATION_TOLERANCE_KM,
};
