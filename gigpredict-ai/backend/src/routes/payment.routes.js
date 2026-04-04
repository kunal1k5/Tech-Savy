/**
 * Payment Routes
 *
 * POST /api/payments/create-order — Create Razorpay order
 * POST /api/payments/verify       — Verify payment signature
 */

const { Router } = require("express");
const Joi = require("joi");
const PaymentController = require("../controllers/payment.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

const router = Router();

const orderSchema = Joi.object({
  amount: Joi.number().positive().required(),
});

const verifySchema = Joi.object({
  order_id: Joi.string().required(),
  payment_id: Joi.string().required(),
  signature: Joi.string().required(),
});

router.post("/create-order", authenticate, validate(orderSchema), PaymentController.createOrder);
router.post("/verify", authenticate, validate(verifySchema), PaymentController.verifyPayment);

module.exports = router;
