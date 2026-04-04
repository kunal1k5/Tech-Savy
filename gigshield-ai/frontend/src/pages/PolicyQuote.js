import React, { useMemo } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudRain, ShieldCheck, Wind } from "lucide-react";
import ActivePolicyCard from "../components/policy/ActivePolicyCard";
import PlanCard from "../components/policy/PlanCard";
import InfoTooltip from "../components/ui/InfoTooltip";
import StatusBadge from "../components/ui/StatusBadge";
import SurfaceButton from "../components/ui/SurfaceButton";
import SurfaceLoadingPanel from "../components/ui/SurfaceLoadingPanel";
import { useGigPredictAIData } from "../context/GigPredictAIDataContext";
import useLiveBackendData from "../hooks/useLiveBackendData";
import { formatINR } from "../utils/helpers";

const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut",
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const RISK_OPTIONS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const SMART_PREMIUM_BY_RISK = {
  Low: 10,
  Medium: 20,
  High: 30,
};

function normalizeRiskLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") {
    return "High";
  }
  if (normalized === "low" || normalized === "safe") {
    return "Low";
  }
  return "Medium";
}

export default function PolicyQuote() {
  const { platformState, derivedData, actions, uiState } = useGigPredictAIData();
  const {
    data: liveBackendData,
    error: liveBackendError,
    isLoading: liveBackendLoading,
    isRefreshing: liveBackendRefreshing,
  } = useLiveBackendData();
  const currentRisk = normalizeRiskLabel(liveBackendData?.risk || derivedData.currentRisk?.level || "Low");
  const smartPremium = Number(liveBackendData?.premium ?? SMART_PREMIUM_BY_RISK[currentRisk] ?? 20);
  const liveFraudStatus = String(liveBackendData?.status || "SAFE").toLowerCase();
  const displayedPlans = useMemo(
    () =>
      platformState.plans.map((plan) => ({
        sourceId: plan.id,
        title: plan.name,
        coverageLabel: `Signal Capacity: ${formatINR(plan.coverageAmount || plan.payoutCap || 0)}`,
        premiumLabel: `${formatINR(plan.premiumWeekly || 0)}/week`,
        premiumAmount: plan.premiumWeekly || 0,
        features: plan.features?.length ? plan.features : ["Real-time monitoring active"],
        summary:
          plan.description || plan.note || "Decision intelligence profile backed by live backend data.",
        isRecommended: plan.id === platformState.recommendedPlanId,
        isActive: plan.id === platformState.activePlanId,
      })),
    [platformState.activePlanId, platformState.plans, platformState.recommendedPlanId]
  );

  const activePlan = displayedPlans.find((plan) => plan.isActive) || displayedPlans[0] || null;

  async function handleAutoClaimScenario(scenarioId, riskKey) {
    await actions.simulateRisk(riskKey, { silent: true });
    actions.triggerScenario(scenarioId, { origin: "auto" });
  }

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="space-y-2">
        <p className="text-sm font-medium text-slate-500">Decision Studio</p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Choose Your Monitoring Profile
        </h2>
        <p className="text-sm leading-6 text-slate-600 md:text-base">
          Select a profile, watch engine cost respond to real-time monitoring, and keep self-correcting AI active.
        </p>
      </motion.header>

      <AnimatePresence>
        {uiState.riskUpdating || uiState.planUpdating || (liveBackendLoading && !liveBackendData) ? (
          <SurfaceLoadingPanel
            title={
              liveBackendLoading && !liveBackendData
                ? "Loading live backend data"
                : uiState.planUpdating
                  ? "Activating decision profile"
                  : "Updating engine cost"
            }
            description={
              liveBackendLoading && !liveBackendData
                ? "Fetching risk, engine cost, and fraud status from the backend."
                : uiState.planUpdating
                ? "Applying your selected profile and refreshing live signals."
                : "Refreshing engine cost from live risk conditions."
            }
          />
        ) : null}
      </AnimatePresence>

      {liveBackendError ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {liveBackendError}
        </motion.div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Decision Profiles</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Decision engine profiles
              </h3>
            </div>

            {platformState.recommendedPlanId ? (
              <StatusBadge status="recommended" label="Recommended Profile" />
            ) : null}
          </div>

          {displayedPlans.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {displayedPlans.map((plan) => (
                <PlanCard
                  key={plan.sourceId}
                  title={plan.title}
                  coverageLabel={plan.coverageLabel}
                  premiumLabel={plan.premiumLabel}
                  features={plan.features}
                  isRecommended={plan.isRecommended}
                  isActive={plan.isActive}
                  isLoading={uiState.planUpdating && uiState.planTarget === plan.sourceId}
                  onSelect={() => plan.sourceId && actions.selectPlan(plan.sourceId)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No profiles available right now. Please wait for the backend sync to finish.
            </div>
          )}
        </motion.section>

        <div className="space-y-6">
          <motion.section
            variants={itemVariants}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">Risk Engine to Engine Cost</p>
                  <InfoTooltip
                    label="Dynamic engine cost information"
                    text="Real-time monitoring updates the active profile cost as risk conditions change."
                  />
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Dynamic engine cost
                </h3>
              </div>

              <StatusBadge status={`risk_${currentRisk.toLowerCase()}`} label={`${currentRisk} Risk`} />
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-500">Active profile cost</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                <CountUp
                  end={smartPremium}
                  duration={1.5}
                  formattingFn={(value) => `${formatINR(Math.round(value))}/week`}
                  preserveValue
                />
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Risk Engine: {currentRisk} -> Engine Cost: {formatINR(smartPremium)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">Fraud status</span>
                <StatusBadge status={liveFraudStatus} label={liveFraudStatus.toUpperCase()} />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {liveBackendRefreshing ? "Refreshing decision signals..." : "Live backend data connected."}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
                <AlertTriangle size={16} />
                Update risk engine
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {RISK_OPTIONS.map((option) => (
                  <SurfaceButton
                    key={option.id}
                    onClick={() => actions.simulateRisk(option.id)}
                    loading={uiState.riskUpdating && uiState.riskTarget === option.id}
                    className={`${
                      currentRisk.toLowerCase() === option.id ||
                      (uiState.riskUpdating && uiState.riskTarget === option.id)
                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : ""
                    }`}
                    variant="secondary"
                  >
                    {option.label}
                  </SurfaceButton>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.div variants={itemVariants}>
            <ActivePolicyCard
              planName={activePlan?.title || "No active profile"}
              premiumAmount={activePlan?.premiumAmount ?? smartPremium}
              coverageSummary={
                activePlan?.summary || "Your live decision profile details will appear here after sync."
              }
              riskLevel={currentRisk}
            />
          </motion.div>

          <motion.section
            variants={itemVariants}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Backend snapshot</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Decision intelligence snapshot
                </h3>
              </div>
              <StatusBadge status={liveFraudStatus} label={liveFraudStatus.toUpperCase()} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Risk Engine</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{currentRisk}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Engine Cost</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatINR(smartPremium)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Fraud Score</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {liveBackendData?.fraud_score ?? "--"}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            variants={itemVariants}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <ShieldCheck size={16} />
              Claim automation support
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Auto claim trigger under high-risk downtime
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Real-time monitoring watches weather and air quality, then the decision engine
              moves a claim from pending to paid when live conditions match.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <SurfaceButton
                onClick={() => handleAutoClaimScenario("rainBurst", "high")}
                leftIcon={CloudRain}
                loading={uiState.claimTriggering && uiState.claimScenarioId === "rainBurst"}
                className="w-full sm:w-auto"
              >
                Simulate Heavy Rain
              </SurfaceButton>

              <SurfaceButton
                onClick={() => handleAutoClaimScenario("airQualitySpike", "medium")}
                variant="secondary"
                leftIcon={Wind}
                loading={uiState.claimTriggering && uiState.claimScenarioId === "airQualitySpike"}
                className="w-full sm:w-auto"
              >
                Simulate AQI Risk
              </SurfaceButton>
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
