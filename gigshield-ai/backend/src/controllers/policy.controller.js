/**
 * Policy Controller — Handles premium quotes and policy purchase
 */

const PolicyService = require("../services/policy.service");
const PolicyModel = require("../models/policy.model");

const PolicyController = {
  async getQuote(req, res, next) {
    try {
      const quote = await PolicyService.getQuote(req.user.id);
      res.json({ data: quote });
    } catch (err) {
      next(err);
    }
  },

  async purchase(req, res, next) {
    try {
      const { assessment_id, payment_id } = req.body;
      const policy = await PolicyService.purchasePolicy(req.user.id, assessment_id, payment_id);
      res.status(201).json({ message: "Policy purchased", data: policy });
    } catch (err) {
      next(err);
    }
  },

  async getActivePolicies(req, res, next) {
    try {
      const policies = await PolicyModel.findActiveByWorker(req.user.id);
      res.json({ data: policies });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PolicyController;
