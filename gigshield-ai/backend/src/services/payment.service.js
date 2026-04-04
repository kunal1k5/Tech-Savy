/**
 * Payment Service — Razorpay integration for premium collection & payouts.
 */

const Razorpay = require("razorpay");
const { pool } = require("../database/connection");
const logger = require("../utils/logger");

// Initialize Razorpay in sandbox mode
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

const PaymentService = {
  /**
   * Create a Razorpay order for premium payment.
   */
  async createPremiumOrder(workerId, amount) {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `premium_${workerId}_${Date.now()}`,
      notes: { worker_id: workerId, type: "premium" },
    });

    // Log the payment intent
    await pool.query(
      `INSERT INTO payments (worker_id, type, amount, razorpay_id, razorpay_status, metadata)
       VALUES ($1, 'premium', $2, $3, 'created', $4)`,
      [workerId, amount, order.id, JSON.stringify({ order })]
    );

    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    };
  },

  /**
   * Verify Razorpay payment signature after checkout.
   */
  async verifyPayment(orderId, paymentId, signature) {
    const crypto = require("crypto");
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "placeholder_secret")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSig !== signature) {
      const err = new Error("Payment verification failed");
      err.statusCode = 400;
      throw err;
    }

    // Update payment record
    await pool.query(
      `UPDATE payments SET razorpay_status = 'captured', razorpay_id = $1 WHERE razorpay_id = $2`,
      [paymentId, orderId]
    );

    return { verified: true, payment_id: paymentId };
  },

  /**
   * Initiate payout for an approved claim via Razorpay.
   */
  async initiatePayout(claimId, workerId, amount) {
    logger.info(`Payout initiated: claim=${claimId}, worker=${workerId}, amount=₹${amount}`);

    // In sandbox mode, we simulate the payout
    const payoutRef = `payout_${claimId}_${Date.now()}`;

    await pool.query(
      `INSERT INTO payments (worker_id, type, amount, razorpay_id, razorpay_status, metadata)
       VALUES ($1, 'payout', $2, $3, 'processed', $4)`,
      [workerId, amount, payoutRef, JSON.stringify({ claim_id: claimId })]
    );

    return { payout_ref: payoutRef, amount, status: "processed" };
  },
};

module.exports = PaymentService;
