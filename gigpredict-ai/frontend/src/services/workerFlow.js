import { apiGet, apiPost, unwrapApiPayload } from "./api";
export async function requestOtp(phone) {
  const response = await apiPost("/auth/login", { phone });
  return unwrapApiPayload(response.data);
}

export async function verifyOtp({
  sessionId,
  phone,
  otp,
  profile,
}) {
  const response = await apiPost("/auth/verify-otp", {
    sessionId,
    phone,
    otp,
    profile,
  });
  return unwrapApiPayload(response.data);
}

export async function registerWorker(profile) {
  const response = await apiPost("/auth/register", profile);
  return unwrapApiPayload(response.data);
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
