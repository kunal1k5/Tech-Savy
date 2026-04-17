import React, { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  CloudRain,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Wind,
  Wallet,
  Zap,
} from "lucide-react";
import AnimatedPipeline from "../components/ui/AnimatedPipeline";
import InfoTooltip from "../components/ui/InfoTooltip";
import SurfaceButton from "../components/ui/SurfaceButton";
import SystemStatusBar from "../components/ui/SystemStatusBar";
import { useGigPredictAIData } from "../context/GigPredictAIDataContext";
import useLiveBackendData from "../hooks/useLiveBackendData";
import {
  DEFAULT_DEMO_SIMULATION_INPUT,
  DEFAULT_RISK_PREMIUM_INPUT,
  extractApiErrorMessage,
  getActiveTriggers,
  getAiDecision,
  getAutoClaim,
  getFraudStatus,
  getRiskPremium,
  reverifyClaim,
  runDemoSimulation,
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
const DEFAULT_PIPELINE_SIMULATION_FORM = Object.freeze({
  ...DEFAULT_DEMO_SIMULATION_INPUT,
});
const PIPELINE_TIME_OPTIONS = Object.freeze([
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
  { label: "Night", value: "night" },
]);

const AUTO_CLAIM_STEPS = ["CREATED", "PROCESSING", "PAID"];
const DEFAULT_HOURLY_RATE = 150;
const DEFAULT_DISPUTE_REASON = "System failed to detect actual issue";
const AI_LIFECYCLE_STEPS = [
  {
    key: "detect",
    label: "Detect",
    note: "Real-time trigger monitoring watches weather, AQI, and activity signals.",
  },
  {
    key: "decide",
    label: "Decide",
    note: "AI fraud decision classifies claim risk and selects the next action.",
  },
  {
    key: "validate",
    label: "Validate",
    note: "Auto claim validation checks proof, behavior, and location context.",
  },
  {
    key: "correct",
    label: "Correct",
    note: "AI re-verification finalizes payout and claim state in real time.",
  },
];
const LIVE_SIGNAL_DEFAULTS = Object.freeze({
  rain: 18,
  aqi: 140,
  location: "Mathura",
  rainThreshold: 40,
  aqiThreshold: 150,
});

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

function getRiskConditionLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "HIGH") {
    return "High Alert";
  }

  if (normalized === "MEDIUM") {
    return "Watch Conditions";
  }

  return "Safe Conditions";
}

function getFraudRiskLevel(status) {
  const normalized = String(status || "SAFE").trim().toUpperCase();
  if (normalized === "FRAUD") {
    return "HIGH";
  }

  if (normalized === "WARNING") {
    return "MEDIUM";
  }

  return "LOW";
}

function getDecisionConfidence(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return "HIGH";
  }

  if (numericScore > 65) {
    return "LOW";
  }

  if (numericScore > 30) {
    return "MEDIUM";
  }

  return "HIGH";
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
      whileHover={hover ? { y: -4, scale: 1.015 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_4%_0%,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.07)] transition-[border-color,box-shadow,transform] duration-300 hover:border-slate-300 hover:shadow-[0_28px_52px_rgba(15,23,42,0.1)]",
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
  labelTooltip,
  value,
  supporting,
  loading = false,
  iconClassName = "bg-blue-50 text-blue-600",
  valueClassName = "text-slate-900",
  pulse = false,
}) {
  return (
    <DashboardCard
      className={cn("group relative min-w-0 overflow-hidden md:min-h-[168px]", pulse && "ring-4")}
      hover
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <span>{label}</span>
            {labelTooltip ? <InfoTooltip label={`${label} info`} text={labelTooltip} /> : null}
          </p>
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
  const [triggerFeed, setTriggerFeed] = useState({ triggers: [], signals: null, evaluatedAt: null });
  const [triggerLoading, setTriggerLoading] = useState(true);
  const [triggerError, setTriggerError] = useState("");
  const [pipelineSimulationForm, setPipelineSimulationForm] = useState({
    ...DEFAULT_PIPELINE_SIMULATION_FORM,
  });
  const [pipelineSimulationResult, setPipelineSimulationResult] = useState(null);
  const [pipelineSimulationLoading, setPipelineSimulationLoading] = useState(false);
  const [pipelineSimulationError, setPipelineSimulationError] = useState("");
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

  async function loadTriggerFeed({ silent = false } = {}) {
    if (!silent) {
      setTriggerLoading(true);
    }

    try {
      const data = await getActiveTriggers();

      if (!mountedRef.current) {
        return;
      }

      setTriggerFeed({
        triggers: Array.isArray(data?.triggers) ? data.triggers : [],
        signals: data?.signals || null,
        evaluatedAt: data?.evaluatedAt || null,
      });
      setTriggerError("");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setTriggerError(extractApiErrorMessage(error, "Unable to fetch trigger feed."));
    } finally {
      if (!mountedRef.current) {
        return;
      }

      setTriggerLoading(false);
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

  function updatePipelineSimulationField(field, value, limits = {}) {
    setPipelineSimulationForm((current) => ({
      ...current,
      [field]:
        typeof value === "number"
          ? value
          : typeof value === "string" && field === "time"
            ? value
            : clampNumber(value, limits.min ?? 0, limits.max ?? 500),
    }));
  }

  async function runPipelineSimulation(formInput = pipelineSimulationForm) {
    const payload = {
      rain: clampNumber(formInput?.rain, 0, 300),
      aqi: clampNumber(formInput?.aqi, 0, 500),
      demand: clampNumber(formInput?.demand, 0, 100),
      time: String(formInput?.time || "morning"),
    };

    setPipelineSimulationLoading(true);
    setPipelineSimulationError("");

    try {
      const result = await runDemoSimulation(payload);

      if (!mountedRef.current) {
        return;
      }

      setPipelineSimulationResult(result);
      setPipelineSimulationForm(payload);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setPipelineSimulationResult(null);
      setPipelineSimulationError(
        extractApiErrorMessage(error, "Unable to run full simulation right now.")
      );
    } finally {
      if (!mountedRef.current) {
        return;
      }

      setPipelineSimulationLoading(false);
    }
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

  async function handleRunPipelineSimulation() {
    await runPipelineSimulation(pipelineSimulationForm);
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
    loadTriggerFeed();
    runPipelineSimulation(DEFAULT_PIPELINE_SIMULATION_FORM);

    const triggerInterval = setInterval(() => {
      loadTriggerFeed({ silent: true });
    }, 12000);

    return () => {
      mountedRef.current = false;
      clearInterval(triggerInterval);
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
  const claimStatusLabel = formatSignalLabel(claimStatus || (claimTriggered ? "PAID" : "NOT GENERATED"));
  const claimStatusDisplay = claimTriggered
    ? "Claim Status: AUTO GENERATED"
    : "Claim Status: NOT GENERATED";
  const claimReasonText =
    claimData?.reason ||
    claimData?.message ||
    "Auto-triggered based on real conditions";
  const fraudStatusLabel = formatSignalLabel(fraudState.label);
  const fraudRiskLevel = getFraudRiskLevel(fraudState.label);
  const decisionConfidence = getDecisionConfidence(fraudScore);
  const trustScoreSnapshot = aiDecisionData || fraudSnapshot;
  const simulationPanelError = riskError || claimError || fraudPanelError;
  const decisionLabel = formatSignalLabel(smartDecisionState.label);
  const activeTriggers = triggerFeed.triggers;
  const liveRainValue = Number(triggerFeed.signals?.rain ?? triggerFeed.signals?.rainfall ?? 0);
  const liveAqiValue = Number(triggerFeed.signals?.aqi ?? 0);
  const liveTriggerStatus =
    triggerFeed.signals?.triggerStatus || (activeTriggers.length ? "TRIGGERED" : "IDLE");
  const hasLiveSignals = Boolean(triggerFeed.signals);
  const liveRainSignal = hasLiveSignals ? liveRainValue : LIVE_SIGNAL_DEFAULTS.rain;
  const liveAqiSignal = hasLiveSignals ? liveAqiValue : LIVE_SIGNAL_DEFAULTS.aqi;
  const liveLocationSignal =
    triggerFeed.signals?.location?.city ||
    LIVE_SIGNAL_DEFAULTS.location;
  const liveSystemStatus = systemBusy || liveBackendRefreshing ? "Monitoring..." : "Monitoring Active";
  const livePipelineTriggerStatus = activeTriggers.length || liveTriggerStatus === "TRIGGERED" ? "ACTIVE" : "IDLE";
  const livePipelineClaimStatus = claimTriggered ? "GENERATED" : "NONE";
  const livePipelineDecisionStatus =
    smartDecisionState.label === "SAFE"
      ? "APPROVED"
      : smartDecisionState.label === "VERIFY"
        ? "REVIEW"
        : smartDecisionState.label === "FRAUD"
          ? "REJECTED"
          : "PENDING";
  const formattedLiveRain = Number.isFinite(liveRainSignal)
    ? String(Number(liveRainSignal.toFixed(1)))
    : String(LIVE_SIGNAL_DEFAULTS.rain);
  const formattedLiveAqi = Number.isFinite(liveAqiSignal)
    ? String(Math.round(liveAqiSignal))
    : String(LIVE_SIGNAL_DEFAULTS.aqi);
  const riskLevelDisplay = `Risk Level: ${automatedRisk.toUpperCase()} (${getRiskConditionLabel(
    automatedRisk
  )})`;
  const riskSignalSummary = `Rain value: ${formattedLiveRain} mm | AQI value: ${formattedLiveAqi}`;
  const pipelineTriggerActive = Boolean(pipelineSimulationResult?.trigger);
  const pipelineClaimGenerated = Boolean(pipelineSimulationResult?.claimGenerated);
  const pipelineFraudScore = Number(pipelineSimulationResult?.fraudScore ?? 0);
  const pipelinePayout = Number(pipelineSimulationResult?.payout ?? 0);
  const pipelineDecision = String(pipelineSimulationResult?.decision || "Pending");
  const pipelineRiskLevel = formatSignalLabel(pipelineSimulationResult?.riskLevel || "low");
  const pipelineExplanation =
    pipelineSimulationResult?.explanation ||
    "Run Simulation to see why trigger, claim, and fraud decisions happened.";
  const pipelineTriggerClassName = pipelineTriggerActive
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-700";
  const pipelineClaimClassName = pipelineClaimGenerated
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-700";
  const pipelineDecisionClassName =
    pipelineDecision.toLowerCase() === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : pipelineDecision.toLowerCase() === "rejected"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";
  const pipelineFlowSteps = [
    { key: "trigger", label: "Trigger", active: pipelineTriggerActive },
    { key: "claim", label: "Claim", active: pipelineClaimGenerated },
    { key: "fraud", label: "Fraud", active: Boolean(pipelineSimulationResult) },
    {
      key: "decision",
      label: "Decision",
      active: pipelineDecision.toLowerCase() !== "pending",
    },
    { key: "payout", label: "Payout", active: pipelinePayout > 0 },
  ];

  return (
    <motion.div
      className="gigpredict-page max-w-[1320px]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.section variants={itemVariants}>
        <SystemStatusBar
          monitoringLabel={liveSystemStatus}
          engineLabel="Decision Engine Running"
          fraudLabel={fraudState.tone === "danger" ? "Fraud Alert Active" : "Fraud Detection Active"}
          engineBusy={systemBusy || liveBackendRefreshing}
          fraudHighRisk={fraudState.tone === "danger" || Number(fraudScore) > 60}
        />
      </motion.section>

      <motion.section
        variants={itemVariants}
        className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] md:px-6"
      >
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          Live System Signals
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CloudRain size={16} className="text-blue-600" />
              Rain
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              <CountUp
                end={Number(formattedLiveRain)}
                duration={0.9}
                decimals={formattedLiveRain.includes(".") ? 1 : 0}
                formattingFn={(value) => `${value}mm`}
                preserveValue
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Wind size={16} className="text-blue-600" />
              AQI
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              <CountUp
                end={Number(formattedLiveAqi)}
                duration={0.9}
                formattingFn={(value) => `${Math.round(value)}`}
                preserveValue
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <MapPin size={16} className="text-blue-600" />
              Location
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{liveLocationSignal}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Zap size={16} className="text-blue-600" />
              Status
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {liveSystemStatus}
            </div>
          </div>
        </div>
      </motion.section>

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
              AI Insurance Intelligence Control Room
            </h2>
            <p className="text-sm leading-6 text-slate-500 md:text-base">
              Every signal is interpreted in milliseconds to keep claims accurate, fair, and fast.
            </p>
            <p className="text-sm leading-6 text-slate-500 md:text-base">
              Weather, fraud, and claim events are connected in one adaptive decision stream.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Live Pipeline Output
            </div>
            <div className="mt-3 grid gap-2">
              <DetailRow label="Trigger" value={livePipelineTriggerStatus} className={livePipelineTriggerStatus === "ACTIVE" ? "text-emerald-700" : "text-slate-700"} />
              <DetailRow label="Claim" value={livePipelineClaimStatus} className={livePipelineClaimStatus === "GENERATED" ? "text-emerald-700" : "text-slate-700"} />
              <DetailRow
                label={(
                  <span className="inline-flex items-center gap-2">
                    <span>Fraud Score</span>
                    <InfoTooltip
                      label="Fraud score explanation"
                      text="Fraud score combines behavior, location, and claim context. Higher values indicate stronger fraud risk and stricter review."
                    />
                  </span>
                )}
                value={Number(fraudScore).toFixed(2)}
                className={Number(fraudScore) > 30 ? "text-amber-700" : "text-emerald-700"}
              />
              <DetailRow label="Decision" value={livePipelineDecisionStatus} className={livePipelineDecisionStatus === "APPROVED" ? "text-emerald-700" : livePipelineDecisionStatus === "REJECTED" ? "text-red-700" : "text-amber-700"} />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Auto-triggered from real-time risk conditions
            </div>
          </div>
        </div>
      </motion.header>

      <section className="grid gap-5">
        <MetricCard
          icon={Activity}
          label="Risk Engine"
          loading={riskLoading && !riskData}
          value={
            <div className="flex items-center gap-3 text-lg md:text-2xl">
              <span className={cn("h-3 w-3 rounded-full", riskStyle.dot, automatedRisk === "High" && "risk-pulse")} />
              <span className={riskStyle.accent}>{riskLevelDisplay}</span>
            </div>
          }
          supporting={riskSignalSummary}
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
          value={claimStatusDisplay}
          supporting={claimReasonText}
          iconClassName="bg-emerald-50 text-emerald-600"
          valueClassName={claimTriggered ? "text-emerald-700" : "text-slate-900"}
        />

        <MetricCard
          icon={ShieldAlert}
          label="AI Fraud Decision"
          labelTooltip="Fraud score evaluates behavior integrity, location consistency, and claim context confidence."
          loading={fraudLoading && !fraudSnapshot}
          value={
            <span className="inline-flex items-center gap-2">
              <span>Fraud Score:</span>
              <CountUp end={Number(fraudScore)} decimals={2} duration={0.95} preserveValue />
            </span>
          }
          supporting={`Risk Level: ${fraudRiskLevel} | Decision Confidence: ${decisionConfidence}`}
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
          value={<CountUp end={Number(trustScore)} duration={0.9} suffix="%" preserveValue />}
          supporting="Based on behavior, location, and activity signals"
          iconClassName="bg-emerald-50 text-emerald-600"
          valueClassName={trustScore >= 80 ? "text-emerald-700" : trustScore >= 50 ? "text-amber-700" : "text-red-700"}
        />
      </section>

      <DashboardCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Trigger Monitoring</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Live trigger feed
              </h3>
            </div>
            <StatusPill
              label={triggerLoading ? "Refreshing" : "Live"}
              className={triggerLoading ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}
              dotClassName={triggerLoading ? "bg-blue-500" : "bg-emerald-500"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SimulationResultCard
              label="Rain"
              value={`${formattedLiveRain} mm`}
              supporting={`Current vs Threshold: ${formattedLiveRain}mm / ${LIVE_SIGNAL_DEFAULTS.rainThreshold}mm`}
            />
            <SimulationResultCard
              label="AQI"
              value={formattedLiveAqi}
              supporting={`Current vs Threshold: ${formattedLiveAqi} / ${LIVE_SIGNAL_DEFAULTS.aqiThreshold}`}
            />
            <SimulationResultCard
              label="Trigger Status"
              value={livePipelineTriggerStatus}
              supporting={
                activeTriggers.length
                  ? `${activeTriggers.length} active policy trigger(s)`
                  : "No active policy triggers"
              }
              toneClassName={activeTriggers.length ? "text-red-700" : "text-emerald-700"}
            />
          </div>

          {triggerError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {triggerError}
            </div>
          ) : null}

          {!triggerLoading && !activeTriggers.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No claims yet - system is actively monitoring risk conditions
            </div>
          ) : null}

          {activeTriggers.length ? (
            <div className="grid gap-3">
              {activeTriggers.map((trigger) => (
                <div
                  key={trigger.policyId}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-red-800">{trigger.policyName}</p>
                      <p className="mt-1 text-xs font-medium text-red-700">
                        {trigger.triggerType} | Current vs Threshold: {trigger.actualValue} / {trigger.threshold}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-red-700">
                      {trigger.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Simulation Mode</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Full insurance pipeline simulator
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Test how the system behaves under real-world scenarios
              </p>
            </div>

            <StatusPill
              label={pipelineSimulationLoading ? "Running" : "Ready"}
              className={pipelineSimulationLoading ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}
              dotClassName={pipelineSimulationLoading ? "bg-blue-500" : "bg-emerald-500"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <SimulationControlCard label="Rain" value={`${pipelineSimulationForm.rain}`} helper="0 - 300">
              <input
                type="range"
                min="0"
                max="300"
                step="1"
                value={pipelineSimulationForm.rain}
                onChange={(event) =>
                  updatePipelineSimulationField("rain", event.target.value, {
                    min: 0,
                    max: 300,
                  })
                }
                className="h-2 w-full cursor-pointer accent-blue-600"
              />
            </SimulationControlCard>

            <SimulationControlCard label="AQI" value={pipelineSimulationForm.aqi} helper="0 - 500">
              <input
                type="number"
                min="0"
                max="500"
                value={pipelineSimulationForm.aqi}
                onChange={(event) =>
                  updatePipelineSimulationField("aqi", event.target.value, {
                    min: 0,
                    max: 500,
                  })
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </SimulationControlCard>

            <SimulationControlCard
              label="Demand"
              value={`${pipelineSimulationForm.demand}`}
              helper="0 - 100"
            >
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={pipelineSimulationForm.demand}
                onChange={(event) =>
                  updatePipelineSimulationField("demand", event.target.value, {
                    min: 0,
                    max: 100,
                  })
                }
                className="h-2 w-full cursor-pointer accent-blue-600"
              />
            </SimulationControlCard>

            <SimulationControlCard
              label="Time"
              value={formatSignalLabel(pipelineSimulationForm.time)}
              helper="Time slot"
            >
              <select
                value={pipelineSimulationForm.time}
                onChange={(event) =>
                  updatePipelineSimulationField("time", event.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {PIPELINE_TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SimulationControlCard>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <SurfaceButton
              onClick={handleRunPipelineSimulation}
              loading={pipelineSimulationLoading}
              disabled={pipelineSimulationLoading}
              leftIcon={BadgeCheck}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 lg:w-auto"
            >
              Run Simulation
            </SurfaceButton>

            <div className="flex flex-wrap gap-2">
              <StatusPill
                label={`Trigger: ${pipelineTriggerActive ? "Activated" : "Idle"}`}
                className={pipelineTriggerClassName}
                dotClassName={pipelineTriggerActive ? "bg-emerald-500" : "bg-slate-400"}
              />
              <StatusPill
                label={`Claim: ${pipelineClaimGenerated ? "Generated" : "Not Generated"}`}
                className={pipelineClaimClassName}
                dotClassName={pipelineClaimGenerated ? "bg-emerald-500" : "bg-slate-400"}
              />
              <StatusPill
                label={`Decision: ${pipelineDecision}`}
                className={pipelineDecisionClassName}
                dotClassName={
                  pipelineDecision.toLowerCase() === "approved"
                    ? "bg-emerald-500"
                    : pipelineDecision.toLowerCase() === "rejected"
                      ? "bg-red-500"
                      : "bg-amber-500"
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <AnimatedPipeline
              steps={pipelineFlowSteps}
              activeIndex={pipelineFlowSteps.reduce(
                (lastActiveIndex, step, index) => (step.active ? index : lastActiveIndex),
                0
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SimulationResultCard
              label="Trigger Status"
              value={pipelineTriggerActive ? "Activated" : "Inactive"}
              supporting="Checks rain, AQI, and demand thresholds."
              toneClassName={pipelineTriggerActive ? "text-emerald-700" : "text-slate-900"}
            />
            <SimulationResultCard
              label="Claim Generated"
              value={pipelineClaimGenerated ? "Yes" : "No"}
              supporting="Claim is generated only when trigger and payout conditions pass."
              toneClassName={pipelineClaimGenerated ? "text-emerald-700" : "text-slate-900"}
            />
            <SimulationResultCard
              label={
                <span className="inline-flex items-center gap-2">
                  <span>Fraud Score</span>
                  <InfoTooltip
                    label="Simulation fraud score"
                    text="This simulated fraud score is generated from trigger strength, claim validity, and behavior consistency."
                  />
                </span>
              }
              value={pipelineFraudScore.toFixed(2)}
              supporting={`Risk Level: ${pipelineRiskLevel}`}
              toneClassName={
                pipelineFraudScore > 60
                  ? "text-red-700"
                  : pipelineFraudScore > 30
                    ? "text-amber-700"
                    : "text-emerald-700"
              }
            />
            <SimulationResultCard
              label="Decision"
              value={pipelineDecision}
              supporting="AI fraud decision from live trigger and claim context."
              toneClassName={
                pipelineDecision.toLowerCase() === "approved"
                  ? "text-emerald-700"
                  : pipelineDecision.toLowerCase() === "rejected"
                    ? "text-red-700"
                    : "text-amber-700"
              }
            />
            <SimulationResultCard
              label="Final Payout"
              value={formatINR(Math.round(pipelinePayout))}
              supporting="Dynamic payout engine result."
              toneClassName="text-slate-900"
            />
          </div>

          <div className="rounded-2xl border border-blue-300 bg-blue-100 px-4 py-4 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-800">
              AI Decision Explanation
            </p>
            <p className="mt-2 text-sm leading-6 font-medium text-slate-800">{pipelineExplanation}</p>
          </div>

          {pipelineSimulationError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pipelineSimulationError}
            </div>
          ) : null}
        </div>
      </DashboardCard>

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
                  Adjust risk and fraud signals, then run the system to update real-time trigger status, auto claim outputs, AI fraud decisions, and trust score in one pass.
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
                value={claimStatusDisplay}
                supporting={
                  claimData?.reason ||
                  claimData?.message ||
                  "Auto claim checks high risk, active work, income loss, and duration above 30 minutes."
                }
                toneClassName={claimTriggered ? "text-emerald-700" : "text-slate-900"}
              />
              <SimulationResultCard
                label={
                  <span className="inline-flex items-center gap-2">
                    <span>Fraud Score</span>
                    <InfoTooltip
                      label="Live fraud score"
                      text="Live fraud score updates after every simulation run based on behavior, location, and claim evidence."
                    />
                  </span>
                }
                value={fraudScore}
                supporting={
                  fraudSnapshot?.reason ||
                  `AI fraud decision status: ${fraudStatusLabel}`
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
                  <p className="text-sm font-medium text-slate-500">Claim Panel</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    {claimLoading
                      ? "Processing..."
                      : showSuccessState
                        ? "Decision updated"
                        : "Live claim output"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {showSuccessState
                      ? "Result highlighted for quick review."
                      : "Claim Status, payout, and reason are shown from the auto claim engine."}
                  </p>
                </div>

                {claimLoading ? (
                  <StatusPill label="Processing..." className="bg-blue-50 text-blue-700" dotClassName="bg-blue-500" />
                ) : claimStatus ? (
                  <StatusPill label={claimStatusDisplay} className="bg-emerald-50 text-emerald-700" dotClassName="bg-emerald-500" />
                ) : (
                  <StatusPill label={claimStatusDisplay} className="bg-slate-100 text-slate-700" dotClassName="bg-slate-400" />
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
                    label="Claim Status"
                    value={claimStatusDisplay}
                    className={claimTriggered ? "text-emerald-700" : "text-slate-900"}
                  />
                  <DetailRow
                    label="Payout"
                    value={formatINR(Math.round(claimPayout))}
                    className={claimPayout > 0 ? "text-emerald-700" : "text-slate-900"}
                  />
                  <DetailRow
                    label="Reason"
                    value={claimReasonText}
                    className="text-slate-900"
                  />
                </div>
              )}

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Auto-triggered based on real conditions
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
              AI Fraud Decision System
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Behavior, location, and context are checked for AI fraud decisions in real time.
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
                    AI Fraud Decision
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
                        Auto Claim + AI Validation
                    </div>
                    <h5 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                        Real-Time Trigger Lifecycle
                    </h5>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Auto claim, real-time trigger monitoring, and AI fraud decisions run as one connected loop.
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
                    Start the Auto Claim + AI Validation flow by raising a dispute and uploading proof.
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
