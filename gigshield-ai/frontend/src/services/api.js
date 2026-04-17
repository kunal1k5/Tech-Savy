import axios from "axios";
import { clearSession, getToken } from "../utils/auth";

const LOCAL_API_BASE_URL = "http://localhost:5000/api";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalHostname(value) {
  return /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)$/i.test(String(value || "").trim());
}

export function resolveApiBaseUrl(runtimeLocation = typeof window !== "undefined" ? window.location : undefined) {
  const configuredBaseUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (runtimeLocation) {
    return isLocalHostname(runtimeLocation.hostname) ? LOCAL_API_BASE_URL : "/api";
  }

  return LOCAL_API_BASE_URL;
}

function normalizeRequestPath(path = "") {
  const value = String(path || "").trim();
  if (!value) {
    return "";
  }

  return value.startsWith("/") ? value : `/${value}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function buildApiUrl(path = "") {
  const normalizedPath = normalizeRequestPath(path);
  return `${API_BASE_URL}${normalizedPath}`;
}

export function unwrapApiPayload(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.prototype.hasOwnProperty.call(payload, "success")
  ) {
    return payload.data;
  }

  return payload;
}

function unwrapAxiosResponse(response) {
  return unwrapApiPayload(response?.data);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const DEFAULT_WEATHER_PAYLOAD = {
  temperature: 35,
  humidity: 80,
  precip_mm: 20,
  wind_kph: 25,
  aqi: 200,
};

export const DEFAULT_RISK_PREMIUM_INPUT = {
  aqi: 90,
  rain: 2,
  wind: 12,
};

export const DEFAULT_AUTO_CLAIM_INPUT = {
  risk: "LOW",
  isWorking: true,
  ordersCompleted: 1,
  duration: 60,
  workingMinutes: 60,
  earnings: 150,
  hoursLost: 1,
  hourlyRate: 150,
};

export const DEFAULT_AI_DECISION_INPUT = {
  aqi: 90,
  rain: 2,
  wind: 12,
  claimsCount: 1,
  loginAttempts: 1,
  locationMatch: true,
  contextValid: true,
};

export const DEFAULT_DEMO_SIMULATION_INPUT = {
  rain: 120,
  aqi: 100,
  demand: 50,
  time: "afternoon",
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

function hasDirectSignalOverrides(overrides = {}) {
  return [
    "risk",
    "locationMatch",
    "location_match",
    "location_signal",
    "claimsCount",
    "claims_count",
    "loginAttempts",
    "login_attempts",
    "contextValid",
    "context_valid",
    "behavior_status",
    "behavior_score",
    "fraud_score",
    "status",
  ].some((fieldName) => overrides[fieldName] !== undefined);
}

function pickFields(source, fieldNames) {
  return fieldNames.reduce((result, fieldName) => {
    if (source[fieldName] !== undefined) {
      result[fieldName] = source[fieldName];
    }
    return result;
  }, {});
}

export function extractApiErrorMessage(error, fallbackMessage = "Service unavailable.") {
  const validationDetails = error?.response?.data?.details;
  if (Array.isArray(validationDetails) && validationDetails.length > 0) {
    return validationDetails.join(", ");
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message ||
    fallbackMessage
  );
}

export function buildFraudPayload(overrides = {}) {
  const normalizedOverrides =
    overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};

  const { weather, location, behavior, ...topLevelOverrides } = normalizedOverrides;
  const payload = {
    ...topLevelOverrides,
    context_valid:
      normalizedOverrides.context_valid !== undefined
        ? normalizedOverrides.context_valid
        : normalizedOverrides.contextValid !== undefined
          ? normalizedOverrides.contextValid
        : DEFAULT_FRAUD_PAYLOAD.context_valid,
  };
  const shouldIncludeDefaultStructures =
    !hasDirectSignalOverrides(topLevelOverrides) || weather || location || behavior;

  if (shouldIncludeDefaultStructures) {
    payload.weather = {
      ...DEFAULT_WEATHER_PAYLOAD,
      ...pickFields(topLevelOverrides, WEATHER_FIELDS),
      ...(weather || {}),
    };
    payload.location = {
      ...DEFAULT_LOCATION_PAYLOAD,
      ...pickFields(topLevelOverrides, LOCATION_FIELDS),
      ...(location || {}),
    };
    payload.behavior = {
      ...DEFAULT_BEHAVIOR_PAYLOAD,
      ...pickFields(topLevelOverrides, BEHAVIOR_FIELDS),
      ...(behavior || {}),
    };
  }

  return payload;
}

export function buildWeatherPayload(overrides = {}) {
  return buildFraudPayload(overrides).weather;
}

export function apiGet(path, config) {
  return api.get(normalizeRequestPath(path), config);
}

export function apiPost(path, data, config) {
  return api.post(normalizeRequestPath(path), data, config);
}

export async function getFraudStatus(payload = DEFAULT_FRAUD_PAYLOAD) {
  const response = await apiPost("/fraud-check", buildFraudPayload(payload));
  return unwrapAxiosResponse(response);
}

export async function getRisk(payload = DEFAULT_FRAUD_PAYLOAD) {
  const fraudData = await getFraudStatus(payload);
  return {
    risk: fraudData?.risk || null,
    premium: fraudData?.premium ?? null,
    fraud_score: fraudData?.fraud_score ?? null,
    status: fraudData?.status || null,
    source: fraudData?.source || "fraud-check",
    intelligence: fraudData?.intelligence || null,
  };
}

export async function getPremium(payload = DEFAULT_FRAUD_PAYLOAD) {
  const response = await apiPost("/calculate-premium", buildWeatherPayload(payload));
  return unwrapAxiosResponse(response);
}

export async function getRiskPremium(payload = DEFAULT_RISK_PREMIUM_INPUT) {
  const response = await apiPost("/risk-premium", payload);
  return unwrapAxiosResponse(response);
}

export async function getAutoClaim(payload = DEFAULT_AUTO_CLAIM_INPUT) {
  const response = await apiPost("/auto-claim", payload);
  return unwrapAxiosResponse(response);
}

export async function getAiDecision(payload = DEFAULT_AI_DECISION_INPUT) {
  const response = await apiPost("/ai-decision", payload);
  return unwrapAxiosResponse(response);
}

export async function startDispute(payload) {
  const response = await apiPost("/start-dispute", payload);
  return unwrapAxiosResponse(response);
}

export async function uploadProof({ disputeId, geoImage, workScreenshot }) {
  const response = await api.postForm(normalizeRequestPath("/upload-proof"), {
    disputeId,
    geoImage,
    workScreenshot,
  });

  return unwrapAxiosResponse(response);
}

export async function uploadClaimProof({
  userId,
  claimId,
  proofType,
  file,
  latitude,
  longitude,
  claimTime,
  city,
  zone,
  metadata = {},
}) {
  const response = await api.postForm(normalizeRequestPath("/upload-proof"), {
    user_id: userId,
    claim_id: claimId,
    proof_type: proofType,
    file,
    latitude,
    longitude,
    claim_time: claimTime,
    city,
    zone,
    metadata_json: JSON.stringify(metadata),
  });

  return unwrapAxiosResponse(response);
}

export async function reverifyClaim(payload) {
  const response = await apiPost("/reverify-claim", payload);
  return unwrapAxiosResponse(response);
}

export async function getActiveTriggers() {
  const response = await apiGet("/triggers");
  return unwrapAxiosResponse(response);
}

export async function runDemoSimulation(payload = DEFAULT_DEMO_SIMULATION_INPUT) {
  const response = await apiPost("/demo/simulate", payload);
  return unwrapAxiosResponse(response);
}

export async function getSystemSnapshot(payload = DEFAULT_FRAUD_PAYLOAD) {
  return getFraudStatus(payload);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gigpredict_ai_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestHeaders = error?.config?.headers || {};
    const requestHadAuthorization = Boolean(
      requestHeaders.Authorization || requestHeaders.authorization
    );

    if (error.response?.status === 401 && requestHadAuthorization && getToken()) {
      clearSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
