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
import { useGigShieldData } from "../context/GigShieldDataContext";
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

function getPlanSources(plans = []) {
  if (!plans.length) {
    return { basicSource: null, smartSource: null };
  }

  const sortedPlans = [...plans].sort((firstPlan, secondPlan) => {
    const firstValue = firstPlan.coverageAmount || firstPlan.payoutCap || firstPlan.premiumWeekly || 0;
    const secondValue =
      secondPlan.coverageAmount || secondPlan.payoutCap || secondPlan.premiumWeekly || 0;
    return firstValue - secondValue;
  });

  return {
    basicSource: sortedPlans[0],
    smartSource: sortedPlans[sortedPlans.length - 1],
  };
}

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
  const { platformState, derivedData, actions, uiState } = useGigShieldData();
  const {
    data: liveBackendData,
    error: liveBackendError,
    isLoading: liveBackendLoading,
    isRefreshing: liveBackendRefreshing,
  } = useLiveBackendData();
  const currentRisk = normalizeRiskLabel(liveBackendData?.risk || derivedData.currentRisk?.level || "Low");
  const smartPremium = Number(liveBackendData?.premium ?? SMART_PREMIUM_BY_RISK[currentRisk] ?? 20);
  const liveFraudStatus = String(liveBackendData?.status || "SAFE").toLowerCase();
  const { basicSource, smartSource } = useMemo(
    () => getPlanSources(platformState.plans),
    [platformState.plans]
  );

  const displayedPlans = [
    {
      sourceId: basicSource?.id,
      title: "Basic Plan",
      coverageLabel: "Coverage: Limited",
      premiumLabel: `${formatINR(10)}/week`,
      features: ["Basic risk coverage"],
      summary: "Entry cover for essential disruptions during active work hours.",
      isRecommended: false,
    },
    {
      sourceId: smartSource?.id,
      title: "Smart Plan",
      coverageLabel: "Coverage: Full",
      premiumLabel: `${formatINR(smartPremium)}/week`,
      features: ["Full risk coverage", "Automatic claim support"],
      summary: "Dynamic premium linked to live risk conditions and auto-claim support.",
      isRecommended: true,
    },
  ];

  const activePlan =
    displayedPlans.find((plan) => plan.sourceId === platformState.activePlanId) || displayedPlans[1];

  async function handleAutoClaimDemo(scenarioId, riskKey) {
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
        <p className="text-sm font-medium text-slate-500">Policy</p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Choose Your Plan
        </h2>
        <p className="text-sm leading-6 text-slate-600 md:text-base">
          Select a plan, see premium respond to real-time monitoring, and keep protection risk-based.
        </p>
      </motion.header>

      <AnimatePresence>
        {uiState.riskUpdating || uiState.planUpdating || (liveBackendLoading && !liveBackendData) ? (
          <SurfaceLoadingPanel
            title={
              liveBackendLoading && !liveBackendData
                ? "Loading live backend data"
                : uiState.planUpdating
                  ? "Activating policy"
                  : "Updating premium"
            }
            description={
              liveBackendLoading && !liveBackendData
                ? "Fetching risk, premium, and fraud status from the backend."
                : uiState.planUpdating
                ? "Applying your selected plan and refreshing coverage."
                : "Refreshing premium from live risk conditions."
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
              <p className="text-sm font-medium text-slate-500">Plan Selection</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Simple insurance coverage
              </h3>
            </div>

            <StatusBadge status="recommended" label="Smart Plan Recommended" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {displayedPlans.map((plan) => (
              <PlanCard
                key={plan.title}
                title={plan.title}
                coverageLabel={plan.coverageLabel}
                premiumLabel={plan.premiumLabel}
                features={plan.features}
                isRecommended={plan.isRecommended}
                isActive={plan.sourceId === platformState.activePlanId}
                isLoading={uiState.planUpdating && uiState.planTarget === plan.sourceId}
                onSelect={() => plan.sourceId && actions.selectPlan(plan.sourceId)}
              />
            ))}
          </div>
        </motion.section>

        <div className="space-y-6">
          <motion.section
            variants={itemVariants}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">Risk to premium</p>
                  <InfoTooltip
                    label="Dynamic premium information"
                    text="Real-time monitoring updates the Smart Plan premium as risk conditions change."
                  />
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Dynamic premium
                </h3>
              </div>

              <StatusBadge status={`risk_${currentRisk.toLowerCase()}`} label={`${currentRisk} Risk`} />
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-500">Smart Plan premium</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                <CountUp
                  end={smartPremium}
                  duration={1.5}
                  formattingFn={(value) => `${formatINR(Math.round(value))}/week`}
                  preserveValue
                />
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Risk: {currentRisk} -> Premium: {formatINR(smartPremium)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">Fraud status</span>
                <StatusBadge status={liveFraudStatus} label={liveFraudStatus.toUpperCase()} />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {liveBackendRefreshing ? "Refreshing backend data..." : "Live backend data connected."}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
                <AlertTriangle size={16} />
                Update risk
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
              planName={activePlan.title}
              premiumAmount={activePlan.title === "Smart Plan" ? smartPremium : 10}
              coverageSummary={activePlan.summary}
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
                  Real policy intelligence
                </h3>
              </div>
              <StatusBadge status={liveFraudStatus} label={liveFraudStatus.toUpperCase()} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Current Risk</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{currentRisk}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Premium</p>
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
              Automatic claim support
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Claim automatically triggered due to high risk conditions
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Real-time monitoring watches weather and air quality, then the automated system
              moves a claim from pending to paid when the policy conditions match.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <SurfaceButton
                onClick={() => handleAutoClaimDemo("rainBurst", "high")}
                leftIcon={CloudRain}
                loading={uiState.claimTriggering && uiState.claimScenarioId === "rainBurst"}
                className="w-full sm:w-auto"
              >
                Simulate Heavy Rain
              </SurfaceButton>

              <SurfaceButton
                onClick={() => handleAutoClaimDemo("airQualitySpike", "medium")}
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
