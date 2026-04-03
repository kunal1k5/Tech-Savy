const DEVICE_ID_KEY = "gigshield_device_id";
const AUTH_RISK_PROFILES_KEY = "gigshield_auth_risk_profiles";
const AUTH_ATTEMPTS_KEY = "gigshield_auth_attempts";
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const FAST_INPUT_THRESHOLD_MS = 1500;
const LOCATION_DRIFT_THRESHOLD_KM = 250;

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

function sanitizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function hashString(input) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function getBrowserInfo() {
  if (typeof window === "undefined") {
    return {
      language: "en-IN",
      platform: "server",
      timeZone: "Asia/Calcutta",
      userAgent: "server",
    };
  }

  const { navigator } = window;

  return {
    language: navigator.language || "en-IN",
    platform: navigator.platform || "web",
    userAgent: navigator.userAgent || "browser",
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta",
  };
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "gs-server-device";
  }

  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const browserInfo = getBrowserInfo();
  const randomSeed =
    window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const deviceId = `gs-${hashString(
    `${browserInfo.userAgent}|${browserInfo.platform}|${browserInfo.language}|${randomSeed}`
  )}`;

  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function getFallbackLocation() {
  const browserInfo = getBrowserInfo();

  return {
    source: "browser_context",
    latitude: null,
    longitude: null,
    accuracy: null,
    timeZone: browserInfo.timeZone,
    locale: browserInfo.language,
  };
}

async function canReadGeolocationSilently() {
  if (typeof window === "undefined" || !window.navigator?.geolocation) {
    return false;
  }

  if (!window.navigator.permissions?.query) {
    return false;
  }

  try {
    const permissionStatus = await window.navigator.permissions.query({
      name: "geolocation",
    });
    return permissionStatus.state === "granted";
  } catch {
    return false;
  }
}

export async function captureApproximateLocation({ timeoutMs = 1200 } = {}) {
  const fallbackLocation = getFallbackLocation();

  if (!(await canReadGeolocationSilently())) {
    return fallbackLocation;
  }

  return new Promise((resolve) => {
    let hasSettled = false;

    const finish = (location) => {
      if (hasSettled) {
        return;
      }

      hasSettled = true;
      resolve(location);
    };

    const timeoutId = window.setTimeout(() => {
      finish(fallbackLocation);
    }, timeoutMs);

    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);

        finish({
          source: "geolocation",
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          accuracy: position.coords.accuracy ? Math.round(position.coords.accuracy) : null,
          timeZone: fallbackLocation.timeZone,
          locale: fallbackLocation.locale,
        });
      },
      () => {
        window.clearTimeout(timeoutId);
        finish(fallbackLocation);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: timeoutMs,
      }
    );
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(firstLocation, secondLocation) {
  if (
    firstLocation?.latitude == null ||
    firstLocation?.longitude == null ||
    secondLocation?.latitude == null ||
    secondLocation?.longitude == null
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(secondLocation.latitude - firstLocation.latitude);
  const deltaLongitude = toRadians(secondLocation.longitude - firstLocation.longitude);
  const firstLatitude = toRadians(firstLocation.latitude);
  const secondLatitude = toRadians(secondLocation.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function hasDrasticLocationChange(previousLocation, nextLocation) {
  if (!previousLocation || !nextLocation) {
    return false;
  }

  const distanceKm = getDistanceKm(previousLocation, nextLocation);
  if (distanceKm != null) {
    return distanceKm > LOCATION_DRIFT_THRESHOLD_KM;
  }

  return Boolean(
    previousLocation.timeZone &&
      nextLocation.timeZone &&
      previousLocation.timeZone !== nextLocation.timeZone
  );
}

function getAttemptStore() {
  return readStorage(AUTH_ATTEMPTS_KEY, {});
}

export function getLoginAttemptCount(phone) {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone) {
    return 0;
  }

  const attempts = getAttemptStore();
  const recentAttempts = (attempts[sanitizedPhone] || []).filter(
    (attemptTimestamp) => Date.now() - attemptTimestamp < ATTEMPT_WINDOW_MS
  );

  if (recentAttempts.length !== (attempts[sanitizedPhone] || []).length) {
    writeStorage(AUTH_ATTEMPTS_KEY, {
      ...attempts,
      [sanitizedPhone]: recentAttempts,
    });
  }

  return recentAttempts.length;
}

export function recordLoginAttempt(phone) {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone) {
    return 0;
  }

  const attempts = getAttemptStore();
  const nextAttempts = [
    ...(attempts[sanitizedPhone] || []).filter(
      (attemptTimestamp) => Date.now() - attemptTimestamp < ATTEMPT_WINDOW_MS
    ),
    Date.now(),
  ];

  writeStorage(AUTH_ATTEMPTS_KEY, {
    ...attempts,
    [sanitizedPhone]: nextAttempts,
  });

  return nextAttempts.length;
}

function getRiskProfiles() {
  return readStorage(AUTH_RISK_PROFILES_KEY, {});
}

function getReferenceLocation(profiles, phone, deviceId) {
  const ownProfile = profiles[phone];
  if (ownProfile?.location) {
    return ownProfile.location;
  }

  const matchingDeviceProfiles = Object.values(profiles)
    .filter((profile) => profile.deviceId === deviceId && profile.phone !== phone && profile.location)
    .sort(
      (firstProfile, secondProfile) =>
        new Date(secondProfile.lastSeenAt || secondProfile.createdAt || 0).getTime() -
        new Date(firstProfile.lastSeenAt || firstProfile.createdAt || 0).getTime()
    );

  return matchingDeviceProfiles[0]?.location || null;
}

function getSameDeviceUserCount(profiles, deviceId, phone) {
  return Object.values(profiles).filter(
    (profile) => profile.deviceId === deviceId && profile.phone !== phone
  ).length;
}

export function evaluateAuthRisk({
  formFillTime = 0,
  loginAttempts = 0,
  sameDeviceUsers = 0,
  locationChange = false,
}) {
  let riskScore = 0;

  if (formFillTime < FAST_INPUT_THRESHOLD_MS) {
    riskScore += 20;
  }

  if (loginAttempts > 3) {
    riskScore += 25;
  }

  if (sameDeviceUsers > 2) {
    riskScore += 30;
  }

  if (locationChange) {
    riskScore += 25;
  }

  let riskLevel = "low";
  let riskStatus = "Safe";
  let trustLevel = "high";

  if (riskScore > 60) {
    riskLevel = "high";
    riskStatus = "Flag";
    trustLevel = "low";
  } else if (riskScore > 30) {
    riskLevel = "medium";
    riskStatus = "Monitor";
    trustLevel = "medium";
  }

  return {
    riskScore,
    riskLevel,
    riskStatus,
    trustLevel,
  };
}

export async function createAuthRiskSnapshot({
  phone,
  flow = "login",
  formStartedAt,
}) {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  const deviceId = getOrCreateDeviceId();
  const profiles = getRiskProfiles();
  const location = await captureApproximateLocation();
  const loginAttempts = flow === "login" ? getLoginAttemptCount(sanitizedPhone) : 0;
  const sameDeviceUsers = getSameDeviceUserCount(profiles, deviceId, sanitizedPhone);
  const referenceLocation = getReferenceLocation(profiles, sanitizedPhone, deviceId);
  const locationChange = hasDrasticLocationChange(referenceLocation, location);
  const formFillTime = Math.max(0, Date.now() - Number(formStartedAt || Date.now()));
  const risk = evaluateAuthRisk({
    formFillTime,
    loginAttempts,
    sameDeviceUsers,
    locationChange,
  });

  return {
    phone: sanitizedPhone,
    flow,
    deviceId,
    browserInfo: getBrowserInfo(),
    location,
    signupTime: flow === "signup" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    signals: {
      formFillTime,
      loginAttempts,
      sameDeviceUsers,
      locationChange,
    },
    internalFlags: {
      sameDeviceMultipleAccounts: sameDeviceUsers > 0,
    },
    ...risk,
  };
}

export function saveAuthRiskSnapshot(snapshot) {
  const phone = sanitizePhoneNumber(snapshot?.phone);
  if (!phone) {
    return null;
  }

  const currentProfiles = getRiskProfiles();
  const currentProfile = currentProfiles[phone] || null;
  const nextProfile = {
    ...currentProfile,
    ...snapshot,
    phone,
    signupTime: currentProfile?.signupTime || snapshot.signupTime || null,
    lastSeenAt: new Date().toISOString(),
  };

  writeStorage(AUTH_RISK_PROFILES_KEY, {
    ...currentProfiles,
    [phone]: nextProfile,
  });

  return nextProfile;
}

export function getAuthRiskProfile(phone) {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone) {
    return null;
  }

  return getRiskProfiles()[sanitizedPhone] || null;
}

export async function assessAndSaveAuthRisk({ phone, flow, formStartedAt }) {
  const snapshot = await createAuthRiskSnapshot({
    phone,
    flow,
    formStartedAt,
  });

  return saveAuthRiskSnapshot(snapshot);
}

export { sanitizePhoneNumber };
