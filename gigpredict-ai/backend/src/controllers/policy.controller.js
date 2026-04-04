/**
 * Policy Controller — Handles premium quotes and policy purchase
 */

const PolicyService = require("../services/policy.service");
const PolicyModel = require("../models/policy.model");
const { sendSuccess } = require("../utils/apiResponse");

const PolicyController = {
  async getQuote(req, res, next) {
    try {
      const quote = await PolicyService.getQuote(req.user.id);
      return sendSuccess(res, quote, "Policy quote loaded successfully.");
    } catch (err) {
      next(err);
    }
  },

  async purchase(req, res, next) {
    try {
      const { assessment_id, payment_id } = req.body;
      const policy = await PolicyService.purchasePolicy(req.user.id, assessment_id, payment_id);
      return sendSuccess(res, policy, "Policy purchased successfully.", 201);
    } catch (err) {
      next(err);
    }
  },

  async getActivePolicies(req, res, next) {
    try {
      const policies = await PolicyModel.findActiveByWorker(req.user.id);
      return sendSuccess(res, policies, "Active policies loaded successfully.");
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PolicyController;
