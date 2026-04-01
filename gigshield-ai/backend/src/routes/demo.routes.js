const { Router } = require("express");
const Joi = require("joi");
const DemoStoreService = require("../services/demoStore.service");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

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
    city: Joi.string().allow("", null),
    zone: Joi.string().allow("", null),
    platform: Joi.string().allow("", null),
    weeklyIncome: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
  }).optional(),
});

const registerSchema = Joi.object({
  fullName: Joi.string().required(),
  phone: Joi.string().required(),
  city: Joi.string().required(),
  zone: Joi.string().required(),
  platform: Joi.string().required(),
  weeklyIncome: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
});

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
    res.json(result);
  } catch (error) {
    next(error);
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
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/auth/register", validate(registerSchema), (req, res, next) => {
  try {
    const result = DemoStoreService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/policy", authenticate, (req, res, next) => {
  try {
    res.json(DemoStoreService.getPolicy(req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/policy/buy", authenticate, validate(buyPolicySchema), (req, res, next) => {
  try {
    res.status(201).json(DemoStoreService.buyPolicy(req.user, req.body.planId));
  } catch (error) {
    next(error);
  }
});

router.get("/premium", authenticate, async (req, res, next) => {
  try {
    const result = await DemoStoreService.getPremium(req.user, req.query.risk);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/claims", authenticate, (req, res, next) => {
  try {
    res.json(DemoStoreService.getClaims(req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/claim/trigger", authenticate, validate(triggerClaimSchema), (req, res, next) => {
  try {
    const result = DemoStoreService.triggerClaim(req.user, req.body);
    res.status(result.triggered ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
