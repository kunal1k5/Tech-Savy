const axios = require("axios");

const logger = require("../utils/logger");

const WAQI_BASE_URL = process.env.WAQI_BASE_URL || "https://api.waqi.info/feed";
const WAQI_TIMEOUT_MS = Number(process.env.WAQI_TIMEOUT_MS || 8000);

const DEFAULT_AQI_DATA = Object.freeze({
  aqi: 0,
});

const aqiCache = new Map();

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildGeoTarget(lat, lon) {
  return `geo:${lat};${lon}`;
}

function parseCoordinates(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const lat = Number(value.lat ?? value.latitude);
    const lon = Number(value.lon ?? value.lng ?? value.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
    return null;
  }

  const normalized = String(value).trim();
  const coordinateMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!coordinateMatch) {
    return null;
  }

  const lat = Number(coordinateMatch[1]);
  const lon = Number(coordinateMatch[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
}

function normalizeLocationKey(city) {
  if (typeof city === "string") {
    const trimmed = city.trim();
    return trimmed || "global";
  }

  if (city && typeof city === "object") {
    const lat = Number(city.lat ?? city.latitude);
    const lon = Number(city.lon ?? city.lng ?? city.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(4)},${lon.toFixed(4)}`;
    }
  }

  return "global";
}

function buildFeedTarget(city) {
  const parsedCoordinates = parseCoordinates(city);

  if (parsedCoordinates) {
    return buildGeoTarget(parsedCoordinates.lat, parsedCoordinates.lon);
  }

  const normalizedCity = String(city || "").trim();
  return encodeURIComponent(normalizedCity || "here");
}

function getCachedAQI(locationKey) {
  return aqiCache.get(locationKey) || aqiCache.get("global") || null;
}

function normalizeAqiResult(value) {
  return {
    aqi: toNumber(value, DEFAULT_AQI_DATA.aqi),
  };
}

function getLastKnownAQI(city) {
  const locationKey = normalizeLocationKey(city);
  return getCachedAQI(locationKey);
}

async function getAQIData(city) {
  const token = process.env.WAQI_API_TOKEN || process.env.WAQI_TOKEN;
  const locationKey = normalizeLocationKey(city);

  try {
    if (!token) {
      throw new Error("WAQI_API_TOKEN is not configured");
    }

    const target = buildFeedTarget(city);
    const response = await axios.get(`${WAQI_BASE_URL}/${target}/`, {
      timeout: WAQI_TIMEOUT_MS,
      params: {
        token,
      },
    });

    const payload = response?.data || {};

    if (payload.status !== "ok") {
      const message = payload?.data || payload?.status || "Unknown WAQI error";
      throw new Error(`WAQI status not ok: ${message}`);
    }

    const normalized = normalizeAqiResult(payload?.data?.aqi);
    aqiCache.set(locationKey, normalized);
    aqiCache.set("global", normalized);

    return normalized;
  } catch (error) {
    logger.warn(`WAQI fetch failed for key ${locationKey}: ${error.message}`);
    return getLastKnownAQI(city) || { ...DEFAULT_AQI_DATA };
  }
}

module.exports = {
  getAQIData,
  getLastKnownAQI,
};
