/**
 * Worker Controller — Handles HTTP request/response for worker endpoints
 */

const WorkerService = require("../services/worker.service");

const WorkerController = {
  async register(req, res, next) {
    try {
      const result = await WorkerService.register(req.body);
      res.status(201).json({ message: "Worker registered successfully", data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await WorkerService.login(email, password);
      res.json({ message: "Login successful", data: result });
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const worker = await WorkerService.getProfile(req.user.id);
      res.json({ data: worker });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = WorkerController;
