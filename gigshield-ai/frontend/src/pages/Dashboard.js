import React, { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  CloudRain,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Wind,
} from "lucide-react";
import SurfaceButton from "../components/ui/SurfaceButton";
import { useGigShieldData } from "../context/GigShieldDataContext";
import useLiveBackendData from "../hooks/useLiveBackendData";
import {
  DEFAULT_RISK_PREMIUM_INPUT,
  extractApiErrorMessage,
  getAiDecision,
  getAutoClaim,
  getFraudStatus,
  getRiskPremium,
  reverifyClaim,
  startDispute,
  uploadProof,
} from "../services/api";
import { getUserFromToken } from "../utils/auth";
import { cn } from "../utils/cn";
import { formatINR } from "../utils/helpers";

const containerVariants = {
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
    transition: { duration: 0.32, ease: "easeOut" },
  },
};

const riskStyles = {
  Low: {
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    accent: "text-emerald-700",
    ring: "ring-emerald-100",
  },
  Medium: {
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    accent: "text-amber-700",
    ring: "ring-amber-100",
  },
  High: {
    badge: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    accent: "text-red-700",
    ring: "ring-red-100",
  },
};

const DEFAULT_AUTOMATION_SCENARIO = {
  riskInputs: DEFAULT_RISK_PREMIUM_INPUT,
  hoursLost: 1,
  fraudSignals: {
    locationMatch: true,
    claimsCount: 1,
    loginAttempts: 1,
    contextValid: true,
  },
};

const RAIN_SIMULATION_SCENARIO = {
  riskInputs: {
    aqi: 120,
    rain: 24,
    wind: 14,
  },
  hoursLost: 3,
  fraudSignals: {
    locationMatch: false,
    claimsCount: 4,
    loginAttempts: 5,
    contextValid: false,
  },
};

const POLLUTION_SIMULATION_SCENARIO = {
  riskInputs: {
    aqi: 340,
    rain: 2,
    wind: 14,
  },
  hoursLost: 3,
  fraudSignals: {
    locationMatch: true,
    claimsCount: 4,
    loginAttempts: 5,
    contextValid: true,
  },
};

const AUTO_CLAIM_STEPS = ["CREATED", "PROCESSING", "PAID"];
const DEFAULT_HOURLY_RATE = 150;
const DEFAULT_DISPUTE_REASON = "System failed to detect actual issue";

function formatClaimTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatSignalLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return "Checking";
  }

  return `${normalized.charAt(0)}${normalized.slice(1).toLowerCase()}`;
}

function getDefaultHourlyRate(weeklyIncome) {
  const numericIncome = Number(weeklyIncome);
  if (Number.isFinite(numericIncome) && numericIncome > 0) {
    return Math.max(1, Math.round((numericIncome / 42) * 100) / 100);
  }

  return DEFAULT_HOURLY_RATE;
}

function getFraudEngineState(snapshot) {
  const status = String(snapshot?.status || "").trim().toUpperCase();
  const fraudScore = Number(snapshot?.fraud_score ?? snapshot?.fraudScore ?? 0);

  if (status === "FRAUD") {
    return {
      score: fraudScore,
      label: "FRAUD",
      className: "bg-red-50 text-red-700",
      dot: "bg-red-500",
      bar: "bg-red-500",
      tone: "danger",
    };
  }

  if (status === "WARNING") {
    return {
      score: fraudScore,
      label: "WARNING",
      className: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      tone: "warning",
    };
  }

  return {
    score: fraudScore,
    label: "SAFE",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    tone: "success",
  };
}

function buildAiDecisionPayload(riskInputs, fraudSignals) {
  return {
    aqi: Number(riskInputs?.aqi ?? 0),
    rain: Number(riskInputs?.rain ?? 0),
    wind: Number(riskInputs?.wind ?? 0),
    claimsCount: Number(fraudSignals?.claimsCount ?? 0),
    loginAttempts: Number(fraudSignals?.loginAttempts ?? 0),
    locationMatch: Boolean(fraudSignals?.locationMatch),
    contextValid: Boolean(fraudSignals?.contextValid),
  };
}

function formatDecisionAction(value) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .toUpperCase();
}

function getSmartDecisionState(snapshot) {
  const decision = String(snapshot?.decision || "").trim().toUpperCase();
  const nextAction = String(snapshot?.nextAction || "").trim().toUpperCase();

  if (!decision) {
    return {
      label: "PENDING",
      nextAction: nextAction || "WAITING",
      className: "bg-slate-100 text-slate-700",
      dot: "bg-slate-400",
      summary: "Smart decision is waiting for the backend response.",
    };
  }

  if (decision === "FRAUD") {
    return {
      label: "FRAUD",
      nextAction: nextAction || "REJECT_CLAIM",
      className: "bg-red-50 text-red-700",
      dot: "bg-red-500",
      summary: "The system wants to reject this claim automatically.",
    };
  }

  if (decision === "VERIFY") {
    return {
      label: "VERIFY",
      nextAction: nextAction || "UPLOAD_PROOF",
      className: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      summary: "The system needs extra proof before it can continue.",
    };
  }

  return {
    label: "SAFE",
    nextAction: nextAction || "AUTO_APPROVE_CLAIM",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    summary: "The system can approve this claim automatically.",
  };
}

function getClaimStepClasses(step, status) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const statusIndex = AUTO_CLAIM_STEPS.indexOf(normalizedStatus);
  const stepIndex = AUTO_CLAIM_STEPS.indexOf(step);

  if (statusIndex >= stepIndex && statusIndex !== -1) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

function SurfaceSkeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,#f8fafc,rgba(226,232,240,0.9),#f8fafc)] bg-[length:200%_100%]",
        className
      )}
    />
  );
}

function DashboardCard({ children, className, hover = true }) {
  return (
    <motion.section
      variants={itemVariants}
      whileHover={hover ? { y: -2, scale: 1.01 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      {children}
    </motion.section>
  );
}

function StatusPill({ label, className, dotClassName = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClassName)} />
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  supporting,
  loading = false,
  toneClassName = "bg-blue-50 text-blue-700",
  iconClassName = "bg-blue-50 text-blue-600",
  valueClassName = "text-slate-900",
  pulse = false,
}) {
  return (
    <DashboardCard className={cn("group relative overflow-hidden", pulse && "ring-4")} hover>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? (
            <>
              <SurfaceSkeleton className="mt-4 h-9 w-28" />
              <SurfaceSkeleton className="mt-3 h-4 w-40" />
            </>
          ) : (
            <>
              <div className={cn("mt-4 text-3xl font-semibold tracking-tight md:text-4xl", valueClassName)}>
                {value}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{supporting}</p>
            </>
          )}
        </div>

        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", iconClassName)}>
          <Icon size={20} />
        </div>
      </div>

      {!loading ? (
        <div className="mt-5">
          <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-semibold", toneClassName)}>
            {label}
          </span>
        </div>
      ) : null}
    </DashboardCard>
  );
}

function DetailRow({ label, value, className }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn("text-sm font-semibold text-slate-900", className)}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { platformState } = useGigShieldData();
  const sessionUser = getUserFromToken();
  const [riskData, setRiskData] = useState(null);
  const [riskInputs, setRiskInputs] = useState(DEFAULT_AUTOMATION_SCENARIO.riskInputs);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState("");
  const [riskAction, setRiskAction] = useState("load");
  const [claimData, setClaimData] = useState(null);
  const [claimLoading, setClaimLoading] = useState(true);
  const [claimError, setClaimError] = useState("");
  const [fraudData, setFraudData] = useState(null);
  const [fraudLoading, setFraudLoading] = useState(true);
  const [fraudError, setFraudError] = useState("");
  const [aiDecisionData, setAiDecisionData] = useState(null);
  const [aiDecisionLoading, setAiDecisionLoading] = useState(true);
  const [aiDecisionError, setAiDecisionError] = useState("");
  const [dispute, setDispute] = useState(null);
  const [disputeError, setDisputeError] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [geoImage, setGeoImage] = useState(null);
  const [workImage, setWorkImage] = useState(null);
  const [proofUpload, setProofUpload] = useState(null);
  const [proofUploadError, setProofUploadError] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [reverificationResult, setReverificationResult] = useState(null);
  const [reverificationError, setReverificationError] = useState("");
  const [reverificationLoading, setReverificationLoading] = useState(false);
  const [claimHoursLost, setClaimHoursLost] = useState(DEFAULT_AUTOMATION_SCENARIO.hoursLost);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const {
    data: liveSnapshot,
    error: liveBackendError,
    isRefreshing: liveBackendRefreshing,
  } = useLiveBackendData({
    refreshIntervalMs: 20000,
  });

  async function loadMonitoringScenario(nextScenario, action) {
    const requestId = requestIdRef.current + 1;
    const nextInputs = nextScenario?.riskInputs || DEFAULT_AUTOMATION_SCENARIO.riskInputs;
    const nextHoursLost = Number(nextScenario?.hoursLost ?? DEFAULT_AUTOMATION_SCENARIO.hoursLost);
    const nextFraudSignals = nextScenario?.fraudSignals || DEFAULT_AUTOMATION_SCENARIO.fraudSignals;
    const hourlyRate = getDefaultHourlyRate(platformState.worker.weeklyIncome);

    requestIdRef.current = requestId;
    setRiskInputs(nextInputs);
    setClaimHoursLost(nextHoursLost);
    setRiskAction(action);
    setRiskLoading(true);
    setClaimLoading(true);
    setFraudLoading(true);
    setAiDecisionLoading(true);
    setRiskError("");
    setClaimError("");
    setFraudError("");
    setAiDecisionError("");
    setDispute(null);
    setDisputeError("");
    setGeoImage(null);
    setWorkImage(null);
    setProofUpload(null);
    setProofUploadError("");
    setReverificationResult(null);
    setReverificationError("");

    try {
      const nextRiskData = await getRiskPremium(nextInputs);
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }

      setRiskData(nextRiskData);

      const [claimResult, fraudResult, aiDecisionResult] = await Promise.allSettled([
        getAutoClaim({
          risk: nextRiskData?.risk || "LOW",
          hoursLost: nextHoursLost,
          hourlyRate,
        }),
        getFraudStatus({
          risk: nextRiskData?.risk || "LOW",
          locationMatch: nextFraudSignals.locationMatch,
          claimsCount: nextFraudSignals.claimsCount,
          loginAttempts: nextFraudSignals.loginAttempts,
          contextValid: nextFraudSignals.contextValid,
        }),
        getAiDecision(buildAiDecisionPayload(nextInputs, nextFraudSignals)),
      ]);

      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }

      if (claimResult.status === "fulfilled") {
        setClaimData(claimResult.value);
      } else {
        setClaimData(null);
        setClaimError(extractApiErrorMessage(claimResult.reason, "Service unavailable"));
      }

      if (fraudResult.status === "fulfilled") {
        setFraudData(fraudResult.value);
      } else {
        setFraudData(null);
        setFraudError(extractApiErrorMessage(fraudResult.reason, "Service unavailable"));
      }

      if (aiDecisionResult.status === "fulfilled") {
        setAiDecisionData(aiDecisionResult.value);
      } else {
        setAiDecisionData(null);
        setAiDecisionError(
          extractApiErrorMessage(aiDecisionResult.reason, "Service unavailable")
        );
      }
    } catch (riskRequestError) {
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }

      setRiskData(null);
      setClaimData(null);
      setFraudData(null);
      setAiDecisionData(null);
      setRiskError(extractApiErrorMessage(riskRequestError, "Service unavailable"));
    } finally {
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        return;
      }

      setRiskLoading(false);
      setClaimLoading(false);
      setFraudLoading(false);
      setAiDecisionLoading(false);
    }
  }

  async function handleStartDispute() {
    if (!sessionUser?.id) {
      setDisputeError("User session not found. Please sign in again.");
      return;
    }

    setDisputeSubmitting(true);
    setDisputeError("");

    try {
      const response = await startDispute({
        userId: sessionUser.id,
        reason: DEFAULT_DISPUTE_REASON,
      });

      if (!mountedRef.current) {
        return;
      }

      setDispute({
        dispute: true,
        disputeId: response.disputeId,
        status: response.status,
      });
      setGeoImage(null);
      setWorkImage(null);
      setProofUpload(null);
      setProofUploadError("");
      setReverificationResult(null);
      setReverificationError("");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setDispute(null);
      setDisputeError(extractApiErrorMessage(error, "Unable to start dispute."));
    } finally {
      if (!mountedRef.current) {
        return;
      }

      setDisputeSubmitting(false);
    }
  }

  function handleGeoImageChange(event) {
    const file = event.target.files?.[0] || null;
    setGeoImage(file);
    setProofUpload(null);
    setProofUploadError("");
    setReverificationResult(null);
    setReverificationError("");
  }

  function handleWorkImageChange(event) {
    const file = event.target.files?.[0] || null;
    setWorkImage(file);
    setProofUpload(null);
    setProofUploadError("");
    setReverificationResult(null);
    setReverificationError("");
  }

  async function handleSubmitProof() {
    if (!dispute?.disputeId) {
      setProofUploadError("Start a dispute before uploading proof.");
      return;
    }

    if (!geoImage || !workImage) {
      setProofUploadError("Please upload both proof images before submitting.");
      return;
    }

    setProofUploading(true);
    setProofUploadError("");
    setReverificationError("");
    setReverificationResult(null);
    let uploadCompleted = false;

    try {
      const uploadResponse = await uploadProof({
        disputeId: dispute.disputeId,
        geoImage,
        workScreenshot: workImage,
      });

      if (!mountedRef.current) {
        return;
      }

      setProofUpload(uploadResponse);
      uploadCompleted = true;
      setDispute((current) =>
        current
          ? {
              ...current,
              status: uploadResponse.status,
            }
          : current
      );

      setProofUploading(false);
      setReverificationLoading(true);

      const reviewResponse = await reverifyClaim({
        disputeId: dispute.disputeId,
        claimTime: formatClaimTime(),
        userLocation: sessionUser?.zone || sessionUser?.city || "Zone-A",
      });

      if (!mountedRef.current) {
        return;
      }

      setReverificationResult(reviewResponse);
      setDispute((current) =>
        current
          ? {
              ...current,
              status: reviewResponse.finalStatus,
            }
          : current
      );

      if (reviewResponse.finalStatus === "APPROVED") {
        setClaimData((current) => ({
          claimTriggered: true,
          payout:
            current?.payout ??
            Math.round(claimHoursLost * claimHourlyRate * 100) / 100,
          status: "PAID",
          claimStates: current?.claimStates || AUTO_CLAIM_STEPS,
          hoursLost: current?.hoursLost ?? claimHoursLost,
          hourlyRate: current?.hourlyRate ?? claimHourlyRate,
          message: "Claim approved after AI re-verification",
        }));
      } else {
        setClaimData((current) => ({
          claimTriggered: true,
          payout: 0,
          status: "REJECTED",
          claimStates: current?.claimStates || AUTO_CLAIM_STEPS,
          hoursLost: current?.hoursLost ?? claimHoursLost,
          hourlyRate: current?.hourlyRate ?? claimHourlyRate,
          message: "Claim rejected after AI re-verification",
        }));
        setFraudData((current) => {
          const nextScore = Math.max(
            Number(current?.fraudScore ?? current?.fraud_score ?? 0),
            70
          );

          return {
            ...(current || {}),
            fraudScore: nextScore,
            fraud_score: nextScore,
            status: "FRAUD",
          };
        });
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      if (!uploadCompleted) {
        setProofUpload(null);
        setProofUploadError(
          extractApiErrorMessage(error, "Proof upload failed. Please retry.")
        );
      } else {
        setReverificationResult(null);
        setReverificationError(
          extractApiErrorMessage(error, "AI re-verification failed. Please retry.")
        );
      }
    } finally {
      if (!mountedRef.current) {
        return;
      }

      setProofUploading(false);
      setReverificationLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    loadMonitoringScenario(DEFAULT_AUTOMATION_SCENARIO, "load");

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fraudSnapshot = fraudData || liveSnapshot;
  const automatedRisk = formatSignalLabel(riskData?.risk || liveSnapshot?.risk || "Low");
  const automatedPremiumAmount = Number(
    riskData?.premium ?? liveSnapshot?.premium ?? 0
  );
  const claimTriggered = Boolean(claimData?.claimTriggered);
  const claimStatus = String(claimData?.status || "").trim().toUpperCase();
  const claimPayout = Number(claimData?.payout ?? 0);
  const claimHourlyRate = Number(
    claimData?.hourlyRate ?? getDefaultHourlyRate(platformState.worker.weeklyIncome)
  );
  const fraudState = getFraudEngineState(fraudSnapshot);
  const fraudScore = Number(fraudSnapshot?.fraudScore ?? fraudSnapshot?.fraud_score ?? 0);
  const fraudDetails = fraudSnapshot?.details || {
    behavior: "Checking",
    location: "Checking",
    context: "Checking",
  };
  const smartDecisionState = getSmartDecisionState(aiDecisionData);
  const showDisputeOption = ["VERIFY", "FRAUD"].includes(smartDecisionState.label);
  const riskStyle = riskStyles[automatedRisk] || riskStyles.Low;
  const fraudPanelError = fraudError || aiDecisionError || (!fraudSnapshot ? liveBackendError : "");
  const systemBusy = riskLoading || claimLoading || fraudLoading || aiDecisionLoading;
  const showSuccessState = claimTriggered && claimStatus === "PAID";

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header
        variants={itemVariants}
        className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Real-Time Monitoring
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              GigShield Command Center
            </h2>
            <p className="text-sm leading-6 text-slate-500 md:text-base">
              System is monitoring your environment.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Live Status
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {systemBusy ? "Refreshing signals" : liveBackendRefreshing ? "Monitoring live changes" : "Monitoring active"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Risk, premium, claim, and fraud stay in sync.
            </div>
          </div>
        </div>
      </motion.header>

      <section className="grid gap-5 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Risk"
          loading={riskLoading && !riskData}
          value={
            <div className="flex items-center gap-3">
              <span className={cn("h-3 w-3 rounded-full", riskStyle.dot, automatedRisk === "High" && "risk-pulse")} />
              <span className={riskStyle.accent}>{automatedRisk}</span>
            </div>
          }
          supporting="Real-time signals are updating continuously."
          toneClassName={riskStyle.badge}
          iconClassName="bg-blue-50 text-blue-600"
          valueClassName={riskStyle.accent}
          pulse={automatedRisk === "High"}
        />

        <MetricCard
          icon={Wallet}
          label="Premium"
          loading={riskLoading && !riskData}
          value={
            <CountUp
              end={automatedPremiumAmount}
              duration={1.15}
              formattingFn={(value) => `${formatINR(Math.round(value))}/week`}
              preserveValue
            />
          }
          supporting="Premium updates as soon as risk changes."
          toneClassName="bg-blue-50 text-blue-700"
          iconClassName="bg-blue-50 text-blue-600"
          valueClassName="text-slate-900"
        />

        <MetricCard
          icon={CheckCircle2}
          label="Claim"
          loading={claimLoading && !claimData}
          value={showSuccessState ? formatINR(claimPayout) : claimTriggered ? claimStatus : "Not triggered"}
          supporting={
            showSuccessState
              ? "Claim processed successfully"
              : "Eligible only when high risk causes 2+ hours lost."
          }
          toneClassName={showSuccessState ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}
          iconClassName={showSuccessState ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}
          valueClassName={showSuccessState ? "text-emerald-700" : "text-slate-900"}
        />

        <MetricCard
          icon={ShieldAlert}
          label="Fraud"
          loading={fraudLoading && !fraudSnapshot}
          value={
            <div className="flex items-center gap-3">
              <span>{fraudScore}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", fraudState.className)}>
                {fraudState.label}
              </span>
            </div>
          }
          supporting="Behavior, location, and context are checked together."
          toneClassName={fraudState.className}
          iconClassName="bg-slate-100 text-slate-700"
          valueClassName="text-slate-900"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard className="overflow-hidden">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Real-time monitoring</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Simulate live conditions
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use one action and watch risk, premium, claim, and fraud react together.
                </p>
              </div>

              <StatusPill
                label={systemBusy ? "Syncing live signals" : "Monitoring active"}
                className="bg-blue-50 text-blue-700"
                dotClassName="bg-blue-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "AQI", value: riskInputs.aqi },
                { label: "Rain", value: `${riskInputs.rain} mm` },
                { label: "Wind", value: `${riskInputs.wind} km/h` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {item.label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <SurfaceButton
                onClick={() => loadMonitoringScenario(RAIN_SIMULATION_SCENARIO, "rain")}
                loading={riskLoading && riskAction === "rain"}
                disabled={riskLoading}
                leftIcon={CloudRain}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
              >
                Simulate Rain
              </SurfaceButton>

              <SurfaceButton
                onClick={() => loadMonitoringScenario(POLLUTION_SIMULATION_SCENARIO, "pollution")}
                loading={riskLoading && riskAction === "pollution"}
                disabled={riskLoading}
                leftIcon={Wind}
                variant="secondary"
                className="w-full border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 sm:w-auto"
              >
                Simulate Pollution
              </SurfaceButton>
            </div>

            <AnimatePresence initial={false}>
              {riskError ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {riskError}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600"
                >
                  {systemBusy
                    ? "Refreshing live signals across risk, premium, claim, and fraud."
                    : "Every simulation reruns the full monitoring flow instantly."}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DashboardCard>

        <motion.div
          variants={itemVariants}
          animate={showSuccessState ? { scale: [1, 1.012, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <DashboardCard
            className={cn(
              "h-full",
              showSuccessState && "border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]"
            )}
          >
            <div className="flex h-full flex-col gap-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Claim</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {claimLoading
                      ? "Checking claim eligibility"
                      : showSuccessState
                        ? "Claim processed successfully"
                        : "Automatic claim status"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {showSuccessState
                      ? "Payout has been highlighted and the flow is complete."
                      : "Claims are created only when high risk leads to sufficient downtime."}
                  </p>
                </div>

                {claimLoading ? (
                  <StatusPill label="Checking" className="bg-blue-50 text-blue-700" dotClassName="bg-blue-500" />
                ) : claimStatus ? (
                  <StatusPill label={claimStatus} className="bg-emerald-50 text-emerald-700" dotClassName="bg-emerald-500" />
                ) : (
                  <StatusPill label="Not eligible" className="bg-slate-100 text-slate-700" dotClassName="bg-slate-400" />
                )}
              </div>

              <div className="rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
                {claimLoading ? (
                  <div className="space-y-3">
                    <SurfaceSkeleton className="h-4 w-28" />
                    <SurfaceSkeleton className="h-10 w-48" />
                    <SurfaceSkeleton className="h-4 w-36" />
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Payout
                    </div>
                    <div className={cn("mt-3 text-4xl font-semibold tracking-tight", showSuccessState ? "text-emerald-700" : "text-slate-900")}>
                      <CountUp
                        end={claimPayout}
                        duration={1.2}
                        formattingFn={(value) => formatINR(Math.round(value))}
                        preserveValue
                      />
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {claimHoursLost} hours lost at {formatINR(claimHourlyRate)}/hour
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {AUTO_CLAIM_STEPS.map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold",
                      getClaimStepClasses(step, claimStatus)
                    )}
                  >
                    {step}
                  </span>
                ))}
              </div>

              {claimError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {claimError}
                </div>
              ) : null}
            </div>
          </DashboardCard>
        </motion.div>
      </section>

      <DashboardCard className="overflow-hidden">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Fraud</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Fraud Engine
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Behavior, location, and context are checked in real time.
            </p>
          </div>

          {fraudLoading && !fraudSnapshot ? (
            <StatusPill label="Checking" className="bg-blue-50 text-blue-700" dotClassName="bg-blue-500" />
          ) : (
            <StatusPill label={fraudState.label} className={fraudState.className} dotClassName={fraudState.dot} />
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Final Score
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                {fraudLoading && !fraudSnapshot ? (
                  <SurfaceSkeleton className="h-10 w-24" />
                ) : (
                  <CountUp end={fraudScore} duration={1} preserveValue />
                )}
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <motion.div
                  className={cn("h-2 rounded-full", fraudState.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(fraudLoading && !fraudSnapshot ? 0 : fraudScore, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Status
              </div>
              <div className="mt-3">
                {fraudLoading && !fraudSnapshot ? (
                  <SurfaceSkeleton className="h-8 w-28" />
                ) : (
                  <StatusPill label={fraudState.label} className={fraudState.className} dotClassName={fraudState.dot} />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <BadgeCheck size={16} />
              Real-time monitoring
            </div>

            <div className="mt-4 space-y-3">
              {fraudLoading && !fraudSnapshot ? (
                <>
                  <SurfaceSkeleton className="h-14 w-full" />
                  <SurfaceSkeleton className="h-14 w-full" />
                  <SurfaceSkeleton className="h-14 w-full" />
                  <SurfaceSkeleton className="h-14 w-full" />
                </>
              ) : (
                <>
                  <DetailRow label="Behavior" value={fraudDetails.behavior} />
                  <DetailRow label="Location" value={fraudDetails.location} />
                  <DetailRow label="Context" value={fraudDetails.context} />
                  <DetailRow label="Final Score" value={fraudScore} />
                  <DetailRow label="Status" value={fraudState.label} className={fraudState.tone === "danger" ? "text-red-700" : fraudState.tone === "warning" ? "text-amber-700" : "text-emerald-700"} />
                </>
              )}
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Smart Decision Layer
                  </div>
                  <h4 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                    {aiDecisionLoading && !aiDecisionData
                      ? "Loading smart decision"
                      : smartDecisionState.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {aiDecisionLoading && !aiDecisionData
                      ? "Evaluating the next system action."
                      : smartDecisionState.summary}
                  </p>
                </div>

                {aiDecisionLoading && !aiDecisionData ? (
                  <SurfaceSkeleton className="h-8 w-28" />
                ) : (
                  <StatusPill
                    label={smartDecisionState.label}
                    className={smartDecisionState.className}
                    dotClassName={smartDecisionState.dot}
                  />
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {aiDecisionLoading && !aiDecisionData ? (
                  <>
                    <SurfaceSkeleton className="h-14 w-full" />
                    <SurfaceSkeleton className="h-14 w-full" />
                  </>
                ) : (
                  <>
                    <DetailRow label="Decision" value={smartDecisionState.label} />
                    <DetailRow
                      label="Next Action"
                      value={formatDecisionAction(smartDecisionState.nextAction)}
                    />
                  </>
                )}
              </div>

              {showDisputeOption ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Not satisfied with this decision?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    You can challenge the result and start a dispute flow.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <SurfaceButton
                      onClick={handleStartDispute}
                      loading={disputeSubmitting}
                      disabled={Boolean(dispute)}
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      Raise Dispute
                    </SurfaceButton>

                    {dispute ? (
                      <span className="text-sm font-medium text-emerald-700">
                        Dispute started. Please upload proof to continue.
                      </span>
                    ) : null}
                  </div>

                  {dispute ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-600">
                      Dispute ID: {dispute.disputeId} | Status: {dispute.status}
                    </div>
                  ) : null}

                  {dispute ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <h5 className="text-sm font-semibold text-slate-900">
                        Upload proof to verify your claim
                      </h5>

                      <div className="mt-4 grid gap-4">
                        <label className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <span className="block text-sm font-medium text-slate-700">
                            Upload geo-location image
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleGeoImageChange}
                            className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
                          />
                          <span className="mt-2 block text-xs text-slate-500">
                            {geoImage ? geoImage.name : "No geo-location image selected."}
                          </span>
                        </label>

                        <label className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <span className="block text-sm font-medium text-slate-700">
                            Upload work app screenshot
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleWorkImageChange}
                            className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
                          />
                          <span className="mt-2 block text-xs text-slate-500">
                            {workImage ? workImage.name : "No work app screenshot selected."}
                          </span>
                        </label>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <SurfaceButton
                          onClick={handleSubmitProof}
                          loading={proofUploading || reverificationLoading}
                          disabled={
                            proofUploading ||
                            reverificationLoading ||
                            Boolean(reverificationResult)
                          }
                          className="w-full sm:w-auto"
                        >
                          Submit Proof
                        </SurfaceButton>

                        {proofUpload?.status === "RECEIVED" && reverificationLoading ? (
                          <span className="text-sm font-medium text-emerald-700">
                            Proof uploaded successfully. Verifying...
                          </span>
                        ) : null}
                      </div>

                      {proofUploadError ? (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {proofUploadError}
                        </div>
                      ) : null}

                      {reverificationError ? (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {reverificationError}
                        </div>
                      ) : null}

                      {reverificationResult ? (
                        <div
                          className={cn(
                            "mt-4 rounded-2xl border px-4 py-4",
                            reverificationResult.finalStatus === "APPROVED"
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-red-200 bg-red-50"
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              reverificationResult.finalStatus === "APPROVED"
                                ? "text-emerald-700"
                                : "text-red-700"
                            )}
                          >
                            {reverificationResult.finalStatus === "APPROVED"
                              ? "Claim Approved after verification"
                              : "Claim Rejected after verification"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Confidence: {reverificationResult.confidence}%
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Claim status: {reverificationResult.claimUpdate.claimStatus}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {disputeError ? (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {disputeError}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {fraudPanelError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fraudPanelError}
              </div>
            ) : null}
          </div>
        </div>
      </DashboardCard>

      <AnimatePresence initial={false}>
        {showSuccessState ? (
          <motion.div
            variants={itemVariants}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DashboardCard className="border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]" hover={false}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      Claim processed successfully
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Payout has been confirmed and highlighted below for quick review.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-white px-5 py-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Payout
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700">
                    {formatINR(claimPayout)}
                  </div>
                </div>
              </div>
            </DashboardCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
