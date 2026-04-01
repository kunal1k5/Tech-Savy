import api from "./api";

export async function requestOtp(phone) {
  const response = await api.post("/auth/login", { phone });
  return response.data;
}

export async function verifyOtp({ sessionId, phone, otp, profile }) {
  const response = await api.post("/auth/verify-otp", {
    sessionId,
    phone,
    otp,
    profile,
  });
  return response.data;
}

export async function registerWorker(profile) {
  const response = await api.post("/auth/register", profile);
  return response.data;
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
