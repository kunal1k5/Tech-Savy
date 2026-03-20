import React, { useEffect, useState } from "react";
import api from "../services/api";
import StatCard from "../components/StatCard";
import { formatINR } from "../utils/helpers";

/**
 * AdminDashboard — Platform-wide analytics for admins.
 */
function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [triggers, setTriggers] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdmin() {
      try {
        const [statsRes, triggerRes, flaggedRes] = await Promise.all([
          api.get("/admin/dashboard"),
          api.get("/admin/triggers/recent"),
          api.get("/admin/claims/flagged"),
        ]);
        setStats(statsRes.data.data);
        setTriggers(triggerRes.data.data);
        setFlagged(flaggedRes.data.data);
      } catch (err) {
        console.error("Admin dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAdmin();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-gray-500">Loading analytics...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Workers" value={stats.total_workers} color="bg-primary-500" />
          <StatCard title="Active Policies" value={stats.active_policies} subtitle={`${stats.total_policies} total`} color="bg-shield-green" />
          <StatCard title="Pending Claims" value={stats.claims.pending} subtitle={`${stats.claims.flagged} flagged`} color="bg-shield-orange" />
          <StatCard title="Total Payouts" value={formatINR(stats.claims.total_payout)} color="bg-shield-red" />
        </div>
      )}

      {/* Recent Triggers */}
      <h2 className="text-xl font-bold mb-4">Recent Triggers (7 days)</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">City / Zone</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{t.trigger_type}</td>
                <td className="px-4 py-3">{t.city} / {t.zone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold
                    ${t.severity === "critical" ? "bg-red-100 text-red-700" :
                      t.severity === "high" ? "bg-orange-100 text-orange-700" :
                      "bg-yellow-100 text-yellow-700"}`}>
                    {t.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(t.triggered_at).toLocaleString()}</td>
              </tr>
            ))}
            {triggers.length === 0 && (
              <tr><td colSpan="4" className="px-4 py-6 text-center text-gray-400">No recent triggers</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flagged Claims */}
      <h2 className="text-xl font-bold mb-4">Flagged Claims (Manual Review Required)</h2>
      <div className="space-y-3">
        {flagged.map((c) => (
          <div key={c.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-400">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{c.full_name} — {c.city} / {c.zone}</p>
                <p className="text-sm text-gray-500">Claim: {formatINR(c.claim_amount)} | Fraud Score: {c.fraud_score}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">Flagged</span>
            </div>
          </div>
        ))}
        {flagged.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400">No flagged claims</div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
