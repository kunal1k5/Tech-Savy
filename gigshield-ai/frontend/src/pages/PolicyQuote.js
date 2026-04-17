import React, { useMemo, useRef, useState } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, CloudRain, ShieldCheck, Sparkles, Wind } from "lucide-react";
import toast from "react-hot-toast";
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
  { id: "low", label: "Low", note: "Safe conditions (low premium)" },
  { id: "medium", label: "Medium", note: "Moderate risk" },
  { id: "high", label: "High", note: "High risk (higher payout potential)" },
];

const SMART_PREMIUM_BY_RISK = {
  Low: 10,
  Medium: 20,
  High: 30,
};

const DEFAULT_POLICY_FORM = {
  policyName: "",
  triggerType: "Rain",
  threshold: 50,
  payout: 500,
  duration: 7,
  location: "Urban",
};

function buildPolicySuggestion(prompt, currentForm) {
  const normalizedPrompt = String(prompt || "").toLowerCase();
  const base = {
    ...DEFAULT_POLICY_FORM,
    ...currentForm,
    duration: 7,
    location: "Urban",
  };

  if (normalizedPrompt.includes("rain")) {
    return {
      ...base,
      policyName: "Rain Protection Policy",
      triggerType: "Rain",
      threshold: 50,
      payout: 500,
    };
  }

  if (normalizedPrompt.includes("aqi") || normalizedPrompt.includes("pollution")) {
    return {
      ...base,
      policyName: "AQI Shield Policy",
      triggerType: "AQI",
      threshold: 300,
      payout: 300,
    };
  }

  if (normalizedPrompt.includes("demand")) {
    return {
      ...base,
      policyName: "Demand Surge Policy",
      triggerType: "Demand",
      threshold: 120,
      payout: 400,
    };
  }

  return {
    ...base,
    policyName: base.policyName || "Custom Smart Policy",
  };
}

function getRiskByTrigger(triggerType) {
  if (triggerType === "Rain") {
    return "high";
  }
  if (triggerType === "AQI") {
    return "medium";
  }
  return "low";
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

function getTriggerUnit(triggerType) {
  if (triggerType === "Rain") {
    return "mm";
  }

  return "";
}

function formatTriggerPreview(triggerType, threshold) {
  const unit = getTriggerUnit(triggerType);
  return `${triggerType} > ${threshold}${unit}`;
}

function getMonitoringBadgeAnimation(isRefreshing) {
  if (isRefreshing) {
    return { scale: [1, 1.05, 1] };
  }

  return { scale: 1 };
}

export default function PolicyQuote() {
  const { platformState, derivedData, actions, uiState } = useGigPredictAIData();
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggested, setAiSuggested] = useState(false);
  const [createdPolicies, setCreatedPolicies] = useState([]);
  const [policyForm, setPolicyForm] = useState(DEFAULT_POLICY_FORM);
  const [highlightActivePolicy, setHighlightActivePolicy] = useState(false);
  const policyStudioSectionRef = useRef(null);
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
        coverageLabel: `Coverage: ${formatINR(plan.coverageAmount || plan.payoutCap || 0)}`,
        premiumLabel: `${formatINR(plan.premiumWeekly || 0)}/week`,
        premiumAmount: plan.premiumWeekly || 0,
        features: plan.features?.length
          ? plan.features
          : ["Policy active with real-time trigger monitoring"],
        summary:
          plan.description || plan.note || "Policy profile backed by live backend data.",
        isRecommended: plan.id === platformState.recommendedPlanId,
        isActive: plan.id === platformState.activePlanId,
      })),
    [platformState.activePlanId, platformState.plans, platformState.recommendedPlanId]
  );

  const activePlan = displayedPlans.find((plan) => plan.isActive) || displayedPlans[0] || null;
  const latestCreatedPolicy = createdPolicies[0] || null;
  const assistantTriggerPreview = formatTriggerPreview(
    policyForm.triggerType,
    Number(policyForm.threshold) || 0
  );

  function handleFocusPolicyCreation() {
    if (policyStudioSectionRef.current) {
      policyStudioSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSuggestPolicy() {
    const suggestion = buildPolicySuggestion(aiPrompt, policyForm);
    setPolicyForm(suggestion);
    setAiSuggested(true);
  }

  function handlePolicyFieldChange(field, value) {
    setPolicyForm((current) => ({ ...current, [field]: value }));
  }

  function handleCreatePolicy(event) {
    event.preventDefault();

    const createdPolicy = {
      ...policyForm,
      threshold: Number(policyForm.threshold) || 0,
      payout: Number(policyForm.payout) || 0,
      duration: Number(policyForm.duration) || 7,
      status: "Active",
      createdAt: new Date().toISOString(),
      aiSuggested,
    };

    setCreatedPolicies((current) => [createdPolicy, ...current]);
    setPolicyForm(DEFAULT_POLICY_FORM);
    setAiPrompt("");
    setAiSuggested(false);
    setHighlightActivePolicy(true);
    window.setTimeout(() => {
      setHighlightActivePolicy(false);
    }, 1800);

    toast.success("Policy created successfully. Real-time monitoring is now active.");

    const riskToSimulate = getRiskByTrigger(createdPolicy.triggerType);
    actions.simulateRisk(riskToSimulate, { silent: true });

    if (!platformState.activePlanId && displayedPlans[0]?.sourceId) {
      actions.selectPlan(displayedPlans[0].sourceId);
    }
  }

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
          Create & Manage Insurance Policy
        </h2>
        <p className="text-sm leading-6 text-slate-600 md:text-base">
          Define trigger conditions, payout rules, and let the system automatically generate and process claims.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <motion.div
            animate={getMonitoringBadgeAnimation(liveBackendRefreshing || uiState.planUpdating)}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <StatusBadge status="active" label="Policy Active 🟢" />
          </motion.div>
          <motion.div
            animate={getMonitoringBadgeAnimation(liveBackendRefreshing || uiState.riskUpdating)}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <StatusBadge status="rejected" label="Monitoring Live 🔴" />
          </motion.div>
          <motion.div
            animate={getMonitoringBadgeAnimation(Boolean(uiState.claimTriggering))}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <StatusBadge status="approved" label="Claim Enabled ⚡" />
          </motion.div>
        </div>
      </motion.header>

      <AnimatePresence>
        {uiState.riskUpdating || uiState.planUpdating || (liveBackendLoading && !liveBackendData) ? (
          <SurfaceLoadingPanel
            title={
              liveBackendLoading && !liveBackendData
                ? "Loading live backend data"
                : uiState.planUpdating
                  ? "Activating insurance policy"
                  : "Updating live insurance premium"
            }
            description={
              liveBackendLoading && !liveBackendData
                ? "Fetching risk, policy premium, and claim status from the backend."
                : uiState.planUpdating
                ? "Applying your selected policy and refreshing live signals."
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

      <motion.section
        variants={itemVariants}
        ref={policyStudioSectionRef}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Bot size={16} />
              AI Policy Assistant
            </div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="ai-policy-input">
              Describe your risk scenario
            </label>
            <textarea
              id="ai-policy-input"
              rows={4}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Explain when work is disrupted and what claim support should trigger."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-700">Example scenarios</p>
              <p className="mt-2">- "Rain above 50mm stops delivery work"</p>
              <p>- "AQI above 150 affects outdoor jobs"</p>
            </div>

            <SurfaceButton onClick={handleSuggestPolicy} leftIcon={Sparkles} className="w-full sm:w-auto">
              Suggest Policy (AI)
            </SurfaceButton>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                Output Preview
              </p>
              <p className="mt-2">Trigger: {assistantTriggerPreview}</p>
              <p>Payout: {formatINR(Number(policyForm.payout) || 0)}</p>
              <p>Duration: {Number(policyForm.duration) || 7} days</p>
            </div>

            {aiSuggested ? (
              <p className="text-xs font-medium text-blue-700">Suggested based on your input</p>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={handleCreatePolicy}>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Policy Form</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Policy Name
                <input
                  type="text"
                  value={policyForm.policyName}
                  onChange={(event) => handlePolicyFieldChange("policyName", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Risk Trigger Type
                <select
                  value={policyForm.triggerType}
                  onChange={(event) => handlePolicyFieldChange("triggerType", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="Rain">Rain</option>
                  <option value="AQI">AQI</option>
                  <option value="Demand">Demand</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Trigger Threshold
                <input
                  type="number"
                  value={policyForm.threshold}
                  onChange={(event) => handlePolicyFieldChange("threshold", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Claim Payout Amount
                <input
                  type="number"
                  value={policyForm.payout}
                  onChange={(event) => handlePolicyFieldChange("payout", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Policy Duration (days)
                <input
                  type="number"
                  value={policyForm.duration}
                  onChange={(event) => handlePolicyFieldChange("duration", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  min={1}
                  required
                />
              </label>

              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Location
                <select
                  value={policyForm.location}
                  onChange={(event) => handlePolicyFieldChange("location", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="Urban">Urban</option>
                  <option value="Semi-Urban">Semi-Urban</option>
                  <option value="Rural">Rural</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Auto-claim will be triggered when conditions are met
            </div>

            <SurfaceButton type="submit" className="w-full sm:w-auto">
              Create Policy
            </SurfaceButton>
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Policy Flow</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Policy</span>
            <span className="text-slate-400">-&gt;</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Trigger</span>
            <span className="text-slate-400">-&gt;</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Claim</span>
            <span className="text-slate-400">-&gt;</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">AI Decision</span>
            <span className="text-slate-400">-&gt;</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Payout</span>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Policy Profiles</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Insurance policy profiles
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
              <p>Create your first policy to activate real-time monitoring</p>
              <SurfaceButton
                onClick={handleFocusPolicyCreation}
                className="mt-4 w-full sm:w-auto"
              >
                Create Policy
              </SurfaceButton>
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
                  <p className="text-sm font-medium text-slate-500">Risk Level to Premium</p>
                  <InfoTooltip
                    label="Live insurance premium information"
                    text="Premium adjusts automatically based on risk level."
                  />
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Live Insurance Premium
                </h3>
              </div>

              <StatusBadge status={`risk_${currentRisk.toLowerCase()}`} label={`${currentRisk} Risk`} />
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-500">Active policy premium</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                <CountUp
                  end={smartPremium}
                  duration={1.5}
                  formattingFn={(value) => `${formatINR(Math.round(value))}/week`}
                  preserveValue
                />
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Premium adjusts automatically based on risk level
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Risk Level: {currentRisk} -> Premium: {formatINR(smartPremium)}
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
                Update risk conditions
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
                    <div className="flex flex-col items-start gap-1 text-left">
                      <span>{option.label}</span>
                      <span className="text-xs font-medium text-slate-500">{option.note}</span>
                    </div>
                  </SurfaceButton>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.div variants={itemVariants}>
            <ActivePolicyCard
              planName={latestCreatedPolicy?.policyName || activePlan?.title || "Active Policy: Rain Protection Plan"}
              premiumAmount={activePlan?.premiumAmount ?? smartPremium}
              coverageSummary={
                latestCreatedPolicy
                  ? `${latestCreatedPolicy.triggerType} policy for ${latestCreatedPolicy.location} area with ${formatINR(latestCreatedPolicy.payout)} payout.`
                  : activePlan?.summary || "Active policy is monitoring live trigger conditions for automatic claim flow."
              }
              payoutAmount={latestCreatedPolicy?.payout ?? 500}
              riskLevel={currentRisk}
              createdAt={latestCreatedPolicy?.createdAt}
              triggerType={latestCreatedPolicy?.triggerType || "Rain"}
              threshold={latestCreatedPolicy?.threshold ?? 50}
              location={latestCreatedPolicy?.location || "Urban"}
              statusLabel={latestCreatedPolicy?.status || "Policy Active"}
              isHighlighted={highlightActivePolicy}
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
                  Live Insurance Snapshot
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
                <p className="text-sm font-medium text-slate-500">Live Insurance Premium</p>
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
              Automatic claim system
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Automatic Claim Activation
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              When risk conditions match, claims are generated and processed automatically.
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
