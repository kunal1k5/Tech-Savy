const crypto = require("crypto");

const OTP_CODE = "1234";
const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const CLAIM_APPROVAL_DELAY_MS = 2000;
const CLAIM_PAYOUT_DELAY_MS = 4000;
const SOURCE_NAME = "frontend-demo-api";
const AUTO_CLAIM_STEPS = ["CREATED", "PROCESSING", "PAID"];

const PLAN_CATALOG = [
  {
    id: "basic",
    name: "Basic",
    description: "Essential income cover for daily disruption days.",
    coverage: 3000,
    basePremium: 10,
    features: [
      "Rainfall auto-claim above 50 mm",
      "AQI auto-claim above 400",
      "Simple weekly protection",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Higher cover with better payout headroom.",
    coverage: 6000,
    basePremium: 20,
    features: [
      "Higher weekly coverage",
      "Priority claim processing",
      "Better payout protection during high risk",
    ],
  },
];

const RISK_LEVELS = {
  low: {
    key: "low",
    label: "Low",
    score: 24,
    premium: 10,
    summary: "Risk is stable right now.",
  },
  medium: {
    key: "medium",
    label: "Medium",
    score: 56,
    premium: 20,
    summary: "Risk is elevated. Premium updates accordingly.",
  },
  high: {
    key: "high",
    label: "High",
    score: 84,
    premium: 30,
    summary: "Risk is high. Premium and monitoring increase.",
  },
};

const LIVE_WEATHER_BY_CITY = {
  bengaluru: {
    temperature: 27,
    humidity: 62,
    wind: 14,
    pressure: 1008,
    rain: 4,
    cloud: 42,
    uv: 6,
    pm25: 32,
    pm10: 46,
    visibility: 8,
    gust: 18,
    resolved_location: {
      name: "Bengaluru",
      region: "Karnataka",
      country: "India",
      localtime: "2026-04-05 15:30",
    },
  },
  delhi: {
    temperature: 33,
    humidity: 40,
    wind: 18,
    pressure: 1002,
    rain: 0,
    cloud: 16,
    uv: 8,
    pm25: 118,
    pm10: 166,
    visibility: 6,
    gust: 24,
    resolved_location: {
      name: "Delhi",
      region: "Delhi",
      country: "India",
      localtime: "2026-04-05 15:30",
    },
  },
  mumbai: {
    temperature: 31,
    humidity: 76,
    wind: 22,
    pressure: 1006,
    rain: 12,
    cloud: 58,
    uv: 7,
    pm25: 54,
    pm10: 72,
    visibility: 7,
    gust: 28,
    resolved_location: {
      name: "Mumbai",
      region: "Maharashtra",
      country: "India",
      localtime: "2026-04-05 15:30",
    },
  },
};

function getStore() {
  if (!globalThis.__gigpredict_demo_api_store) {
    globalThis.__gigpredict_demo_api_store = {
      usersByPhone: new Map(),
      userStates: new Map(),
      disputes: new Map(),
      proofUploads: new Map(),
    };
  }

  return globalThis.__gigpredict_demo_api_store;
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

function normalizeString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function createDemoJwt(user) {
  const header = base64UrlEncode({ alg: "none", typ: "JWT" });
  const payload = base64UrlEncode({
    id: user.id,
    role: "worker",
    full_name: user.full_name,
    phone: user.phone,
    city: user.city,
    zone: user.zone,
    platform: user.platform,
    weekly_income: user.weekly_income,
    work_type: user.work_type,
    worker_id: user.worker_id,
    work_proof_name: user.work_proof_name,
    work_verification_status: user.work_verification_status,
    work_verification_flag: user.work_verification_flag,
    device_id: user.device_id,
    auth_risk_score: user.auth_risk_score,
    auth_risk_level: user.auth_risk_level,
    auth_risk_status: user.auth_risk_status,
    signup_time: user.signup_time,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });

  return `${header}.${payload}.demo`;
}

function decodeDemoJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = base64UrlDecode(parts[1]);
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    return null;
  }

  return payload;
}

function createOtpSessionId(phone) {
  return Buffer.from(
    JSON.stringify({
      phone,
      exp: Date.now() + OTP_TTL_MS,
      nonce: crypto.randomUUID(),
    })
  ).toString("base64url");
}

function decodeOtpSessionId(sessionId) {
  try {
    return JSON.parse(Buffer.from(String(sessionId || ""), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildSessionUser(profile = {}, existingUser = {}) {
  const phone = sanitizePhone(profile.phone || existingUser.phone);

  return {
    id: existingUser.id || profile.id || crypto.randomUUID(),
    full_name: normalizeString(
      profile.full_name ?? profile.fullName,
      existingUser.full_name || "Rahul Singh"
    ),
    phone,
    city: normalizeString(profile.city, existingUser.city || "Bengaluru"),
    zone: normalizeString(profile.zone, existingUser.zone || profile.city || "Koramangala"),
    platform: normalizeString(profile.platform, existingUser.platform || "Swiggy"),
    weekly_income: normalizeNumber(
      profile.weekly_income ?? profile.weeklyIncome,
      existingUser.weekly_income || 18350
    ),
    work_type: normalizeString(
      profile.work_type ?? profile.workType,
      existingUser.work_type || "Delivery"
    ),
    worker_id: normalizeString(
      profile.worker_id ?? profile.workerId,
      existingUser.worker_id || "DEMO-1001"
    ),
    work_proof_name: normalizeString(
      profile.work_proof_name ?? profile.workProofName,
      existingUser.work_proof_name || "demo-work-proof.png"
    ),
    work_verification_status: normalizeString(
      profile.work_verification_status ?? profile.workVerificationStatus,
      existingUser.work_verification_status || "verified"
    ),
    work_verification_flag:
      profile.work_verification_flag ??
      profile.workVerificationFlag ??
      existingUser.work_verification_flag ??
      null,
    device_id:
      normalizeString(profile.device_id ?? profile.deviceId, existingUser.device_id || "") || null,
    auth_risk_score: normalizeNumber(
      profile.auth_risk_score ?? profile.authRiskScore,
      existingUser.auth_risk_score || 18
    ),
    auth_risk_level: normalizeString(
      profile.auth_risk_level ?? profile.authRiskLevel,
      existingUser.auth_risk_level || "low"
    ),
    auth_risk_status: normalizeString(
      profile.auth_risk_status ?? profile.authRiskStatus,
      existingUser.auth_risk_status || "Safe"
    ),
    signup_time:
      normalizeString(profile.signup_time ?? profile.signupTime, existingUser.signup_time || "") ||
      nowIso(),
    location: profile.location ?? existingUser.location ?? null,
  };
}

function getRiskMeta(riskKey = "medium") {
  return RISK_LEVELS[riskKey] || RISK_LEVELS.medium;
}

function deriveRiskKey(payload = {}) {
  const explicitRisk = normalizeString(payload.risk || payload.riskLevel || payload.risk_level).toLowerCase();
  if (RISK_LEVELS[explicitRisk]) {
    return explicitRisk;
  }

  const aqi = normalizeNumber(payload.aqi, 0);
  const rain = normalizeNumber(payload.rain ?? payload.precip_mm, 0);
  const wind = normalizeNumber(payload.wind ?? payload.wind_kph ?? payload.gust, 0);
  const pm25 = normalizeNumber(payload.pm25, 0);
  const pm10 = normalizeNumber(payload.pm10, 0);

  if (aqi >= 180 || rain >= 20 || wind >= 28 || pm25 >= 100 || pm10 >= 150) {
    return "high";
  }

  if (aqi >= 95 || rain >= 6 || wind >= 16 || pm25 >= 45 || pm10 >= 70) {
    return "medium";
  }

  return "low";
}

function getOrCreateUserState(user) {
  const store = getStore();
  const existingState = store.userStates.get(user.id);

  if (existingState) {
    existingState.user = buildSessionUser(user, existingState.user);
    return existingState;
  }

  const nextState = {
    user: buildSessionUser(user),
    activePlanId: null,
    riskKey: deriveRiskKey(user),
    claims: [],
  };

  store.userStates.set(user.id, nextState);
  return nextState;
}

function getUserFromAuthHeader(req) {
  const authorization =
    req.headers.authorization || req.headers.Authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const payload = decodeDemoJwt(authorization.slice("Bearer ".length));
  if (!payload) {
    return null;
  }

  const store = getStore();
  const phone = sanitizePhone(payload.phone);
  const existingUser = store.usersByPhone.get(phone) || {};
  const user = buildSessionUser(payload, existingUser);
  store.usersByPhone.set(phone, user);
  getOrCreateUserState(user);
  return user;
}

function buildPlan(plan, activePlanId, riskKey) {
  const riskMeta = getRiskMeta(riskKey);
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    coverage: plan.coverage,
    premium: plan.basePremium + (riskMeta.premium - RISK_LEVELS.low.premium),
    status: activePlanId === plan.id ? "active" : "inactive",
    features: plan.features,
  };
}

function buildPlans(state) {
  return PLAN_CATALOG.map((plan) => buildPlan(plan, state.activePlanId, state.riskKey));
}

function buildActivePolicy(state) {
  if (!state.activePlanId) {
    return null;
  }

  const plan = PLAN_CATALOG.find((entry) => entry.id === state.activePlanId);
  if (!plan) {
    return null;
  }

  const pricedPlan = buildPlan(plan, state.activePlanId, state.riskKey);
  return {
    planId: plan.id,
    name: plan.name,
    coverage: plan.coverage,
    premium: pricedPlan.premium,
    status: "active",
    activatedAt: state.activatedAt || nowIso(),
  };
}

function hydrateClaim(claim) {
  if (claim.mode === "fraud_drill") {
    return {
      ...claim,
      status: "manual_review",
      fraudStatus: "flagged",
      payoutWindow: "Held for manual review",
      updatedAt: nowIso(),
    };
  }

  const ageMs = Date.now() - new Date(claim.detectedAt).getTime();
  if (ageMs >= CLAIM_PAYOUT_DELAY_MS) {
    return {
      ...claim,
      status: "paid",
      fraudStatus: "verified",
      payoutWindow: "Paid to linked account",
      updatedAt: nowIso(),
    };
  }

  if (ageMs >= CLAIM_APPROVAL_DELAY_MS) {
    return {
      ...claim,
      status: "approved",
      fraudStatus: "verified",
      payoutWindow: "Payout processing",
      updatedAt: nowIso(),
    };
  }

  return {
    ...claim,
    status: "pending",
    fraudStatus: "verified",
    payoutWindow: "Checking payout",
    updatedAt: nowIso(),
  };
}

function hydrateClaims(state) {
  state.claims = state.claims.map(hydrateClaim);
  return state.claims;
}

function buildFraudWatch(claims) {
  const flaggedClaim = claims.find((claim) => claim.fraudStatus === "flagged");
  if (flaggedClaim) {
    return {
      status: "flagged",
      summary: "Suspicious activity found. Manual review is active.",
      latestAudit: "Route continuity mismatch detected during review.",
      activeFlags: jsonClone(flaggedClaim.flags || []),
      lastCheckedAt: flaggedClaim.updatedAt,
    };
  }

  return {
    status: "verified",
    summary: "Claims and route activity look normal.",
    latestAudit: "No active anomalies found in the last claim cycle.",
    activeFlags: [],
    lastCheckedAt: nowIso(),
  };
}

function buildBehaviorCheck(payload = {}) {
  const loginAttempts = normalizeNumber(payload.login_attempts ?? payload.loginAttempts, 0);
  const claimsCount = normalizeNumber(payload.claims_count ?? payload.claimsCount, 0);
  const suspicious = loginAttempts >= 5 || claimsCount >= 4;
  const score = Math.min(100, claimsCount * 18 + loginAttempts * 9);

  return {
    suspicious,
    status: suspicious ? "WARNING" : "SAFE",
    behavior_score: score,
    claims_count: claimsCount,
    login_attempts: loginAttempts,
    source: SOURCE_NAME,
  };
}

function buildLocationMatch(payload = {}) {
  const currentLocation = normalizeString(payload.current_location ?? payload.currentLocation);
  const actualLocation = normalizeString(payload.actual_location ?? payload.actualLocation);
  const match =
    currentLocation &&
    actualLocation &&
    currentLocation.toLowerCase() === actualLocation.toLowerCase();

  return {
    match: Boolean(match),
    suspicious: Boolean(currentLocation && actualLocation && !match),
    current_location: currentLocation,
    actual_location: actualLocation,
    source: SOURCE_NAME,
  };
}

function buildRoutePrediction(payload = {}) {
  const originId = normalizeNumber(payload.origin_id, 1001);
  const dayOfWeek = normalizeNumber(payload.day_of_week, 1);
  const hourOfDay = normalizeNumber(payload.hour_of_day, 12);
  const actualDestinationId =
    payload.actual_destination_id === undefined
      ? null
      : normalizeNumber(payload.actual_destination_id, null);
  const predictedDestinationId = Math.round(originId + ((dayOfWeek + hourOfDay) % 5) + 1);
  const fraudStatus =
    actualDestinationId !== null && actualDestinationId !== predictedDestinationId
      ? "Suspicious"
      : "Clear";
  const confidence = fraudStatus === "Suspicious" ? 0.84 : 0.93;

  return {
    predicted_destination_id: predictedDestinationId,
    predicted_destination_name: `Route ${predictedDestinationId}`,
    actual_destination_id: actualDestinationId,
    confidence,
    fraud_status: fraudStatus,
    top_candidates: [
      {
        encoded_destination_id: predictedDestinationId,
        destination_movement_id: predictedDestinationId,
        destination_display_name: `Route ${predictedDestinationId}`,
        score: 0.93,
      },
      {
        encoded_destination_id: predictedDestinationId + 1,
        destination_movement_id: predictedDestinationId + 1,
        destination_display_name: `Route ${predictedDestinationId + 1}`,
        score: 0.61,
      },
      {
        encoded_destination_id: predictedDestinationId + 2,
        destination_movement_id: predictedDestinationId + 2,
        destination_display_name: `Route ${predictedDestinationId + 2}`,
        score: 0.42,
      },
    ],
    source: SOURCE_NAME,
  };
}

function buildFraudCheck(payload = {}) {
  const riskKey = deriveRiskKey(payload);
  const riskMeta = getRiskMeta(riskKey);
  const claimsCount = normalizeNumber(payload.claimsCount ?? payload.claims_count, 0);
  const loginAttempts = normalizeNumber(payload.loginAttempts ?? payload.login_attempts, 0);
  const locationMatch =
    payload.locationMatch === undefined
      ? payload.location_match === undefined
        ? true
        : Boolean(payload.location_match)
      : Boolean(payload.locationMatch);
  const contextValid =
    payload.contextValid === undefined
      ? payload.context_valid === undefined
        ? true
        : Boolean(payload.context_valid)
      : Boolean(payload.contextValid);

  let fraudScore = claimsCount * 12 + loginAttempts * 8;
  if (!locationMatch) {
    fraudScore += 28;
  }
  if (!contextValid) {
    fraudScore += 18;
  }
  fraudScore = Math.max(0, Math.min(100, fraudScore));

  let status = "SAFE";
  if (fraudScore >= 70) {
    status = "FRAUD";
  } else if (fraudScore >= 35) {
    status = "WARNING";
  }

  return {
    risk: riskMeta.label,
    premium: riskMeta.premium,
    fraud_score: fraudScore,
    fraudScore,
    status,
    source: SOURCE_NAME,
    details: {
      behavior: claimsCount >= 4 || loginAttempts >= 5 ? "Elevated" : "Stable",
      location: locationMatch ? "Matched" : "Mismatch detected",
      context: contextValid ? "Valid" : "Missing supporting context",
    },
    intelligence: {
      behavior: buildBehaviorCheck(payload),
      location: {
        match: locationMatch,
        suspicious: !locationMatch,
      },
      context: {
        valid: contextValid,
      },
    },
  };
}

function buildAiDecision(payload = {}) {
  const fraudCheck = buildFraudCheck(payload);
  let decision = "SAFE";
  let nextAction = "AUTO_APPROVE_CLAIM";
  let reason = "Signals are stable and the claim can move forward automatically.";

  if (fraudCheck.status === "FRAUD") {
    decision = "FRAUD";
    nextAction = "REJECT_CLAIM";
    reason = "High fraud indicators require a manual stop and review.";
  } else if (fraudCheck.status === "WARNING") {
    decision = "VERIFY";
    nextAction = "UPLOAD_PROOF";
    reason = "Some trust signals need extra proof before approval.";
  }

  return {
    decision,
    nextAction,
    status: fraudCheck.status,
    fraudScore: fraudCheck.fraud_score,
    fraud_score: fraudCheck.fraud_score,
    trustScore: Math.max(0, 100 - fraudCheck.fraud_score),
    reason,
    riskReason: `Risk is ${fraudCheck.risk}.`,
    fraudReason: `Fraud score is ${fraudCheck.fraud_score}.`,
    source: SOURCE_NAME,
  };
}

function buildRiskPremium(payload = {}) {
  const riskKey = deriveRiskKey(payload);
  const riskMeta = getRiskMeta(riskKey);

  return {
    risk: riskMeta.label.toUpperCase(),
    premium: riskMeta.premium,
    riskScore: riskMeta.score,
    summary: riskMeta.summary,
    source: SOURCE_NAME,
  };
}

function buildAutoClaim(payload = {}) {
  const risk = normalizeString(payload.risk, "LOW").toUpperCase();
  const hoursLost = normalizeNumber(payload.hoursLost ?? payload.hours_lost, 1);
  const hourlyRate = normalizeNumber(payload.hourlyRate ?? payload.hourly_rate, 150);
  const ordersCompleted = normalizeNumber(payload.ordersCompleted ?? payload.orders_completed, 0);
  const earnings = normalizeNumber(payload.earnings, 0);
  const isWorking = payload.isWorking === undefined ? true : Boolean(payload.isWorking);
  const incomeLossDetected = earnings <= hourlyRate * Math.max(1, hoursLost);
  const activeWorkConfirmed = isWorking;
  const claimTriggered = risk !== "LOW" || incomeLossDetected;
  const payoutMultiplier = risk === "HIGH" ? 1.15 : risk === "MEDIUM" ? 1.05 : 0.9;
  const payout = claimTriggered
    ? Math.round(hoursLost * hourlyRate * payoutMultiplier)
    : 0;

  return {
    claimTriggered,
    payout,
    status: claimTriggered ? (risk === "LOW" ? "PROCESSING" : "PAID") : "ON_HOLD",
    claimStates: AUTO_CLAIM_STEPS,
    hoursLost,
    hourlyRate,
    reason:
      risk === "HIGH"
        ? "Severe disruption triggered the automated claim flow."
        : risk === "MEDIUM"
          ? "Elevated disruption triggered a monitored payout."
          : "Signals are mild, so the claim remains conservative.",
    message: claimTriggered
      ? "Claim created automatically and payout processing started."
      : "Threshold not met. No claim created.",
    eligibility: {
      activeWorkConfirmed,
      incomeLossDetected,
      ordersCompleted,
    },
    source: SOURCE_NAME,
  };
}

function getLiveWeather(city) {
  const normalizedCity = normalizeString(city, "bengaluru").toLowerCase();
  return LIVE_WEATHER_BY_CITY[normalizedCity] || LIVE_WEATHER_BY_CITY.bengaluru;
}

function buildPredictRisk(payload = {}) {
  const riskKey = deriveRiskKey(payload);
  const riskMeta = getRiskMeta(riskKey);
  const label = `${riskMeta.label} Risk`;

  return {
    risk: label,
    prediction_class: riskMeta.label,
    probabilities: {
      low: riskKey === "low" ? 0.82 : riskKey === "medium" ? 0.16 : 0.05,
      medium: riskKey === "medium" ? 0.74 : riskKey === "high" ? 0.18 : 0.12,
      high: riskKey === "high" ? 0.77 : riskKey === "medium" ? 0.1 : 0.06,
    },
    feature_mode: "direct",
    source: SOURCE_NAME,
  };
}

function buildPredictLiveRisk(city) {
  const weatherBundle = getLiveWeather(city);
  const prediction = buildPredictRisk(weatherBundle);

  return {
    ...prediction,
    weather: {
      temperature: weatherBundle.temperature,
      humidity: weatherBundle.humidity,
      wind: weatherBundle.wind,
      pressure: weatherBundle.pressure,
      rain: weatherBundle.rain,
      cloud: weatherBundle.cloud,
      uv: weatherBundle.uv,
      pm25: weatherBundle.pm25,
      pm10: weatherBundle.pm10,
      visibility: weatherBundle.visibility,
      gust: weatherBundle.gust,
    },
    resolved_location: weatherBundle.resolved_location,
    source: SOURCE_NAME,
  };
}

function buildProofUploadResponse() {
  return {
    status: "RECEIVED",
    message: "Proof uploaded successfully. AI checks are running.",
    warning: false,
    decision: {
      decision: "VERIFY",
      fraud_score: 22,
      confidence: 91,
    },
    reasons: [
      "Geo metadata looks consistent.",
      "Visual checks passed for the uploaded proof.",
    ],
    source: SOURCE_NAME,
  };
}

function buildDisputeResponse(payload = {}) {
  const disputeId = `DSP-${Date.now()}`;
  const record = {
    disputeId,
    userId: normalizeString(payload.userId, "demo-user"),
    reason: normalizeString(payload.reason, "System failed to detect actual issue"),
    status: "UNDER_REVIEW",
    createdAt: nowIso(),
  };

  getStore().disputes.set(disputeId, record);
  return {
    disputeId,
    status: record.status,
    createdAt: record.createdAt,
    source: SOURCE_NAME,
  };
}

function buildReverificationResponse(payload = {}) {
  const disputeId = normalizeString(payload.disputeId);
  const existing = getStore().disputes.get(disputeId);
  const approved = Boolean(normalizeString(payload.userLocation, "Zone-A"));
  const finalStatus = approved ? "APPROVED" : "REJECTED";
  const confidence = approved ? 93 : 71;

  if (existing) {
    existing.status = finalStatus;
    existing.updatedAt = nowIso();
  }

  return {
    finalStatus,
    confidence,
    claimUpdate: {
      claimStatus: approved ? "paid" : "rejected",
    },
    source: SOURCE_NAME,
  };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendSuccess(res, data = {}, message = "Request completed successfully.", statusCode = 200) {
  sendJson(res, statusCode, {
    success: true,
    data,
    message,
  });
}

function sendError(res, statusCode = 500, message = "Internal Server Error", details) {
  const payload = {
    success: false,
    data: {},
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  sendJson(res, statusCode, payload);
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getRecognizedMethodsForPath(pathname) {
  const routes = {
    "/health": ["GET"],
    "/auth/login": ["POST"],
    "/auth/verify-otp": ["POST"],
    "/auth/register": ["POST"],
    "/policy": ["GET"],
    "/policy/buy": ["POST"],
    "/premium": ["GET"],
    "/claims": ["GET"],
    "/claim/trigger": ["POST"],
    "/analyze-behavior": ["POST"],
    "/predict-location": ["POST"],
    "/fraud-check": ["POST"],
    "/calculate-premium": ["POST"],
    "/risk-premium": ["POST"],
    "/auto-claim": ["POST"],
    "/ai-decision": ["POST"],
    "/start-dispute": ["POST"],
    "/upload-proof": ["POST"],
    "/reverify-claim": ["POST"],
    "/predict": ["POST"],
    "/weather/live": ["GET"],
    "/predict/live": ["POST"],
  };

  return routes[pathname] || null;
}

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }

    return req.body && typeof req.body === "object" ? req.body : {};
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("multipart/form-data")) {
    return { multipart: true };
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }

  return {};
}

async function handleDemoApi(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname.replace(/^\/api/, "") || "/";
  const allowedMethods = getRecognizedMethodsForPath(pathname);

  if (allowedMethods && !allowedMethods.includes(req.method)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    sendError(res, 405, "Method Not Allowed");
    return;
  }

  try {
    const body = await readBody(req);

    if (pathname === "/health" && req.method === "GET") {
      sendSuccess(
        res,
        {
          status: "ok",
          service: SOURCE_NAME,
          timestamp: nowIso(),
        },
        "Health check passed."
      );
      return;
    }

    if (pathname === "/auth/login" && req.method === "POST") {
      const phone = sanitizePhone(body.phone);
      if (phone.length !== 10) {
        sendError(res, 400, "A valid 10-digit mobile number is required.");
        return;
      }

      sendSuccess(
        res,
        {
          sessionId: createOtpSessionId(phone),
          phone,
          otp: OTP_CODE,
          message: "OTP sent successfully.",
        },
        "OTP sent successfully."
      );
      return;
    }

    if (pathname === "/auth/verify-otp" && req.method === "POST") {
      const phone = sanitizePhone(body.phone);
      const session = decodeOtpSessionId(body.sessionId);

      if (!session || session.phone !== phone || session.exp < Date.now()) {
        sendError(res, 400, "OTP session expired. Please request a new OTP.");
        return;
      }

      if (String(body.otp || "") !== OTP_CODE) {
        sendError(res, 401, "Invalid OTP. Use the verification code returned by the API.");
        return;
      }

      const store = getStore();
      const user = buildSessionUser(
        { ...(body.profile || {}), phone },
        store.usersByPhone.get(phone) || {}
      );
      store.usersByPhone.set(phone, user);
      getOrCreateUserState(user);

      sendSuccess(
        res,
        {
          token: createDemoJwt(user),
          user: jsonClone(user),
        },
        "OTP verified successfully."
      );
      return;
    }

    if (pathname === "/auth/register" && req.method === "POST") {
      const phone = sanitizePhone(body.phone);
      if (phone.length !== 10) {
        sendError(res, 400, "A valid 10-digit mobile number is required.");
        return;
      }

      const store = getStore();
      const user = buildSessionUser({ ...body, phone }, store.usersByPhone.get(phone) || {});
      store.usersByPhone.set(phone, user);
      getOrCreateUserState(user);

      sendSuccess(
        res,
        {
          token: createDemoJwt(user),
          user: jsonClone(user),
        },
        "Worker registered successfully.",
        201
      );
      return;
    }

    if (pathname === "/analyze-behavior" && req.method === "POST") {
      sendSuccess(res, buildBehaviorCheck(body), "Behavior analyzed successfully.");
      return;
    }

    if (pathname === "/predict-location" && req.method === "POST") {
      const hasRouteModelFields = body.origin_id !== undefined || body.hour_of_day !== undefined;
      const response = hasRouteModelFields ? buildRoutePrediction(body) : buildLocationMatch(body);
      sendSuccess(res, response, "Location analysis completed successfully.");
      return;
    }

    if (pathname === "/fraud-check" && req.method === "POST") {
      sendSuccess(res, buildFraudCheck(body), "Fraud check completed successfully.");
      return;
    }

    if (pathname === "/calculate-premium" && req.method === "POST") {
      const snapshot = buildRiskPremium(body);
      sendSuccess(
        res,
        {
          premium: snapshot.premium,
          risk: snapshot.risk,
          source: snapshot.source,
        },
        "Premium calculated successfully."
      );
      return;
    }

    if (pathname === "/risk-premium" && req.method === "POST") {
      sendSuccess(res, buildRiskPremium(body), "Risk premium calculated successfully.");
      return;
    }

    if (pathname === "/auto-claim" && req.method === "POST") {
      sendSuccess(res, buildAutoClaim(body), "Auto claim evaluated successfully.");
      return;
    }

    if (pathname === "/ai-decision" && req.method === "POST") {
      sendSuccess(res, buildAiDecision(body), "AI decision computed successfully.");
      return;
    }

    if (pathname === "/start-dispute" && req.method === "POST") {
      sendSuccess(res, buildDisputeResponse(body), "Dispute started successfully.", 201);
      return;
    }

    if (pathname === "/upload-proof" && req.method === "POST") {
      const response = buildProofUploadResponse();
      if (body.disputeId) {
        getStore().proofUploads.set(String(body.disputeId), {
          status: response.status,
          createdAt: nowIso(),
        });
      }
      sendSuccess(res, response, response.message);
      return;
    }

    if (pathname === "/reverify-claim" && req.method === "POST") {
      sendSuccess(res, buildReverificationResponse(body), "Claim re-verified successfully.");
      return;
    }

    if (pathname === "/predict" && req.method === "POST") {
      sendSuccess(res, buildPredictRisk(body), "Risk predicted successfully.");
      return;
    }

    if (pathname === "/weather/live" && req.method === "GET") {
      const weather = getLiveWeather(url.searchParams.get("city"));
      sendSuccess(
        res,
        {
          weather: {
            temperature: weather.temperature,
            humidity: weather.humidity,
            wind: weather.wind,
            pressure: weather.pressure,
            rain: weather.rain,
            cloud: weather.cloud,
            uv: weather.uv,
            pm25: weather.pm25,
            pm10: weather.pm10,
            visibility: weather.visibility,
            gust: weather.gust,
          },
          resolved_location: weather.resolved_location,
          source: SOURCE_NAME,
        },
        "Live weather loaded successfully."
      );
      return;
    }

    if (pathname === "/predict/live" && req.method === "POST") {
      sendSuccess(
        res,
        buildPredictLiveRisk(body.city),
        "Live risk predicted successfully."
      );
      return;
    }

    const authedUser = getUserFromAuthHeader(req);
    const authedState = authedUser ? getOrCreateUserState(authedUser) : null;

    if (pathname === "/policy" && req.method === "GET") {
      if (!authedUser || !authedState) {
        sendError(res, 401, "Handled safely");
        return;
      }

      const riskMeta = getRiskMeta(authedState.riskKey);
      sendSuccess(
        res,
        {
          plans: buildPlans(authedState),
          activePolicy: buildActivePolicy(authedState),
          dynamicPremium: riskMeta.premium,
          riskLevel: riskMeta.label,
          riskScore: riskMeta.score,
        },
        "Policy state loaded successfully."
      );
      return;
    }

    if (pathname === "/policy/buy" && req.method === "POST") {
      if (!authedUser || !authedState) {
        sendError(res, 401, "Handled safely");
        return;
      }

      const selectedPlan = PLAN_CATALOG.find((plan) => plan.id === body.planId);
      if (!selectedPlan) {
        sendError(res, 404, "Selected plan was not found.");
        return;
      }

      authedState.activePlanId = selectedPlan.id;
      authedState.activatedAt = nowIso();
      const riskMeta = getRiskMeta(authedState.riskKey);

      sendSuccess(
        res,
        {
          activePolicy: buildActivePolicy(authedState),
          plans: buildPlans(authedState),
          dynamicPremium: riskMeta.premium,
        },
        "Policy purchased successfully.",
        201
      );
      return;
    }

    if (pathname === "/premium" && req.method === "GET") {
      if (!authedUser || !authedState) {
        sendError(res, 401, "Handled safely");
        return;
      }

      authedState.riskKey = deriveRiskKey({
        risk: url.searchParams.get("risk") || authedState.riskKey,
      });
      const riskMeta = getRiskMeta(authedState.riskKey);

      sendSuccess(
        res,
        {
          riskLevel: riskMeta.label,
          riskKey: riskMeta.key,
          riskScore: riskMeta.score,
          premium: riskMeta.premium,
          source: SOURCE_NAME,
          summary: riskMeta.summary,
          plans: buildPlans(authedState),
          activePolicy: buildActivePolicy(authedState),
        },
        "Premium state loaded successfully."
      );
      return;
    }

    if (pathname === "/claims" && req.method === "GET") {
      if (!authedUser || !authedState) {
        sendError(res, 401, "Handled safely");
        return;
      }

      const claims = hydrateClaims(authedState)
        .slice()
        .sort(
          (left, right) =>
            new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime()
        );

      sendSuccess(
        res,
        {
          claims: jsonClone(claims),
          fraudWatch: buildFraudWatch(claims),
        },
        "Claims loaded successfully."
      );
      return;
    }

    if (pathname === "/claim/trigger" && req.method === "POST") {
      if (!authedUser || !authedState) {
        sendError(res, 401, "Handled safely");
        return;
      }

      const rainfall = normalizeNumber(body.rainfall, 0);
      const aqi = normalizeNumber(body.aqi, 0);
      const mode = normalizeString(body.mode, "auto");
      if (mode !== "fraud_drill" && rainfall <= 50 && aqi <= 400) {
        sendSuccess(
          res,
          {
            triggered: false,
            message: "Threshold not met. No claim created.",
            claims: jsonClone(hydrateClaims(authedState)),
            fraudWatch: buildFraudWatch(authedState.claims),
          },
          "Claim trigger evaluated successfully."
        );
        return;
      }

      const eventType =
        mode === "fraud_drill"
          ? "Fraud Drill"
          : rainfall > 50
            ? "Rainfall"
            : "AQI";
      const claim = {
        id: `CLM-${Date.now()}`,
        eventType,
        headline:
          mode === "fraud_drill"
            ? "Suspicious claim review"
            : eventType === "Rainfall"
              ? "Rainfall threshold crossed"
              : "Air quality threshold crossed",
        triggerValue:
          mode === "fraud_drill"
            ? "GPS jump detected"
            : eventType === "Rainfall"
              ? `${rainfall} mm`
              : `AQI ${aqi}`,
        area: `${authedUser.zone}, ${authedUser.city}`,
        amount: Math.min(
          Math.round(
            Math.max(rainfall * 4.5, aqi * 0.75, 280) *
              (authedState.riskKey === "high" ? 1.15 : authedState.riskKey === "medium" ? 1.05 : 1)
          ),
          buildActivePolicy(authedState)?.coverage || 3000
        ),
        mode,
        status: mode === "fraud_drill" ? "manual_review" : "pending",
        fraudStatus: mode === "fraud_drill" ? "flagged" : "verified",
        flags:
          mode === "fraud_drill"
            ? ["Location jump detected during claim window", "Manual review required"]
            : [],
        source: "Automated trigger monitor",
        detectedAt: nowIso(),
        updatedAt: nowIso(),
      };

      authedState.claims.unshift(claim);
      hydrateClaims(authedState);

      sendSuccess(
        res,
        {
          triggered: true,
          message:
            mode === "fraud_drill"
              ? "Claim moved to manual fraud review."
              : "Claim created automatically and payout processing started.",
          claim: jsonClone(authedState.claims[0]),
          claims: jsonClone(authedState.claims),
          fraudWatch: buildFraudWatch(authedState.claims),
        },
        "Claim trigger evaluated successfully.",
        mode === "fraud_drill" ? 200 : 201
      );
      return;
    }

    sendError(res, 404, "Route not found");
  } catch (error) {
    sendError(res, 500, error?.message || "Internal Server Error");
  }
}

module.exports = handleDemoApi;
