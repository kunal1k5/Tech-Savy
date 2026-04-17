/**
 * Trigger Service — Parametric disruption trigger engine.
 *
 * Monitors external data sources (weather, AQI, traffic) and
 * automatically fires triggers when predefined thresholds are met.
 *
 * Threshold definitions (Phase-1):
 *   - Extreme Weather:  rainfall > 50mm/hr  OR  temperature > 45°C  OR  temperature < 5°C
 *   - High AQI:         AQI > 300 (hazardous)
 *   - Flooding:         rainfall > 100mm/hr
 *   - Heatwave:         temperature > 44°C for 3+ hours
 *   - Zone Shutdown:    manual trigger by admin (curfew, protests, etc.)
 */

const { pool } = require("../database/connection");
const ClaimModel = require("../models/claim.model");
const PolicyModel = require("../models/policy.model");
const AutoClaimService = require("./autoClaim.service");
const { getWeatherData } = require("./weather.service");
const { getAQIData } = require("./aqi.service");
const {
  getClaimCooldownState,
  formatCooldownWait,
} = require("./claimCooldown.service");
const logger = require("../utils/logger");

// Configurable thresholds
const THRESHOLDS = {
  extreme_weather: {
    rainfall_mm: 50,
    temp_high_c: 45,
    temp_low_c: 5,
  },
  high_aqi: {
    aqi: 300,
  },
  flooding: {
    rainfall_mm: 100,
  },
  heatwave: {
    temperature_c: 44,
  },
};

const TRIGGER_DEDUP_WINDOW_MS = Number(process.env.TRIGGER_DEDUP_WINDOW_MS || 120000);

const TRIGGER_TYPE_CONFIG = {
  Rain: {
    signalKey: "rain",
    defaultThreshold: 50,
  },
  AQI: {
    signalKey: "aqi",
    defaultThreshold: 300,
  },
  Demand: {
    signalKey: "demandScore",
    defaultThreshold: 80,
  },
};

const CITY_COORDINATE_LOOKUP = Object.freeze({
  Bengaluru: { lat: 12.9716, lon: 77.5946 },
  Bangalore: { lat: 12.9716, lon: 77.5946 },
  Delhi: { lat: 28.6139, lon: 77.2090 },
  Mumbai: { lat: 19.0760, lon: 72.8777 },
  Chennai: { lat: 13.0827, lon: 80.2707 },
  Hyderabad: { lat: 17.3850, lon: 78.4867 },
  Pune: { lat: 18.5204, lon: 73.8567 },
  Kolkata: { lat: 22.5726, lon: 88.3639 },
});

const DEFAULT_COORDINATES = Object.freeze({
  lat: toNumber(process.env.OPENWEATHER_DEFAULT_LAT, 28.6139),
  lon: toNumber(process.env.OPENWEATHER_DEFAULT_LON, 77.2090),
});

const simulatedSignalState = {
  rain: 18,
  rainfall: 18,
  temperature: 31,
  condition: "Unknown",
  aqi: 140,
  demandScore: 55,
};

const monitoringState = {
  timer: null,
  latestSignals: null,
  latestSignalsByLocation: new Map(),
  triggeredByPolicyId: new Map(),
  lastTriggerTimestampByPolicyId: new Map(),
  lastEvaluatedAt: null,
};

function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTriggerType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "aqi") {
    return "AQI";
  }
  if (normalized === "demand") {
    return "Demand";
  }
  return "Rain";
}

function buildPolicyName(policy) {
  return (
    policy.policy_name ||
    policy.name ||
    policy.plan_name ||
    (policy.id ? `Policy ${String(policy.id).slice(0, 8)}` : "Policy")
  );
}

function getPolicyTriggerType(policy) {
  return normalizeTriggerType(policy.trigger_type || policy.triggerType || policy.event_type);
}

function getPolicyThreshold(policy, triggerType) {
  const configuredThreshold =
    policy.threshold ??
    policy.trigger_threshold ??
    policy.threshold_value;

  return toNumber(configuredThreshold, TRIGGER_TYPE_CONFIG[triggerType].defaultThreshold);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function buildLocationKey(city, zone) {
  return `${String(city || "unknown").toLowerCase()}|${String(zone || "unknown").toLowerCase()}`;
}

function normalizeCoordinatesFromPolicy(policy = {}) {
  const policyLat =
    policy.latitude ??
    policy.lat ??
    policy.worker_latitude ??
    policy.workerLatitude ??
    policy.location_latitude;
  const policyLon =
    policy.longitude ??
    policy.lon ??
    policy.lng ??
    policy.worker_longitude ??
    policy.workerLongitude ??
    policy.location_longitude;

  const lat = toNumber(policyLat, NaN);
  const lon = toNumber(policyLon, NaN);

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }

  const cityCoordinates = CITY_COORDINATE_LOOKUP[policy.city] || CITY_COORDINATE_LOOKUP[policy.zone];
  if (cityCoordinates) {
    return cityCoordinates;
  }

  return DEFAULT_COORDINATES;
}

function calculateDemandScore({ rain, aqi }) {
  const demandFromRain = Math.min(50, toNumber(rain, 0) * 0.7);
  const demandFromAqi = Math.min(45, Math.max(0, toNumber(aqi, 0) - 100) * 0.18);
  return Math.round(clamp(20 + demandFromRain + demandFromAqi, 0, 100));
}

function buildDefaultSignals() {
  return {
    rain: simulatedSignalState.rain,
    rainfall: simulatedSignalState.rain,
    aqi: simulatedSignalState.aqi,
    demandScore: simulatedSignalState.demandScore,
    temperature: simulatedSignalState.temperature,
    condition: simulatedSignalState.condition,
    source: {
      weather: "fallback",
      aqi: "fallback",
    },
    stale: true,
    updatedAt: new Date().toISOString(),
  };
}

function getSignalValue(triggerType, signals = {}) {
  if (triggerType === "Rain") {
    return toNumber(signals.rain ?? signals.rainfall, 0);
  }

  if (triggerType === "AQI") {
    return toNumber(signals.aqi, 0);
  }

  return toNumber(signals.demandScore, 0);
}

function pickMostCriticalSignals(signalList = []) {
  if (!signalList.length) {
    return buildDefaultSignals();
  }

  const sorted = [...signalList].sort((left, right) => {
    const leftSeverity = toNumber(left.rain, 0) + toNumber(left.aqi, 0) * 0.2;
    const rightSeverity = toNumber(right.rain, 0) + toNumber(right.aqi, 0) * 0.2;
    return rightSeverity - leftSeverity;
  });

  const selected = sorted[0];

  return {
    rain: selected.rain,
    rainfall: selected.rain,
    aqi: selected.aqi,
    demandScore: selected.demandScore,
    temperature: selected.temperature,
    condition: selected.condition,
    source: selected.source,
    stale: selected.stale,
    locationsCovered: signalList.length,
    updatedAt: new Date().toISOString(),
  };
}

function serializeSignalsByLocation() {
  return Array.from(monitoringState.latestSignalsByLocation.entries()).map(([locationKey, signal]) => ({
    locationKey,
    ...signal,
  }));
}

function isWithinDedupWindow(lastTriggeredAt) {
  if (!lastTriggeredAt) {
    return false;
  }

  const timestamp = new Date(lastTriggeredAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < TRIGGER_DEDUP_WINDOW_MS;
}

const TriggerService = {
  /**
   * Evaluate weather/environment data against thresholds.
   * Returns an array of triggered events.
   */
  evaluateTriggers(data) {
    const { city, zone, rainfall_mm, temperature_c, aqi } = data;
    const triggers = [];

    // Extreme weather check
    if (rainfall_mm > THRESHOLDS.extreme_weather.rainfall_mm ||
        temperature_c > THRESHOLDS.extreme_weather.temp_high_c ||
        temperature_c < THRESHOLDS.extreme_weather.temp_low_c) {
      triggers.push({
        trigger_type: "extreme_weather",
        city, zone,
        severity: rainfall_mm > 80 || temperature_c > 48 ? "critical" : "high",
        threshold_met: `rainfall=${rainfall_mm}mm, temp=${temperature_c}°C`,
      });
    }

    // AQI check
    if (aqi > THRESHOLDS.high_aqi.aqi) {
      triggers.push({
        trigger_type: "high_aqi",
        city, zone,
        severity: aqi > 400 ? "critical" : "high",
        threshold_met: `AQI=${aqi}`,
      });
    }

    // Flooding check
    if (rainfall_mm > THRESHOLDS.flooding.rainfall_mm) {
      triggers.push({
        trigger_type: "flooding",
        city, zone,
        severity: "critical",
        threshold_met: `rainfall=${rainfall_mm}mm (flooding threshold)`,
      });
    }

    return triggers;
  },

  /**
   * Record a trigger event and auto-initiate claims for all
   * active policies in the affected zone.
   */
  async fireTrigger(triggerData) {
    // 1. Record the trigger event
    const result = await pool.query(
      `INSERT INTO parametric_triggers (trigger_type, city, zone, severity, data_snapshot, threshold_met)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        triggerData.trigger_type, triggerData.city, triggerData.zone,
        triggerData.severity, JSON.stringify(triggerData.data_snapshot || {}),
        triggerData.threshold_met,
      ]
    );
    const trigger = result.rows[0];

    // 2. Find all active policies in the affected zone
    const activePolicies = await PolicyModel.getActivePoliciesForZone(
      triggerData.city, triggerData.zone
    );

    // 3. Auto-create claims for each affected policy
    const claims = [];
    const cooldownBlocks = [];
    for (const policy of activePolicies) {
      const latestClaim = await ClaimModel.findLatestByWorker(policy.worker_id);
      const cooldown = getClaimCooldownState(latestClaim?.created_at);

      if (cooldown.active) {
        cooldownBlocks.push({
          worker_id: policy.worker_id,
          policy_id: policy.id,
          reason: `Claim cooldown active. Retry in ${formatCooldownWait(cooldown.remainingMs)}.`,
          cooldown,
        });
        continue;
      }

      // Payout = coverage_amount × severity multiplier
      const severityMultiplier = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
      const claimAmount = Math.round(
        policy.coverage_amount * (severityMultiplier[triggerData.severity] || 0.5) * 100
      ) / 100;

      const claim = await ClaimModel.create({
        policy_id: policy.id,
        worker_id: policy.worker_id,
        trigger_id: trigger.id,
        claim_amount: claimAmount,
      });
      claims.push(claim);
    }

    logger.info(
      `Trigger ${trigger.id} fired: ${triggerData.trigger_type} in ${triggerData.city}/${triggerData.zone} — ${claims.length} claims auto-created, ${cooldownBlocks.length} blocked by cooldown`
    );

    return {
      trigger,
      claims_created: claims.length,
      claims_blocked_by_cooldown: cooldownBlocks.length,
      cooldown_blocks: cooldownBlocks,
    };
  },

  async fetchMonitoringSignals({ policies = [], simulatedData } = {}) {
    if (simulatedData && typeof simulatedData === "object") {
      const rainValue = toNumber(
        simulatedData.rain ?? simulatedData.rainfall,
        simulatedSignalState.rain
      );
      const aqiValue = toNumber(simulatedData.aqi, simulatedSignalState.aqi);

      const mergedSignals = {
        rain: rainValue,
        rainfall: rainValue,
        aqi: aqiValue,
        demandScore: toNumber(
          simulatedData.demandScore,
          calculateDemandScore({ rain: rainValue, aqi: aqiValue })
        ),
        temperature: toNumber(simulatedData.temperature, simulatedSignalState.temperature),
        condition: String(simulatedData.condition || simulatedSignalState.condition || "Unknown"),
        source: {
          weather: "simulation",
          aqi: "simulation",
        },
        stale: false,
        updatedAt: new Date().toISOString(),
      };

      simulatedSignalState.rain = mergedSignals.rain;
      simulatedSignalState.rainfall = mergedSignals.rain;
      simulatedSignalState.aqi = mergedSignals.aqi;
      simulatedSignalState.temperature = mergedSignals.temperature;
      simulatedSignalState.condition = mergedSignals.condition;
      simulatedSignalState.demandScore = mergedSignals.demandScore;

      monitoringState.latestSignals = mergedSignals;
      monitoringState.latestSignalsByLocation.clear();

      return monitoringState.latestSignals;
    }

    if (!Array.isArray(policies) || policies.length === 0) {
      monitoringState.latestSignals = monitoringState.latestSignals || buildDefaultSignals();
      return monitoringState.latestSignals;
    }

    const uniqueLocations = new Map();
    for (const policy of policies) {
      const locationKey = buildLocationKey(policy.city, policy.zone);
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.set(locationKey, {
          city: policy.city || null,
          zone: policy.zone || null,
          samplePolicy: policy,
        });
      }
    }

    const locationSignals = await Promise.all(
      Array.from(uniqueLocations.entries()).map(async ([locationKey, locationMeta]) => {
        try {
          const coordinates = normalizeCoordinatesFromPolicy(locationMeta.samplePolicy);
          const [weather, aqi] = await Promise.all([
            getWeatherData(coordinates.lat, coordinates.lon),
            getAQIData(locationMeta.city || `${coordinates.lat},${coordinates.lon}`),
          ]);

          const rainValue = toNumber(weather?.rain, simulatedSignalState.rain);
          const aqiValue = toNumber(aqi?.aqi, simulatedSignalState.aqi);
          const demandScore = calculateDemandScore({ rain: rainValue, aqi: aqiValue });

          const normalized = {
            location: {
              city: locationMeta.city,
              zone: locationMeta.zone,
              lat: coordinates.lat,
              lon: coordinates.lon,
            },
            rain: rainValue,
            rainfall: rainValue,
            aqi: aqiValue,
            demandScore,
            temperature: toNumber(weather?.temperature, simulatedSignalState.temperature),
            condition: String(weather?.condition || simulatedSignalState.condition || "Unknown"),
            source: {
              weather: "openweather",
              aqi: "waqi",
            },
            stale: false,
            updatedAt: new Date().toISOString(),
          };

          monitoringState.latestSignalsByLocation.set(locationKey, normalized);
          return normalized;
        } catch (error) {
          logger.warn(`Failed to build live signals for ${locationKey}: ${error.message}`);

          const cached =
            monitoringState.latestSignalsByLocation.get(locationKey) ||
            monitoringState.latestSignals ||
            buildDefaultSignals();

          const fallback = {
            ...cached,
            location: {
              city: locationMeta.city,
              zone: locationMeta.zone,
            },
            stale: true,
            updatedAt: new Date().toISOString(),
          };

          monitoringState.latestSignalsByLocation.set(locationKey, fallback);
          return fallback;
        }
      })
    );

    const aggregateSignals = pickMostCriticalSignals(locationSignals);
    simulatedSignalState.rain = aggregateSignals.rain;
    simulatedSignalState.rainfall = aggregateSignals.rain;
    simulatedSignalState.aqi = aggregateSignals.aqi;
    simulatedSignalState.temperature = aggregateSignals.temperature;
    simulatedSignalState.condition = aggregateSignals.condition;
    simulatedSignalState.demandScore = aggregateSignals.demandScore;

    monitoringState.latestSignals = aggregateSignals;

    return monitoringState.latestSignals;
  },

  evaluatePolicyAgainstSignals(policy, signals) {
    const triggerType = getPolicyTriggerType(policy);
    const threshold = getPolicyThreshold(policy, triggerType);
    const signalKey = TRIGGER_TYPE_CONFIG[triggerType].signalKey;

    let actualValue = getSignalValue(triggerType, signals);
    let isTriggered = actualValue > threshold;

    if (triggerType === "Rain") {
      actualValue = toNumber(signals?.rain ?? signals?.rainfall, 0);
      isTriggered = actualValue > threshold;
    }

    if (triggerType === "AQI") {
      actualValue = toNumber(signals?.aqi, 0);
      isTriggered = actualValue > threshold;
    }

    return {
      policyId: policy.id,
      policyName: buildPolicyName(policy),
      triggerType,
      actualValue,
      threshold,
      status: isTriggered ? "TRIGGERED" : "IDLE",
      triggerState: isTriggered ? "ACTIVE" : "INACTIVE",
      createdAt: new Date().toISOString(),
      signalKey,
      weather: {
        rain: toNumber(signals?.rain ?? signals?.rainfall, 0),
        temperature: toNumber(signals?.temperature, 0),
        condition: String(signals?.condition || "Unknown"),
      },
      aqi: toNumber(signals?.aqi, 0),
      signalSource: signals?.source || null,
      staleSignal: Boolean(signals?.stale),
      location: {
        city: signals?.location?.city || policy.city || null,
        zone: signals?.location?.zone || policy.zone || null,
      },
    };
  },

  async evaluateActivePolicies({ simulatedData } = {}) {
    let activePolicies = [];
    try {
      activePolicies = await PolicyModel.getAllActivePolicies();
    } catch (error) {
      logger.warn(`Policy fetch failed during trigger monitoring: ${error.message}`);
      activePolicies = [];
    }

    const signals = await this.fetchMonitoringSignals({ policies: activePolicies, simulatedData });

    const triggeredResults = [];
    for (const policy of activePolicies) {
      const locationKey = buildLocationKey(policy.city, policy.zone);
      const locationSignals = monitoringState.latestSignalsByLocation.get(locationKey) || signals;
      const evaluation = this.evaluatePolicyAgainstSignals(policy, locationSignals);

      if (evaluation.status !== "TRIGGERED") {
        monitoringState.triggeredByPolicyId.delete(policy.id);
        continue;
      }

      const existing = monitoringState.triggeredByPolicyId.get(policy.id);
      const lastTriggeredAt = monitoringState.lastTriggerTimestampByPolicyId.get(policy.id) || null;
      const isDuplicateSuppressed = !existing && isWithinDedupWindow(lastTriggeredAt);
      const isNewTriggerEvent = !existing;
      const eventId = isNewTriggerEvent
        ? `${policy.id}-${evaluation.triggerType}-${Date.now()}`
        : existing.eventId;

      const merged = {
        ...(existing || {}),
        ...evaluation,
        eventId,
        justActivated: isNewTriggerEvent && !isDuplicateSuppressed,
        duplicateSuppressed: isDuplicateSuppressed,
        lastTriggeredAt,
      };

      if (isNewTriggerEvent && !isDuplicateSuppressed) {
        const autoClaimResult = await AutoClaimService.createAutoClaim({
          policyId: policy.id,
          triggerType: evaluation.triggerType,
          actualValue: evaluation.actualValue,
          threshold: evaluation.threshold,
          eventId,
          location: evaluation.location,
          weather: evaluation.weather,
          aqi: evaluation.aqi,
          policyName: evaluation.policyName,
        });

        merged.autoClaim = autoClaimResult;
        merged.lastTriggeredAt = new Date().toISOString();
        monitoringState.lastTriggerTimestampByPolicyId.set(policy.id, merged.lastTriggeredAt);

        if (autoClaimResult?.created) {
          logger.info(`Auto claim generated for policy ${policy.id}`);
        }
      }

      monitoringState.triggeredByPolicyId.set(policy.id, merged);
      triggeredResults.push(merged);
    }

    monitoringState.lastEvaluatedAt = new Date().toISOString();
    monitoringState.latestSignals = {
      ...(monitoringState.latestSignals || signals || buildDefaultSignals()),
      triggerStatus: triggeredResults.length > 0 ? "TRIGGERED" : "IDLE",
      updatedAt: new Date().toISOString(),
    };

    return {
      checkedPolicies: activePolicies.length,
      signals: monitoringState.latestSignals,
      triggered: triggeredResults,
      signalsByLocation: serializeSignalsByLocation(),
      evaluatedAt: monitoringState.lastEvaluatedAt,
    };
  },

  async runMonitoringCycle(options = {}) {
    const cycleResult = await this.evaluateActivePolicies(options);

    for (const trigger of cycleResult.triggered) {
      if (!trigger.justActivated) {
        continue;
      }

      console.log(`Trigger activated for policy ${trigger.policyId}`);
      logger.info(`Trigger activated for policy ${trigger.policyId}`);
    }

    return cycleResult;
  },

  async runTriggerEvaluation(options = {}) {
    const cycleResult = await this.runMonitoringCycle(options);

    return cycleResult.triggered.map((trigger) => ({
      policyId: trigger.policyId,
      triggerType: trigger.triggerType,
      actualValue: trigger.actualValue,
      threshold: trigger.threshold,
      status: "TRIGGERED",
    }));
  },

  getTriggeredPolicies() {
    return {
      evaluatedAt: monitoringState.lastEvaluatedAt,
      signals: monitoringState.latestSignals,
      signalsByLocation: serializeSignalsByLocation(),
      triggers: Array.from(monitoringState.triggeredByPolicyId.values()).sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
      ),
    };
  },

  startAutoMonitoringLoop({ intervalMs = 20000 } = {}) {
    if (monitoringState.timer) {
      return monitoringState.timer;
    }

    const tick = async () => {
      try {
        await this.runTriggerEvaluation();
      } catch (error) {
        logger.warn(`Trigger monitoring cycle failed: ${error.message}`);
      }
    };

    // Warm-up run so the API has data shortly after startup.
    setImmediate(tick);
    monitoringState.timer = setInterval(tick, intervalMs);

    if (typeof monitoringState.timer.unref === "function") {
      monitoringState.timer.unref();
    }

    return monitoringState.timer;
  },

  stopAutoMonitoringLoop() {
    if (monitoringState.timer) {
      clearInterval(monitoringState.timer);
      monitoringState.timer = null;
    }
  },
};

module.exports = TriggerService;
