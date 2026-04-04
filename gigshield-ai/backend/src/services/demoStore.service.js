const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const aiService = require("../integrations/aiService");
const {
  getClaimCooldownState,
  formatCooldownWait,
} = require("./claimCooldown.service");
const { clampNumber, ensureObject } = require("../utils/inputSafety");

const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret";
const OTP_CODE = "1234";
const OTP_TTL_MS = 5 * 60 * 1000;

const DEMO_PLANS = [
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
    zone: "Koramangala",
    summary: "Risk is stable right now.",
  },
  medium: {
    key: "medium",
    label: "Medium",
    score: 56,
    premium: 20,
    zone: "Koramangala",
    summary: "Risk is elevated. Premium updates accordingly.",
  },
  high: {
    key: "high",
    label: "High",
    score: 84,
    premium: 30,
    zone: "Koramangala",
    summary: "Risk is high. Premium and monitoring increase.",
  },
};

const otpSessions = new Map();
const usersByPhone = new Map();
const userStates = new Map();
const claimProgressTimeouts = new Set();
let claimSequence = 3001;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeClaimTriggerPayload(payload = {}) {
  const safePayload = ensureObject(payload);

  return {
    ...safePayload,
    rainfall: clampNumber(safePayload?.rainfall, { min: 0, max: 100, defaultValue: 0 }),
    aqi: clampNumber(safePayload?.aqi, { min: 0, max: 500, defaultValue: 0 }),
  };
}

function createHistory(stage, detail, tone = "default") {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    stage,
    detail,
    tone,
    timestamp: nowIso(),
  };
}

function buildJwt(user) {
  return jwt.sign(
    {
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
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
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

function buildDemoUser(profile = {}, existingUser = {}) {
  const phone = sanitizePhone(profile.phone || existingUser.phone);

  return {
    id: existingUser.id || profile.id || uuidv4(),
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
      existingUser.work_type || ""
    ),
    worker_id: normalizeString(
      profile.worker_id ?? profile.workerId,
      existingUser.worker_id || ""
    ),
    work_proof_name: normalizeString(
      profile.work_proof_name ?? profile.workProofName,
      existingUser.work_proof_name || ""
    ),
    work_verification_status: normalizeString(
      profile.work_verification_status ?? profile.workVerificationStatus,
      existingUser.work_verification_status || "pending"
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
      existingUser.auth_risk_score || 0
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
      null,
    location: profile.location ?? existingUser.location ?? null,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getRiskMeta(riskLevel = "medium") {
  return RISK_LEVELS[riskLevel] || RISK_LEVELS.medium;
}

function getPlanTemplate(planId) {
  return DEMO_PLANS.find((plan) => plan.id === planId) || DEMO_PLANS[0];
}

function getSurcharge(riskLevel) {
  return getRiskMeta(riskLevel).premium - RISK_LEVELS.low.premium;
}

function buildPlan(plan, state) {
  const surcharge = getSurcharge(state.risk.key);
  const premium = plan.basePremium + surcharge;

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    coverage: plan.coverage,
    premium,
    status: state.activePolicy?.planId === plan.id ? "active" : "inactive",
    features: plan.features,
  };
}

function buildPlans(state) {
  return DEMO_PLANS.map((plan) => buildPlan(plan, state));
}

function ensureState(user) {
  const existing = userStates.get(user.id);
  if (existing) {
    return existing;
  }

  const state = {
    user: {
      id: user.id,
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
      location: user.location,
    },
    risk: {
      ...RISK_LEVELS.medium,
      source: "demo",
    },
    activePolicy: null,
    claims: [],
  };

  userStates.set(user.id, state);
  return state;
}

function syncUserState(user) {
  const state = ensureState(user);
  state.user = {
    id: user.id,
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
    location: user.location,
  };
  return state;
}

function buildActivePolicy(state) {
  if (!state.activePolicy) {
    return null;
  }

  const template = getPlanTemplate(state.activePolicy.planId);
  const plan = buildPlan(template, state);

  return {
    planId: template.id,
    name: template.name,
    coverage: template.coverage,
    premium: plan.premium,
    status: "active",
    activatedAt: state.activePolicy.activatedAt,
  };
}

function buildFraudWatch(claims) {
  const flaggedClaim = claims.find(
    (claim) => claim.fraudStatus === "flagged" && claim.status !== "paid"
  );

  if (flaggedClaim) {
    return {
      status: "flagged",
      summary: "Suspicious activity found. Manual review is active.",
      latestAudit: "Route continuity mismatch detected during review.",
      activeFlags: clone(flaggedClaim.flags || []),
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

function buildClaimAmount(state, payload) {
  const activeCoverage = buildActivePolicy(state)?.coverage || 3000;
  const safePayload = sanitizeClaimTriggerPayload(payload);
  const rainfall = safePayload.rainfall;
  const aqi = safePayload.aqi;
  const riskMultiplier = state.risk.key === "high" ? 1.15 : state.risk.key === "medium" ? 1.05 : 1;
  const baseAmount = Math.max(rainfall * 4.5, aqi * 0.75, 280);
  return Math.min(Math.round(baseAmount * riskMultiplier), activeCoverage);
}

function buildClaim(state, payload) {
  const safePayload = sanitizeClaimTriggerPayload(payload);
  const eventType =
    safePayload.mode === "fraud_drill"
      ? "Fraud Drill"
      : safePayload.rainfall > 50
        ? "Rainfall"
        : "AQI";
  const triggerValue =
    safePayload.mode === "fraud_drill"
      ? "GPS jump detected"
      : eventType === "Rainfall"
        ? `${safePayload.rainfall} mm`
        : `AQI ${safePayload.aqi}`;
  const claimId = `CLM-${claimSequence++}`;
  const detectedAt = nowIso();
  const headline =
    safePayload.mode === "fraud_drill"
      ? "Suspicious claim review"
      : eventType === "Rainfall"
        ? "Rainfall threshold crossed"
        : "Air quality threshold crossed";
  const amount = buildClaimAmount(state, safePayload);

  return {
    id: claimId,
    eventType,
    headline,
    triggerValue,
    area: `${state.user.zone}, ${state.user.city}`,
    amount,
    status: safePayload.mode === "fraud_drill" ? "manual_review" : "pending",
    fraudStatus: safePayload.mode === "fraud_drill" ? "flagged" : "verified",
    flags:
      safePayload.mode === "fraud_drill"
        ? ["Location jump detected during claim window", "Manual review required"]
        : [],
    source: "Automated trigger monitor",
    detectedAt,
    updatedAt: detectedAt,
    payoutWindow: safePayload.mode === "fraud_drill" ? "Held for manual review" : "Checking payout",
    history: [
      createHistory(
        "claim_created",
        safePayload.mode === "fraud_drill"
          ? "Fraud drill created a manual review claim."
          : `${headline} and generated a new claim automatically.`,
        safePayload.mode === "fraud_drill" ? "danger" : "info"
      ),
    ],
  };
}

function scheduleClaimProgress(userId, claimId, mode) {
  if (mode === "fraud_drill") {
    return;
  }

  const approvalTimeoutId = setTimeout(() => {
    claimProgressTimeouts.delete(approvalTimeoutId);
    const state = userStates.get(userId);
    if (!state) {
      return;
    }

    const claim = state.claims.find((item) => item.id === claimId);
    if (!claim || claim.status !== "pending") {
      return;
    }

    claim.status = "approved";
    claim.updatedAt = nowIso();
    claim.payoutWindow = "Payout processing";
    claim.history.unshift(
      createHistory("approved", "Coverage conditions matched. Claim approved.", "success")
    );
  }, 1800);
  claimProgressTimeouts.add(approvalTimeoutId);

  const payoutTimeoutId = setTimeout(() => {
    claimProgressTimeouts.delete(payoutTimeoutId);
    const state = userStates.get(userId);
    if (!state) {
      return;
    }

    const claim = state.claims.find((item) => item.id === claimId);
    if (!claim || (claim.status !== "approved" && claim.status !== "pending")) {
      return;
    }

    claim.status = "paid";
    claim.updatedAt = nowIso();
    claim.payoutWindow = "Paid to linked account";
    claim.history.unshift(
      createHistory("paid", "Money released to the worker account.", "success")
    );
  }, 3600);
  claimProgressTimeouts.add(payoutTimeoutId);
}

function getLatestClaimTime(claims = []) {
  return claims[0]?.detectedAt || null;
}

function buildCooldownBlockResult(state, cooldown) {
  return {
    triggered: false,
    blocked: true,
    cooldown,
    message: `Claim blocked by cooldown. Try again in ${formatCooldownWait(cooldown.remainingMs)}.`,
    claims: clone(state.claims),
    fraudWatch: buildFraudWatch(state.claims),
  };
}

async function resolveRiskScore(user, requestedRisk) {
  const fallback = getRiskMeta(requestedRisk).score;

  try {
    const response = await aiService.assessRisk({
      worker_id: user.id,
      city: user.city,
      zone: user.zone,
    });

    const aiScore = Number(response?.risk_score);
    if (!Number.isFinite(aiScore)) {
      return { score: fallback, source: "demo" };
    }

    if (requestedRisk === "low") {
      return { score: Math.min(Math.round(aiScore), 30), source: "ai-engine" };
    }

    if (requestedRisk === "high") {
      return { score: Math.max(Math.round(aiScore), 80), source: "ai-engine" };
    }

    const bounded = Math.min(Math.max(Math.round(aiScore), 40), 70);
    return { score: bounded, source: "ai-engine" };
  } catch {
    return { score: fallback, source: "demo" };
  }
}

const DemoStoreService = {
  requestOtp(rawPhone) {
    const phone = sanitizePhone(rawPhone);
    if (phone.length !== 10) {
      const err = new Error("A valid 10-digit mobile number is required.");
      err.statusCode = 400;
      throw err;
    }

    const sessionId = uuidv4();
    otpSessions.set(sessionId, {
      sessionId,
      phone,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    return {
      sessionId,
      phone,
      otp: OTP_CODE,
      message: "OTP sent successfully.",
    };
  },

  verifyOtp({ sessionId, rawPhone, otp, profile = {} }) {
    const phone = sanitizePhone(rawPhone);
    const session = otpSessions.get(sessionId);

    if (!session || session.phone !== phone || session.expiresAt < Date.now()) {
      const err = new Error("OTP session expired. Please request a new OTP.");
      err.statusCode = 400;
      throw err;
    }

    if (String(otp) !== OTP_CODE) {
      const err = new Error("Invalid OTP. Use 1234 for the demo.");
      err.statusCode = 401;
      throw err;
    }

    let user = usersByPhone.get(phone);
    if (!user) {
      user = buildDemoUser({ ...profile, phone });
    } else {
      user = buildDemoUser({ ...profile, phone }, user);
    }

    usersByPhone.set(phone, user);
    syncUserState(user);
    otpSessions.delete(sessionId);

    return {
      token: buildJwt(user),
      user: clone(user),
    };
  },

  register(profile = {}) {
    const phone = sanitizePhone(profile.phone);
    if (phone.length !== 10) {
      const err = new Error("A valid 10-digit mobile number is required.");
      err.statusCode = 400;
      throw err;
    }

    const user = buildDemoUser({ ...profile, phone }, usersByPhone.get(phone) || {});

    usersByPhone.set(phone, user);
    syncUserState(user);

    return {
      token: buildJwt(user),
      user: clone(user),
    };
  },

  async getPremium(user, requestedRisk) {
    const state = syncUserState(user);
    const nextRiskKey = requestedRisk ? String(requestedRisk).toLowerCase() : state.risk.key;
    const riskMeta = getRiskMeta(nextRiskKey);
    const scoreMeta = await resolveRiskScore(state.user, riskMeta.key);

    state.risk = {
      ...riskMeta,
      score: scoreMeta.score,
      source: scoreMeta.source,
      zone: state.user.zone,
    };

    return {
      riskLevel: state.risk.label,
      riskKey: state.risk.key,
      riskScore: state.risk.score,
      premium: state.risk.premium,
      source: state.risk.source,
      summary: state.risk.summary,
      plans: buildPlans(state),
      activePolicy: buildActivePolicy(state),
    };
  },

  getPolicy(user) {
    const state = syncUserState(user);
    return {
      plans: buildPlans(state),
      activePolicy: buildActivePolicy(state),
      dynamicPremium: state.risk.premium,
      riskLevel: state.risk.label,
      riskScore: state.risk.score,
    };
  },

  buyPolicy(user, planId) {
    const state = syncUserState(user);
    const selectedPlan = getPlanTemplate(planId);

    if (!selectedPlan) {
      const err = new Error("Selected plan was not found.");
      err.statusCode = 404;
      throw err;
    }

    state.activePolicy = {
      planId: selectedPlan.id,
      activatedAt: nowIso(),
    };

    return {
      activePolicy: buildActivePolicy(state),
      plans: buildPlans(state),
      dynamicPremium: state.risk.premium,
    };
  },

  getClaims(user) {
    const state = syncUserState(user);
    const claims = [...state.claims].sort(
      (left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime()
    );

    return {
      claims: clone(claims),
      fraudWatch: buildFraudWatch(claims),
    };
  },

  triggerClaim(user, payload = {}) {
    const state = syncUserState(user);
    const safePayload = sanitizeClaimTriggerPayload(payload);
    const rainfall = safePayload.rainfall;
    const aqi = safePayload.aqi;
    const mode = safePayload.mode || "auto";

    if (mode !== "fraud_drill" && rainfall <= 50 && aqi <= 400) {
      return {
        triggered: false,
        message: "Threshold not met. No claim created.",
        claims: clone(state.claims),
        fraudWatch: buildFraudWatch(state.claims),
      };
    }

    const cooldown = getClaimCooldownState(getLatestClaimTime(state.claims));
    if (cooldown.active) {
      return buildCooldownBlockResult(state, cooldown);
    }

    const claim = buildClaim(state, safePayload);
    state.claims.unshift(claim);
    scheduleClaimProgress(state.user.id, claim.id, mode);

    return {
      triggered: true,
      message:
        mode === "fraud_drill"
          ? "Claim moved to manual fraud review."
          : "Claim created automatically and payout processing started.",
      claim: clone(claim),
      claims: clone(state.claims),
      fraudWatch: buildFraudWatch(state.claims),
    };
  },

  resetDemoStore() {
    claimProgressTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    claimProgressTimeouts.clear();
    otpSessions.clear();
    usersByPhone.clear();
    userStates.clear();
    claimSequence = 3001;
  },
};

module.exports = DemoStoreService;
