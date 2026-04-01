import React from "react";
import {
  AlertTriangle,
  Check,
  CloudRain,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card, { CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { formatINR } from "../utils/helpers";

const RISK_OPTIONS = [
  { id: "low", label: "Low", tone: "success" },
  { id: "medium", label: "Medium", tone: "warning" },
  { id: "high", label: "High", tone: "danger" },
];

export default function PolicyQuote() {
  const { platformState, derivedData, actions } = useGigShieldData();

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Policy"
        title="Select your protection plan"
        description="Choose Basic or Premium, simulate risk, and watch weekly premium update instantly."
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card glow="sky">
          <CardHeader>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Live policy state</div>
              <CardTitle className="mt-2">Current cover and premium</CardTitle>
              <CardDescription className="mt-2">
                This section is built for the demo flow: policy active status, risk simulation, and premium updates in one place.
              </CardDescription>
            </div>
            <Badge tone={derivedData.riskTone} pulse={derivedData.riskTone === "danger"}>
              {derivedData.currentRisk?.level || "Low"}
            </Badge>
          </CardHeader>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Shield size={16} className="text-sky-300" />
                Active policy
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-white">
                {derivedData.hasActivePolicy ? derivedData.activePlan.name : "No active policy"}
              </div>
              <div className="mt-2 text-sm text-slate-400">
                {derivedData.hasActivePolicy
                  ? `Coverage ${formatINR(derivedData.totalProtectedAmount)} • Status active`
                  : `${derivedData.displayPlan.name} is ready to activate`}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Wallet size={16} className="text-emerald-300" />
                Weekly premium
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-white">
                {formatINR(derivedData.dynamicPremium)}
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Risk score {derivedData.currentRisk?.score || 0}/100
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <AlertTriangle size={16} className="text-amber-300" />
              Simulate risk
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {RISK_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={derivedData.currentRisk?.level?.toLowerCase() === option.id ? "primary" : "secondary"}
                  onClick={() => actions.simulateRisk(option.id)}
                >
                  {option.label} Risk
                </Button>
              ))}
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-400">
              Demo flow tip: make risk high, watch premium increase, then trigger rainfall or AQI claim.
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" leftIcon={CloudRain} onClick={() => actions.triggerScenario("rainBurst")}>
              Trigger Rain Claim
            </Button>
            <Button type="button" variant="secondary" leftIcon={Sparkles} onClick={() => actions.triggerScenario("airQualitySpike")}>
              Trigger AQI Claim
            </Button>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {platformState.plans.map((plan) => {
            const isActive = plan.id === platformState.activePlanId;
            const isRecommended = plan.id === platformState.recommendedPlanId;

            return (
              <Card
                key={plan.id}
                glow={isActive ? "emerald" : isRecommended ? "sky" : "violet"}
                interactive
                className={isActive ? "border-emerald-400/20" : undefined}
              >
                <CardHeader>
                  <div>
                    <div className="text-sm text-slate-400">{plan.description}</div>
                    <CardTitle className="mt-2 text-3xl">{plan.name}</CardTitle>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-slate-950/55 text-white">
                    {isRecommended ? <Sparkles size={18} /> : <Shield size={18} />}
                  </div>
                </CardHeader>

                <div className="mt-5 flex flex-wrap gap-2">
                  {isActive ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>}
                  {isRecommended ? <Badge tone="info">Recommended</Badge> : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-sm text-slate-400">Coverage</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatINR(plan.coverageAmount || plan.payoutCap * 7)}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-sm text-slate-400">Premium</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatINR(plan.premiumWeekly)}
                      <span className="ml-2 text-sm font-normal text-slate-500">/ week</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                      <div className="mt-1 rounded-full bg-emerald-400/[0.12] p-1 text-emerald-300">
                        <Check size={12} />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  onClick={() => actions.selectPlan(plan.id)}
                  variant={isActive ? "success" : "primary"}
                  className="mt-6 w-full"
                >
                  {isActive ? "Policy Active" : `Buy ${plan.name}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
