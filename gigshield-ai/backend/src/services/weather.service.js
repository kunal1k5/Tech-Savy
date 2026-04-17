const axios = require("axios");

const logger = require("../utils/logger");

const OPENWEATHER_BASE_URL =
  process.env.OPENWEATHER_BASE_URL || "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_TIMEOUT_MS = Number(process.env.OPENWEATHER_TIMEOUT_MS || 8000);
const OPENWEATHER_UNITS = process.env.OPENWEATHER_UNITS || "metric";

const DEFAULT_WEATHER_DATA = Object.freeze({
  rain: 0,
  temperature: 0,
  condition: "Unknown",
});

const weatherCache = new Map();

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRainValue(payload) {
  return toNumber(payload?.rain?.["1h"], DEFAULT_WEATHER_DATA.rain);
}

function normalizeCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWeatherPayload(payload = {}) {
  return {
    rain: normalizeRainValue(payload),
    temperature: toNumber(payload?.main?.temp, DEFAULT_WEATHER_DATA.temperature),
    condition: String(
      payload?.weather?.[0]?.main ||
        payload?.weather?.[0]?.description ||
        DEFAULT_WEATHER_DATA.condition
    ),
  };
}

function buildCacheKey(lat, lon) {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLon = normalizeCoordinate(lon);

  if (normalizedLat === null || normalizedLon === null) {
    return "global";
  }

  return `${normalizedLat.toFixed(4)},${normalizedLon.toFixed(4)}`;
}

function getCachedWeather(cacheKey) {
  if (!cacheKey) {
    return null;
  }

  return weatherCache.get(cacheKey) || weatherCache.get("global") || null;
}

function getLastKnownWeather(lat, lon) {
  const cacheKey = buildCacheKey(lat, lon);
  return getCachedWeather(cacheKey);
}

async function getWeatherData(lat, lon) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const resolvedLat = normalizeCoordinate(lat);
    const resolvedLon = normalizeCoordinate(lon);
    const cacheKey = buildCacheKey(resolvedLat, resolvedLon);

    if (!apiKey) {
      throw new Error("OPENWEATHER_API_KEY is not configured");
    }

    if (resolvedLat === null || resolvedLon === null) {
      throw new Error("Latitude/longitude is required for OpenWeather lookups");
    }

    const response = await axios.get(OPENWEATHER_BASE_URL, {
      timeout: OPENWEATHER_TIMEOUT_MS,
      params: {
        lat: resolvedLat,
        lon: resolvedLon,
        appid: apiKey,
        units: OPENWEATHER_UNITS,
      },
    });

    const normalized = normalizeWeatherPayload(response?.data || {});

    weatherCache.set(cacheKey, normalized);
    weatherCache.set("global", normalized);

    return normalized;
  } catch (error) {
    logger.warn(`OpenWeather fetch failed: ${error.message}`);

    return getLastKnownWeather(lat, lon) || { ...DEFAULT_WEATHER_DATA };
  }
}

module.exports = {
  getWeatherData,
  getLastKnownWeather,
};
