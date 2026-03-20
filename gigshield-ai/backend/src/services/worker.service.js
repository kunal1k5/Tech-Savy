/**
 * Worker Service — Business logic for worker registration & profile
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const WorkerModel = require("../models/worker.model");

const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 12;

const WorkerService = {
  /**
   * Register a new worker account.
   * Hashes password, stores profile, and returns a JWT.
   */
  async register({ full_name, email, phone, password, platform, city, zone, avg_weekly_income, vehicle_type }) {
    // Check for existing account
    const existing = await WorkerModel.findByEmail(email);
    if (existing) {
      const err = new Error("A worker with this email already exists");
      err.statusCode = 409;
      throw err;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const worker = await WorkerModel.create({
      full_name, email, phone, password_hash, platform,
      city, zone, avg_weekly_income, vehicle_type,
    });

    const token = jwt.sign(
      { id: worker.id, email: worker.email, role: "worker" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { worker, token };
  },

  /**
   * Authenticate worker and return JWT.
   */
  async login(email, password) {
    const worker = await WorkerModel.findByEmail(email);
    if (!worker) {
      const err = new Error("Invalid email or password");
      err.statusCode = 401;
      throw err;
    }

    const valid = await bcrypt.compare(password, worker.password_hash);
    if (!valid) {
      const err = new Error("Invalid email or password");
      err.statusCode = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: worker.id, email: worker.email, role: "worker" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      worker: {
        id: worker.id, full_name: worker.full_name,
        email: worker.email, platform: worker.platform,
        city: worker.city, zone: worker.zone,
      },
    };
  },

  async getProfile(workerId) {
    const worker = await WorkerModel.findById(workerId);
    if (!worker) {
      const err = new Error("Worker not found");
      err.statusCode = 404;
      throw err;
    }
    return worker;
  },
};

module.exports = WorkerService;
