/**
 * API Service — Centralised Axios instance for backend communication.
 *
 * Automatically attaches JWT token from localStorage to every request.
 * Base URL is configured via REACT_APP_API_URL environment variable.
 */

import axios from "axios";

const API_BASE_CACHE_KEY = "gigshield_api_base_url";
const BACKEND_SERVICE_NAME = "gigshield-ai-backend";
const DISCOVERY_TIMEOUT_MS = 1200;

let resolvedApiBaseUrl =
  (typeof window !== "undefined" && window.localStorage.getItem(API_BASE_CACHE_KEY)) ||
  process.env.REACT_APP_API_URL ||
  "";
let discoveryPromise = null;

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/$/, "");
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildCandidateApiBaseUrls() {
  const candidates = [];
  const configuredBaseUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL);
  if (configuredBaseUrl) {
    candidates.push(configuredBaseUrl);
  }

  if (typeof window === "undefined") {
    return candidates.length ? candidates : ["/api"];
  }

  const { origin, hostname } = window.location;
  if (!isLocalHostname(hostname)) {
    candidates.push(`${origin}/api`);
  } else {
    candidates.push("http://localhost:5001/api");
    candidates.push("http://127.0.0.1:5001/api");
    candidates.push("http://localhost:5000/api");
    candidates.push("http://127.0.0.1:5000/api");
    candidates.push(`${origin}/api`);
  }

  return [...new Set(candidates.map(normalizeBaseUrl).filter(Boolean))];
}

async function probeApiBaseUrl(baseUrl) {
  if (typeof window === "undefined") {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data?.service === BACKEND_SERVICE_NAME;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function discoverApiBaseUrl() {
  const candidates = buildCandidateApiBaseUrls();
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const isValid = await probeApiBaseUrl(candidate);
    if (isValid) {
      return candidate;
    }
  }

  return candidates[0] || "/api";
}

async function ensureApiBaseUrl(forceRefresh = false) {
  if (!forceRefresh && resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  if (!forceRefresh && discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = discoverApiBaseUrl()
    .then((baseUrl) => {
      resolvedApiBaseUrl = normalizeBaseUrl(baseUrl) || "/api";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(API_BASE_CACHE_KEY, resolvedApiBaseUrl);
      }
      return resolvedApiBaseUrl;
    })
    .finally(() => {
      discoveryPromise = null;
    });

  return discoveryPromise;
}

function resolveApiBaseUrl() {
  if (resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  const candidates = buildCandidateApiBaseUrls();
  return candidates[0] || "/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

export const DEFAULT_WEATHER_PAYLOAD = {
  temperature: 35,
  humidity: 80,
  precip_mm: 20,
  wind_kph: 25,
  aqi: 200,
};

export const DEFAULT_LOCATION_PAYLOAD = {
  current_location: "Zone-A",
  actual_location: "Zone-Z",
  time: "14:00",
};

export const DEFAULT_BEHAVIOR_PAYLOAD = {
  claims_count: 3,
  last_claim_time: "02:30",
  working_hours: [9, 18],
  login_attempts: 5,
};

export const DEFAULT_FRAUD_PAYLOAD = {
  weather: DEFAULT_WEATHER_PAYLOAD,
  location: DEFAULT_LOCATION_PAYLOAD,
  behavior: DEFAULT_BEHAVIOR_PAYLOAD,
  context_valid: false,
};

const WEATHER_FIELDS = ["temperature", "humidity", "precip_mm", "wind_kph", "aqi"];
const LOCATION_FIELDS = ["current_location", "actual_location", "time", "day_of_week"];
const BEHAVIOR_FIELDS = ["claims_count", "last_claim_time", "working_hours", "login_attempts"];

function pickFields(source, fieldNames) {
  return fieldNames.reduce((result, fieldName) => {
    if (source[fieldName] !== undefined) {
      result[fieldName] = source[fieldName];
    }
    return result;
  }, {});
}

export function buildFraudPayload(overrides = {}) {
  const normalizedOverrides =
    overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};

  const {
    weather,
    location,
    behavior,
    ...topLevelOverrides
  } = normalizedOverrides;

  return {
    ...DEFAULT_FRAUD_PAYLOAD,
    ...topLevelOverrides,
    weather: {
      ...DEFAULT_WEATHER_PAYLOAD,
      ...pickFields(topLevelOverrides, WEATHER_FIELDS),
      ...(weather || {}),
    },
    location: {
      ...DEFAULT_LOCATION_PAYLOAD,
      ...pickFields(topLevelOverrides, LOCATION_FIELDS),
      ...(location || {}),
    },
    behavior: {
      ...DEFAULT_BEHAVIOR_PAYLOAD,
      ...pickFields(topLevelOverrides, BEHAVIOR_FIELDS),
      ...(behavior || {}),
    },
    context_valid:
      normalizedOverrides.context_valid !== undefined
        ? normalizedOverrides.context_valid
        : DEFAULT_FRAUD_PAYLOAD.context_valid,
  };
}

export function buildWeatherPayload(overrides = {}) {
  return buildFraudPayload(overrides).weather;
}

export async function getFraudStatus(payload = DEFAULT_FRAUD_PAYLOAD) {
  const response = await api.post("/fraud-check", buildFraudPayload(payload));
  return response.data;
}

export async function getRisk(payload = DEFAULT_FRAUD_PAYLOAD) {
  const fraudData = await getFraudStatus(payload);
  return {
    risk: fraudData.risk,
    fraud_score: fraudData.fraud_score,
    status: fraudData.status,
    source: "fraud-check",
    intelligence: fraudData.intelligence,
  };
}

export async function getPremium(payload = DEFAULT_FRAUD_PAYLOAD) {
  const response = await api.post("/calculate-premium", buildWeatherPayload(payload));
  return response.data;
}

export async function getSystemSnapshot(payload = DEFAULT_FRAUD_PAYLOAD) {
  const [fraudData, premiumData] = await Promise.all([
    getFraudStatus(payload),
    getPremium(payload),
  ]);

  return {
    ...fraudData,
    premium: premiumData.premium,
    premium_risk: premiumData.risk,
    premium_source: premiumData.source,
    premium_warning: premiumData.warning || null,
    refreshed_at: new Date().toISOString(),
  };
}

// Attach token to outgoing requests
api.interceptors.request.use(async (config) => {
  config.baseURL = await ensureApiBaseUrl();
  const token = localStorage.getItem("gigshield_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 404 &&
      typeof window !== "undefined" &&
      error.config &&
      !error.config.__gigshieldRetried
    ) {
      const refreshedBaseUrl = await ensureApiBaseUrl(true);
      error.config.__gigshieldRetried = true;
      error.config.baseURL = refreshedBaseUrl;
      return api.request(error.config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("gigshield_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
