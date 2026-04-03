import api from "./api";

const OFFLINE_OTP_CODE = "1234";
const OFFLINE_OTP_TTL_MS = 5 * 60 * 1000;
const OFFLINE_OTP_SESSIONS_KEY = "gigshield_offline_otp_sessions";
const OFFLINE_USERS_KEY = "gigshield_offline_users";

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

function readStorage(key, fallbackValue) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    localStorage.removeItem(key);
    return fallbackValue;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function createDemoError(message, status = 400) {
  const error = new Error(message);
  error.response = {
    status,
    data: { error: message },
  };
  return error;
}

function shouldUseOfflineFallback(error) {
  return !error?.response;
}

function createOfflineSessionId() {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildOfflineUser(profile = {}) {
  const phone = sanitizePhone(profile.phone);

  return {
    id: profile.id || `demo-user-${phone || Math.random().toString(36).slice(2, 8)}`,
    full_name: profile.full_name || profile.fullName || "Rahul Singh",
    phone,
    city: profile.city || "Bengaluru",
    zone: profile.zone || "Koramangala",
    platform: profile.platform || "Swiggy",
    weekly_income: Number(profile.weekly_income ?? profile.weeklyIncome) || 18350,
    work_type: profile.work_type || profile.workType || null,
    worker_id: profile.worker_id || profile.workerId || null,
    work_proof_name: profile.work_proof_name || profile.workProofName || null,
    work_verification_status:
      profile.work_verification_status || profile.workVerificationStatus || "pending",
    work_verification_flag:
      profile.work_verification_flag || profile.workVerificationFlag || null,
    device_id: profile.device_id || profile.deviceId || null,
    auth_risk_score: Number(profile.auth_risk_score ?? profile.authRiskScore) || 0,
    auth_risk_level: profile.auth_risk_level || profile.authRiskLevel || "low",
    auth_risk_status: profile.auth_risk_status || profile.authRiskStatus || "Safe",
    signup_time: profile.signup_time || profile.signupTime || null,
    location: profile.location || null,
  };
}

function getOfflineUsers() {
  return readStorage(OFFLINE_USERS_KEY, {});
}

function saveOfflineUser(profile = {}) {
  const phone = sanitizePhone(profile.phone);
  if (phone.length !== 10) {
    throw createDemoError("A valid 10-digit mobile number is required.");
  }

  const currentUsers = getOfflineUsers();
  const nextUser = buildOfflineUser({
    ...currentUsers[phone],
    ...profile,
    phone,
  });

  writeStorage(OFFLINE_USERS_KEY, {
    ...currentUsers,
    [phone]: nextUser,
  });

  return nextUser;
}

function getOfflineUser(phone) {
  const sanitizedPhone = sanitizePhone(phone);
  if (!sanitizedPhone) {
    return null;
  }

  return getOfflineUsers()[sanitizedPhone] || null;
}

function requestOfflineOtp(phone) {
  const sanitizedPhone = sanitizePhone(phone);
  if (sanitizedPhone.length !== 10) {
    throw createDemoError("A valid 10-digit mobile number is required.");
  }

  const sessionId = createOfflineSessionId();
  const sessions = readStorage(OFFLINE_OTP_SESSIONS_KEY, {});

  writeStorage(OFFLINE_OTP_SESSIONS_KEY, {
    ...sessions,
    [sessionId]: {
      phone: sanitizedPhone,
      expiresAt: Date.now() + OFFLINE_OTP_TTL_MS,
    },
  });

  return {
    sessionId,
    phone: sanitizedPhone,
    otp: OFFLINE_OTP_CODE,
    message: "API unavailable. Offline demo mode is active.",
    fallbackMode: "offline_demo",
  };
}

function verifyOfflineOtp({ sessionId, phone, otp, profile }) {
  const sanitizedPhone = sanitizePhone(phone);
  if (sanitizedPhone.length !== 10) {
    throw createDemoError("A valid 10-digit mobile number is required.");
  }

  if (String(otp) !== OFFLINE_OTP_CODE) {
    throw createDemoError("Invalid OTP. Use 1234 for the demo.", 401);
  }

  if (sessionId?.startsWith("offline-")) {
    const sessions = readStorage(OFFLINE_OTP_SESSIONS_KEY, {});
    const session = sessions[sessionId];

    if (!session || session.phone !== sanitizedPhone || session.expiresAt < Date.now()) {
      throw createDemoError("OTP session expired. Please request a new OTP.");
    }

    delete sessions[sessionId];
    writeStorage(OFFLINE_OTP_SESSIONS_KEY, sessions);
  }

  const existingUser = getOfflineUser(sanitizedPhone);
  const user = existingUser
    ? saveOfflineUser({
        ...existingUser,
        ...profile,
        phone: sanitizedPhone,
      })
    : saveOfflineUser({
        fullName: "Rahul Singh",
        city: "Bengaluru",
        zone: "Koramangala",
        platform: "Swiggy",
        weeklyIncome: 18350,
        ...profile,
        phone: sanitizedPhone,
      });

  return {
    user,
    fallbackMode: "offline_demo",
  };
}

function registerOfflineWorker(profile = {}) {
  return {
    user: saveOfflineUser(profile),
    fallbackMode: "offline_demo",
  };
}

export async function requestOtp(phone, options = {}) {
  if (options.preferOfflineDemo) {
    return requestOfflineOtp(phone);
  }

  try {
    const response = await api.post("/auth/login", { phone });
    return response.data;
  } catch (error) {
    if (!shouldUseOfflineFallback(error)) {
      throw error;
    }

    return requestOfflineOtp(phone);
  }
}

export async function verifyOtp({ sessionId, phone, otp, profile, preferOfflineDemo = false }) {
  if (preferOfflineDemo) {
    return verifyOfflineOtp({ sessionId, phone, otp, profile });
  }

  try {
    const response = await api.post("/auth/verify-otp", {
      sessionId,
      phone,
      otp,
      profile,
    });
    return response.data;
  } catch (error) {
    if (!shouldUseOfflineFallback(error)) {
      throw error;
    }

    return verifyOfflineOtp({ sessionId, phone, otp, profile });
  }
}

export async function registerWorker(profile, options = {}) {
  if (options.preferOfflineDemo) {
    return registerOfflineWorker(profile);
  }

  try {
    const response = await api.post("/auth/register", profile);
    return response.data;
  } catch (error) {
    if (!shouldUseOfflineFallback(error)) {
      throw error;
    }

    return registerOfflineWorker(profile);
  }
}

export async function getPolicyState() {
  const response = await api.get("/policy");
  return response.data;
}

export async function buyPolicy(planId) {
  const response = await api.post("/policy/buy", { planId });
  return response.data;
}

export async function getPremium(risk) {
  const response = await api.get("/premium", {
    params: risk ? { risk } : undefined,
  });
  return response.data;
}

export async function getClaims() {
  const response = await api.get("/claims");
  return response.data;
}

export async function triggerClaim(payload) {
  const response = await api.post("/claim/trigger", payload);
  return response.data;
}
