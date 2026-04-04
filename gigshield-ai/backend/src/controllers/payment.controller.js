/**
 * Payment Controller — Razorpay order creation and verification
 */

const PaymentService = require("../services/payment.service");
const { sendSuccess } = require("../utils/apiResponse");

const PaymentController = {
  async createOrder(req, res, next) {
    try {
      const { amount } = req.body;
      const order = await PaymentService.createPremiumOrder(req.user.id, amount);
      return sendSuccess(res, order, "Payment order created successfully.");
    } catch (err) {
      next(err);
    }
  },

  async verifyPayment(req, res, next) {
    try {
      const { order_id, payment_id, signature } = req.body;
      const result = await PaymentService.verifyPayment(order_id, payment_id, signature);
      return sendSuccess(res, result, "Payment verified successfully.");
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PaymentController;
