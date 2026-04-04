import React, { useRef, useState } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CloudRain, FileText, Package2, ShieldCheck, Smartphone, Wind } from "lucide-react";
import ClaimCard from "../components/claims/ClaimCard";
import InfoTooltip from "../components/ui/InfoTooltip";
import StatusBadge from "../components/ui/StatusBadge";
import SurfaceButton from "../components/ui/SurfaceButton";
import SurfaceLoadingPanel from "../components/ui/SurfaceLoadingPanel";
import { useGigShieldData } from "../context/GigShieldDataContext";
import useLiveBackendData from "../hooks/useLiveBackendData";
import { extractApiErrorMessage, uploadClaimProof } from "../services/api";
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

export default function Claims() {
  const { platformState, derivedData, actions, uiState } = useGigShieldData();
  const parcelInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const workInputRef = useRef(null);
  const [proofUploadError, setProofUploadError] = useState("");
  const [proofUploadResult, setProofUploadResult] = useState(null);
  const [uploadingProofType, setUploadingProofType] = useState("");
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
        userId: sessionUser?.id || sessionUser?.worker_id || "demo-user",
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

  async function handleAutoClaimDemo(scenarioId, riskKey) {
    await actions.simulateRisk(riskKey, { silent: true });
    await actions.triggerScenario(scenarioId, { origin: "auto" });
  }

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
          Claim Flow
        </h2>
        <p className="text-sm leading-6 text-slate-600 md:text-base">
          Review claim activity with real-time monitoring, automated decisions, and a clear
          payout flow.
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
                ? "Fetching real risk, engine cost, and fraud signals from the backend."
                : uiState.claimTriggering
                ? "Checking the latest risk signal and starting the automated payout flow."
                : "Updating engine cost, status, and payout information."
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
                    text="Decision intelligence checks weather, AQI, and traffic signals before creating a claim."
                  />
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Claim auto-triggered by the decision engine
                </h3>
              </div>

            <StatusBadge
              status={`risk_${currentRisk.toLowerCase()}`}
              label={`${currentRisk} Risk`}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              Real-time monitoring
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Automated system
            </span>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Self-correcting AI
            </span>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">
              {latestClaim
                ? `Latest auto claim was triggered when the decision engine detected ${getClaimReason(latestClaim)} conditions and is moving through the payout flow automatically.`
                : "Claims are created automatically when rain, AQI, or traffic conditions cross the live decision threshold."}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Current risk</p>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {currentRisk}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Engine Cost</p>
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

        <motion.section
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck size={16} />
            Claim flow
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Created -&gt; Processing -&gt; Paid
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Every claim starts automatically, moves through verification, and then reaches payout
            once checks are clear.
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Pending</span>
              <StatusBadge status="pending" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Approved</span>
              <StatusBadge status="approved" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">Paid</span>
              <StatusBadge status="paid" />
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
              Upload required proof for AI fraud checks
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload one proof at a time. Live capture, image forensics, activity logs, and weather
              checks run automatically.
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
          <h3 className="mt-4 text-xl font-semibold text-slate-900">No claims yet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your first claim will appear here when a risk event crosses the automatic trigger
            threshold.
          </p>
        </motion.section>
      )}
    </motion.div>
  );
}
