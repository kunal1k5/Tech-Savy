import React, {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { extractApiErrorMessage } from "../services/api";
import {
  buyPolicy,
  getClaims,
  getPolicyState,
  getPremium,
  triggerClaim,
} from "../services/workerFlow";
import { getToken, getUserFromToken } from "../utils/auth";
import { playUiAlert, playUiSuccess } from "../utils/soundFeedback";

const GigPredictAIDataContext = createContext(null);

const BACKEND_SCENARIO_PAYLOADS = {
  rainBurst: { rainfall: 72, aqi: 140, mode: "auto" },
  airQualitySpike: { rainfall: 0, aqi: 428, mode: "auto" },
  gpsSpoof: { rainfall: 0, aqi: 0, mode: "fraud_drill" },
};
const SCENARIO_TITLES = {
  rainBurst: "Heavy rain",
  airQualitySpike: "AQI spike",
  gpsSpoof: "Fraud drill",
};

function createEmptyEarningsTrend() {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      day: formatter.format(date),
      earnings: 0,
      payouts: 0,
      downtimeHours: 0,
      riskScore: 0,
    };
  });
}

function createInitialPlatformState(sessionUser = null) {
  return applySessionWorker(
    {
      worker: {
        name: "",
        city: "",
        area: "",
        platform: "",
        weeklyIncome: 0,
        activeHoursToday: 0,
      },
      plans: [],
      activePlanId: null,
      recommendedPlanId: null,
      riskFeed: [],
      earningsTrend: createEmptyEarningsTrend(),
      liveMonitor: {
        stage: "syncing",
        headline: "Loading live protection status",
        summary: "Fetching your policy, claim, and fraud data from the backend.",
        lastHeartbeatAt: new Date().toISOString(),
        activeScenarioId: null,
      },
      fraudWatch: {
        status: "verified",
        summary: "Live fraud signals will appear after the first sync.",
        activeFlags: [],
        lastCheckedAt: null,
        latestAudit: "Waiting for backend response.",
      },
      claims: [],
    },
    sessionUser
  );
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    paid: "Paid",
    manual_review: "Manual Review",
  };

  return labels[status] || status;
}

function getFraudStatusLabel(status) {
  const labels = {
    in_progress: "Fraud Check in Progress",
    verified: "Verified",
    flagged: "Flagged",
  };

  return labels[status] || status;
}

function applySessionWorker(baseState, sessionUser) {
  if (!sessionUser) {
    return baseState;
  }

  const hasSessionIdentity = Boolean(sessionUser.id || sessionUser.phone);

  return {
    ...baseState,
    worker: {
      ...baseState.worker,
      name: hasSessionIdentity
        ? sessionUser.full_name ?? sessionUser.fullName ?? ""
        : baseState.worker.name,
      city: hasSessionIdentity ? sessionUser.city ?? "" : baseState.worker.city,
      area: hasSessionIdentity
        ? sessionUser.zone ?? sessionUser.city ?? ""
        : baseState.worker.area,
      platform: hasSessionIdentity ? sessionUser.platform ?? "" : baseState.worker.platform,
      weeklyIncome: Number(
        sessionUser.weekly_income ?? sessionUser.weeklyIncome ?? baseState.worker.weeklyIncome
      ),
    },
  };
}

function mapRiskLevel(level) {
  if (!level) {
    return "Medium";
  }

  const normalized = String(level).toLowerCase();
  if (normalized === "low" || normalized === "safe") {
    return "Low";
  }
  if (normalized === "high") {
    return "High";
  }
  return "Medium";
}

function mapBackendPlans(plans = []) {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    premiumWeekly: plan.premium,
    payoutCap: Math.max(250, Math.round((plan.coverage || 3000) / 7)),
    description: plan.description,
    features: plan.features || [],
    note:
      plan.status === "active"
        ? "Policy is active and ready for claim processing."
        : "Select this plan to activate protection.",
    status: plan.status,
    coverageAmount: plan.coverage,
  }));
}

function mapBackendClaims(claims = []) {
  return claims.map((claim) => ({
    ...claim,
    status:
      claim.fraudStatus === "flagged" && claim.status === "pending"
        ? "manual_review"
        : claim.status,
  }));
}

function buildRiskFeed(currentFeed, premiumData, workerArea) {
  if (!premiumData) {
    return currentFeed;
  }

  const level = mapRiskLevel(premiumData.riskLevel);
  const score = premiumData.riskScore || 56;
  const baseZone = workerArea || currentFeed[0]?.zone || "";

  if (!baseZone) {
    return [];
  }

  return [
    {
      zone: baseZone,
      level,
      score,
      change: level === "High" ? "+12" : level === "Medium" ? "+6" : "-4",
    },
  ];
}

function buildLiveMonitor(currentMonitor, premiumData, claimsData, workerArea) {
  const latestClaim = claimsData?.claims?.[0];

  if (latestClaim) {
    return {
      stage: latestClaim.status,
      headline: latestClaim.headline,
      summary:
        latestClaim.status === "paid"
          ? "Claim paid successfully and protection story is complete."
          : latestClaim.status === "approved"
            ? "Claim approved. Money is being released."
            : latestClaim.status === "manual_review"
              ? "Claim moved to manual review after suspicious checks."
              : "Claim created automatically and payout checks started.",
      lastHeartbeatAt: new Date().toISOString(),
      activeScenarioId:
        latestClaim.eventType === "Rainfall"
          ? "rainBurst"
          : latestClaim.eventType === "AQI"
            ? "airQualitySpike"
            : "gpsSpoof",
    };
  }

  if (premiumData) {
    return {
      ...currentMonitor,
      stage: "risk_updated",
      headline: `${premiumData.riskLevel} risk in ${workerArea || "your area"}`,
      summary: premiumData.summary || "Premium updated from the latest risk signal.",
      lastHeartbeatAt: new Date().toISOString(),
    };
  }

  return currentMonitor;
}

function mergeBackendState(current, { policyData, premiumData, claimsData } = {}, sessionUser) {
  const nextState = applySessionWorker(current, sessionUser);
  const plansSource = policyData?.plans || premiumData?.plans;
  const activePolicy = policyData?.activePolicy || premiumData?.activePolicy;

  if (plansSource) {
    nextState.plans = mapBackendPlans(plansSource);
  }

  if (activePolicy?.planId) {
    nextState.activePlanId = activePolicy.planId;
  } else if (policyData) {
    nextState.activePlanId = null;
  }

  if (premiumData) {
    nextState.recommendedPlanId = premiumData.riskKey === "high" ? "premium" : "basic";
    nextState.riskFeed = buildRiskFeed(current.riskFeed, premiumData, nextState.worker.area);
  }

  if (claimsData?.claims) {
    nextState.claims = mapBackendClaims(claimsData.claims);
    nextState.fraudWatch = claimsData.fraudWatch || nextState.fraudWatch;
  }

  nextState.liveMonitor = buildLiveMonitor(
    nextState.liveMonitor,
    premiumData,
    claimsData,
    nextState.worker.area
  );

  return nextState;
}

export function GigPredictAIDataProvider({ children }) {
  const [platformState, setPlatformState] = useState(() => {
    return createInitialPlatformState(getUserFromToken());
  });
  const [uiState, setUiState] = useState({
    syncing: Boolean(getToken()),
    riskUpdating: false,
    riskTarget: "",
    planUpdating: false,
    planTarget: "",
    claimTriggering: false,
    claimScenarioId: "",
  });
  const timeoutIdsRef = useRef([]);
  const intervalIdsRef = useRef([]);
  const hasBootstrappedRef = useRef(false);
  const lastFraudStatusRef = useRef("unknown");

  function schedule(callback, delay) {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }

  async function syncBackendState({ requestedRisk } = {}) {
    if (!getToken()) {
      return;
    }

    setUiState((current) => ({ ...current, syncing: true }));

    try {
      const [policyData, premiumData, claimsData] = await Promise.all([
        getPolicyState(),
        getPremium(requestedRisk),
        getClaims(),
      ]);

      startTransition(() => {
        setPlatformState((current) =>
          mergeBackendState(current, { policyData, premiumData, claimsData }, getUserFromToken())
        );
      });
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Service unavailable."));
    } finally {
      setUiState((current) => ({ ...current, syncing: false }));
    }
  }

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
      intervalIdsRef.current.forEach((id) => window.clearInterval(id));
    };
  }, []);

  useEffect(() => {
    function handleAuthChange() {
      const nextSessionUser = getUserFromToken();

      startTransition(() => {
        setPlatformState(createInitialPlatformState(nextSessionUser));
      });

      if (getToken()) {
        syncBackendState();
      }
    }

    window.addEventListener("gigpredict-ai-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("gigpredict-ai-auth-changed", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return undefined;
    }

    hasBootstrappedRef.current = true;

    const heartbeatId = window.setInterval(() => {
      setPlatformState((current) => ({
        ...current,
        liveMonitor: {
          ...current.liveMonitor,
          lastHeartbeatAt: new Date().toISOString(),
        },
      }));
    }, 45000);
    intervalIdsRef.current.push(heartbeatId);

    if (getToken()) {
      syncBackendState();
    }

    return undefined;
  }, []);

  useEffect(() => {
    const fraudStatus = platformState.fraudWatch?.status;

    if (!fraudStatus) {
      return;
    }

    if (fraudStatus === lastFraudStatusRef.current) {
      return;
    }

    if (fraudStatus === "flagged") {
      toast.error("High risk detected - review required.");
      playUiAlert();
    } else if (
      fraudStatus === "verified" &&
      lastFraudStatusRef.current === "flagged"
    ) {
      toast.success("Fraud risk normalized. Monitoring remains active.");
      playUiSuccess();
    }

    lastFraudStatusRef.current = fraudStatus;
  }, [platformState.fraudWatch?.status]);

  async function simulateRisk(riskKey, { silent = false } = {}) {
    setUiState((current) => ({ ...current, riskUpdating: true, riskTarget: riskKey }));

    if (!getToken()) {
      toast.error("Service unavailable.");
      setUiState((current) => ({ ...current, riskUpdating: false, riskTarget: "" }));
      return;
    }

    try {
      const premiumData = await getPremium(riskKey);

      startTransition(() => {
        setPlatformState((current) =>
          mergeBackendState(current, { premiumData }, getUserFromToken())
        );
      });

      if (!silent) {
        toast.success(`Premium updated to ${premiumData.premium} INR.`);
        playUiSuccess();
      }
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Service unavailable."));
      playUiAlert();
    } finally {
      setUiState((current) => ({ ...current, riskUpdating: false, riskTarget: "" }));
    }
  }

  async function selectPlan(planId) {
    setUiState((current) => ({ ...current, planUpdating: true, planTarget: planId }));

    if (!getToken()) {
      toast.error("Service unavailable.");
      setUiState((current) => ({ ...current, planUpdating: false, planTarget: "" }));
      return;
    }

    try {
      const policyData = await buyPolicy(planId);

      startTransition(() => {
        setPlatformState((current) =>
          mergeBackendState(current, { policyData }, getUserFromToken())
        );
      });

      toast.success("Policy activated");
      playUiSuccess();
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Service unavailable."));
      playUiAlert();
    } finally {
      setUiState((current) => ({ ...current, planUpdating: false, planTarget: "" }));
    }
  }

  function refreshSignals() {
    const riskSequence = ["low", "medium", "high"];
    const currentLevel = String(platformState.riskFeed[0]?.level || "Medium").toLowerCase();
    const currentIndex = riskSequence.indexOf(currentLevel === "safe" ? "low" : currentLevel);
    const nextRisk = riskSequence[(currentIndex + 1 + riskSequence.length) % riskSequence.length];
    simulateRisk(nextRisk);
  }

  async function triggerScenario(scenarioId, { origin = "manual" } = {}) {
    if (!BACKEND_SCENARIO_PAYLOADS[scenarioId]) {
      return;
    }

    setUiState((current) => ({
      ...current,
      claimTriggering: true,
      claimScenarioId: scenarioId,
    }));

    if (!getToken()) {
      toast.error("Service unavailable.");
      setUiState((current) => ({
        ...current,
        claimTriggering: false,
        claimScenarioId: "",
      }));
      return;
    }

    const scenarioTitle = SCENARIO_TITLES[scenarioId] || "Risk event";
    const loadingToastId = toast.loading(`${scenarioTitle} detected. Checking for auto-claim.`);

    try {
      const response = await triggerClaim(BACKEND_SCENARIO_PAYLOADS[scenarioId]);

      startTransition(() => {
        setPlatformState((current) =>
          mergeBackendState(current, { claimsData: response }, getUserFromToken())
        );
      });

      if (!response.triggered) {
        toast.error(response.message || "No claim was triggered.", { id: loadingToastId });
        playUiAlert();
        return;
      }

      toast.success("Claim auto-generated successfully.", { id: loadingToastId });
      playUiSuccess();

      const hasFraudAlert = (response.claims || []).some(
        (claim) => claim.fraudStatus === "flagged" || claim.status === "manual_review"
      );

      if (hasFraudAlert) {
        toast.error("High risk detected - review required.");
        playUiAlert();
      }

      schedule(() => syncBackendState(), 2100);
      schedule(() => syncBackendState(), 4100);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Service unavailable."), {
        id: loadingToastId,
      });
      playUiAlert();
    } finally {
      setUiState((current) => ({
        ...current,
        claimTriggering: false,
        claimScenarioId: "",
      }));
    }
  }

  function runFraudDrill() {
    triggerScenario("gpsSpoof", { origin: "manual" });
  }

  const derivedData = useMemo(() => {
    const activePlan =
      platformState.plans.find((plan) => plan.id === platformState.activePlanId) || null;
    const recommendedPlan =
      platformState.plans.find((plan) => plan.id === platformState.recommendedPlanId) ||
      activePlan ||
      platformState.plans[0];
    const displayPlan = activePlan || recommendedPlan || platformState.plans[0];
    const currentRisk = platformState.riskFeed[0];
    const latestClaim = platformState.claims[0] || null;
    const pendingClaims = platformState.claims.filter((claim) =>
      ["pending", "approved", "manual_review"].includes(claim.status)
    );
    const paidClaims = platformState.claims.filter((claim) => claim.status === "paid");
    const weeklyPayouts = paidClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const fraudFlags = platformState.claims.reduce(
      (sum, claim) => sum + (claim.flags?.length || 0),
      0
    );
    const downtimeThisWeek = platformState.earningsTrend.reduce(
      (sum, entry) => sum + entry.downtimeHours,
      0
    );
    const todayTrend = platformState.earningsTrend[platformState.earningsTrend.length - 1];
    const estimatedHourlyIncome = platformState.worker.weeklyIncome / 42;
    const latestLossAmount =
      latestClaim?.amount || Math.round(estimatedHourlyIncome * (todayTrend?.downtimeHours || 0));
    const riskTone =
      currentRisk?.level === "High" ? "danger" : currentRisk?.level === "Medium" ? "warning" : "success";
    const claimTone =
      latestClaim?.status === "paid"
        ? "success"
        : latestClaim?.status === "manual_review"
          ? "danger"
          : "warning";
    const fraudTone =
      platformState.fraudWatch.status === "flagged"
        ? "danger"
        : platformState.fraudWatch.status === "in_progress"
          ? "warning"
          : "success";

    return {
      activePlan,
      displayPlan,
      hasActivePolicy: Boolean(activePlan),
      recommendedPlan,
      currentRisk,
      latestClaim,
      pendingClaims,
      weeklyPayouts,
      fraudFlags,
      downtimeThisWeek: Number(downtimeThisWeek.toFixed(1)),
      hoursLostToday: Number((todayTrend?.downtimeHours || 0).toFixed(1)),
      latestLossAmount,
      riskTone,
      claimTone,
      fraudTone,
      dynamicPremium: displayPlan?.premiumWeekly || 0,
      totalProtectedAmount: (displayPlan?.payoutCap || 0) * 7,
      statusLabels: {
        claim: latestClaim ? getStatusLabel(latestClaim.status) : "No claim",
        fraud: getFraudStatusLabel(platformState.fraudWatch.status),
      },
    };
  }, [platformState]);

  const value = useMemo(
    () => ({
      platformState,
      uiState,
      derivedData,
      actions: {
        refreshSignals,
        runFraudDrill,
        selectPlan,
        simulateRisk,
        triggerScenario,
      },
    }),
    [derivedData, platformState, uiState]
  );

  return (
    <GigPredictAIDataContext.Provider value={value}>
      {children}
    </GigPredictAIDataContext.Provider>
  );
}

export function useGigPredictAIData() {
  const context = useContext(GigPredictAIDataContext);
  if (!context) {
    throw new Error("useGigPredictAIData must be used within GigPredictAIDataProvider.");
  }
  return context;
}
