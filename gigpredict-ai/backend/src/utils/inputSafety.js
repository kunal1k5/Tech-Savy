function ensureObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function toFiniteNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : defaultValue;
}

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, defaultValue = 0 } = {}) {
  const numericValue = toFiniteNumber(value, defaultValue);
  return Math.max(min, Math.min(numericValue, max));
}

function clampInteger(value, { min = 0, max = Number.MAX_SAFE_INTEGER, defaultValue = 0 } = {}) {
  return Math.round(clampNumber(value, { min, max, defaultValue }));
}

function sanitizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  return Boolean(value);
}

function sanitizeWeatherMetrics(input = {}) {
  const safeInput = ensureObject(input);

  return {
    aqi: clampNumber(safeInput?.aqi, { min: 0, max: 500, defaultValue: 0 }),
    rain: clampNumber(safeInput?.rain ?? safeInput?.rainfall ?? safeInput?.rainfall_mm, {
      min: 0,
      max: 100,
      defaultValue: 0,
    }),
    wind: clampNumber(safeInput?.wind, { min: 0, max: 100, defaultValue: 0 }),
  };
}

module.exports = {
  clampInteger,
  clampNumber,
  ensureObject,
  sanitizeBoolean,
  sanitizeWeatherMetrics,
  toFiniteNumber,
};
