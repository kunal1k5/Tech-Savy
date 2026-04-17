import React, { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CloudRain, FileText, Package2, ShieldCheck, Smartphone, Wind } from "lucide-react";
import ClaimCard from "../components/claims/ClaimCard";
import AnimatedPipeline from "../components/ui/AnimatedPipeline";
import InfoTooltip from "../components/ui/InfoTooltip";
import StatusBadge from "../components/ui/StatusBadge";
import SurfaceButton from "../components/ui/SurfaceButton";
import SurfaceLoadingPanel from "../components/ui/SurfaceLoadingPanel";
import { useGigPredictAIData } from "../context/GigPredictAIDataContext";
import useLiveBackendData from "../hooks/useLiveBackendData";
import { extractApiErrorMessage, uploadClaimProof } from "../services/api";
import { getClaims as fetchClaimsFeed } from "../services/workerFlow";
import { getUserFromToken } from "../utils/auth";
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

const SMART_PREMIUM_BY_RISK = {
  Low: 10,
  Medium: 20,
  High: 30,
};

const CLAIM_PIPELINE_STEPS = [
  "Trigger",
  "Claim Created",
  "AI Review",
  "Approved",
  "Paid",
];

const TRIGGER_REFERENCE = {
  rainThreshold: 50,
  aqiThreshold: 150,
  fallbackRain: 120,
  fallbackAqi: 180,
};

const CITY_COORDINATES = {
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  delhi: { latitude: 28.6139, longitude: 77.209 },
  mumbai: { latitude: 19.076, longitude: 72.8777 },
};

function getClaimReason(claim) {
  if (!claim) {
    return "risk";
  }

  if (claim.eventType === "Rainfall") {
    return "heavy rain";
  }

  if (claim.eventType === "AQI") {
    return "AQI";
  }

  return "traffic";
}

function CurrencyCount({ value, suffix = "" }) {
  return (
    <CountUp
      end={value}
      duration={1.5}
      formattingFn={(currentValue) => `${formatINR(Math.round(currentValue))}${suffix}`}
      preserveValue
    />
  );
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

function normalizeFraudScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric > 1 ? numeric / 100 : numeric;
}

function getFraudRiskLevel(score) {
  if (score === null) {
    return "Low";
  }

  if (score <= 0.2) {
    return "Low";
  }

  if (score <= 0.5) {
    return "Medium";
  }

  return "High";
}

function getDecisionConfidence(score) {
  if (score === null) {
    return "High";
  }

  if (score <= 0.2) {
    return "High";
  }

  if (score <= 0.5) {
    return "Medium";
  }

  return "Low";
}

function mapClaimStatusLabel(status) {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (normalized === "paid") {
    return "Payout Completed";
  }
  if (normalized === "approved") {
    return "Approved by AI";
  }
  return "Under AI Review";
}

function getStatusBadgeLabel(status) {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (normalized === "paid") {
    return "Paid 💰";
  }
  if (normalized === "approved") {
    return "Approved 🟢";
  }
  return "Under Review 🟡";
}

function getPipelineStageIndex(status) {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (normalized === "paid") {
    return 4;
  }
  if (normalized === "approved") {
    return 3;
  }
  if (normalized === "pending" || normalized === "manual_review") {
    return 2;
  }
  if (normalized === "created") {
    return 1;
  }
  return 0;
}

function buildAiDecisionExplanation(claim, triggerSignals) {
  const triggerType = String(claim?.triggerType || "Rain").toLowerCase();
  const riskLevel = String(claim?.riskLevel || "low").toLowerCase();
  const status = String(claim?.status || "pending").toLowerCase();

  let triggerLine = "Policy threshold was exceeded, triggering the claim.";
  if (triggerType.includes("rain")) {
    triggerLine = `Rain exceeded threshold (${Math.round(triggerSignals.rainValue)} > ${triggerSignals.rainThreshold}), triggering the policy.`;
  } else if (triggerType.includes("aqi")) {
    triggerLine = `AQI exceeded threshold (${Math.round(triggerSignals.aqiValue)} > ${triggerSignals.aqiThreshold}), triggering the policy.`;
  }

  if (status === "paid") {
    return `${triggerLine} Low fraud risk detected, claim approved and payout completed.`;
  }

  if (status === "approved") {
    return `${triggerLine} Low fraud risk detected, claim approved.`;
  }

  if (riskLevel === "high") {
    return `${triggerLine} Elevated fraud risk detected, claim is under AI review.`;
  }

  return `${triggerLine} Fraud checks are running and the claim is under AI review.`;
}

export default function Claims() {
  const { platformState, derivedData, actions, uiState } = useGigPredictAIData();
  const parcelInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const workInputRef = useRef(null);
  const [proofUploadError, setProofUploadError] = useState("");
  const [proofUploadResult, setProofUploadResult] = useState(null);
  const [uploadingProofType, setUploadingProofType] = useState("");
  const [claimFeed, setClaimFeed] = useState([]);
  const [claimFeedLoading, setClaimFeedLoading] = useState(true);
  const [claimFeedError, setClaimFeedError] = useState("");
  const [newClaimIds, setNewClaimIds] = useState([]);
  const seenClaimIdsRef = useRef(new Set());
  const {
    data: liveBackendData,
    error: liveBackendError,
    isLoading: liveBackendLoading,
    isRefreshing: liveBackendRefreshing,
  } = useLiveBackendData();
  const sessionUser = getUserFromToken();
  const latestClaim = platformState.claims[0] || null;
  const currentRisk = normalizeRiskLabel(liveBackendData?.risk || derivedData.currentRisk?.level || "Low");
  const smartPremium = Number(liveBackendData?.premium ?? SMART_PREMIUM_BY_RISK[currentRisk] ?? 20);
  const liveFraudStatus = String(liveBackendData?.status || "SAFE").toLowerCase();
  const isLoading =
    uiState.claimTriggering ||
    uiState.riskUpdating ||
    uiState.syncing ||
    (liveBackendLoading && !liveBackendData);
  const activeClaimId = latestClaim?.id || liveBackendData?.claim_id || "";
  const activeClaimTime = latestClaim?.detectedAt || new Date().toISOString();
  const liveRainValue = Number(
    liveBackendData?.rain ?? liveBackendData?.signals?.rain ?? liveBackendData?.weather?.rain ?? TRIGGER_REFERENCE.fallbackRain
  );
  const liveAqiValue = Number(
    liveBackendData?.aqi ?? liveBackendData?.signals?.aqi ?? liveBackendData?.weather?.aqi ?? TRIGGER_REFERENCE.fallbackAqi
  );
  const rainValue = TRIGGER_REFERENCE.fallbackRain;
  const aqiValue = TRIGGER_REFERENCE.fallbackAqi;
  const triggerActivated =
    rainValue > TRIGGER_REFERENCE.rainThreshold || aqiValue > TRIGGER_REFERENCE.aqiThreshold;
  const riskSummaryLabel = `Risk Level: ${currentRisk.toUpperCase()} (${triggerActivated ? "Claim Eligible" : "Monitoring"})`;
  const liveFraudScore = normalizeFraudScore(liveBackendData?.fraud_score);
  const fraudScoreLabel = liveFraudScore !== null ? liveFraudScore.toFixed(2) : "0.12";
  const fraudRiskLevel = getFraudRiskLevel(liveFraudScore);
  const decisionConfidence = getDecisionConfidence(liveFraudScore);
  const latestStatusKey = latestClaim?.status || claimFeed[0]?.status || (triggerActivated ? "pending" : "created");
  const currentPipelineStage = getPipelineStageIndex(latestStatusKey);
  const claimPipelineFlowSteps = CLAIM_PIPELINE_STEPS.map((step, index) => ({
    key: step.toLowerCase().replace(/\s+/g, "-"),
    label: step,
    active: index <= currentPipelineStage,
  }));

  function normalizeClaimRecord(claim) {
    const autoClaimMeta = claim?.fraud_flags?.auto_claim || {};
    const aiDecisionMeta = claim?.fraud_flags?.ai_decision || {};
    const dynamicMeta = autoClaimMeta.dynamic || {};
    const rawStatus = String(claim.status || "PENDING").toUpperCase();
    const fraudScore = Number(
      claim.fraudScore ?? claim.fraud_score ?? aiDecisionMeta.fraudScore ?? aiDecisionMeta.fraud_score ?? 0
    );
    const riskLevel = String(
      claim.riskLevel ?? claim.risk_level ?? aiDecisionMeta.riskLevel ?? aiDecisionMeta.risk_level ?? "medium"
    ).toLowerCase();
    const decisionReason =
      claim.decisionReason ??
      claim.decision_reason ??
      aiDecisionMeta.decisionReason ??
      aiDecisionMeta.decision_reason ??
      "Normal behavior pattern";
    const processedAt =
      claim.processedAt ?? claim.processed_at ?? aiDecisionMeta.processedAt ?? aiDecisionMeta.processed_at ?? null;
    const basePayout = Number(
      claim.basePayout ??
      claim.base_payout ??
      autoClaimMeta.basePayout ??
      autoClaimMeta.base_payout ??
      dynamicMeta.basePayout ??
      claim.claim_amount ??
      0
    );
    const finalPayout = Number(
      claim.finalPayout ??
      claim.final_payout ??
      autoClaimMeta.finalPayout ??
      autoClaimMeta.final_payout ??
      claim.claim_amount ??
      0
    );
    const severityLevel = String(
      claim.severityLevel ??
      claim.severity_level ??
      autoClaimMeta.severityLevel ??
      autoClaimMeta.severity_level ??
      dynamicMeta.severityLevel ??
      "medium"
    ).toLowerCase();

    return {
      claimId: claim.claimId || claim.id,
      policyName:
        claim.policyName ||
        autoClaimMeta.policyName ||
        claim.headline ||
        "Policy",
      triggerType:
        claim.triggerType ||
        autoClaimMeta.triggerType ||
        claim.eventType ||
        "Unknown",
      payout: finalPayout || Number(claim.payout ?? claim.claim_amount ?? claim.amount ?? 0) || 0,
      finalPayout: finalPayout || Number(claim.payout ?? claim.claim_amount ?? claim.amount ?? 0) || 0,
      basePayout,
      status: rawStatus,
      statusLabel: mapClaimStatusLabel(rawStatus),
      fraudScore,
      riskLevel,
      severityLevel,
      decisionReason,
      processedAt,
      createdAt: claim.createdAt || claim.created_at || claim.detectedAt || new Date().toISOString(),
    };
  }

  function getRiskTone(riskLevel) {
    const normalizedRisk = String(riskLevel || "medium").toLowerCase();

    if (normalizedRisk === "low") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (normalizedRisk === "high") {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  function getStatusTone(status) {
    const normalizedStatus = String(status || "pending").toUpperCase();

    if (normalizedStatus === "APPROVED") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (normalizedStatus === "REJECTED") {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  function getSeverityTone(severityLevel) {
    const normalizedSeverity = String(severityLevel || "medium").toLowerCase();

    if (normalizedSeverity === "high") {
      return "bg-red-50 text-red-700 border-red-200";
    }

    if (normalizedSeverity === "low") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  async function loadClaimFeed({ silent = false } = {}) {
    if (!silent) {
      setClaimFeedLoading(true);
    }

    try {
      const response = await fetchClaimsFeed();
      const claims = Array.isArray(response?.claims)
        ? response.claims
        : Array.isArray(response)
          ? response
          : [];
      const normalizedClaims = claims.map(normalizeClaimRecord);

      const unseenIds = normalizedClaims
        .map((claim) => claim.claimId)
        .filter((claimId) => claimId && !seenClaimIdsRef.current.has(claimId));

      unseenIds.forEach((claimId) => seenClaimIdsRef.current.add(claimId));
      setNewClaimIds(unseenIds);
      setClaimFeed(normalizedClaims);
      setClaimFeedError("");
    } catch (error) {
      setClaimFeedError(extractApiErrorMessage(error, "Unable to load claims."));
    } finally {
      if (!silent) {
        setClaimFeedLoading(false);
      }
    }
  }

  function getFallbackCoordinates() {
    const normalizedCity = String(sessionUser?.city || platformState.worker.city || "bengaluru")
      .trim()
      .toLowerCase();
    return CITY_COORDINATES[normalizedCity] || CITY_COORDINATES.bengaluru;
  }

  async function resolveCoordinates() {
    const fallback = getFallbackCoordinates();
    if (!navigator.geolocation) {
      return fallback;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 0,
        });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (_error) {
      return fallback;
    }
  }

  async function handleProofSelection(proofType, event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!activeClaimId) {
      setProofUploadError("A claim must exist before automated proof validation can run.");
      setProofUploadResult(null);
      return;
    }

    setUploadingProofType(proofType);
    setProofUploadError("");

    try {
      const coordinates = await resolveCoordinates();
      const result = await uploadClaimProof({
        userId: sessionUser?.id || sessionUser?.worker_id || "session-worker",
        claimId: activeClaimId,
        proofType,
        file,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        claimTime: activeClaimTime,
        city: sessionUser?.city || platformState.worker.city || "Bengaluru",
        zone: sessionUser?.zone || platformState.worker.area || "Central",
        metadata: {
          source_page: "claims",
          original_file_name: file.name,
        },
      });

      setProofUploadResult(result);
    } catch (error) {
      setProofUploadResult(null);
      setProofUploadError(
        extractApiErrorMessage(error, "Automated proof validation failed. Please retry.")
      );
    } finally {
      setUploadingProofType("");
    }
  }

  async function handleAutoClaimScenario(scenarioId, riskKey) {
    await actions.simulateRisk(riskKey, { silent: true });
    await actions.triggerScenario(scenarioId, { origin: "auto" });
  }

  useEffect(() => {
    loadClaimFeed();

    const intervalId = setInterval(() => {
      loadClaimFeed({ silent: true });
    }, 12000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="space-y-2">
        <p className="text-sm font-medium text-slate-500">Claims</p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Automated Insurance Claims
        </h2>
        <p className="text-sm leading-6 text-slate-600 md:text-base">
          Claims are auto-triggered, validated, and settled by one real-time AI decision pipeline.
        </p>
      </motion.header>

      <AnimatePresence>
        {isLoading ? (
          <SurfaceLoadingPanel
            title={
              liveBackendLoading && !liveBackendData
                ? "Loading live backend data"
                : uiState.claimTriggering
                  ? "Creating claim"
                  : "Refreshing claim data"
            }
            description={
              liveBackendLoading && !liveBackendData
                ? "Fetching real risk, premium, and fraud signals from the backend."
                : uiState.claimTriggering
                ? "Checking the latest risk signal and starting the automated payout flow."
                : "Updating premium, status, and payout information."
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
        >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">Decision Trigger</p>
                  <InfoTooltip
                    label="Automatic claims information"
                    text="Policy trigger checks weather and AQI signals before creating a claim."
                  />
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Automatic Claim Activation
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  When risk conditions exceed policy thresholds, claims are generated instantly.
                </p>
              </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${latestStatusKey}-${triggerActivated}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <StatusBadge
                  status={
                    latestStatusKey === "paid"
                      ? "paid"
                      : latestStatusKey === "approved"
                        ? "approved"
                        : latestStatusKey === "manual_review"
                          ? "manual_review"
                          : triggerActivated
                            ? "risk_high"
                            : "risk_low"
                  }
                  label={
                    latestStatusKey === "paid"
                      ? "Paid"
                      : latestStatusKey === "approved"
                        ? "Approved"
                        : latestStatusKey === "manual_review"
                          ? "Manual Review"
                          : triggerActivated
                            ? "Claim Active"
                            : "Monitoring"
                  }
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <StatusBadge status="rejected" label="Claim Active 🔴" />
            <StatusBadge status="pending" label="Under Review 🟡" />
            <StatusBadge status="active" label="Approved 🟢" />
            <StatusBadge status="paid" label="Paid 💰" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Rain</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {Math.round(rainValue)}mm (Threshold: {TRIGGER_REFERENCE.rainThreshold}mm)
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">AQI</p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {Math.round(aqiValue)} (Threshold: {TRIGGER_REFERENCE.aqiThreshold})
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Trigger</p>
              <p className="mt-2 text-base font-semibold text-red-700">
                {triggerActivated ? "ACTIVATED" : "IDLE"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Live feed: Rain {Math.round(liveRainValue)}mm | AQI {Math.round(liveAqiValue)}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Current Risk</p>
              <div className="mt-2 text-base font-semibold tracking-tight text-slate-900">
                {riskSummaryLabel}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Insurance Premium</p>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                <CurrencyCount value={smartPremium} suffix="/week" />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Latest payout</p>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                <CurrencyCount value={derivedData.latestLossAmount} />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Fraud status</p>
              <div className="mt-2">
                <StatusBadge status={liveFraudStatus} label={liveFraudStatus.toUpperCase()} />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {liveBackendRefreshing ? "Refreshing..." : `Score: ${liveBackendData?.fraud_score ?? "--"}`}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Fraud Review Snapshot</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  <span>Fraud Score</span>
                  <InfoTooltip
                    label="Fraud score model"
                    text="Fraud score blends behavior consistency, route confidence, and claim context. Higher scores trigger stricter review."
                  />
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">{fraudScoreLabel}</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                  <motion.div
                    className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(Math.max(Number(fraudScoreLabel) * 100, 0), 100)}%`,
                    }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Risk Level</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{fraudRiskLevel}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Decision Confidence</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{decisionConfidence}</p>
              </div>
            </div>
          </div>

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

        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck size={16} />
            Claim Pipeline
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Trigger to payout decision flow
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Live policy trigger, claim creation, AI review, and payout stages are tracked in real time.
          </p>

          <div className="mt-6">
            <AnimatedPipeline
              steps={claimPipelineFlowSteps}
              activeIndex={currentPipelineStage}
            />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Under AI Review</span>
              <StatusBadge status="pending" label="Under Review 🟡" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Approved by AI</span>
              <StatusBadge status="active" label="Approved 🟢" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Payout Completed</span>
              <StatusBadge status="paid" label="Paid 💰" />
            </div>
          </div>
        </motion.section>
      </div>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Automated proof validation</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Upload Proof for Claim Verification
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This helps AI validate your claim faster.
            </p>
          </div>

          <StatusBadge
            status={activeClaimId ? "approved" : "pending"}
            label={activeClaimId ? "Claim Ready" : "Claim Needed"}
          />
        </div>

        <input
          ref={parcelInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleProofSelection("PARCEL", event)}
        />
        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(event) => handleProofSelection("SELFIE", event)}
        />
        <input
          ref={workInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleProofSelection("WORK_SCREEN", event)}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <SurfaceButton
            onClick={() => parcelInputRef.current?.click()}
            leftIcon={Package2}
            disabled={!activeClaimId}
            loading={uploadingProofType === "PARCEL"}
            className="w-full sm:w-auto"
          >
            Upload Parcel Screenshot
          </SurfaceButton>

          <SurfaceButton
            onClick={() => selfieInputRef.current?.click()}
            leftIcon={Camera}
            variant="secondary"
            disabled={!activeClaimId}
            loading={uploadingProofType === "SELFIE"}
            className="w-full sm:w-auto"
          >
            Take Live Selfie
          </SurfaceButton>

          <SurfaceButton
            onClick={() => workInputRef.current?.click()}
            leftIcon={Smartphone}
            variant="secondary"
            disabled={!activeClaimId}
            loading={uploadingProofType === "WORK_SCREEN"}
            className="w-full sm:w-auto"
          >
            Upload Work Screen
          </SurfaceButton>
        </div>

        {proofUploadError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {proofUploadError}
          </div>
        ) : null}

        {uploadingProofType ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            Verification in progress...
          </div>
        ) : null}

        {proofUploadResult ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${
              proofUploadResult.warning
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="font-semibold">
                {proofUploadResult.message}
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em]">
                Decision: {proofUploadResult.decision?.decision || "--"}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-700">
              Fraud score: {proofUploadResult.decision?.fraud_score ?? "--"} | Confidence:{" "}
              {proofUploadResult.decision?.confidence ?? "--"}%
            </div>

            {proofUploadResult.reasons?.length ? (
              <div className="mt-2 text-xs text-slate-700">
                {proofUploadResult.reasons.join(" | ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </motion.section>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Auto-generated claims</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Real-Time Claim Activity
            </h3>
          </div>
          <StatusBadge status={claimFeedLoading ? "pending" : "approved"} label={claimFeedLoading ? "Refreshing" : "Live"} />
        </div>

        {claimFeedError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {claimFeedError}
          </div>
        ) : null}

        {!claimFeedLoading && !claimFeed.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            <p>No claims yet - system is actively monitoring risk conditions</p>
            <p className="mt-1">
              Claims will auto-generate the moment trigger thresholds are exceeded.
            </p>
          </div>
        ) : null}

        {claimFeed.length ? (
          <div className="mt-4 grid gap-3">
            {claimFeed.map((claim) => {
              const isNew = newClaimIds.includes(claim.claimId);

              return (
                <div
                  key={claim.claimId}
                  className={`rounded-2xl border p-4 transition-all duration-200 ${
                    isNew
                      ? "border-blue-200 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{claim.policyName}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Policy Name</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{claim.policyName}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Trigger Event</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{claim.triggerType}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Payout Amount</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{formatINR(claim.finalPayout || claim.payout)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{claim.statusLabel || claim.status}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Time</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">{new Date(claim.createdAt).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskTone(claim.riskLevel)}`}>
                          Risk: {String(claim.riskLevel || "medium").toUpperCase()}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getSeverityTone(claim.severityLevel)}`}>
                          Severity: {String(claim.severityLevel || "medium").toUpperCase()}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(claim.status)}`}>
                          {getStatusBadgeLabel(claim.status)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="text-sm font-semibold text-slate-900">{formatINR(claim.finalPayout || claim.payout)}</span>
                      <span className="text-xs text-slate-500">
                        Fraud Score: {claim.fraudScore !== null ? claim.fraudScore.toFixed(2) : "--"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    Base: {formatINR(claim.basePayout)} → Final: {formatINR(claim.finalPayout || claim.payout)} ({String(claim.severityLevel || "medium").toUpperCase()} Severity)
                  </div>

                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                      AI Decision Explanation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-blue-900">
                      {buildAiDecisionExplanation(claim, {
                        rainValue,
                        rainThreshold: TRIGGER_REFERENCE.rainThreshold,
                        aqiValue,
                        aqiThreshold: TRIGGER_REFERENCE.aqiThreshold,
                      })}
                    </p>
                  </div>

                  <details className="mt-4 rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      Why was this claim approved/rejected?
                    </summary>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      <p>{claim.decisionReason}</p>
                      <p>
                        Fraud Score: <span className="font-semibold text-slate-900">{claim.fraudScore !== null ? claim.fraudScore.toFixed(2) : "--"}</span>
                      </p>
                      <p>
                        Risk Level: <span className="font-semibold text-slate-900">{String(claim.riskLevel || "medium").toUpperCase()}</span>
                      </p>
                      {claim.processedAt ? (
                        <p>
                          Processed: <span className="font-semibold text-slate-900">{new Date(claim.processedAt).toLocaleString()}</span>
                        </p>
                      ) : null}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        ) : null}
      </motion.section>

      {platformState.claims.length ? (
        <motion.section variants={itemVariants} className="space-y-4">
          {platformState.claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </motion.section>
      ) : (
        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <FileText size={22} />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-900">
            No claims yet - system is actively monitoring risk conditions
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Claims will auto-generate once rain, AQI, or fraud triggers cross policy thresholds.
          </p>
        </motion.section>
      )}
    </motion.div>
  );
}
