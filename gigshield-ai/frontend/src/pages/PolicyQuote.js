import React from "react";
import { motion } from "framer-motion";
import { Check, Shield, Sparkles, Wallet } from "lucide-react";
import InfoTooltip from "../components/ui/InfoTooltip";
import SectionHeader from "../components/ui/SectionHeader";
import StatusPill from "../components/ui/StatusPill";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { formatINR } from "../utils/helpers";

export default function PolicyQuote() {
  const { platformState, derivedData, actions } = useGigShieldData();

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Coverage design"
        title="Choose a plan that matches current route risk"
        description="Plans are now driven by live mock data so recommendation logic, payout caps, and coverage reasoning feel realistic during a demo."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="glass-panel rounded-[2rem] border border-white/10 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-white">Recommendation summary</h2>
            <InfoTooltip
              label="Recommendation info"
              text="The recommended plan is based on the current zone feed, recent payouts, and disruption pressure in the worker's area."
            />
          </div>

          <div className="mt-6 rounded-[2rem] border border-sky-500/20 bg-sky-500/10 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone="info">Recommended</StatusPill>
              <div className="text-lg font-semibold text-white">
                {derivedData.recommendedPlan.name}
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-sky-100/90">
              {derivedData.recommendedPlan.note}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="text-sm text-slate-400">Current zone pressure</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {derivedData.currentRisk.zone} at {derivedData.currentRisk.score}/100
              </div>
              <div className="mt-3 text-sm text-slate-500">
                Higher disruption pressure increases the value of faster automated payout handling.
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="text-sm text-slate-400">Paid this week</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatINR(derivedData.weeklyPayouts)}
              </div>
              <div className="mt-3 text-sm text-slate-500">
                The selected plan should still leave room for one more large disruption this week.
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="text-sm text-slate-400">Current active plan</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {derivedData.activePlan.name}
              </div>
              <div className="mt-3 text-sm text-slate-500">
                Daily cap {formatINR(derivedData.activePlan.payoutCap)} for verified claims.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {platformState.plans.map((plan) => {
            const isActive = plan.id === platformState.activePlanId;
            const isRecommended = plan.id === platformState.recommendedPlanId;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                className={`glass-panel flex h-full flex-col rounded-[2rem] border p-6 ${
                  isRecommended
                    ? "border-sky-500/25 bg-gradient-to-b from-sky-500/10 to-transparent"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-400">{plan.description}</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{plan.name}</h3>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white">
                    {isRecommended ? <Sparkles size={18} /> : <Shield size={18} />}
                  </div>
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <div className="text-4xl font-semibold text-white">
                    {formatINR(plan.premiumWeekly)}
                  </div>
                  <div className="pb-1 text-sm text-slate-500">per week</div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {isRecommended ? <StatusPill tone="info">Recommended</StatusPill> : null}
                  {isActive ? <StatusPill tone="success">Active</StatusPill> : null}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                      <span className="mt-1 rounded-full bg-emerald-500/15 p-1 text-emerald-300">
                        <Check size={12} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
                  <div className="flex items-center gap-2 text-white">
                    <Wallet size={15} className="text-emerald-300" />
                    Payout cap {formatINR(plan.payoutCap)}
                  </div>
                  <div className="mt-2">{plan.note}</div>
                </div>

                <button
                  type="button"
                  onClick={() => actions.selectPlan(plan.id)}
                  className={`mt-6 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                      : "bg-sky-600 text-white hover:bg-sky-500"
                  }`}
                >
                  {isActive ? "Plan active" : `Switch to ${plan.name}`}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
