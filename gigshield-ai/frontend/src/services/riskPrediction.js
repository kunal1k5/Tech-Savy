const SAMPLE_RISK_PAYLOAD = {
  temperature: 38,
  humidity: 88,
  wind: 32,
  pressure: 996,
  rain: 28,
  cloud: 90,
  uv: 10,
  pm25: 140,
  pm10: 220,
  visibility: 2,
  gust: 44,
};

function resolveRiskApiBaseUrl() {
  if (process.env.REACT_APP_FLASK_API_URL) {
    return process.env.REACT_APP_FLASK_API_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return origin;
  }

  return "http://localhost:8000";
}

export async function predictRisk(payload) {
  const response = await fetch(`${resolveRiskApiBaseUrl()}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Unable to fetch risk prediction.");
  }

  return data;
}

export async function fetchLiveWeather(city) {
  const query = new URLSearchParams({ city }).toString();
  const response = await fetch(`${resolveRiskApiBaseUrl()}/weather/live?${query}`);

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Unable to fetch live weather.");
  }

  return data;
}

export async function predictLiveRisk(city) {
  const response = await fetch(`${resolveRiskApiBaseUrl()}/predict/live`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ city }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Unable to predict live risk.");
  }

  return data;
}

export { SAMPLE_RISK_PAYLOAD };
