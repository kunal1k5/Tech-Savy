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

const GigShieldDataContext = createContext(null);

function updateClaim(claims, claimId, updater) {
  return claims.map((claim) => {
    if (claim.id !== claimId) {
      return claim;
    }
    return updater(claim);
  });
}

export function GigShieldDataProvider({ children }) {
  const [platformState, setPlatformState] = useState(() => createInitialPlatformState());
  const timeoutIdsRef = useRef([]);
  const intervalIdsRef = useRef([]);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
      intervalIdsRef.current.forEach((id) => window.clearInterval(id));
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

    const initialEventId = window.setTimeout(() => {
      triggerScenario("rainBurst", { origin: "auto" });
    }, 1400);
    timeoutIdsRef.current.push(initialEventId);

    return undefined;
  }, []);

  function schedule(callback, delay) {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }

  function selectPlan(planId) {
    startTransition(() => {
      setPlatformState((current) => ({
        ...current,
        activePlanId: planId,
      }));
    });

    const chosenPlan = platformState.plans.find((plan) => plan.id === planId);
    if (chosenPlan) {
      toast.success(`${chosenPlan.name} is now active for your route.`);
    }
  }

  function refreshSignals() {
    const scenario =
      platformState.liveMonitor.activeScenarioId === "airQualitySpike"
        ? disruptionScenarios.rainBurst
        : disruptionScenarios.airQualitySpike;

    startTransition(() => {
      setPlatformState((current) => ({
        ...current,
        riskFeed: scenario.zoneUpdates,
        liveMonitor: {
          ...current.liveMonitor,
          headline: "Signal refresh complete",
          summary: `${scenario.summary} Coverage thresholds were recalculated for nearby zones.`,
          lastHeartbeatAt: new Date().toISOString(),
        },
      }));
    });

    toast.success("Zone signals refreshed from the mock monitoring feed.");
  }

  function triggerScenario(scenarioId, { origin = "manual" } = {}) {
    const scenario = disruptionScenarios[scenarioId];
    if (!scenario) {
      return;
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
      let fraudResult;

      setPlatformState((current) => {
        fraudResult = evaluateFraudSignals(scenario, current.claims);

        return {
          ...current,
          claims: updateClaim(current.claims, liveClaim.id, (claim) => ({
            ...claim,
            fraudStatus: fraudResult.status,
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
      platformState.plans.find((plan) => plan.id === platformState.activePlanId) ||
      platformState.plans[0];
    const recommendedPlan =
      platformState.plans.find((plan) => plan.id === platformState.recommendedPlanId) ||
      activePlan;
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

    return {
      activePlan,
      recommendedPlan,
      currentRisk,
      latestClaim,
      pendingClaims,
      weeklyPayouts,
      fraudFlags,
      downtimeThisWeek: Number(downtimeThisWeek.toFixed(1)),
      totalProtectedAmount: activePlan.payoutCap * 7,
      statusLabels: {
        claim: latestClaim ? getStatusLabel(latestClaim.status) : "No claim",
        fraud: getFraudStatusLabel(platformState.fraudWatch.status),
      },
    };
  }, [platformState]);

  const value = useMemo(
    () => ({
      platformState,
      derivedData,
      actions: {
        refreshSignals,
        runFraudDrill,
        selectPlan,
        triggerScenario,
      },
    }),
    [derivedData, platformState]
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
