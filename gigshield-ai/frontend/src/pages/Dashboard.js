import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  CloudRain,
  MapPinned,
  Radar,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  Siren,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import EmptyState from "../components/ui/EmptyState";
import InfoTooltip from "../components/ui/InfoTooltip";
import SectionHeader from "../components/ui/SectionHeader";
import StatusPill from "../components/ui/StatusPill";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { getFraudStatusLabel, getStatusLabel } from "../data/mockPlatform";
import { formatINR } from "../utils/helpers";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-[0_20px_40px_rgba(2,6,23,0.45)]">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 space-y-2 text-sm text-slate-300">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span>{entry.name}</span>
            <span className="font-medium text-white">
              {entry.dataKey === "downtimeHours"
                ? `${entry.value} hrs`
                : entry.dataKey === "riskScore"
                  ? entry.value
                  : formatINR(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { platformState, derivedData, actions } = useGigShieldData();
  const latestClaim = derivedData.latestClaim;
  const activeFlags = platformState.fraudWatch.activeFlags;

  const automationSteps = [
    {
      label: "Event detected",
      detail: latestClaim
        ? `${latestClaim.eventType} crossed threshold at ${latestClaim.area}.`
        : "Waiting for the next disruption signal.",
      tone: "info",
      active: Boolean(latestClaim),
    },
    {
      label: "Claim created",
      detail: latestClaim
        ? `${latestClaim.id} created by automated logic.`
        : "A claim will appear here once a threshold is crossed.",
      tone: "info",
      active: Boolean(latestClaim),
    },
    {
      label: getFraudStatusLabel(latestClaim?.fraudStatus || "in_progress"),
      detail: latestClaim
        ? latestClaim.flags[0] || "Route continuity and repeat-claim checks completed."
        : "Fraud checks will run immediately after claim creation.",
      tone: latestClaim?.fraudStatus === "flagged" ? "danger" : "warning",
      active: Boolean(latestClaim),
    },
    {
      label: getStatusLabel(latestClaim?.status || "pending"),
      detail: latestClaim
        ? latestClaim.payoutWindow
        : "Payout release happens after verification and approval.",
      tone: latestClaim?.status === "paid" ? "success" : "default",
      active: Boolean(latestClaim),
    },
  ];

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Live demo"
        title={`Good to see you, ${platformState.worker.name.split(" ")[0]}`}
        description="This workspace ties together monitoring, claims, payouts, and fraud checks with dynamic mock data so the product behaves like a live insurance platform."
        action={
          <>
            <button
              type="button"
              onClick={() => actions.triggerScenario("airQualitySpike")}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Simulate disruption
              <Siren size={16} />
            </button>
            <button
              type="button"
              onClick={actions.runFraudDrill}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
            >
              Run fraud drill
              <ShieldX size={16} />
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel rounded-[2rem] border border-white/10 p-6"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <StatusPill
                tone={derivedData.currentRisk?.level === "High" ? "danger" : "info"}
              >
                {derivedData.currentRisk?.level || "Live"} risk in {derivedData.currentRisk?.zone}
              </StatusPill>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {platformState.liveMonitor.headline}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
                  {platformState.liveMonitor.summary}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 md:min-w-[240px]">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Worker context
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPinned size={15} className="text-sky-300" />
                  {platformState.worker.area}, {platformState.worker.city}
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={15} className="text-emerald-300" />
                  Weekly income {formatINR(platformState.worker.weeklyIncome)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 size={15} className="text-amber-300" />
                  Active hours today {platformState.worker.activeHoursToday}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="glass-panel rounded-[2rem] border border-white/10 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Fraud watch
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {getFraudStatusLabel(platformState.fraudWatch.status)}
              </h2>
            </div>
            <StatusPill
              tone={platformState.fraudWatch.status === "flagged" ? "danger" : "success"}
            >
              {platformState.fraudWatch.status}
            </StatusPill>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            {platformState.fraudWatch.summary}
          </p>

          {activeFlags.length ? (
            <div className="mt-5 space-y-3">
              {activeFlags.map((flag) => (
                <div
                  key={flag}
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                >
                  {flag}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              No active anomalies. Claims can move through the automated flow without manual intervention.
            </div>
          )}

          <button
            type="button"
            onClick={actions.runFraudDrill}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
          >
            Test suspicious route
            <ShieldX size={16} />
          </button>
        </motion.div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Protected capacity"
          value={formatINR(derivedData.totalProtectedAmount)}
          subtitle={`${derivedData.activePlan.name} covers up to ${formatINR(derivedData.activePlan.payoutCap)} per day.`}
          icon={ShieldCheck}
          accent="sky"
          trend="Active now"
        />
        <StatCard
          title="Paid this week"
          value={formatINR(derivedData.weeklyPayouts)}
          subtitle="Dynamic mock payouts update whenever a verified event is settled."
          icon={Wallet}
          accent="emerald"
          trend="Live ledger"
        />
        <StatCard
          title="Claims in flight"
          value={derivedData.pendingClaims.length}
          subtitle="Pending, approved, and manual review claims stay visible until settled."
          icon={CloudRain}
          accent="amber"
          trend={derivedData.statusLabels.claim}
        />
        <StatCard
          title="Fraud alerts"
          value={derivedData.fraudFlags}
          subtitle="GPS jumps, repeat claims, and device switches are tracked in the same workflow."
          icon={AlertTriangle}
          accent="rose"
          trend={derivedData.statusLabels.fraud}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-white">Income vs payouts</h3>
                <InfoTooltip
                  label="Income chart info"
                  text="This chart uses dynamic mock data so every automated payout immediately shows up in the weekly trend."
                />
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Earnings stay visible alongside protected payouts and downtime hours.
              </p>
            </div>
            <button
              type="button"
              onClick={actions.refreshSignals}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Refresh signals
              <RefreshCcw size={16} />
            </button>
          </div>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={platformState.earningsTrend}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  name="Platform earnings"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fill="url(#earningsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="payouts"
                  name="Protected payouts"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#payoutGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">Zone risk feed</h3>
            <InfoTooltip
              label="Zone risk info"
              text="Scores simulate disruption pressure by zone so judges can see how local conditions affect cover logic."
            />
          </div>
          <div className="mt-5 space-y-4">
            {platformState.riskFeed.map((zone) => (
              <div
                key={zone.zone}
                className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{zone.zone}</div>
                    <div className="mt-1 text-sm text-slate-500">Change {zone.change}</div>
                  </div>
                  <StatusPill tone={zone.level === "High" ? "danger" : "warning"}>
                    {zone.level}
                  </StatusPill>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/5">
                  <div
                    className={`h-2 rounded-full ${
                      zone.level === "High" ? "bg-red-400" : zone.level === "Medium" ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    style={{ width: `${zone.score}%` }}
                  />
                </div>
                <div className="mt-2 text-sm text-slate-400">Score {zone.score}/100</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">Automated claim flow</h3>
            <InfoTooltip
              label="Claim flow info"
              text="This stepper responds to live mock state. It moves from detection to verification to payout without manual refresh."
            />
          </div>
          <div className="mt-6 space-y-4">
            {automationSteps.map((step, index) => (
              <div
                key={step.label}
                className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border text-sm font-semibold ${
                      step.active
                        ? "border-sky-500/20 bg-sky-500/10 text-sky-200"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="space-y-2">
                    <StatusPill tone={step.tone}>{step.label}</StatusPill>
                    <p className="text-sm leading-6 text-slate-400">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-white">Downtime pressure</h3>
              <InfoTooltip
                label="Downtime chart info"
                text="This view keeps risk score and downtime visible together, which helps explain why payouts were triggered."
              />
            </div>
            <div className="mt-6 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformState.earningsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="downtimeHours" name="Downtime" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="riskScore" name="Risk score" fill="#fb7185" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Recent claims</h3>
                <p className="mt-2 text-sm text-slate-400">
                  The claim list updates automatically whenever a new disruption is simulated.
                </p>
              </div>
              <Link
                to="/claims"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-200"
              >
                View all
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {platformState.claims.slice(0, 3).map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-white/15"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{claim.headline}</div>
                        <StatusPill tone={claim.status === "paid" ? "success" : claim.status === "manual_review" ? "danger" : "warning"}>
                          {getStatusLabel(claim.status)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {claim.triggerValue} / {claim.area}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-white">{formatINR(claim.amount)}</div>
                  </div>
                </div>
              ))}
            </div>

            {!platformState.claims.length ? (
              <div className="mt-5">
                <EmptyState
                  icon={Radar}
                  title="No claims yet"
                  description="Simulate a disruption to watch the automated claim lifecycle populate this section."
                  action={
                    <button
                      type="button"
                      onClick={() => actions.triggerScenario("rainBurst")}
                      className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                    >
                      Trigger first event
                    </button>
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
