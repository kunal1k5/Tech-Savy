import { apiGet, apiPost, unwrapApiPayload } from "./api";

function parseBooleanFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function isLocalHostname(hostname) {
  return /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)$/i.test(String(hostname || "").trim());
}

export function isRealAuthEnabled(
  runtimeLocation = typeof window !== "undefined" ? window.location : undefined
) {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const configuredFlag = parseBooleanFlag(process.env.REACT_APP_REAL_AUTH_ENABLED);
  if (configuredFlag !== null) {
    return configuredFlag;
  }

  return Boolean(runtimeLocation && isLocalHostname(runtimeLocation.hostname));
}

function shouldFallbackToDemo(error) {
  const statusCode = error?.response?.status;
  return (
    !error?.response ||
    [404, 405, 501, 502, 503, 504].includes(statusCode)
  );
}

function normalizeOtpResponse(payload, authMode) {
  const normalizedPayload = payload || {};
  const otpCode = normalizedPayload.devOtp ?? normalizedPayload.otp;
  const otpLength = Math.max(
    4,
    Number(String(otpCode || "").length) || (authMode === "real" ? 6 : 4)
  );

  return {
    ...normalizedPayload,
    authMode,
    otp: otpCode ? String(otpCode) : "",
    otpLength,
  };
}

function normalizeAuthResponse(payload, authMode) {
  return {
    ...(payload || {}),
    authMode,
  };
}

export async function requestOtp(phone, options = {}) {
  const { purpose = "login_or_register", allowDemoFallback = true } = options;

  if (isRealAuthEnabled()) {
    try {
      const response = await apiPost("/auth/real/send-otp", { phone, purpose });
      return normalizeOtpResponse(unwrapApiPayload(response.data), "real");
    } catch (error) {
      if (!allowDemoFallback || !shouldFallbackToDemo(error)) {
        throw error;
      }
    }
  }

  const response = await apiPost("/auth/login", { phone });
  return normalizeOtpResponse(unwrapApiPayload(response.data), "demo");
}

export async function verifyOtp({
  sessionId,
  phone,
  otp,
  profile,
  authMode = "demo",
}) {
  if (authMode === "real") {
    const response = await apiPost("/auth/real/verify-otp", {
      sessionId,
      phone,
      otp,
    });
    return normalizeAuthResponse(unwrapApiPayload(response.data), "real");
  }

  const response = await apiPost("/auth/verify-otp", {
    sessionId,
    phone,
    otp,
    profile,
  });
  return normalizeAuthResponse(unwrapApiPayload(response.data), "demo");
}

export async function registerWorker(profile, options = {}) {
  const { authMode = "demo", registrationToken } = options;

  if (authMode === "real") {
    const response = await apiPost("/auth/real/register", {
      registrationToken,
      ...profile,
    });
    return normalizeAuthResponse(unwrapApiPayload(response.data), "real");
  }

  const response = await apiPost("/auth/register", profile);
  return normalizeAuthResponse(unwrapApiPayload(response.data), "demo");
}

export async function getPolicyState() {
  const response = await apiGet("/policy");
  return unwrapApiPayload(response.data);
}

export async function buyPolicy(planId) {
  const response = await apiPost("/policy/buy", { planId });
  return unwrapApiPayload(response.data);
}

export async function getPremium(risk) {
  const response = await apiGet("/premium", {
    params: risk ? { risk } : undefined,
  });
  return unwrapApiPayload(response.data);
}

export async function getClaims() {
  const response = await apiGet("/claims");
  return unwrapApiPayload(response.data);
}

export async function triggerClaim(payload) {
  const response = await apiPost("/claim/trigger", payload);
  return unwrapApiPayload(response.data);
}
