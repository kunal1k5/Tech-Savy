const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const { getMongoDb } = require("../database/mongo");
const logger = require("../utils/logger");
const { sendOtp, sanitizePhone } = require("./otpProvider.service");

const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret";
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || JWT_SECRET;
const OTP_TTL_MS = Number(process.env.AUTH_OTP_TTL_MS || 5 * 60 * 1000);
const OTP_RESEND_COOLDOWN_MS = Number(process.env.AUTH_OTP_RESEND_COOLDOWN_MS || 60 * 1000);
const OTP_MAX_ATTEMPTS = Number(process.env.AUTH_OTP_MAX_ATTEMPTS || 5);
const REGISTRATION_TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_REGISTRATION_TOKEN_TTL_SECONDS || 15 * 60
);
const USERS_COLLECTION = "auth_users";
const OTP_SESSIONS_COLLECTION = "otp_sessions";
const AUTH_AUDIT_COLLECTION = "auth_audit_logs";

let indexesPromise = null;

function createError(message, statusCode = 500, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function getCollections() {
  const db = getMongoDb();
  if (!db) {
    throw createError("MongoDB is required for real OTP auth.", 503);
  }

  return {
    users: db.collection(USERS_COLLECTION),
    otpSessions: db.collection(OTP_SESSIONS_COLLECTION),
    authAudit: db.collection(AUTH_AUDIT_COLLECTION),
  };
}

async function ensureIndexes() {
  if (indexesPromise) {
    return indexesPromise;
  }

  indexesPromise = (async () => {
    const collections = getCollections();
    await Promise.all([
      collections.users.createIndex({ phone: 1 }, { unique: true }),
      collections.otpSessions.createIndex({ phone: 1, createdAt: -1 }),
      collections.otpSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      collections.authAudit.createIndex({ phone: 1, createdAt: -1 }),
    ]);
  })().catch((error) => {
    indexesPromise = null;
    throw error;
  });

  return indexesPromise;
}

function now() {
  return new Date();
}

function nowIso() {
  return now().toISOString();
}

function normalizeString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeUserDocument(user = {}) {
  const phone = sanitizePhone(user.phone);

  return {
    id: user.id || uuidv4(),
    full_name: normalizeString(user.full_name ?? user.fullName, "Gig worker"),
    phone,
    city: normalizeString(user.city),
    zone: normalizeString(user.zone, user.city || ""),
    platform: normalizeString(user.platform),
    weekly_income: normalizeNumber(user.weekly_income ?? user.weeklyIncome, 0),
    work_type: normalizeString(user.work_type ?? user.workType),
    worker_id: normalizeString(user.worker_id ?? user.workerId),
    work_proof_name: normalizeString(user.work_proof_name ?? user.workProofName),
    work_verification_status: normalizeString(
      user.work_verification_status ?? user.workVerificationStatus,
      "pending"
    ),
    work_verification_flag:
      user.work_verification_flag ?? user.workVerificationFlag ?? null,
    device_id: normalizeString(user.device_id ?? user.deviceId) || null,
    auth_risk_score: normalizeNumber(user.auth_risk_score ?? user.authRiskScore, 0),
    auth_risk_level: normalizeString(user.auth_risk_level ?? user.authRiskLevel, "low"),
    auth_risk_status: normalizeString(user.auth_risk_status ?? user.authRiskStatus, "Safe"),
    signup_time: user.signup_time ?? user.signupTime ?? null,
    location: user.location ?? null,
    is_phone_verified: true,
    auth_mode: "real_otp",
  };
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashOtp(sessionId, otp) {
  return crypto
    .createHmac("sha256", OTP_HASH_SECRET)
    .update(`${sessionId}:${String(otp)}`)
    .digest("hex");
}

function compareOtpHashes(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: "worker",
      full_name: user.full_name,
      phone: user.phone,
      city: user.city,
      zone: user.zone,
      platform: user.platform,
      weekly_income: user.weekly_income,
      work_type: user.work_type,
      worker_id: user.worker_id,
      work_proof_name: user.work_proof_name,
      work_verification_status: user.work_verification_status,
      work_verification_flag: user.work_verification_flag,
      device_id: user.device_id,
      auth_risk_score: user.auth_risk_score,
      auth_risk_level: user.auth_risk_level,
      auth_risk_status: user.auth_risk_status,
      signup_time: user.signup_time,
      auth_mode: "real_otp",
      token_type: "access",
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function buildRegistrationToken({ sessionId, phone }) {
  return jwt.sign(
    {
      auth_mode: "real_otp",
      token_type: "registration_completion",
      sessionId,
      phone,
    },
    JWT_SECRET,
    { expiresIn: REGISTRATION_TOKEN_TTL_SECONDS }
  );
}

function verifyRegistrationToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw createError("Invalid or expired registration token.", 401);
  }

  if (
    payload?.auth_mode !== "real_otp" ||
    payload?.token_type !== "registration_completion"
  ) {
    throw createError("Invalid registration token.", 401);
  }

  return payload;
}

function assertRealAccessToken(user) {
  if (user?.auth_mode !== "real_otp" || user?.token_type !== "access") {
    throw createError("Real auth token required.", 403);
  }
}

async function writeAuditLog(action, phone, status, meta = {}) {
  try {
    const collections = getCollections();
    await collections.authAudit.insertOne({
      action,
      phone,
      status,
      createdAt: now(),
      ...meta,
    });
  } catch (error) {
    logger.warn(`Auth audit log write failed: ${error.message}`);
  }
}

function buildUserResponse(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    phone: user.phone,
    city: user.city,
    zone: user.zone,
    platform: user.platform,
    weekly_income: user.weekly_income,
    work_type: user.work_type,
    worker_id: user.worker_id,
    work_proof_name: user.work_proof_name,
    work_verification_status: user.work_verification_status,
    work_verification_flag: user.work_verification_flag,
    device_id: user.device_id,
    auth_risk_score: user.auth_risk_score,
    auth_risk_level: user.auth_risk_level,
    auth_risk_status: user.auth_risk_status,
    signup_time: user.signup_time,
    location: user.location,
  };
}

async function requestOtp({ phone, purpose = "login_or_register", ipAddress, userAgent }) {
  await ensureIndexes();

  const collections = getCollections();
  const sanitizedPhone = sanitizePhone(phone);
  if (sanitizedPhone.length !== 10) {
    throw createError("A valid 10-digit mobile number is required.", 400);
  }

  const existingSession = await collections.otpSessions.findOne(
    {
      phone: sanitizedPhone,
      purpose,
      status: "sent",
    },
    { sort: { createdAt: -1 } }
  );

  const currentTime = now();
  if (
    existingSession?.lastSentAt &&
    currentTime.getTime() - new Date(existingSession.lastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS -
        (currentTime.getTime() - new Date(existingSession.lastSentAt).getTime())) /
        1000
    );

    throw createError(
      `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
      429,
      { retryAfterSeconds }
    );
  }

  await collections.otpSessions.updateMany(
    { phone: sanitizedPhone, purpose, status: "sent" },
    { $set: { status: "superseded", supersededAt: currentTime } }
  );

  const sessionId = uuidv4();
  const otp = createOtpCode();
  const expiresAt = new Date(currentTime.getTime() + OTP_TTL_MS);
  const otpHash = hashOtp(sessionId, otp);

  const delivery = await sendOtp({ phone: sanitizedPhone, otp, purpose });

  await collections.otpSessions.insertOne({
    _id: sessionId,
    phone: sanitizedPhone,
    purpose,
    otpHash,
    status: "sent",
    attemptCount: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt,
    createdAt: currentTime,
    lastSentAt: currentTime,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId || null,
    providerStatus: delivery.status || null,
    ipAddress: normalizeString(ipAddress) || null,
    userAgent: normalizeString(userAgent) || null,
  });

  await writeAuditLog("send_otp", sanitizedPhone, "sent", {
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId || null,
    ipAddress,
  });

  return {
    sessionId,
    phone: sanitizedPhone,
    purpose,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    provider: delivery.provider,
    ...(process.env.NODE_ENV !== "production" && delivery.devOtp
      ? { devOtp: delivery.devOtp }
      : {}),
  };
}

async function verifyOtp({ sessionId, phone, otp, ipAddress, userAgent }) {
  await ensureIndexes();

  const collections = getCollections();
  const sanitizedPhone = sanitizePhone(phone);
  const session = await collections.otpSessions.findOne({
    _id: sessionId,
    phone: sanitizedPhone,
  });

  if (!session) {
    throw createError("OTP session not found.", 404);
  }

  if (session.status !== "sent") {
    throw createError("OTP session is no longer active.", 400);
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await collections.otpSessions.updateOne(
      { _id: sessionId },
      { $set: { status: "expired", expiredAt: now() } }
    );
    throw createError("OTP expired. Please request a new OTP.", 400);
  }

  const nextAttemptCount = Number(session.attemptCount || 0) + 1;
  const submittedOtpHash = hashOtp(sessionId, otp);
  const isMatch = compareOtpHashes(session.otpHash, submittedOtpHash);

  if (!isMatch) {
    const nextStatus = nextAttemptCount >= OTP_MAX_ATTEMPTS ? "locked" : "sent";
    await collections.otpSessions.updateOne(
      { _id: sessionId },
      {
        $set: {
          attemptCount: nextAttemptCount,
          status: nextStatus,
          updatedAt: now(),
        },
      }
    );

    await writeAuditLog("verify_otp", sanitizedPhone, "failed", {
      reason: "invalid_otp",
      attemptCount: nextAttemptCount,
      ipAddress,
    });

    throw createError("Invalid OTP.", 401, {
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - nextAttemptCount),
    });
  }

  await collections.otpSessions.updateOne(
    { _id: sessionId },
    {
      $set: {
        status: "verified",
        verifiedAt: now(),
        verifiedByIp: normalizeString(ipAddress) || null,
        verifiedUserAgent: normalizeString(userAgent) || null,
        attemptCount: nextAttemptCount,
      },
    }
  );

  const user = await collections.users.findOne({ phone: sanitizedPhone });
  await writeAuditLog("verify_otp", sanitizedPhone, "verified", {
    sessionId,
    existingUser: Boolean(user),
    ipAddress,
  });

  if (!user) {
    return {
      status: "registration_required",
      registrationRequired: true,
      registrationToken: buildRegistrationToken({ sessionId, phone: sanitizedPhone }),
      phone: sanitizedPhone,
    };
  }

  const updatedAt = now();
  await collections.users.updateOne(
    { phone: sanitizedPhone },
    {
      $set: {
        lastLoginAt: updatedAt,
        lastOtpVerifiedAt: updatedAt,
        is_phone_verified: true,
      },
    }
  );

  const normalizedUser = normalizeUserDocument({ ...user, lastLoginAt: updatedAt });
  return {
    status: "authenticated",
    registrationRequired: false,
    token: buildAccessToken(normalizedUser),
    user: buildUserResponse(normalizedUser),
  };
}

async function completeRegistration({ registrationToken, profile, ipAddress }) {
  await ensureIndexes();

  const collections = getCollections();
  const payload = verifyRegistrationToken(registrationToken);
  const sanitizedPhone = sanitizePhone(payload.phone);

  const session = await collections.otpSessions.findOne({
    _id: payload.sessionId,
    phone: sanitizedPhone,
    status: "verified",
  });

  if (!session) {
    throw createError("Verified OTP session not found. Please verify OTP again.", 400);
  }

  const existingUser = await collections.users.findOne({ phone: sanitizedPhone });
  if (existingUser) {
    throw createError("User already exists for this phone number.", 409);
  }

  const currentTime = now();
  const user = normalizeUserDocument({
    ...profile,
    phone: sanitizedPhone,
    signup_time: nowIso(),
  });

  await collections.users.insertOne({
    ...user,
    createdAt: currentTime,
    updatedAt: currentTime,
    lastLoginAt: currentTime,
    lastOtpVerifiedAt: session.verifiedAt || currentTime,
  });

  await writeAuditLog("complete_registration", sanitizedPhone, "created", {
    userId: user.id,
    ipAddress,
  });

  return {
    status: "authenticated",
    token: buildAccessToken(user),
    user: buildUserResponse(user),
  };
}

async function getCurrentUser(authUser) {
  await ensureIndexes();
  assertRealAccessToken(authUser);

  const collections = getCollections();
  const user = await collections.users.findOne({
    id: authUser.id,
    phone: sanitizePhone(authUser.phone),
  });

  if (!user) {
    throw createError("User not found.", 404);
  }

  return buildUserResponse(normalizeUserDocument(user));
}

module.exports = {
  completeRegistration,
  getCurrentUser,
  requestOtp,
  verifyOtp,
};
