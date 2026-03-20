/**
 * Admin Controller — Dashboard analytics and admin operations
 */

const { pool } = require("../database/connection");

const AdminController = {
  async getDashboardStats(req, res, next) {
    try {
      const [workers, policies, claims, triggers] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM workers"),
        pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM policies"),
        pool.query(`SELECT COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE status = 'flagged') as flagged,
                    COALESCE(SUM(claim_amount) FILTER (WHERE status = 'approved' OR status = 'paid'), 0) as total_payout
                    FROM claims`),
        pool.query("SELECT COUNT(*) as count FROM parametric_triggers WHERE triggered_at > NOW() - INTERVAL '7 days'"),
      ]);

      res.json({
        data: {
          total_workers: parseInt(workers.rows[0].count),
          total_policies: parseInt(policies.rows[0].total),
          active_policies: parseInt(policies.rows[0].active),
          claims: {
            total: parseInt(claims.rows[0].total),
            pending: parseInt(claims.rows[0].pending),
            approved: parseInt(claims.rows[0].approved),
            flagged: parseInt(claims.rows[0].flagged),
            total_payout: parseFloat(claims.rows[0].total_payout),
          },
          triggers_this_week: parseInt(triggers.rows[0].count),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getRecentTriggers(req, res, next) {
    try {
      const result = await pool.query(
        "SELECT * FROM parametric_triggers ORDER BY triggered_at DESC LIMIT 20"
      );
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  },

  async getFlaggedClaims(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT c.*, w.full_name, w.email, w.city, w.zone
         FROM claims c JOIN workers w ON w.id = c.worker_id
         WHERE c.status = 'flagged'
         ORDER BY c.created_at DESC`
      );
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AdminController;
