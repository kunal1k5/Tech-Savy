const { Router } = require("express");
const Joi = require("joi");

const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { sendSuccess } = require("../utils/apiResponse");
const realAuthService = require("../services/realAuth.service");

const router = Router();

const sendOtpSchema = Joi.object({
  phone: Joi.string().required(),
  purpose: Joi.string().valid("login", "register", "login_or_register").default("login_or_register"),
});

const verifyOtpSchema = Joi.object({
  sessionId: Joi.string().required(),
  phone: Joi.string().required(),
  otp: Joi.string().pattern(/^\d{4,6}$/).required(),
});

const completeRegistrationSchema = Joi.object({
  registrationToken: Joi.string().required(),
  fullName: Joi.string().min(2).required(),
  city: Joi.string().min(2).required(),
  zone: Joi.string().min(2).required(),
  platform: Joi.string().min(2).required(),
  weeklyIncome: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  workType: Joi.string().allow("", null).optional(),
  workerId: Joi.string().allow("", null).optional(),
  workProofName: Joi.string().allow("", null).optional(),
  deviceId: Joi.string().allow("", null).optional(),
  location: Joi.object().unknown(true).allow(null).optional(),
}).unknown(true);

function getRequestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

router.post("/auth/real/send-otp", validate(sendOtpSchema), async (req, res, next) => {
  try {
    const result = await realAuthService.requestOtp({
      phone: req.body.phone,
      purpose: req.body.purpose,
      ...getRequestContext(req),
    });

    return sendSuccess(res, result, "OTP sent successfully.");
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/real/verify-otp", validate(verifyOtpSchema), async (req, res, next) => {
  try {
    const result = await realAuthService.verifyOtp({
      sessionId: req.body.sessionId,
      phone: req.body.phone,
      otp: req.body.otp,
      ...getRequestContext(req),
    });

    return sendSuccess(res, result, "OTP verified successfully.");
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/auth/real/register",
  validate(completeRegistrationSchema),
  async (req, res, next) => {
    try {
      const result = await realAuthService.completeRegistration({
        registrationToken: req.body.registrationToken,
        profile: {
          full_name: req.body.fullName,
          city: req.body.city,
          zone: req.body.zone,
          platform: req.body.platform,
          weekly_income: req.body.weeklyIncome,
          work_type: req.body.workType,
          worker_id: req.body.workerId,
          work_proof_name: req.body.workProofName,
          device_id: req.body.deviceId,
          location: req.body.location,
        },
        ...getRequestContext(req),
      });

      return sendSuccess(res, result, "Registration completed successfully.", 201);
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/auth/real/me", authenticate, async (req, res, next) => {
  try {
    const result = await realAuthService.getCurrentUser(req.user);
    return sendSuccess(res, result, "Current user loaded successfully.");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
