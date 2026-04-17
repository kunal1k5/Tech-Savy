import React, { useEffect, useMemo, useState } from "react";
import CountUp from "react-countup";
import {
  Activity,
  CloudRain,
  Gauge,
  MapPin,
  RefreshCcw,
  Send,
  ShieldCheck,
  Wind,
} from "lucide-react";
import AnimatedPipeline from "../components/ui/AnimatedPipeline";
import Card, { CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { LoadingPanel } from "../components/ui/Loader";
import SectionHeader from "../components/ui/SectionHeader";
import { useGigPredictAIData } from "../context/GigPredictAIDataContext";
import { predictLiveRisk, predictRisk } from "../services/riskPrediction";
import { getUserFromToken } from "../utils/auth";

const FIELD_CONFIG = [
  { name: "temperature", label: "Temperature", unit: "C" },
  { name: "humidity", label: "Humidity", unit: "%" },
  { name: "wind", label: "Wind", unit: "km/h" },
  { name: "pressure", label: "Pressure", unit: "hPa" },
  { name: "rain", label: "Rain", unit: "mm" },
  { name: "cloud", label: "Cloud", unit: "%" },
  { name: "uv", label: "UV", unit: "index" },
  { name: "pm25", label: "PM2.5", unit: "ug/m3" },
  { name: "pm10", label: "PM10", unit: "ug/m3" },
  { name: "visibility", label: "Visibility", unit: "km" },
  { name: "gust", label: "Gust", unit: "km/h" },
];

const RISK_STYLES = {
  LOW: { tone: "success", glow: "emerald", text: "text-emerald-200" },
  MEDIUM: { tone: "warning", glow: "amber", text: "text-amber-200" },
  HIGH: { tone: "danger", glow: "rose", text: "text-rose-200" },
  default: { tone: "info", glow: "sky" },
};

const FLOW_STEPS = ["Weather", "Risk", "Trigger", "Claim", "Fraud", "Decision"];

const ACTIVE_POLICIES = ["Rain policy", "AQI policy", "Demand policy"];

const TRIGGER_THRESHOLDS = {
  rain: 50,
  aqi: 150,
};

function toDisplayLocation(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1).toLowerCase()}`)
    .join(" ");
}

function normalizeRiskLevel(prediction) {
  const normalized = String(prediction || "").trim().toLowerCase();

  if (normalized.includes("high")) {
    return "HIGH";
  }

  if (normalized.includes("medium")) {
    return "MEDIUM";
  }

  return "LOW";
}

function getProbabilityFromPrediction(riskLevel) {
  if (riskLevel === "HIGH") {
    return 84;
  }

  if (riskLevel === "MEDIUM") {
    return 58;
  }

  return 18;
}

function getClaimProbability(predictionDetails, riskLevel) {
  const probabilityEntries = Object.entries(predictionDetails?.probabilities || {});

  if (!probabilityEntries.length) {
    return getProbabilityFromPrediction(riskLevel);
  }

  const highRiskEntry = probabilityEntries.find(([label]) =>
    String(label || "").toLowerCase().includes("high")
  );

  if (highRiskEntry) {
    return Math.round(Number(highRiskEntry[1] || 0) * 100);
  }

  const bestProbability = probabilityEntries.reduce(
    (maxValue, [, value]) => Math.max(maxValue, Number(value || 0)),
    0
  );

  return Math.round(bestProbability * 100);
}

function getConfidenceValue(predictionDetails) {
  const probabilityValues = Object.values(predictionDetails?.probabilities || {}).map((value) =>
    Number(value || 0)
  );

  if (!probabilityValues.length) {
    return 92;
  }

  return Math.max(1, Math.min(99, Math.round(Math.max(...probabilityValues) * 100)));
}

function buildRiskExplanation({ rainValue, aqiValue, riskLevel, triggerStatus }) {
  const normalizedRain = Number.isFinite(Number(rainValue)) ? Math.round(Number(rainValue)) : 0;
  const normalizedAqi = Number.isFinite(Number(aqiValue)) ? Math.round(Number(aqiValue)) : 0;

  if (triggerStatus === "ACTIVE") {
    return `Rain (${normalizedRain}mm) and AQI (${normalizedAqi}) exceed safe thresholds, increasing risk level to ${riskLevel} and triggering potential claim conditions.`;
  }

  return `Current rain (${normalizedRain}mm) and AQI (${normalizedAqi}) readings remain within safe ranges, so trigger conditions are idle and no immediate claim is expected.`;
}

function buildRiskTrend(probability, riskLevel) {
  const base = Number.isFinite(Number(probability)) ? Number(probability) : 35;
  const amplitude = riskLevel === "HIGH" ? 16 : riskLevel === "MEDIUM" ? 12 : 8;

  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(index / 2.8) * amplitude;
    const drift = index > 18 ? 4 : 0;
    const value = Math.max(5, Math.min(98, Math.round(base + wave + drift)));
    return value;
  });
}

function toFormState(payload) {
  return Object.fromEntries(FIELD_CONFIG.map(({ name }) => [name, String(payload[name] ?? "")]));
}

function createEmptyFormState() {
  return Object.fromEntries(FIELD_CONFIG.map(({ name }) => [name, ""]));
}

function toNumericPayload(formData) {
  const payload = {};

  for (const field of FIELD_CONFIG) {
    const rawValue = formData[field.name]?.trim();

    if (!rawValue) {
      throw new Error(`${field.label} is required.`);
    }

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      throw new Error(`${field.label} must be numeric.`);
    }

    payload[field.name] = numericValue;
  }

  return payload;
}

export default function RiskMap() {
  const { platformState } = useGigPredictAIData();
  const profileCity = useMemo(() => {
    const sessionUser = getUserFromToken();
    return sessionUser?.city || platformState.worker.city || "Bengaluru";
  }, [platformState.worker.city]);
  const [formData, setFormData] = useState(createEmptyFormState);
  const [city, setCity] = useState(profileCity);
  const [prediction, setPrediction] = useState("");
  const [predictionDetails, setPredictionDetails] = useState(null);
  const [submittedPayload, setSubmittedPayload] = useState(null);
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLiveWeather, setIsFetchingLiveWeather] = useState(false);
  const [liveDataMode, setLiveDataMode] = useState(true);
  const [liveWeatherMeta, setLiveWeatherMeta] = useState(null);
  const [liveWeatherSource, setLiveWeatherSource] = useState("");
  const [isSimulatingImpact, setIsSimulatingImpact] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const hasAnalysis = Boolean(prediction || submittedPayload);
  const riskLevel = normalizeRiskLevel(prediction);
  const claimProbability = hasAnalysis ? getClaimProbability(predictionDetails, riskLevel) : 12;
  const rainTriggerActive = hasAnalysis && Number(submittedPayload?.rain || 0) > TRIGGER_THRESHOLDS.rain;
  const aqiTriggerActive = hasAnalysis && Number(submittedPayload ? Math.max(submittedPayload.pm25, submittedPayload.pm10) : 0) > TRIGGER_THRESHOLDS.aqi;
  const triggerStatus = rainTriggerActive || aqiTriggerActive ? "ACTIVE" : "IDLE";
  const confidenceValue = hasAnalysis ? getConfidenceValue(predictionDetails) : 92;
  const styles = RISK_STYLES[riskLevel] || RISK_STYLES.default;
  const displayLocation = toDisplayLocation(liveWeatherMeta?.name || city || profileCity);
  const aqiSignal = submittedPayload ? Math.max(submittedPayload.pm25, submittedPayload.pm10) : 0;
  const riskTrend = useMemo(() => buildRiskTrend(claimProbability, riskLevel), [claimProbability, riskLevel]);
  const dataSourceLabel = liveDataMode && liveWeatherSource ? "Live API" : "Simulated";
  const highRiskAlert = riskLevel === "HIGH" || claimProbability >= 75;
  const pipelineActiveIndex = !hasAnalysis
    ? 1
    : simulationResult?.claimGenerated
      ? 5
      : triggerStatus === "ACTIVE"
        ? 3
        : 2;
  const pipelineFlowSteps = FLOW_STEPS.map((step, index) => ({
    key: step.toLowerCase(),
    label: step,
    active: index <= pipelineActiveIndex,
  }));
  const riskExplanation = buildRiskExplanation({
    rainValue: submittedPayload?.rain ?? 0,
    aqiValue: aqiSignal,
    riskLevel,
    triggerStatus,
  });

  useEffect(() => {
    setCity(profileCity);
  }, [profileCity]);

  useEffect(() => {
    if (!liveDataMode) {
      return undefined;
    }

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void handleLiveWeather({ cityOverride: trimmedCity, silentError: true });
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [city, liveDataMode]);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setFormData(createEmptyFormState());
    setSubmittedPayload(null);
    setPrediction("");
    setPredictionDetails(null);
    setLiveWeatherSource("");
    setLiveWeatherMeta(null);
    setSimulationResult(null);
    setApiError("");
  }

  async function handleSimulateImpact() {
    setIsSimulatingImpact(true);

    window.setTimeout(() => {
      const claimGenerated = rainTriggerActive || aqiTriggerActive;
      const payout = rainTriggerActive ? 500 : aqiTriggerActive ? 300 : 0;
      const fraudDecision = !claimGenerated
        ? "No claim"
        : riskLevel === "HIGH" && confidenceValue < 85
          ? "Under AI Review"
          : "Approved";

      setSimulationResult({
        claimGenerated,
        payout,
        fraudDecision,
      });
      setIsSimulatingImpact(false);
    }, 500);
  }

  async function handleLiveWeather(options = {}) {
    const trimmedCity = String(options.cityOverride || city || "").trim();
    if (!trimmedCity) {
      if (!options.silentError) {
        setApiError("City name is required for live weather.");
      }
      return;
    }

    setIsFetchingLiveWeather(true);
    setApiError("");

    try {
      const response = await predictLiveRisk(trimmedCity);
      setFormData(toFormState(response.weather));
      setSubmittedPayload(response.weather);
      setPrediction(response.risk);
      setPredictionDetails({
        predictionClass: response.prediction_class,
        probabilities: response.probabilities || {},
        featureMode: response.feature_mode || "direct",
      });
      setLiveWeatherMeta(response.resolved_location);
      setLiveWeatherSource(response.source || "");
    } catch (error) {
      if (!options.silentError) {
        setApiError(error.message || "Live weather fetch failed.");
      }
    } finally {
      setIsFetchingLiveWeather(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setApiError("");

    try {
      const payload = toNumericPayload(formData);
      const response = await predictRisk(payload);
      setPrediction(response.risk);
      setSubmittedPayload(payload);
      setPredictionDetails({
        predictionClass: response.prediction_class,
        probabilities: response.probabilities || {},
        featureMode: response.feature_mode || "direct",
      });
      if (!liveDataMode) {
        setLiveWeatherSource("");
        setLiveWeatherMeta(null);
      }
    } catch (error) {
      setApiError(error.message || "Prediction failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="gigpredict-page">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_18%),radial-gradient(circle_at_top_right,rgba(167,139,250,0.14),transparent_18%),linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:p-8">
        <SectionHeader
          eyebrow="Risk intelligence"
          title="Real-Time Risk Intelligence Engine"
          description="Analyze live environmental conditions to determine insurance risk levels and trigger potential claims."
          action={
            <>
              <Badge tone="success" dot={false}>
                Monitoring Live 🟢
              </Badge>
              <Badge
                tone={isSubmitting || isFetchingLiveWeather ? "warning" : "info"}
                dot={false}
                pulse={isSubmitting || isFetchingLiveWeather}
              >
                Risk Updating ⚡
              </Badge>
              <Badge tone={dataSourceLabel === "Live API" ? "info" : "warning"} dot={false}>
                {dataSourceLabel}
              </Badge>
              <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-slate-200">
                <MapPin size={16} className="text-sky-300" />
                <input
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Enter city"
                  className="min-w-[150px] bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={isFetchingLiveWeather}
                onClick={handleLiveWeather}
              >
                {isFetchingLiveWeather ? "Fetching Live Weather" : "Use Live Weather"}
              </Button>
            </>
          }
        />

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step 1</div>
            <div className="mt-2 font-semibold text-white">Live Risk Input</div>
            <div className="mt-1 text-sm text-slate-400">Capture live weather signals or manually simulate high-risk scenarios.</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step 2</div>
            <div className="mt-2 font-semibold text-white">AI Risk Analysis</div>
            <div className="mt-1 text-sm text-slate-400">Analyze claim probability and trigger readiness with AI-driven scoring.</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step 3</div>
            <div className="mt-2 font-semibold text-white">Claim Readiness</div>
            <div className="mt-1 text-sm text-slate-400">Track whether current risk can activate policy trigger and payout flow.</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card glow="violet">
          <form onSubmit={handleSubmit} className="space-y-6">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Live Risk Inputs
                </div>
                <CardTitle className="mt-2">Live Risk Input</CardTitle>
                <CardDescription className="mt-2">
                  Use real-time weather or manually adjust values to simulate risk conditions.
                </CardDescription>
              </div>
              <Badge tone="violet" dot={false}>AI Risk Analysis</Badge>
            </CardHeader>

            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Live Data Mode ({liveDataMode ? "ON" : "OFF"})</p>
                  <p className="mt-1 text-emerald-100/80">When ON, inputs auto-fill from live API weather signals.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveDataMode((current) => !current)}
                  className="rounded-full border border-emerald-200/40 bg-emerald-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-50"
                >
                  {liveDataMode ? "ON" : "OFF"}
                </button>
              </div>
              <p className="mt-3 text-sm">Location: {displayLocation || "Bengaluru"}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {FIELD_CONFIG.map((field) => (
                <label
                  key={field.name}
                  className="rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3"
                >
                  <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {field.label}
                  </span>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      step="any"
                      value={formData[field.name]}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      className="w-full bg-transparent text-base text-white outline-none"
                      placeholder="0"
                    />
                    <span className="whitespace-nowrap text-xs text-slate-500">{field.unit}</span>
                  </div>
                </label>
              ))}
            </div>

            {apiError ? (
              <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {apiError}
              </div>
            ) : (
              <div className="rounded-[22px] border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                Use real-time or manual values to run insurance risk analysis for trigger readiness.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" leftIcon={RefreshCcw} onClick={resetForm}>
                Reset Form
              </Button>
              <Button type="submit" variant="primary" rightIcon={Send} loading={isSubmitting}>
                {isSubmitting ? "Analyzing Risk" : "Analyze Risk"}
              </Button>
            </div>
          </form>
          </Card>

          <div className="space-y-6">
          {isSubmitting || isFetchingLiveWeather ? <LoadingPanel title="Updating risk intelligence" /> : null}

            <Card glow={styles.glow}>
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">AI Risk Analysis</div>
                <CardTitle className="mt-2">Risk Analysis Result</CardTitle>
                <CardDescription className="mt-2">
                  Live risk analysis maps environmental conditions to policy trigger and claim readiness.
                </CardDescription>
              </div>
              <Badge tone={styles.tone} pulse={riskLevel === "HIGH"} dot={false}>
                {riskLevel}
              </Badge>
            </CardHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldCheck size={15} className="text-emerald-300" />
                  Risk Level
                </div>
                <div className={`mt-3 text-2xl font-semibold ${styles.text || "text-white"}`}>
                  {riskLevel}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Gauge size={15} className="text-amber-300" />
                  Claim Probability
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  <CountUp end={claimProbability} duration={0.9} suffix="%" preserveValue />
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Activity size={15} className="text-cyan-300" />
                  Trigger Status
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {triggerStatus}
                </div>
              </div>
            </div>

            {!hasAnalysis ? (
              <div className="mt-4 rounded-xl border border-sky-300/25 bg-sky-400/10 px-4 py-4 text-sky-100">
                <p className="text-sm font-semibold">Analyzing live signals...</p>
                <div className="mt-3 space-y-2">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(125,211,252,0.18),rgba(56,189,248,0.45),rgba(125,211,252,0.18))] bg-[length:200%_100%] animate-shimmer" />
                  <div className="h-2 w-4/5 rounded-full bg-[linear-gradient(90deg,rgba(125,211,252,0.16),rgba(56,189,248,0.38),rgba(125,211,252,0.16))] bg-[length:200%_100%] animate-shimmer" />
                </div>
              </div>
            ) : null}

            {highRiskAlert ? (
              <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
                ⚠ High risk detected — potential claims incoming
              </div>
            ) : null}

            <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Visual Risk Indicator</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Low", tone: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30", active: riskLevel === "LOW" },
                  { label: "Medium", tone: "bg-amber-500/20 text-amber-200 border-amber-400/30", active: riskLevel === "MEDIUM" },
                  { label: "High", tone: "bg-rose-500/20 text-rose-200 border-rose-400/30", active: riskLevel === "HIGH" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold ${item.tone} ${
                      item.active ? "ring-2 ring-white/20" : "opacity-70"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CloudRain size={15} className="text-sky-300" />
                Rain
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {submittedPayload?.rain ?? "-"} mm
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <Wind size={15} className="text-cyan-300" />
                AQI (PM Snapshot)
              </div>
              <div className="mt-1 text-base font-semibold text-white">{submittedPayload ? aqiSignal : "-"}</div>
              <div className="mt-3 text-sm font-semibold text-white">Location: {displayLocation || "Bengaluru"}</div>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
                {triggerStatus === "ACTIVE"
                  ? "If current conditions continue → Claim will be triggered"
                  : "Conditions safe → No claim expected"}
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                If rain exceeds threshold → ₹500 claim will be generated
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-sm font-semibold text-white">Trigger Status</p>
                <div className="mt-2 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Rain Trigger →</span>
                    <span className="font-semibold text-white">{rainTriggerActive ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>AQI Trigger →</span>
                    <span className="font-semibold text-white">{aqiTriggerActive ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-sm font-semibold text-white">This location has 3 active policies</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACTIVE_POLICIES.map((policy) => (
                    <span
                      key={policy}
                      className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200"
                    >
                      {policy}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <AnimatedPipeline
                  steps={pipelineFlowSteps}
                  activeIndex={pipelineActiveIndex}
                  variant="dark"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSimulateImpact}
                  loading={isSimulatingImpact}
                >
                  {isSimulatingImpact ? "Simulating Impact" : "Simulate Impact"}
                </Button>
              </div>

              {simulationResult ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                  <p className="font-semibold text-white">Simulation Result</p>
                  <p className="mt-2">
                    Claim Generated: {simulationResult.claimGenerated ? "Yes" : "No"}
                  </p>
                  <p className="mt-1">Payout: ₹{simulationResult.payout}</p>
                  <p className="mt-1">Fraud Decision: {simulationResult.fraudDecision}</p>
                </div>
              ) : null}
            </div>
            </Card>

            <Card glow="violet">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Historical Risk</div>
                <CardTitle className="mt-2">Past 24h risk trend</CardTitle>
                <CardDescription className="mt-2">
                  Trend reflects how risk has evolved in the last 24 hours for this location.
                </CardDescription>
              </div>
              <Activity size={18} className="text-violet-300" />
            </CardHeader>

            <div className="mt-3 flex items-end gap-1">
              {riskTrend.map((point, index) => (
                <div
                  key={`${index}-${point}`}
                  className={`h-16 w-[10px] rounded-t ${
                    point >= 70
                      ? "bg-rose-400/70"
                      : point >= 40
                        ? "bg-amber-400/70"
                        : "bg-emerald-400/70"
                  }`}
                  style={{ height: `${Math.max(10, Math.round(point * 0.7))}px` }}
                  title={`Hour ${index + 1}: ${point}%`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <span>24h ago</span>
              <span>Now</span>
            </div>
            </Card>

            <Card glow="sky">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">AI Risk Analysis</div>
                <CardTitle className="mt-2">AI Confidence Level</CardTitle>
              </div>
              <Gauge size={18} className="text-sky-300" />
            </CardHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">AI Confidence Level</div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  Prediction Confidence: <CountUp end={confidenceValue} duration={0.9} suffix="%" preserveValue />
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Claim Readiness</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {triggerStatus === "ACTIVE" ? "High trigger readiness" : "Low trigger readiness"}
                </div>
              </div>
            </div>
            </Card>

            <Card glow="emerald">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-emerald-300" />
              <div>
                <div className="font-semibold text-white">AI Risk Explanation</div>
                <div className="mt-1 text-sm text-slate-300">
                  {riskExplanation}
                </div>
                {liveWeatherSource ? (
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200/80">
                    Live Source: {liveWeatherSource}
                  </div>
                ) : null}
              </div>
            </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
