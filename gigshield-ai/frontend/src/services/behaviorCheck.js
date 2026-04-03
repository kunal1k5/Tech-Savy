import api from "./api";

export const SAMPLE_BEHAVIOR_PAYLOAD = {
  claims_count: 3,
  last_claim_time: "02:30",
  working_hours: [9, 18],
  login_attempts: 5,
};

export async function fetchBehaviorCheck(payload = SAMPLE_BEHAVIOR_PAYLOAD) {
  const response = await api.post("/analyze-behavior", payload);
  return response.data;
}
