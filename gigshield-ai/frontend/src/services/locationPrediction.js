import { buildApiUrl, unwrapApiPayload } from "./api";

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function predictNextLocation(payload) {
  const response = await fetch(buildApiUrl("/predict-location"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Service unavailable.");
  }

  return unwrapApiPayload(data);
}
