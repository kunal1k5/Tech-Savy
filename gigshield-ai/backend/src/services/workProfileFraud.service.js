const crypto = require("crypto");
const Joi = require("joi");

const { pool } = require("../database/connection");
const logger = require("../utils/logger");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const PLATFORM_KEYWORDS = [
  "swiggy",
  "zomato",
  "uber",
  "ola",
  "delivery",
  "dashboard",
  "driver",
  "worker id",
  "worker_id",
  "blinkit",
  "zepto",
  "rapido",
];
const SUSPICIOUS_METADATA_KEYWORDS = [
  "photoshop",
  "gimp",
  "canva",
  "edited",
  "stable diffusion",
  "midjourney",
  "ai",
];

const knownImageHashes = new Map();

const workProfileVerifySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  city: Joi.string().trim().min(2).max(120).required(),
  workType: Joi.string().trim().min(2).max(120).optional(),
  work_type: Joi.string().trim().min(2).max(120).optional(),
  ocrText: Joi.string().allow("", null).optional(),
  metadata_json: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
})
  .custom((value, helpers) => {
    if (!(value.workType || value.work_type)) {
      return helpers.error("any.custom", { message: "workType is required." });
    }

    return value;
  }, "work profile contract")
  .messages({
    "any.custom": "{{#message}}",
  });

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function titleCase(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function validateImageFile(file) {
  if (!file || Number(file.size) <= 0) {
    throw createHttpError("Please upload a valid image", 400);
  }

  if (!String(file.mimetype || "").startsWith("image/")) {
    throw createHttpError("Please upload a valid image", 400);
  }

  if (Number(file.size) > MAX_FILE_SIZE_BYTES) {
    throw createHttpError("File size too large", 400);
  }
}

function buildExtractedText({ file, ocrText, metadata }) {
  const metadataText = [
    metadata?.ocrText,
    metadata?.detectedName,
    metadata?.extractedText,
    metadata?.platform,
    metadata?.description,
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeText([
    ocrText,
    metadataText,
    file?.originalname,
  ].filter(Boolean).join(" "));
}

function isNameMatch(userName, extractedText) {
  const normalizedName = normalizeText(userName);
  if (!normalizedName || !extractedText) {
    return false;
  }

  const tokens = normalizedName
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (!tokens.length) {
    return false;
  }

  const matchedTokens = tokens.filter((token) => extractedText.includes(token)).length;
  const requiredMatches = tokens.length === 1 ? 1 : Math.ceil(tokens.length * 0.6);
  return matchedTokens >= requiredMatches;
}

function detectPlatformKeywords(extractedText) {
  if (!extractedText) {
    return [];
  }

  return PLATFORM_KEYWORDS.filter((keyword) => extractedText.includes(keyword));
}

function detectImageQuality(file) {
  const fileName = normalizeText(file?.originalname);
  const fileSize = Number(file?.size || 0);

  if (fileName.includes("blur") || fileName.includes("blurry")) {
    return "blurry";
  }

  return fileSize >= 80 * 1024 ? "clear" : "blurry";
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function safeQuery(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    logger.warn(`work-profile-fraud fallback: ${error.message}`);
    return null;
  }
}

async function isDuplicateImage(fileHash) {
  if (knownImageHashes.has(fileHash)) {
    return true;
  }

  const result = await safeQuery(
    `SELECT image_hash
     FROM image_hashes
     WHERE image_hash = $1
     LIMIT 1`,
    [fileHash]
  );

  return Boolean(result?.rows?.[0]);
}

function hasSuspiciousMetadata(metadata = {}) {
  const normalizedMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const metadataBlob = normalizeText([
    normalizedMetadata?.software,
    normalizedMetadata?.editor,
    normalizedMetadata?.app,
    normalizedMetadata?.source,
    normalizedMetadata?.notes,
  ].filter(Boolean).join(" "));

  const keywordMatch = SUSPICIOUS_METADATA_KEYWORDS.some((keyword) =>
    metadataBlob.includes(keyword)
  );

  return Boolean(
    normalizedMetadata?.isEdited ||
      normalizedMetadata?.edited ||
      normalizedMetadata?.aiGenerated ||
      normalizedMetadata?.synthetic ||
      keywordMatch
  );
}

function classifyFraudScore(score) {
  if (score >= 60) {
    return {
      riskLevel: "LOW",
      decision: "APPROVE",
    };
  }

  if (score >= 30) {
    return {
      riskLevel: "MEDIUM",
      decision: "REVIEW",
    };
  }

  return {
    riskLevel: "HIGH",
    decision: "REJECT",
  };
}

async function verifyWorkProfileScreenshot({
  file,
  name,
  city,
  workType,
  work_type,
  ocrText,
  metadataJson,
}) {
  validateImageFile(file);

  const normalizedWorkType = String(workType || work_type || "Unknown Work").trim();
  const metadata = safeJsonParse(metadataJson, {});
  const extractedText = buildExtractedText({
    file,
    ocrText,
    metadata,
  });
  const nameMatched = isNameMatch(name, extractedText);
  const detectedName = nameMatched ? titleCase(name) : titleCase(metadata?.detectedName || "Unknown");
  const platformKeywords = detectPlatformKeywords(extractedText);
  const platformDetected = platformKeywords.length > 0;
  const imageQuality = detectImageQuality(file);
  const imageIsClear = imageQuality === "clear";

  const fileHash = hashBuffer(file.buffer);
  const duplicateFound = await isDuplicateImage(fileHash);
  const suspiciousMetadata = hasSuspiciousMetadata(metadata);

  let score = 0;
  const reasons = [];

  if (nameMatched) {
    score += 30;
    reasons.push("Name matched");
  } else {
    score += 5;
    reasons.push("Name not matched");
  }

  if (platformDetected) {
    score += 25;
    reasons.push("Platform detected");
  } else {
    score += 5;
    reasons.push("Platform not detected");
  }

  if (imageIsClear) {
    score += 20;
    reasons.push("Image clear");
  } else {
    score += 5;
    reasons.push("Image blurry");
  }

  if (duplicateFound) {
    score -= 30;
    reasons.push("Duplicate image already uploaded");
  }

  if (suspiciousMetadata) {
    score -= 10;
    reasons.push("Suspicious metadata detected");
  }

  const fraudScore = Math.max(0, Math.min(100, score));
  const { riskLevel, decision } = classifyFraudScore(fraudScore);

  knownImageHashes.set(fileHash, {
    uploadedAt: new Date().toISOString(),
    name: String(name || "").trim(),
    city: String(city || "").trim(),
    workType: normalizedWorkType,
  });

  return {
    fraudScore,
    riskLevel,
    decision,
    reasons,
    signals: {
      detectedName,
      platformKeywords,
      imageQuality,
      duplicateFound,
      suspiciousMetadata,
      city: String(city || "").trim(),
      workType: normalizedWorkType,
    },
    systemNote:
      "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
  };
}

module.exports = {
  verifyWorkProfileScreenshot,
  workProfileVerifySchema,
};
