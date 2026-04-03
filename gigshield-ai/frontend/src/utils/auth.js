const TOKEN_KEY = "gigshield_token";
const DEMO_SESSION_KEY = "gigshield_demo_session";
const USER_KEY = "gigshield_user";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gigshield-auth-changed"));
  }
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    full_name: user.full_name || user.fullName,
    phone: user.phone,
    city: user.city,
    zone: user.zone,
    platform: user.platform,
    weekly_income: user.weekly_income ?? user.weeklyIncome,
    work_type: user.work_type || user.workType,
    worker_id: user.worker_id || user.workerId,
    work_proof_name: user.work_proof_name || user.workProofName,
    work_verification_status: user.work_verification_status || user.workVerificationStatus,
    work_verification_flag:
      user.work_verification_flag || user.workVerificationFlag || null,
    device_id: user.device_id || user.deviceId,
    auth_risk_score: user.auth_risk_score ?? user.authRiskScore,
    auth_risk_level: user.auth_risk_level || user.authRiskLevel,
    auth_risk_status: user.auth_risk_status || user.authRiskStatus,
  };
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function saveDemoSession(session) {
  localStorage.setItem(
    DEMO_SESSION_KEY,
    JSON.stringify({
      ...session,
      createdAt: new Date().toISOString(),
    })
  );
  notifyAuthChange();
}

export function saveAuthSession({ token, user }) {
  const normalizedUser = normalizeUser(user);

  if (token) {
    saveToken(token);
  } else {
    removeToken();
  }

  if (normalizedUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    saveDemoSession({
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

  notifyAuthChange();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getDemoSession() {
  const rawSession = localStorage.getItem(DEMO_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return null;
  }
}

export function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return normalizeUser(JSON.parse(rawUser));
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DEMO_SESSION_KEY);
  localStorage.removeItem(USER_KEY);
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
  if (token && isValidJwt(token)) {
    return true;
  }

  return Boolean(getDemoSession());
}

export function getUserFromToken() {
  const token = getToken();
  if (token && isValidJwt(token)) {
    try {
      return JSON.parse(atob(token.split(".")[1]));
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

  return {
    full_name: demoSession.fullName,
    phone: demoSession.phone,
    city: demoSession.city,
    zone: demoSession.zone,
    platform: demoSession.platform,
    work_type: demoSession.workType,
    worker_id: demoSession.workerId,
    work_proof_name: demoSession.workProofName,
    work_verification_status: demoSession.workVerificationStatus,
    work_verification_flag: demoSession.workVerificationFlag,
    device_id: demoSession.deviceId,
    auth_risk_score: demoSession.authRiskScore,
    auth_risk_level: demoSession.authRiskLevel,
    auth_risk_status: demoSession.authRiskStatus,
  };
}
