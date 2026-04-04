import { apiPost, unwrapApiPayload } from "./api";

export async function fetchBehaviorCheck(payload) {
  const response = await apiPost("/analyze-behavior", payload);
  return unwrapApiPayload(response.data);
}
