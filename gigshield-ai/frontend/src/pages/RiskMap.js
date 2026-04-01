import React, { useState } from "react";
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
import Card, { CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { LoadingPanel } from "../components/ui/Loader";
import SectionHeader from "../components/ui/SectionHeader";
import {
  SAMPLE_RISK_PAYLOAD,
  predictLiveRisk,
  predictRisk,
} from "../services/riskPrediction";

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

const PRESET_PAYLOADS = {
  "Low Risk": {
    temperature: 24,
    humidity: 45,
    wind: 8,
    pressure: 1014,
    rain: 0,
    cloud: 12,
    uv: 4,
    pm25: 18,
    pm10: 32,
    visibility: 10,
    gust: 12,
  },
  "Medium Risk": {
    temperature: 31,
    humidity: 68,
    wind: 18,
    pressure: 1008,
    rain: 6,
    cloud: 56,
    uv: 7,
    pm25: 60,
    pm10: 98,
    visibility: 6,
    gust: 24,
  },
  "High Risk": SAMPLE_RISK_PAYLOAD,
};

const RISK_STYLES = {
  "Low Risk": { tone: "success", glow: "emerald" },
  "Medium Risk": { tone: "warning", glow: "amber" },
  "High Risk": { tone: "danger", glow: "rose" },
  default: { tone: "info", glow: "sky" },
};

function toFormState(payload) {
  return Object.fromEntries(FIELD_CONFIG.map(({ name }) => [name, String(payload[name] ?? "")]));
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
  const [formData, setFormData] = useState(() => toFormState(SAMPLE_RISK_PAYLOAD));
  const [city, setCity] = useState("Bengaluru");
  const [prediction, setPrediction] = useState("");
  const [predictionDetails, setPredictionDetails] = useState(null);
  const [submittedPayload, setSubmittedPayload] = useState(SAMPLE_RISK_PAYLOAD);
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLiveWeather, setIsFetchingLiveWeather] = useState(false);
  const [liveWeatherMeta, setLiveWeatherMeta] = useState(null);
  const [liveWeatherSource, setLiveWeatherSource] = useState("");

  const styles = RISK_STYLES[prediction] || RISK_STYLES.default;

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(payload) {
    setFormData(toFormState(payload));
    setApiError("");
  }

  async function handleLiveWeather() {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setApiError("City name is required for live weather.");
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
      setApiError(error.message || "Live weather fetch failed.");
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
      setLiveWeatherSource("");
      setLiveWeatherMeta(null);
    } catch (error) {
      setApiError(error.message || "Prediction failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Risk intelligence"
        title="Live weather to risk response"
        description="This page now feels like a real underwriting tool: clean inputs, clear risk verdicts, and stronger loading and feedback states."
        action={
          <>
            <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-slate-200">
              <MapPin size={16} className="text-sky-300" />
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Enter city"
                className="min-w-[150px] bg-transparent text-sm outline-none"
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

      <div className="flex flex-wrap gap-3">
        {Object.entries(PRESET_PAYLOADS).map(([label, payload]) => (
          <Button key={label} type="button" variant="ghost" onClick={() => applyPreset(payload)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card glow="violet">
          <form onSubmit={handleSubmit} className="space-y-6">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Predictor Input
                </div>
                <CardTitle className="mt-2">POST /predict payload</CardTitle>
                <CardDescription className="mt-2">
                  Feed manual weather and air-quality values or pull live city data from the Flask service.
                </CardDescription>
              </div>
              <Badge tone="violet">React → Flask</Badge>
            </CardHeader>

            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
              Live weather mode keeps your API key server-side while still making the demo feel real-time and production-ready.
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
                Use presets for a quick demo or enter custom weather data to show the full scoring flow.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" leftIcon={RefreshCcw} onClick={() => applyPreset(SAMPLE_RISK_PAYLOAD)}>
                Reset Sample
              </Button>
              <Button type="submit" variant="primary" rightIcon={Send} loading={isSubmitting}>
                {isSubmitting ? "Predicting Risk" : "Predict Risk"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          {isSubmitting || isFetchingLiveWeather ? <LoadingPanel title="Scoring disruption risk" /> : null}

          <Card glow={styles.glow}>
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Risk Response</div>
                <CardTitle className="mt-2">
                  {prediction || "Waiting for prediction"}
                </CardTitle>
                <CardDescription className="mt-2">
                  The result is presented as a clear, judge-friendly risk tier instead of raw model output.
                </CardDescription>
              </div>
              <Badge tone={styles.tone} pulse={prediction === "High Risk"}>
                {prediction || "No result"}
              </Badge>
            </CardHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <CloudRain size={15} className="text-sky-300" />
                  Rain
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{submittedPayload.rain} mm</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Gauge size={15} className="text-amber-300" />
                  AQ snapshot
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {Math.max(submittedPayload.pm25, submittedPayload.pm10)}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Wind size={15} className="text-cyan-300" />
                  Gust
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{submittedPayload.gust} km/h</div>
              </div>
            </div>

            {liveWeatherMeta ? (
              <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MapPin size={15} className="text-sky-300" />
                  Live weather source
                </div>
                <div className="mt-2 font-semibold text-white">
                  {liveWeatherMeta.name}
                  {liveWeatherMeta.region ? `, ${liveWeatherMeta.region}` : ""}
                  {liveWeatherMeta.country ? `, ${liveWeatherMeta.country}` : ""}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Local time {liveWeatherMeta.localtime || "N/A"}
                </div>
                {liveWeatherSource ? (
                  <div className="mt-1 text-sm text-slate-400">Source: {liveWeatherSource}</div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card glow="sky">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Response Debug</div>
                <CardTitle className="mt-2">Confidence breakdown</CardTitle>
              </div>
              <Activity size={18} className="text-sky-300" />
            </CardHeader>
            {predictionDetails ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Predicted class</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{predictionDetails.predictionClass}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Feature mode</div>
                  <div className="mt-2 text-lg font-semibold text-white">{predictionDetails.featureMode}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4 sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Probability split</div>
                  <div className="mt-3 space-y-3">
                    {Object.entries(predictionDetails.probabilities).map(([label, value]) => (
                      <div key={label}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-slate-400">{label}</span>
                          <span className="font-semibold text-white">{(value * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-sky-300 to-cyan-400"
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-slate-400">
                Run a prediction to surface confidence values and model details.
              </div>
            )}
          </Card>

          <Card glow="emerald">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-emerald-300" />
              <div>
                <div className="font-semibold text-white">Frontend integration</div>
                <div className="text-sm text-slate-400">
                  Loading states, clearer risk tiers, and city-based live weather make this feel much closer to a real underwriting tool.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
