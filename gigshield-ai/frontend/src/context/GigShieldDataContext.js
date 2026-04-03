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
import {
  createHistoryNote,
  createInitialPlatformState,
  createLiveClaimFromScenario,
  disruptionScenarios,
  evaluateFraudSignals,
  getFraudStatusLabel,
  getStatusLabel,
  updateTrendWithPayout,
} from "../data/mockPlatform";
import {
  buyPolicy,
  getClaims,
  getPolicyState,
  getPremium,
  triggerClaim,
} from "../services/demoFlow";
import { getDemoSession, getToken, getUserFromToken } from "../utils/auth";

const GigShieldDataContext = createContext(null);

const BACKEND_SCENARIO_PAYLOADS = {
  rainBurst: { rainfall: 72, aqi: 140, mode: "auto" },
  airQualitySpike: { rainfall: 0, aqi: 428, mode: "auto" },
  gpsSpoof: { rainfall: 0, aqi: 0, mode: "fraud_drill" },
};

function updateClaim(claims, claimId, updater) {
  return claims.map((claim) => {
    if (claim.id !== claimId) {
      return claim;
    }
    return updater(claim);
  });
}

function applySessionWorker(baseState, sessionUser) {
  if (!sessionUser) {
    return baseState;
  }

  return {
    ...baseState,
    worker: {
      ...baseState.worker,
      name: sessionUser.full_name || sessionUser.fullName || baseState.worker.name,
      city: sessionUser.city || baseState.worker.city,
      area: sessionUser.zone || baseState.worker.area,
      platform: sessionUser.platform || baseState.worker.platform,
      weeklyIncome:
        Number(sessionUser.weekly_income ?? sessionUser.weeklyIncome) || baseState.worker.weeklyIncome,
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
  const baseZone = workerArea || currentFeed[0]?.zone || "Koramangala";
  const otherZones = ["Indiranagar", "HSR Layout", "Whitefield"];

  return [
    { zone: baseZone, level, score, change: level === "High" ? "+12" : level === "Medium" ? "+6" : "-4" },
    ...otherZones.map((zone, index) => ({
      zone,
      level: index === 0 && level === "High" ? "Medium" : index === 2 ? "Low" : level,
      score: Math.max(22, score - (index + 1) * 9),
      change: index === 2 ? "-2" : `+${Math.max(1, 6 - index * 2)}`,
    })),
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

  if (plansSource?.length) {
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

export function GigShieldDataProvider({ children }) {
  const [platformState, setPlatformState] = useState(() => {
    const baseState = createInitialPlatformState();
    return applySessionWorker(baseState, getUserFromToken() || getDemoSession());
  });
  const [uiState, setUiState] = useState({
    syncing: false,
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
      toast.error(error.response?.data?.error || "Something went wrong.");
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
      const nextSessionUser = getUserFromToken() || getDemoSession();

      startTransition(() => {
        setPlatformState(applySessionWorker(createInitialPlatformState(), nextSessionUser));
      });

      if (getToken()) {
        syncBackendState();
      }
    }

    window.addEventListener("gigshield-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("gigshield-auth-changed", handleAuthChange);
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

  async function simulateRisk(riskKey, { silent = false } = {}) {
    setUiState((current) => ({ ...current, riskUpdating: true, riskTarget: riskKey }));

    if (getToken()) {
      try {
        const premiumData = await getPremium(riskKey);

        startTransition(() => {
          setPlatformState((current) =>
            mergeBackendState(current, { premiumData }, getUserFromToken())
          );
        });

        if (!silent) {
          toast.success(`Premium updated to ${premiumData.premium} INR.`);
        }
      } catch (error) {
        toast.error(error.response?.data?.error || "Something went wrong.");
      } finally {
        setUiState((current) => ({ ...current, riskUpdating: false, riskTarget: "" }));
      }
      return;
    }

    const scenario =
      riskKey === "high"
        ? disruptionScenarios.rainBurst
        : riskKey === "low"
          ? {
              ...disruptionScenarios.airQualitySpike,
              zoneUpdates: disruptionScenarios.airQualitySpike.zoneUpdates.map((zone, index) => ({
                ...zone,
                level: index === 0 ? "Low" : "Medium",
                score: Math.max(28, zone.score - 22),
              })),
            }
          : disruptionScenarios.airQualitySpike;

    startTransition(() => {
      setPlatformState((current) => ({
        ...current,
        riskFeed: scenario.zoneUpdates,
        liveMonitor: {
          ...current.liveMonitor,
          headline: `${mapRiskLevel(riskKey)} risk simulated`,
          summary: `${scenario.summary} Premium cards are ready to update.`,
          lastHeartbeatAt: new Date().toISOString(),
        },
      }));
    });

    if (!silent) {
      toast.success(`${mapRiskLevel(riskKey)} risk simulated.`);
    }

    setUiState((current) => ({ ...current, riskUpdating: false, riskTarget: "" }));
  }

  async function selectPlan(planId) {
    setUiState((current) => ({ ...current, planUpdating: true, planTarget: planId }));

    if (getToken()) {
      try {
        const policyData = await buyPolicy(planId);

        startTransition(() => {
          setPlatformState((current) =>
            mergeBackendState(current, { policyData }, getUserFromToken())
          );
        });

        toast.success("Policy activated");
      } catch (error) {
        toast.error(error.response?.data?.error || "Something went wrong.");
      } finally {
        setUiState((current) => ({ ...current, planUpdating: false, planTarget: "" }));
      }
      return;
    }

    startTransition(() => {
      setPlatformState((current) => ({
        ...current,
        activePlanId: planId,
      }));
    });

    const chosenPlan = platformState.plans.find((plan) => plan.id === planId);
    if (chosenPlan) {
      toast.success("Policy activated");
    }

    setUiState((current) => ({ ...current, planUpdating: false, planTarget: "" }));
  }

  function refreshSignals() {
    const riskSequence = ["low", "medium", "high"];
    const currentLevel = String(platformState.riskFeed[0]?.level || "Medium").toLowerCase();
    const currentIndex = riskSequence.indexOf(currentLevel === "safe" ? "low" : currentLevel);
    const nextRisk = riskSequence[(currentIndex + 1 + riskSequence.length) % riskSequence.length];
    simulateRisk(nextRisk);
  }

  async function triggerScenario(scenarioId, { origin = "manual" } = {}) {
    const scenario = disruptionScenarios[scenarioId];
    if (!scenario) {
      return;
    }

    setUiState((current) => ({
      ...current,
      claimTriggering: true,
      claimScenarioId: scenarioId,
    }));

    if (getToken()) {
      const loadingToastId = toast.loading(`${scenario.title} detected. Checking for auto-claim.`);

      try {
        const response = await triggerClaim(BACKEND_SCENARIO_PAYLOADS[scenarioId] || {});

        startTransition(() => {
          setPlatformState((current) =>
            mergeBackendState(current, { claimsData: response }, getUserFromToken())
          );
        });

        if (!response.triggered) {
          toast.error(response.message || "No claim was triggered.", { id: loadingToastId });
          setUiState((current) => ({
            ...current,
            claimTriggering: false,
            claimScenarioId: "",
          }));
          return;
        }

        toast.success(response.message, { id: loadingToastId });
        schedule(() => syncBackendState(), 2100);
        schedule(() => syncBackendState(), 4100);
        setUiState((current) => ({
          ...current,
          claimTriggering: false,
          claimScenarioId: "",
        }));
        return;
      } catch (error) {
        toast.error(error.response?.data?.error || "Something went wrong.", {
          id: loadingToastId,
        });
        setUiState((current) => ({
          ...current,
          claimTriggering: false,
          claimScenarioId: "",
        }));
        return;
      }
    }

    const liveClaim = createLiveClaimFromScenario(scenario, platformState.claims.length);
    const loadingToastId = toast.loading(
      `${scenario.title} in ${scenario.area}. Automated logic started a claim.`
    );

    startTransition(() => {
      setPlatformState((current) => ({
        ...current,
        claims: [liveClaim, ...current.claims].slice(0, 8),
        riskFeed: scenario.zoneUpdates,
        liveMonitor: {
          stage: "event_detected",
          headline: scenario.title,
          summary:
            origin === "auto"
              ? scenario.summary
              : `${scenario.summary} Demo controls triggered this run for judges.`,
          lastHeartbeatAt: new Date().toISOString(),
          activeScenarioId: scenario.id,
        },
        fraudWatch: {
          status: "in_progress",
          summary: "Fraud check in progress. Verifying route continuity and recent claim frequency.",
          activeFlags: [],
          lastCheckedAt: new Date().toISOString(),
          latestAudit: "Reading device continuity, duplicate claims, and route stability.",
        },
      }));
    });

    schedule(() => {
      setUiState((current) => ({
        ...current,
        claimTriggering: false,
        claimScenarioId: "",
      }));
    }, 700);

    schedule(() => {
      let fraudResult;

      setPlatformState((current) => {
        fraudResult = evaluateFraudSignals(scenario, current.claims);

        return {
          ...current,
          claims: updateClaim(current.claims, liveClaim.id, (claim) => ({
            ...claim,
            fraudStatus: fraudResult.status,
            status: fraudResult.suspicious ? "manual_review" : claim.status,
            flags: fraudResult.flags,
            updatedAt: new Date().toISOString(),
            payoutWindow: fraudResult.suspicious
              ? "Held for analyst review"
              : "Verification complete",
            history: [
              createHistoryNote(
                fraudResult.suspicious ? "fraud_flagged" : "fraud_verified",
                fraudResult.suspicious
                  ? fraudResult.flags[0]
                  : "Fraud check passed. Location continuity and claim timing were verified.",
                fraudResult.suspicious ? "danger" : "info"
              ),
              ...claim.history,
            ],
          })),
          fraudWatch: {
            status: fraudResult.status,
            summary: fraudResult.summary,
            activeFlags: fraudResult.flags,
            lastCheckedAt: new Date().toISOString(),
            latestAudit: fraudResult.latestAudit,
          },
          liveMonitor: {
            ...current.liveMonitor,
            stage: fraudResult.suspicious ? "manual_review" : "claim_verified",
          },
        };
      });

      if (fraudResult.suspicious) {
        toast.error("Claim flagged for manual review due to suspicious movement.", {
          id: loadingToastId,
        });
        return;
      }

      toast.success("Claim verified automatically. Approval is in progress.", {
        id: loadingToastId,
      });

      schedule(() => {
        setPlatformState((current) => ({
          ...current,
          claims: updateClaim(current.claims, liveClaim.id, (claim) => ({
            ...claim,
            status: "approved",
            updatedAt: new Date().toISOString(),
            payoutWindow: "Funds queued for release",
            history: [
              createHistoryNote(
                "approved",
                "Coverage rules passed. Claim approved by automated payout logic.",
                "success"
              ),
              ...claim.history,
            ],
          })),
          liveMonitor: {
            ...current.liveMonitor,
            stage: "claim_approved",
            summary: "Coverage conditions matched the policy terms. Funds are being prepared.",
          },
        }));
      }, 1700);

      schedule(() => {
        setPlatformState((current) => ({
          ...current,
          earningsTrend: updateTrendWithPayout(current.earningsTrend, scenario.amount),
          claims: updateClaim(current.claims, liveClaim.id, (claim) => ({
            ...claim,
            status: "paid",
            updatedAt: new Date().toISOString(),
            payoutWindow: "Released in 4 minutes",
            history: [
              createHistoryNote(
                "paid",
                "Payout released to your linked account. Settlement confirmation sent.",
                "success"
              ),
              ...claim.history,
            ],
          })),
          liveMonitor: {
            ...current.liveMonitor,
            stage: "paid",
            summary: "Latest disruption was settled successfully and logged in the claim history.",
          },
        }));

      toast.success("Payout released. Claim history has been updated.");
      }, 3600);
    }, 1400);
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
    const fraudFlags = platformState.claims.reduce((sum, claim) => sum + claim.flags.length, 0);
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
    const fraudTone = platformState.fraudWatch.status === "flagged" ? "danger" : "success";

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
    <GigShieldDataContext.Provider value={value}>
      {children}
    </GigShieldDataContext.Provider>
  );
}

export function useGigShieldData() {
  const context = useContext(GigShieldDataContext);
  if (!context) {
    throw new Error("useGigShieldData must be used within GigShieldDataProvider.");
  }
  return context;
}
