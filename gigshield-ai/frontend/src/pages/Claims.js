import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CloudRain,
  History,
  ShieldAlert,
  Siren,
  Wind,
} from "lucide-react";
import EmptyState from "../components/ui/EmptyState";
import InfoTooltip from "../components/ui/InfoTooltip";
import SectionHeader from "../components/ui/SectionHeader";
import StatusPill from "../components/ui/StatusPill";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { getFraudStatusLabel, getStatusLabel } from "../data/mockPlatform";
import { formatINR } from "../utils/helpers";

const EVENT_ICONS = {
  Rainfall: CloudRain,
  AQI: Wind,
};

const HISTORY_TONES = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  danger: "border-red-500/20 bg-red-500/10 text-red-100",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-100",
  default: "border-white/10 bg-white/5 text-slate-200",
};

export default function Claims() {
  const { platformState, derivedData, actions } = useGigShieldData();

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Claims system"
        title="Automated claim lifecycle"
        description="Claims are generated from monitored events, run through fraud checks, and move through review states with timestamps and history."
        action={
          <>
            <button
              type="button"
              onClick={() => actions.triggerScenario("rainBurst")}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Trigger rain event
              <CloudRain size={16} />
            </button>
            <button
              type="button"
              onClick={actions.runFraudDrill}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
            >
              Trigger fraud drill
              <ShieldAlert size={16} />
            </button>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="glass-panel rounded-[2rem] border border-white/10 p-5">
          <div className="text-sm text-slate-400">Claims tracked</div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {platformState.claims.length}
          </div>
          <div className="mt-3 text-sm text-slate-500">
            Includes paid, approved, pending, and manual review claims.
          </div>
        </div>
        <div className="glass-panel rounded-[2rem] border border-white/10 p-5">
          <div className="text-sm text-slate-400">Claims in progress</div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {derivedData.pendingClaims.length}
          </div>
          <div className="mt-3 text-sm text-slate-500">
            These claims are still inside automated approval or review logic.
          </div>
        </div>
        <div className="glass-panel rounded-[2rem] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            Fraud watch
            <InfoTooltip
              label="Fraud watch info"
              text="Location jumps and rapid repeat claims are shown here so judges can see the anti-fraud story without opening another screen."
            />
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {getFraudStatusLabel(platformState.fraudWatch.status)}
          </div>
          <div className="mt-3 text-sm text-slate-500">
            {platformState.fraudWatch.latestAudit}
          </div>
        </div>
      </div>

      {!platformState.claims.length ? (
        <EmptyState
          icon={History}
          title="No claims generated yet"
          description="Simulate a weather or fraud scenario to populate the claims timeline with realistic statuses and timestamps."
          action={
            <button
              type="button"
              onClick={() => actions.triggerScenario("rainBurst")}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Generate first claim
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          {platformState.claims.map((claim) => {
            const EventIcon = EVENT_ICONS[claim.eventType] || Siren;

            return (
              <motion.div
                key={claim.id}
                whileHover={{ y: -3 }}
                className="glass-panel rounded-[2rem] border border-white/10 p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-4">
                    <div className="mt-1 rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">
                      <EventIcon size={20} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">{claim.headline}</h3>
                        <StatusPill
                          tone={
                            claim.status === "paid"
                              ? "success"
                              : claim.status === "manual_review"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {getStatusLabel(claim.status)}
                        </StatusPill>
                        <StatusPill
                          tone={claim.fraudStatus === "flagged" ? "danger" : claim.fraudStatus === "verified" ? "success" : "warning"}
                        >
                          {getFraudStatusLabel(claim.fraudStatus)}
                        </StatusPill>
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-slate-400">
                        {claim.source} logged {claim.triggerValue} in {claim.area}. Claim
                        amount is {formatINR(claim.amount)}.
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>ID {claim.id}</span>
                        <span>Detected {new Date(claim.detectedAt).toLocaleString()}</span>
                        <span>Updated {new Date(claim.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 xl:min-w-[240px]">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Payout status
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatINR(claim.amount)}
                    </div>
                    <div className="mt-3 text-sm text-slate-400">{claim.payoutWindow}</div>
                    {claim.flags.length ? (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                        {claim.flags[0]}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      Claim history
                      <InfoTooltip
                        label="Claim history info"
                        text="Every status transition is timestamped so the automated flow is easy to explain during a demo."
                      />
                    </div>
                    <div className="mt-4 space-y-3">
                      {claim.history.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-2xl border px-4 py-3 text-sm ${
                            HISTORY_TONES[entry.tone] || HISTORY_TONES.default
                          }`}
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="font-medium text-white">
                              {entry.stage.replace(/_/g, " ")}
                            </div>
                            <div className="text-xs text-slate-400">
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-2 leading-6">{entry.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="text-sm font-medium text-white">Judge-friendly summary</div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                      <p>
                        This claim shows how event detection, risk review, and payout states
                        stay visible in one place.
                      </p>
                      <p>
                        Current fraud status:{" "}
                        <span className="font-medium text-white">
                          {getFraudStatusLabel(claim.fraudStatus)}
                        </span>
                      </p>
                      <p>
                        Current claim status:{" "}
                        <span className="font-medium text-white">
                          {getStatusLabel(claim.status)}
                        </span>
                      </p>
                    </div>
                    <Link
                      to="/dashboard"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                    >
                      Back to dashboard
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-400">
        <div className="mb-2 flex items-center gap-2 text-white">
          <AlertTriangle size={16} className="text-amber-300" />
          Why this flow feels real
        </div>
        Claims are not static cards anymore. They are generated from event scenarios,
        timestamped automatically, and updated in place as approval and fraud logic runs.
      </div>
    </div>
  );
}
