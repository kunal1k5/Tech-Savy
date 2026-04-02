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
  };
}
