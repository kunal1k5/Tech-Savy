import { apiPost, unwrapApiPayload } from "./api";

export async function fetchLocationCheck(payload) {
  const response = await apiPost("/predict-location", payload);
  return unwrapApiPayload(response.data);
}
