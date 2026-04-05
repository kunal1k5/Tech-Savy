const TOKEN_KEY = "gigpredict_ai_token";
const SESSION_CACHE_KEY = "gigpredict_ai_session_cache";
const USER_KEY = "user";
const LEGACY_USER_KEY = "gigpredict_ai_user";
const KNOWN_USERS_KEY = "gigpredict_ai_known_users";
export const DEMO_ACCOUNT = Object.freeze({
  id: "demo-worker-local",
  full_name: "Demo Rider",
  phone: "9876543210",
  city: "Bengaluru",
  zone: "Koramangala",
  platform: "Swiggy",
  weekly_income: 18500,
  work_type: "Delivery",
  worker_id: "DEMO-2026",
  work_proof_name: "demo-profile.png",
  work_verification_status: "verified",
  work_verification_flag: null,
  auth_risk_score: 24,
  auth_risk_level: "low",
  auth_risk_status: "Safe",
});

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gigpredict-ai-auth-changed"));
  }
}

function sanitizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function readStorage(key) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  const phone = sanitizePhone(user.phone);
  const fullName = user.full_name ?? user.fullName ?? user.name ?? "";
  const city = user.city ?? "";
  const zone = user.zone ?? user.city ?? "";
  const platform = user.platform ?? "";
  const weeklyIncome = Number(user.weekly_income ?? user.weeklyIncome ?? 0);
  const workType = user.work_type ?? user.workType ?? "";
  const workerId = user.worker_id ?? user.workerId ?? "";
  const workProofName = user.work_proof_name ?? user.workProofName ?? "";
  const workVerificationStatus =
    user.work_verification_status ?? user.workVerificationStatus ?? "pending";
  const workVerificationFlag =
    user.work_verification_flag ?? user.workVerificationFlag ?? null;
  const deviceId = user.device_id ?? user.deviceId ?? null;
  const authRiskScore = Number(user.auth_risk_score ?? user.authRiskScore ?? 0);
  const authRiskLevel = user.auth_risk_level ?? user.authRiskLevel ?? "low";
  const authRiskStatus = user.auth_risk_status ?? user.authRiskStatus ?? "Safe";
  const signupTime = user.signup_time ?? user.signupTime ?? null;
  const location = user.location ?? null;

  return {
    id: user.id || (phone ? `worker-${phone}` : null),
    name: fullName,
    fullName,
    full_name: fullName,
    phone,
    city,
    zone,
    platform,
    weeklyIncome,
    weekly_income: weeklyIncome,
    workType,
    work_type: workType,
    workerId,
    worker_id: workerId,
    workProofName,
    work_proof_name: workProofName,
    workVerificationStatus,
    work_verification_status: workVerificationStatus,
    workVerificationFlag,
    work_verification_flag: workVerificationFlag,
    deviceId,
    device_id: deviceId,
    authRiskScore,
    auth_risk_score: authRiskScore,
    authRiskLevel,
    auth_risk_level: authRiskLevel,
    authRiskStatus,
    auth_risk_status: authRiskStatus,
    signupTime,
    signup_time: signupTime,
    location,
  };
}

function syncOfflineUserStore(nextUser, previousUser = null) {
  if (!nextUser?.phone) {
    return;
  }

  const currentUsers = readStorage(KNOWN_USERS_KEY) || {};
  const nextUsers = { ...currentUsers };

  if (
    previousUser?.phone &&
    previousUser.phone !== nextUser.phone &&
    previousUser.id &&
    nextUser.id &&
    previousUser.id === nextUser.id
  ) {
    delete nextUsers[previousUser.phone];
  }

  nextUsers[nextUser.phone] = {
    ...(nextUsers[nextUser.phone] || {}),
    ...nextUser,
  };

  writeStorage(KNOWN_USERS_KEY, nextUsers);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function saveSessionCache(session) {
  writeStorage(SESSION_CACHE_KEY, {
    ...session,
    createdAt: new Date().toISOString(),
  });
  notifyAuthChange();
}

export function saveAuthSession({ token, user }) {
  const previousUser = getStoredUser();
  const normalizedUser = normalizeUser(user);

  if (token) {
    saveToken(token);
  } else {
    removeToken();
  }

  if (normalizedUser) {
    writeStorage(USER_KEY, normalizedUser);
    writeStorage(LEGACY_USER_KEY, normalizedUser);
    syncOfflineUserStore(normalizedUser, previousUser);
    saveSessionCache({
      id: normalizedUser.id,
      fullName: normalizedUser.full_name,
      phone: normalizedUser.phone,
      city: normalizedUser.city,
      zone: normalizedUser.zone,
      platform: normalizedUser.platform,
      weeklyIncome: normalizedUser.weekly_income,
      workType: normalizedUser.work_type,
      workerId: normalizedUser.worker_id,
      workProofName: normalizedUser.work_proof_name,
      workVerificationStatus: normalizedUser.work_verification_status,
      workVerificationFlag: normalizedUser.work_verification_flag,
      deviceId: normalizedUser.device_id,
      authRiskScore: normalizedUser.auth_risk_score,
      authRiskLevel: normalizedUser.auth_risk_level,
      authRiskStatus: normalizedUser.auth_risk_status,
    });
    return;
  }

  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  localStorage.removeItem(SESSION_CACHE_KEY);
  notifyAuthChange();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSessionCache() {
  return readStorage(SESSION_CACHE_KEY);
}

export function getStoredUser() {
  const currentUser = readStorage(USER_KEY);
  if (currentUser) {
    return normalizeUser(currentUser);
  }

  const legacyUser = readStorage(LEGACY_USER_KEY);
  if (!legacyUser) {
    return null;
  }

  const normalizedLegacyUser = normalizeUser(legacyUser);
  if (normalizedLegacyUser) {
    writeStorage(USER_KEY, normalizedLegacyUser);
  }

  return normalizedLegacyUser;
}

export function findStoredUserByPhone(phone) {
  const sanitizedPhone = sanitizePhone(phone);
  if (!sanitizedPhone) {
    return null;
  }

  const currentUser = getStoredUser();
  if (currentUser?.phone === sanitizedPhone) {
    return currentUser;
  }

  const knownUsers = readStorage(KNOWN_USERS_KEY) || {};
  const knownUser = knownUsers[sanitizedPhone];
  return knownUser ? normalizeUser(knownUser) : null;
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_CACHE_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  notifyAuthChange();
}

function isValidJwt(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function hasSessionIdentity() {
  const storedUser = getStoredUser();
  if (storedUser?.id || storedUser?.phone) {
    return true;
  }

  const sessionCache = getSessionCache();
  return Boolean(sessionCache?.id || sessionCache?.phone);
}

export function isAuthenticated() {
  const token = getToken();
  if (token) {
    return isValidJwt(token);
  }

  return hasSessionIdentity();
}

export function getUserFromToken() {
  const token = getToken();
  if (token && isValidJwt(token)) {
    try {
      const tokenUser = normalizeUser(JSON.parse(atob(token.split(".")[1])));
      const storedUser = getStoredUser();
      return normalizeUser({
        ...(tokenUser || {}),
        ...(storedUser || {}),
      });
    } catch {
      return null;
    }
  }

  const storedUser = getStoredUser();
  if (storedUser) {
    return storedUser;
  }

  const sessionCache = getSessionCache();
  if (!sessionCache) {
    return null;
  }

  return normalizeUser({
    id: sessionCache.id,
    full_name: sessionCache.fullName,
    phone: sessionCache.phone,
    city: sessionCache.city,
    zone: sessionCache.zone,
    platform: sessionCache.platform,
    weekly_income: sessionCache.weeklyIncome,
    work_type: sessionCache.workType,
    worker_id: sessionCache.workerId,
    work_proof_name: sessionCache.workProofName,
    work_verification_status: sessionCache.workVerificationStatus,
    work_verification_flag: sessionCache.workVerificationFlag,
    device_id: sessionCache.deviceId,
    auth_risk_score: sessionCache.authRiskScore,
    auth_risk_level: sessionCache.authRiskLevel,
    auth_risk_status: sessionCache.authRiskStatus,
  });
}

export function signInWithDemoAccount(overrides = {}) {
  const demoUser = normalizeUser({
    ...DEMO_ACCOUNT,
    ...overrides,
  });

  saveAuthSession({ user: demoUser });
  return demoUser;
}
