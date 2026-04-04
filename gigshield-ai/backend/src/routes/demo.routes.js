const { Router } = require("express");
const Joi = require("joi");
const DemoStoreService = require("../services/demoStore.service");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { sendError, sendSuccess } = require("../utils/apiResponse");

const router = Router();

const loginSchema = Joi.object({
  phone: Joi.string().required(),
});

const verifySchema = Joi.object({
  sessionId: Joi.string().required(),
  phone: Joi.string().required(),
  otp: Joi.string().required(),
  profile: Joi.object({
    fullName: Joi.string().allow("", null),
    full_name: Joi.string().allow("", null),
    city: Joi.string().allow("", null),
    zone: Joi.string().allow("", null),
    platform: Joi.string().allow("", null),
    weeklyIncome: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    weekly_income: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    workType: Joi.string().allow("", null),
    work_type: Joi.string().allow("", null),
    workerId: Joi.string().allow("", null),
    worker_id: Joi.string().allow("", null),
    workProofName: Joi.string().allow("", null),
    work_proof_name: Joi.string().allow("", null),
    workVerificationStatus: Joi.string().allow("", null),
    work_verification_status: Joi.string().allow("", null),
    workVerificationFlag: Joi.alternatives().try(Joi.string(), Joi.valid(null)).allow(null),
    work_verification_flag: Joi.alternatives().try(Joi.string(), Joi.valid(null)).allow(null),
    deviceId: Joi.string().allow("", null),
    device_id: Joi.string().allow("", null),
    authRiskScore: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    auth_risk_score: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    authRiskLevel: Joi.string().allow("", null),
    auth_risk_level: Joi.string().allow("", null),
    authRiskStatus: Joi.string().allow("", null),
    auth_risk_status: Joi.string().allow("", null),
    signupTime: Joi.string().isoDate().allow("", null),
    signup_time: Joi.string().isoDate().allow("", null),
    location: Joi.object().unknown(true).allow(null),
  }).unknown(true).optional(),
});

const registerSchema = Joi.object({
  fullName: Joi.string().required(),
  phone: Joi.string().required(),
  city: Joi.string().required(),
  zone: Joi.string().required(),
  platform: Joi.string().required(),
  weeklyIncome: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
}).unknown(true);

const buyPolicySchema = Joi.object({
  planId: Joi.string().valid("basic", "premium").required(),
});

const triggerClaimSchema = Joi.object({
  rainfall: Joi.number().optional(),
  aqi: Joi.number().optional(),
  mode: Joi.string().valid("auto", "fraud_drill").optional(),
});

router.post("/auth/login", validate(loginSchema), (req, res, next) => {
  try {
    const result = DemoStoreService.requestOtp(req.body.phone);
    return sendSuccess(res, result, "OTP sent successfully.");
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/verify-otp", validate(verifySchema), (req, res, next) => {
  try {
    const result = DemoStoreService.verifyOtp({
      sessionId: req.body.sessionId,
      rawPhone: req.body.phone,
      otp: req.body.otp,
      profile: req.body.profile,
    });
    return sendSuccess(res, result, "OTP verified successfully.");
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/register", validate(registerSchema), (req, res, next) => {
  try {
    const result = DemoStoreService.register(req.body);
    return sendSuccess(res, result, "Worker registered successfully.", 201);
  } catch (error) {
    return next(error);
  }
});

router.get("/policy", authenticate, (req, res, next) => {
  try {
    return sendSuccess(
      res,
      DemoStoreService.getPolicy(req.user),
      "Policy state loaded successfully."
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/policy/buy", authenticate, validate(buyPolicySchema), (req, res, next) => {
  try {
    return sendSuccess(
      res,
      DemoStoreService.buyPolicy(req.user, req.body.planId),
      "Policy purchased successfully.",
      201
    );
  } catch (error) {
    return next(error);
  }
});

router.get("/premium", authenticate, async (req, res, next) => {
  try {
    const result = await DemoStoreService.getPremium(req.user, req.query.risk);
    return sendSuccess(res, result, "Premium state loaded successfully.");
  } catch (error) {
    return next(error);
  }
});

router.get("/claims", authenticate, (req, res, next) => {
  try {
    return sendSuccess(res, DemoStoreService.getClaims(req.user), "Claims loaded successfully.");
  } catch (error) {
    return next(error);
  }
});

router.post("/claim/trigger", authenticate, validate(triggerClaimSchema), (req, res, next) => {
  try {
    const result = DemoStoreService.triggerClaim(req.user, req.body);
    if (result.blocked) {
      return sendError(res, 429, result.message, { data: result });
    }

    return sendSuccess(
      res,
      result,
      result.message || "Claim trigger evaluated successfully.",
      result.triggered ? 201 : 200
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
