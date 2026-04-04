const TOKEN_KEY = "gigshield_token";
const DEMO_SESSION_KEY = "gigshield_demo_session";
const USER_KEY = "user";
const LEGACY_USER_KEY = "gigshield_user";
const OFFLINE_USERS_KEY = "gigshield_offline_users";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gigshield-auth-changed"));
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
    id: user.id || (phone ? `demo-user-${phone}` : null),
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

  const currentUsers = readStorage(OFFLINE_USERS_KEY) || {};
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

  writeStorage(OFFLINE_USERS_KEY, nextUsers);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function saveDemoSession(session) {
  writeStorage(DEMO_SESSION_KEY, {
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
    saveDemoSession({
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
  localStorage.removeItem(DEMO_SESSION_KEY);
  notifyAuthChange();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getDemoSession() {
  return readStorage(DEMO_SESSION_KEY);
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

  const offlineUsers = readStorage(OFFLINE_USERS_KEY) || {};
  const offlineUser = offlineUsers[sanitizedPhone];
  return offlineUser ? normalizeUser(offlineUser) : null;
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DEMO_SESSION_KEY);
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

export function isAuthenticated() {
  const token = getToken();
  return Boolean(token && isValidJwt(token));
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

  const demoSession = getDemoSession();
  if (!demoSession) {
    return null;
  }

  return normalizeUser({
    id: demoSession.id,
    full_name: demoSession.fullName,
    phone: demoSession.phone,
    city: demoSession.city,
    zone: demoSession.zone,
    platform: demoSession.platform,
    weekly_income: demoSession.weeklyIncome,
    work_type: demoSession.workType,
    worker_id: demoSession.workerId,
    work_proof_name: demoSession.workProofName,
    work_verification_status: demoSession.workVerificationStatus,
    work_verification_flag: demoSession.workVerificationFlag,
    device_id: demoSession.deviceId,
    auth_risk_score: demoSession.authRiskScore,
    auth_risk_level: demoSession.authRiskLevel,
    auth_risk_status: demoSession.authRiskStatus,
  });
}
