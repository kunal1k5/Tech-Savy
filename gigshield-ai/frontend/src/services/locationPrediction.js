const SAMPLE_LOCATION_PAYLOAD = {
  origin_id: 0,
  day_of_week: 5,
  hour_of_day: 12,
  travel_time_mean: 4503,
  lower_bound: 3699,
  upper_bound: 5480,
  actual_destination_id: 1315,
};

function resolveLocationApiBaseUrl() {
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

export async function predictNextLocation(payload) {
  const response = await fetch(`${resolveLocationApiBaseUrl()}/predict-location`, {
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
    throw new Error(data?.error || "Unable to predict next destination.");
  }

  return data;
}

export { SAMPLE_LOCATION_PAYLOAD };
