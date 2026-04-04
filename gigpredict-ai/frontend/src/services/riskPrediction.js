import { buildApiUrl, unwrapApiPayload } from "./api";

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function predictRisk(payload) {
  const response = await fetch(buildApiUrl("/predict"), {
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

export async function fetchLiveWeather(city) {
  const query = new URLSearchParams({ city }).toString();
  const response = await fetch(`${buildApiUrl("/weather/live")}?${query}`);
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Service unavailable.");
  }

  return unwrapApiPayload(data);
}

export async function predictLiveRisk(city) {
  const response = await fetch(buildApiUrl("/predict/live"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ city }),
  });

  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Service unavailable.");
  }

  return unwrapApiPayload(data);
}
