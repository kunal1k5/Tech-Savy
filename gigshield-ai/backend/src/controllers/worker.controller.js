/**
 * Worker Controller — Handles HTTP request/response for worker endpoints
 */

const WorkerService = require("../services/worker.service");
const { sendSuccess } = require("../utils/apiResponse");

const WorkerController = {
  async register(req, res, next) {
    try {
      const result = await WorkerService.register(req.body);
      return sendSuccess(res, result, "Worker registered successfully.", 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await WorkerService.login(email, password);
      return sendSuccess(res, result, "Login successful.");
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const worker = await WorkerService.getProfile(req.user.id);
      return sendSuccess(res, worker, "Worker profile loaded successfully.");
    } catch (err) {
      next(err);
    }
  },
};

module.exports = WorkerController;
