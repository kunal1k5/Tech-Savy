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
} from "lucide-react";
import SurfaceButton from "../components/ui/SurfaceButton";
import { useGigPredictAIData } from "../context/GigPredictAIDataContext";
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

const SIMULATION_PRESETS = Object.freeze({
  NORMAL: Object.freeze({
    label: "Normal Scenario",
    aqi: DEFAULT_RISK_PREMIUM_INPUT.aqi,
    rain: DEFAULT_RISK_PREMIUM_INPUT.rain,
    wind: DEFAULT_RISK_PREMIUM_INPUT.wind,
    claimsCount: 1,
    loginAttempts: 1,
    locationMatch: true,
  }),
  HEAVY_RAIN: Object.freeze({
    label: "Heavy Rain Scenario",
    aqi: 120,
    rain: 28,
    wind: 18,
    claimsCount: 1,
    loginAttempts: 2,
    locationMatch: true,
  }),
  HIGH_FRAUD: Object.freeze({
    label: "High Fraud Scenario",
    aqi: 180,
    rain: 8,
    wind: 14,
    claimsCount: 5,
    loginAttempts: 6,
    locationMatch: false,
  }),
});

const DEFAULT_SIMULATION_FORM = Object.freeze({ ...SIMULATION_PRESETS.NORMAL });
const DEFAULT_AUTOMATION_SCENARIO = createMonitoringScenarioFromForm(DEFAULT_SIMULATION_FORM);
const HEAVY_RAIN_SIMULATION_SCENARIO = createMonitoringScenarioFromForm(
  SIMULATION_PRESETS.HEAVY_RAIN
);
const HIGH_FRAUD_SIMULATION_SCENARIO = createMonitoringScenarioFromForm(
  SIMULATION_PRESETS.HIGH_FRAUD
);

const AUTO_CLAIM_STEPS = ["CREATED", "PROCESSING", "PAID"];
const DEFAULT_HOURLY_RATE = 150;
const DEFAULT_DISPUTE_REASON = "System failed to detect actual issue";
const AI_LIFECYCLE_STEPS = [
  {
    key: "detect",
    label: "Detect",
    note: "Signals are monitored across risk, behavior, and location.",
  },
  {
    key: "decide",
    label: "Decide",
    note: "The decision engine classifies the claim and chooses the next action.",
  },
  {
    key: "validate",
    label: "Validate",
    note: "Users can challenge the result with disputes and proof uploads.",
  },
  {
    key: "correct",
    label: "Correct",
    note: "AI re-verification refines the final outcome and claim state.",
  },
];
const LIVE_SYSTEM_SIGNALS = [
  {
    label: "Monitoring Active",
    dotClassName: "bg-blue-500",
  },
  {
    label: "Decision Engine Running",
    dotClassName: "bg-emerald-500",
  },
  {
    label: "Fraud Detection Active",
    dotClassName: "bg-amber-500",
  },
];

function formatClaimTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatSignalLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return "Processing...";
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

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function normalizeSimulationForm(form = {}) {
  return {
    aqi: clampNumber(form.aqi ?? DEFAULT_SIMULATION_FORM.aqi, 0, 500),
    rain: clampNumber(form.rain ?? DEFAULT_SIMULATION_FORM.rain, 0, 50),
    wind: clampNumber(form.wind ?? DEFAULT_SIMULATION_FORM.wind, 0, 50),
    claimsCount: clampNumber(
      form.claimsCount ?? DEFAULT_SIMULATION_FORM.claimsCount,
      0,
      20
    ),
    loginAttempts: clampNumber(
      form.loginAttempts ?? DEFAULT_SIMULATION_FORM.loginAttempts,
      0,
      20
    ),
    locationMatch:
      form.locationMatch === undefined
        ? DEFAULT_SIMULATION_FORM.locationMatch
        : Boolean(form.locationMatch),
  };
}

function deriveSimulationContextValidity({ claimsCount, loginAttempts, locationMatch }) {
  if (!locationMatch) {
    return false;
  }

  return !(Number(claimsCount) > 3 && Number(loginAttempts) > 3);
}

function deriveSimulationActivitySignals({ aqi, rain, wind }) {
  if (aqi > 300 || rain > 20 || wind > 30) {
    return {
      hoursLost: 3,
      activitySignals: {
        isWorking: true,
        ordersCompleted: 0,
        workingMinutes: 180,
        earnings: 0,
      },
    };
  }

  if (aqi > 150 || rain > 5) {
    return {
      hoursLost: 2,
      activitySignals: {
        isWorking: true,
        ordersCompleted: 1,
        workingMinutes: 140,
        earnings: 80,
      },
    };
  }

  return {
    hoursLost: 1,
    activitySignals: {
      isWorking: true,
      ordersCompleted: 3,
      workingMinutes: 90,
      earnings: 240,
    },
  };
}

function createMonitoringScenarioFromForm(form) {
  const simulationForm = normalizeSimulationForm(form);
  const riskInputs = {
    aqi: simulationForm.aqi,
    rain: simulationForm.rain,
    wind: simulationForm.wind,
  };
  const { hoursLost, activitySignals } = deriveSimulationActivitySignals(riskInputs);

  return {
    riskInputs,
    hoursLost,
    activitySignals,
    fraudSignals: {
      locationMatch: simulationForm.locationMatch,
      claimsCount: simulationForm.claimsCount,
      loginAttempts: simulationForm.loginAttempts,
      contextValid: deriveSimulationContextValidity(simulationForm),
    },
    simulationForm,
  };
}

function buildAutoClaimPayload({ risk, hoursLost, hourlyRate, activitySignals }) {
  const duration = Number(activitySignals?.workingMinutes ?? hoursLost * 60);

  return {
    risk,
    hoursLost,
    hourlyRate,
    duration,
    isWorking: Boolean(activitySignals?.isWorking),
    ordersCompleted: Number(activitySignals?.ordersCompleted ?? 0),
    workingMinutes: duration,
    earnings: Number(activitySignals?.earnings ?? 0),
  };
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
      summary: "Automated decision system is waiting for the backend response.",
    };
  }

  if (decision === "FRAUD") {
    return {
      label: "FRAUD",
      nextAction: nextAction || "REJECT_CLAIM",
      className: "bg-red-50 text-red-700",
      dot: "bg-red-500",
      summary: "Automated decision system recommends rejecting this claim.",
    };
  }

  if (decision === "VERIFY") {
    return {
      label: "VERIFY",
      nextAction: nextAction || "UPLOAD_PROOF",
      className: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      summary: "Automated decision system needs extra proof before it can continue.",
    };
  }

  return {
    label: "SAFE",
    nextAction: nextAction || "AUTO_APPROVE_CLAIM",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    summary: "Automated decision system can approve this claim automatically.",
  };
}

function getTrustScore(snapshot) {
  if (!snapshot) {
    return 100;
  }

  const explicitTrustScore = Number(snapshot?.trustScore ?? snapshot?.trust_score);
  if (Number.isFinite(explicitTrustScore)) {
    return Math.max(0, Math.min(100, explicitTrustScore));
  }

  const fraudScore = Number(snapshot?.fraudScore ?? snapshot?.fraud_score ?? 0);
  return Math.max(0, Math.min(100, 100 - Math.max(0, fraudScore)));
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

function getLifecycleStepsState({
  fraudSnapshot,
  aiDecisionData,
  aiDecisionLoading,
  showDisputeOption,
  dispute,
  disputeSubmitting,
  proofUpload,
  proofUploading,
  reverificationLoading,
  reverificationResult,
}) {
  return AI_LIFECYCLE_STEPS.map((step) => {
    let status = "pending";

    if (step.key === "detect") {
      status = fraudSnapshot || aiDecisionData ? "complete" : aiDecisionLoading ? "active" : "pending";
    }

    if (step.key === "decide") {
      status = aiDecisionData ? "complete" : aiDecisionLoading ? "active" : "pending";
    }

    if (step.key === "validate") {
      if (reverificationResult) {
        status = "complete";
      } else if (
        proofUpload ||
        proofUploading ||
        dispute ||
        disputeSubmitting ||
        showDisputeOption
      ) {
        status = "active";
      }
    }

    if (step.key === "correct") {
      if (reverificationResult) {
        status = "complete";
      } else if (reverificationLoading || proofUpload) {
        status = "active";
      }
    }

    return {
      ...step,
      status,
    };
  });
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
        "rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,transform] duration-200 hover:border-slate-300 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]",
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
              <p className="mt-2 text-sm leading-6 text-slate-500">{supporting}</p>
            </>
          )}
        </div>

        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm", iconClassName)}>
          <Icon size={20} />
        </div>
      </div>
    </DashboardCard>
  );
}

function SimulationControlCard({ label, value, helper, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>
        </div>

        {helper ? <span className="text-xs font-medium text-slate-400">{helper}</span> : null}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function SimulationResultCard({
  label,
  value,
  supporting,
  toneClassName = "text-slate-900",
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className={cn("mt-3 text-2xl font-semibold tracking-tight", toneClassName)}>{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{supporting}</div>
    </div>
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

function LifecycleStepCard({ index, step }) {
  const styles = {
    complete: {
      container: "border-emerald-200 bg-emerald-50",
      badge: "bg-emerald-600 text-white",
      label: "text-emerald-800",
      status: "Complete",
    },
    active: {
      container: "border-blue-200 bg-blue-50",
      badge: "bg-blue-600 text-white",
      label: "text-blue-800",
      status: "Active",
    },
    pending: {
      container: "border-slate-200 bg-slate-50",
      badge: "bg-white text-slate-700 border border-slate-200",
      label: "text-slate-800",
      status: "Pending",
    },
  };

  const currentStyle = styles[step.status] || styles.pending;

  return (
    <div className={cn("rounded-2xl border px-4 py-4", currentStyle.container)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
              currentStyle.badge
            )}
          >
            {index + 1}
          </span>
          <p className={cn("text-sm font-semibold", currentStyle.label)}>{step.label}</p>
        </div>

        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {currentStyle.status}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{step.note}</p>
    </div>
  );
}

export default function Dashboard() {
  const { platformState } = useGigPredictAIData();
  const sessionUser = getUserFromToken();
  const [riskData, setRiskData] = useState(null);
  const [riskInputs, setRiskInputs] = useState(DEFAULT_AUTOMATION_SCENARIO.riskInputs);
  const [simulationForm, setSimulationForm] = useState({ ...DEFAULT_SIMULATION_FORM });
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
    const nextActivitySignals =
      nextScenario?.activitySignals || DEFAULT_AUTOMATION_SCENARIO.activitySignals;
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
        getAutoClaim(
          buildAutoClaimPayload({
            risk: nextRiskData?.risk || "LOW",
            hoursLost: nextHoursLost,
            hourlyRate,
            activitySignals: nextActivitySignals,
          })
        ),
        getFraudStatus({
          risk: nextRiskData?.risk || "LOW",
          aqi: nextInputs.aqi,
          rain: nextInputs.rain,
          wind: nextInputs.wind,
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

  function updateSimulationField(field, value, limits = {}) {
    setSimulationForm((current) => ({
      ...current,
      [field]:
        typeof value === "boolean"
          ? value
          : clampNumber(value, limits.min ?? 0, limits.max ?? 500),
    }));
  }

  async function applySimulationPreset(presetKey) {
    const preset = SIMULATION_PRESETS[presetKey];
    if (!preset) {
      return;
    }

    const nextForm = normalizeSimulationForm(preset);
    setSimulationForm(nextForm);

    const scenario =
      presetKey === "HEAVY_RAIN"
        ? HEAVY_RAIN_SIMULATION_SCENARIO
        : presetKey === "HIGH_FRAUD"
          ? HIGH_FRAUD_SIMULATION_SCENARIO
          : DEFAULT_AUTOMATION_SCENARIO;

    await loadMonitoringScenario(scenario, `preset-${presetKey.toLowerCase()}`);
  }

  async function handleRunSimulation() {
    await loadMonitoringScenario(
      createMonitoringScenarioFromForm(simulationForm),
      "manual"
    );
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

  const baseFraudSnapshot = fraudData || liveSnapshot || null;
  const fraudSnapshot =
    baseFraudSnapshot || aiDecisionData
      ? {
          ...(baseFraudSnapshot || {}),
          ...(aiDecisionData
            ? {
                fraudScore: aiDecisionData.fraudScore,
                fraud_score: aiDecisionData.fraud_score,
                status: aiDecisionData.status,
                riskReason: aiDecisionData.riskReason,
                fraudReason: aiDecisionData.fraudReason,
                reason: aiDecisionData.reason,
              }
            : {}),
        }
      : null;
  const simulationContextValid = deriveSimulationContextValidity(simulationForm);
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
  const fraudScore = Number(
    aiDecisionData?.fraudScore ??
      aiDecisionData?.fraud_score ??
      fraudSnapshot?.fraudScore ??
      fraudSnapshot?.fraud_score ??
      0
  );
  const fraudDetails = fraudSnapshot?.details || {
    behavior: "Processing...",
    location: "Processing...",
    context: "Processing...",
  };
  const smartDecisionState = getSmartDecisionState(aiDecisionData);
  const trustScore = getTrustScore(aiDecisionData || fraudSnapshot);
  const showDisputeOption = ["VERIFY", "FRAUD"].includes(smartDecisionState.label);
  const lifecycleSteps = getLifecycleStepsState({
    fraudSnapshot,
    aiDecisionData,
    aiDecisionLoading,
    showDisputeOption,
    dispute,
    disputeSubmitting,
    proofUpload,
    proofUploading,
    reverificationLoading,
    reverificationResult,
  });
  const riskStyle = riskStyles[automatedRisk] || riskStyles.Low;
  const fraudPanelError = fraudError || aiDecisionError || (!fraudSnapshot ? liveBackendError : "");
  const systemBusy = riskLoading || claimLoading || fraudLoading || aiDecisionLoading;
  const showSuccessState = claimTriggered && claimStatus === "PAID";
  const statusBannerLabel = systemBusy || liveBackendRefreshing ? "Processing..." : "Decision updated";
  const statusBannerCopy =
    systemBusy || liveBackendRefreshing
      ? "Live signals are syncing across the system."
      : "Monitoring remains active across decisions and fraud checks.";
  const claimStatusLabel = formatSignalLabel(claimStatus || (claimTriggered ? "PAID" : "NOT TRIGGERED"));
  const fraudStatusLabel = formatSignalLabel(fraudState.label);
  const trustScoreSnapshot = aiDecisionData || fraudSnapshot;
  const simulationPanelError = riskError || claimError || fraudPanelError;
  const decisionLabel = formatSignalLabel(smartDecisionState.label);

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
              GigPredict AI Command Center
            </h2>
            <p className="text-sm leading-6 text-slate-500 md:text-base">
              We are not an insurance platform - we are an AI Decision Intelligence System and real-time protection system for gig workers.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Live Status
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {statusBannerLabel}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {LIVE_SYSTEM_SIGNALS.map((signal) => (
                <span
                  key={signal.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  <span className={cn("h-2 w-2 rounded-full animate-pulse", signal.dotClassName)} />
                  {signal.label}
                </span>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {statusBannerCopy}
            </div>
          </div>
        </div>
      </motion.header>

      <section className="grid gap-5 xl:grid-cols-5">
        <MetricCard
          icon={Activity}
          label="Risk Engine"
          loading={riskLoading && !riskData}
          value={
            <div className="flex items-center gap-3">
              <span className={cn("h-3 w-3 rounded-full", riskStyle.dot, automatedRisk === "High" && "risk-pulse")} />
              <span className={riskStyle.accent}>{automatedRisk}</span>
            </div>
          }
          supporting={
            riskData?.reason || "Real-time monitoring keeps risk signals fresh."
          }
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
          supporting="Premium updates from live risk signals."
          iconClassName="bg-blue-50 text-blue-600"
          valueClassName="text-slate-900"
        />

        <MetricCard
          icon={CheckCircle2}
          label="Claim Status"
          loading={claimLoading && !claimData}
          value={claimStatusLabel}
          supporting={
            claimData?.reason ||
            claimData?.message ||
            "Claims trigger only when high risk, active work, income loss, and more than 30 minutes of duration are confirmed."
          }
          iconClassName="bg-emerald-50 text-emerald-600"
          valueClassName={claimTriggered ? "text-emerald-700" : "text-slate-900"}
        />

        <MetricCard
          icon={ShieldAlert}
          label="Fraud Intelligence"
          loading={fraudLoading && !fraudSnapshot}
          value={fraudStatusLabel}
          supporting={fraudSnapshot?.reason || `Fraud score: ${fraudScore}`}
          iconClassName="bg-slate-100 text-slate-700"
          valueClassName={
            fraudState.tone === "danger"
              ? "text-red-700"
              : fraudState.tone === "warning"
                ? "text-amber-700"
                : "text-emerald-700"
          }
        />

        <MetricCard
          icon={ShieldCheck}
          label="Trust Score"
          loading={fraudLoading && !trustScoreSnapshot}
          value={`${trustScore}%`}
          supporting={`User Trust Score: ${trustScore}%`}
          iconClassName="bg-emerald-50 text-emerald-600"
          valueClassName={trustScore >= 80 ? "text-emerald-700" : trustScore >= 50 ? "text-amber-700" : "text-red-700"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard className="overflow-hidden">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Interactive simulation panel</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Test live decision scenarios
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Adjust risk and fraud signals, then run the system to update Risk Engine, premium, claim status, Fraud Intelligence, decision, and trust score in one pass.
                </p>
              </div>

              <StatusPill
                label={systemBusy || liveBackendRefreshing ? "Processing..." : "Decision updated"}
                className="bg-blue-50 text-blue-700"
                dotClassName="bg-blue-500"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <SurfaceButton
                onClick={() => applySimulationPreset("NORMAL")}
                loading={riskLoading && riskAction === "preset-normal"}
                disabled={riskLoading}
                leftIcon={Activity}
                variant="secondary"
                className="w-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                Normal Scenario
              </SurfaceButton>

              <SurfaceButton
                onClick={() => applySimulationPreset("HEAVY_RAIN")}
                loading={riskLoading && riskAction === "preset-heavy_rain"}
                disabled={riskLoading}
                leftIcon={CloudRain}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Heavy Rain Scenario
              </SurfaceButton>

              <SurfaceButton
                onClick={() => applySimulationPreset("HIGH_FRAUD")}
                loading={riskLoading && riskAction === "preset-high_fraud"}
                disabled={riskLoading}
                leftIcon={ShieldAlert}
                variant="secondary"
                className="w-full border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                High Fraud Scenario
              </SurfaceButton>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
              <div className="grid gap-4">
                <SimulationControlCard
                  label="AQI"
                  value={simulationForm.aqi}
                  helper="0 - 500"
                >
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="1"
                    value={simulationForm.aqi}
                    onChange={(event) =>
                      updateSimulationField("aqi", event.target.value, {
                        min: 0,
                        max: 500,
                      })
                    }
                    className="h-2 w-full cursor-pointer accent-blue-600"
                  />
                </SimulationControlCard>

                <SimulationControlCard
                  label="Rain"
                  value={`${simulationForm.rain} mm`}
                  helper="0 - 50"
                >
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={simulationForm.rain}
                    onChange={(event) =>
                      updateSimulationField("rain", event.target.value, {
                        min: 0,
                        max: 50,
                      })
                    }
                    className="h-2 w-full cursor-pointer accent-blue-600"
                  />
                </SimulationControlCard>

                <SimulationControlCard
                  label="Wind"
                  value={`${simulationForm.wind} km/h`}
                  helper="0 - 50"
                >
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={simulationForm.wind}
                    onChange={(event) =>
                      updateSimulationField("wind", event.target.value, {
                        min: 0,
                        max: 50,
                      })
                    }
                    className="h-2 w-full cursor-pointer accent-blue-600"
                  />
                </SimulationControlCard>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <SimulationControlCard
                  label="Claims Count"
                  value={simulationForm.claimsCount}
                  helper="0 - 20"
                >
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={simulationForm.claimsCount}
                    onChange={(event) =>
                      updateSimulationField("claimsCount", event.target.value, {
                        min: 0,
                        max: 20,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </SimulationControlCard>

                <SimulationControlCard
                  label="Login Attempts"
                  value={simulationForm.loginAttempts}
                  helper="0 - 20"
                >
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={simulationForm.loginAttempts}
                    onChange={(event) =>
                      updateSimulationField("loginAttempts", event.target.value, {
                        min: 0,
                        max: 20,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </SimulationControlCard>

                <SimulationControlCard
                  label="Location Match"
                  value={simulationForm.locationMatch ? "TRUE" : "FALSE"}
                  helper={simulationContextValid ? "Context valid" : "Context flagged"}
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateSimulationField("locationMatch", true)}
                      className={cn(
                        "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                        simulationForm.locationMatch
                          ? "border-blue-200 bg-blue-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Match
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSimulationField("locationMatch", false)}
                      className={cn(
                        "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                        !simulationForm.locationMatch
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Mismatch
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Context validity is inferred automatically from mismatch and repeated anomalies to keep the simulation realistic.
                  </p>
                </SimulationControlCard>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Manual changes stay local until you run the simulation.
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  Work and income-loss signals are inferred automatically from live conditions so judges can test the whole flow with minimal input.
                </div>
              </div>

              <SurfaceButton
                onClick={handleRunSimulation}
                loading={riskLoading && riskAction === "manual"}
                disabled={riskLoading}
                leftIcon={BadgeCheck}
                className="w-full bg-slate-900 text-white hover:bg-slate-800 lg:w-auto"
              >
                Run Simulation
              </SurfaceButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SimulationResultCard
                label="Risk"
                value={automatedRisk}
                supporting={`AQI ${riskInputs.aqi} • Rain ${riskInputs.rain} mm • Wind ${riskInputs.wind} km/h`}
                toneClassName={riskStyle.accent}
              />
              <SimulationResultCard
                label="Premium"
                value={`${formatINR(Math.round(automatedPremiumAmount))}/week`}
                supporting="Premium recalculates instantly from current live risk inputs."
              />
              <SimulationResultCard
                label="Claim Status"
                value={claimStatusLabel}
                supporting={
                  claimData?.reason ||
                  claimData?.message ||
                  "Claim automation checks high risk, active work, income loss, and duration above 30 minutes."
                }
                toneClassName={claimTriggered ? "text-emerald-700" : "text-slate-900"}
              />
              <SimulationResultCard
                label="Fraud Score"
                value={fraudScore}
                supporting={
                  fraudSnapshot?.reason ||
                  `Fraud Intelligence status: ${fraudStatusLabel}`
                }
                toneClassName={
                  fraudState.tone === "danger"
                    ? "text-red-700"
                    : fraudState.tone === "warning"
                      ? "text-amber-700"
                      : "text-emerald-700"
                }
              />
              <SimulationResultCard
                label="Decision"
                value={decisionLabel}
                supporting={aiDecisionData?.reason || smartDecisionState.summary}
                toneClassName={
                  smartDecisionState.label === "FRAUD"
                    ? "text-red-700"
                    : smartDecisionState.label === "VERIFY"
                      ? "text-amber-700"
                      : "text-emerald-700"
                }
              />
              <SimulationResultCard
                label="Trust Score"
                value={`${trustScore}%`}
                supporting={`User Trust Score: ${trustScore}%`}
                toneClassName={
                  trustScore >= 80
                    ? "text-emerald-700"
                    : trustScore >= 50
                      ? "text-amber-700"
                      : "text-red-700"
                }
              />
            </div>

            <AnimatePresence initial={false}>
              {simulationPanelError ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {simulationPanelError}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600"
                >
                  {systemBusy
                    ? "Processing..."
                    : "Decision updated. The dashboard reflects the latest simulation run."}
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
                      ? "Processing..."
                      : showSuccessState
                        ? "Decision updated"
                        : "Claim status"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {showSuccessState
                      ? "Result highlighted for quick review."
                      : "Claim automation runs only when high risk, active work, income loss, and duration above 30 minutes are confirmed."}
                  </p>
                </div>

                {claimLoading ? (
                  <StatusPill label="Processing..." className="bg-blue-50 text-blue-700" dotClassName="bg-blue-500" />
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

              {claimLoading ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <SurfaceSkeleton className="h-14 w-full" />
                  <SurfaceSkeleton className="h-14 w-full" />
                  <SurfaceSkeleton className="h-14 w-full" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailRow
                    label="Active Work"
                    value={claimData?.eligibility?.activeWorkConfirmed ? "Confirmed" : "Not confirmed"}
                    className={claimData?.eligibility?.activeWorkConfirmed ? "text-emerald-700" : "text-slate-900"}
                  />
                  <DetailRow
                    label="Income Loss"
                    value={claimData?.eligibility?.incomeLossDetected ? "Detected" : "Clear"}
                    className={claimData?.eligibility?.incomeLossDetected ? "text-emerald-700" : "text-slate-900"}
                  />
                  <DetailRow
                    label="Decision"
                    value={claimTriggered ? "Triggered" : "On hold"}
                    className={claimTriggered ? "text-emerald-700" : "text-slate-900"}
                  />
                </div>
              )}

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
              Fraud Intelligence Engine
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Behavior, location, and context are checked in real time.
            </p>
          </div>

          {fraudLoading && !fraudSnapshot ? (
            <StatusPill label="Processing..." className="bg-blue-50 text-blue-700" dotClassName="bg-blue-500" />
          ) : (
            <StatusPill label={fraudState.label} className={fraudState.className} dotClassName={fraudState.dot} />
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Fraud Score
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
                  <DetailRow label="Fraud Score" value={fraudScore} />
                  <DetailRow label="Status" value={fraudState.label} className={fraudState.tone === "danger" ? "text-red-700" : fraudState.tone === "warning" ? "text-amber-700" : "text-emerald-700"} />
                </>
              )}
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Decision Engine
                  </div>
                  <h4 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                    {aiDecisionLoading && !aiDecisionData
                      ? "Processing..."
                      : smartDecisionState.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {aiDecisionLoading && !aiDecisionData
                      ? "Decision Engine Running"
                      : aiDecisionData?.reason || smartDecisionState.summary}
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

              <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Self-Correcting AI System
                    </div>
                    <h5 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                      AI Decision Lifecycle
                    </h5>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Our system not only detects problems, it validates and corrects decisions.
                    </p>
                  </div>

                  <StatusPill
                    label="Adaptive"
                    className="bg-blue-50 text-blue-700"
                    dotClassName="bg-blue-500"
                  />
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-4 sm:grid-cols-2">
                  {lifecycleSteps.map((step, index) => (
                    <LifecycleStepCard key={step.key} index={index} step={step} />
                  ))}
                </div>
              </div>

              {showDisputeOption ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Not satisfied with this decision?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Start the Self-Correcting AI System flow by raising a dispute and uploading proof.
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
                        Decision updated. Please upload proof to continue.
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
                            Verification in progress
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
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Decision updated
                          </div>
                          <p
                            className={cn(
                              "mt-2 text-sm font-semibold",
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
                      Decision updated
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
