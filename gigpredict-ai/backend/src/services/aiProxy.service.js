const aiService = require("../integrations/aiService");
const { clampNumber, ensureObject } = require("../utils/inputSafety");

const DETAILED_RISK_FIELDS = [
  "temperature",
  "humidity",
  "wind",
  "pressure",
  "rain",
  "cloud",
  "uv",
  "pm25",
  "pm10",
  "visibility",
  "gust",
];

const DEFAULT_LIVE_WEATHER = {
  temperature: 31,
  humidity: 72,
  wind: 18,
  pressure: 1008,
  rain: 6,
  cloud: 58,
  uv: 6,
  pm25: 64,
  pm10: 98,
  visibility: 6,
  gust: 24,
};

function validateDetailedRiskPayload(payload) {
  const safePayload = ensureObject(payload);

  return {
    temperature: clampNumber(safePayload?.temperature, { min: -50, max: 60, defaultValue: 0 }),
    humidity: clampNumber(safePayload?.humidity, { min: 0, max: 100, defaultValue: 0 }),
    wind: clampNumber(safePayload?.wind, { min: 0, max: 100, defaultValue: 0 }),
    pressure: clampNumber(safePayload?.pressure, { min: 800, max: 1200, defaultValue: 1000 }),
    rain: clampNumber(safePayload?.rain, { min: 0, max: 100, defaultValue: 0 }),
    cloud: clampNumber(safePayload?.cloud, { min: 0, max: 100, defaultValue: 0 }),
    uv: clampNumber(safePayload?.uv, { min: 0, max: 20, defaultValue: 0 }),
    pm25: clampNumber(safePayload?.pm25, { min: 0, max: 1000, defaultValue: 0 }),
    pm10: clampNumber(safePayload?.pm10, { min: 0, max: 1000, defaultValue: 0 }),
    visibility: clampNumber(safePayload?.visibility, { min: 0, max: 100, defaultValue: 0 }),
    gust: clampNumber(safePayload?.gust, { min: 0, max: 150, defaultValue: 0 }),
  };
}

function clampScore(score, min = 0, max = 100) {
  return Math.min(Math.max(score, min), max);
}

function scoreToRiskLabel(score) {
  if (score >= 68) {
    return "High Risk";
  }

  if (score >= 36) {
    return "Medium Risk";
  }

  return "Low Risk";
}

function buildProbabilities(score) {
  const normalizedScore = clampScore(score, 0, 100) / 100;
  let low = 0.15;
  let medium = 0.2;
  let high = 0.15;

  if (normalizedScore >= 0.68) {
    high = 0.7;
    medium = 0.2;
    low = 0.1;
  } else if (normalizedScore >= 0.36) {
    high = 0.22;
    medium = 0.56;
    low = 0.22;
  } else {
    high = 0.08;
    medium = 0.24;
    low = 0.68;
  }

  return {
    "Low Risk": Number(low.toFixed(4)),
    "Medium Risk": Number(medium.toFixed(4)),
    "High Risk": Number(high.toFixed(4)),
  };
}

function buildFallbackDetailedRiskPrediction(payload, source = "backend-fallback") {
  const score = clampScore(
    (payload.rain > 20 ? 24 : payload.rain > 5 ? 12 : 0)
      + (Math.max(payload.pm25, payload.pm10) > 180 ? 20 : Math.max(payload.pm25, payload.pm10) > 80 ? 10 : 0)
      + (payload.gust > 35 || payload.wind > 25 ? 16 : payload.gust > 20 || payload.wind > 15 ? 8 : 0)
      + (payload.visibility < 4 ? 14 : payload.visibility < 7 ? 7 : 0)
      + (payload.uv > 8 ? 10 : payload.uv > 5 ? 5 : 0)
      + (payload.cloud > 75 ? 8 : payload.cloud > 45 ? 4 : 0),
  );
  const risk = scoreToRiskLabel(score);

  return {
    risk,
    prediction_class: risk === "High Risk" ? 2 : risk === "Medium Risk" ? 1 : 0,
    probabilities: buildProbabilities(score),
    feature_mode: source,
    features: payload,
  };
}

function buildFallbackWeather(city) {
  const seed = String(city || "Bengaluru")
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

  return {
    city: city || "Bengaluru",
    resolved_location: {
      name: city || "Bengaluru",
      region: "",
      country: "India",
      localtime: new Date().toISOString(),
    },
    weather: {
      ...DEFAULT_LIVE_WEATHER,
      temperature: DEFAULT_LIVE_WEATHER.temperature + (seed % 4),
      humidity: DEFAULT_LIVE_WEATHER.humidity + (seed % 6),
      rain: seed % 2 === 0 ? 8 : 2,
      pm25: DEFAULT_LIVE_WEATHER.pm25 + (seed % 30),
      pm10: DEFAULT_LIVE_WEATHER.pm10 + (seed % 40),
    },
    source: "backend-fallback-weather",
    warning: "AI weather service unavailable. Using fallback weather sample.",
  };
}

async function proxyDetailedRiskPrediction(payload) {
  const validatedPayload = validateDetailedRiskPayload(payload);

  try {
    return await aiService.predictRisk(validatedPayload);
  } catch {
    return buildFallbackDetailedRiskPrediction(validatedPayload);
  }
}

async function proxyWeatherLookup(city) {
  const trimmedCity = String(city || "Bengaluru").trim() || "Bengaluru";

  try {
    return await aiService.fetchWeather(trimmedCity);
  } catch {
    return buildFallbackWeather(trimmedCity);
  }
}

async function proxyLiveRiskPrediction(payload) {
  const safePayload = ensureObject(payload);
  const city = String(safePayload?.city || safePayload?.location || "Bengaluru").trim() || "Bengaluru";

  try {
    return await aiService.predictLiveRisk({ city });
  } catch {
    const fallbackWeather = buildFallbackWeather(city);
    return {
      ...buildFallbackDetailedRiskPrediction(fallbackWeather.weather, "backend-live-fallback"),
      city: fallbackWeather.city,
      resolved_location: fallbackWeather.resolved_location,
      weather: fallbackWeather.weather,
      source: fallbackWeather.source,
      warning: fallbackWeather.warning,
    };
  }
}

module.exports = {
  buildFallbackDetailedRiskPrediction,
  buildFallbackWeather,
  proxyDetailedRiskPrediction,
  proxyLiveRiskPrediction,
  proxyWeatherLookup,
  validateDetailedRiskPayload,
};
