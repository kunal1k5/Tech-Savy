const TOKEN_KEY = "gigshield_token";
const DEMO_SESSION_KEY = "gigshield_demo_session";

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

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DEMO_SESSION_KEY);
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
