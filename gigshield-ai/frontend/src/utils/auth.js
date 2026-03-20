/**
 * Auth Utilities — Token management helpers
 */

export function saveToken(token) {
  localStorage.setItem("gigshield_token", token);
}

export function getToken() {
  return localStorage.getItem("gigshield_token");
}

export function removeToken() {
  localStorage.removeItem("gigshield_token");
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}
