import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CloudRain,
  Gauge,
  MapPin,
  RefreshCcw,
  Send,
  ShieldCheck,
  Wind,
} from "lucide-react";
import {
  SAMPLE_RISK_PAYLOAD,
  predictRisk,
  predictLiveRisk,
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
  "Low Risk Sample": {
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
  "Medium Risk Sample": {
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
  "High Risk Sample": SAMPLE_RISK_PAYLOAD,
};

const RISK_STYLES = {
  "Low Risk": {
    panel:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.12)]",
    badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  },
  "Medium Risk": {
    panel:
      "border-amber-500/30 bg-amber-500/10 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.12)]",
    badge: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  },
  "High Risk": {
    panel:
      "border-red-500/35 bg-red-500/10 text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.16)]",
    badge: "bg-red-500/15 text-red-200 border border-red-500/35",
  },
  default: {
    panel: "border-white/10 bg-white/5 text-slate-200",
    badge: "bg-white/5 text-slate-300 border border-white/10",
  },
};

function toFormState(payload) {
  return Object.fromEntries(
    FIELD_CONFIG.map(({ name }) => [name, String(payload[name] ?? "")])
  );
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Risk Response Monitor
            </h1>
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
              React to Flask
            </span>
          </div>
          <p className="text-slate-400 max-w-2xl">
            Send weather and air-quality data to the Flask API, run the
            risk-based service, and surface the returned response tier in the UI.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto xl:items-center">
          <label className="flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-slate-200">
            <MapPin size={16} className="text-blue-300" />
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Enter city"
              className="bg-transparent outline-none min-w-[160px] text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handleLiveWeather}
            disabled={isFetchingLiveWeather}
            className="px-4 py-2 rounded-full text-sm font-medium border border-blue-500/20 text-blue-100 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {isFetchingLiveWeather ? "Fetching live weather..." : "Use Live Weather"}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {Object.entries(PRESET_PAYLOADS).map(([label, payload]) => (
            <button
              key={label}
              type="button"
              onClick={() => applyPreset(payload)}
              className="px-4 py-2 rounded-full text-sm font-medium border border-white/10 text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.4fr_0.9fr] gap-6">
        <form
          onSubmit={handleSubmit}
          className="glass-panel border border-white/10 rounded-3xl p-6 md:p-8 space-y-6"
        >
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Live weather mode:
            <span className="text-emerald-200">
              {" "}city enter karo, phir "Use Live Weather" click karo. Backend weather API se realtime values laakar model ko feed karega.
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">
                Predictor Input
              </p>
              <h2 className="text-xl font-semibold text-white">
                POST /predict payload
              </h2>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => applyPreset(SAMPLE_RISK_PAYLOAD)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <RefreshCcw size={16} />
                Reset Sample
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-[0_10px_30px_rgba(37,99,235,0.25)]"
              >
                <Send size={16} />
                {isSubmitting ? "Predicting..." : "Predict Risk"}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {FIELD_CONFIG.map((field) => (
              <label
                key={field.name}
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {field.label}
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="number"
                    step="any"
                    value={formData[field.name]}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    className="w-full bg-transparent text-white text-base outline-none"
                    placeholder="0"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {field.unit}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {apiError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {apiError}
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
              Example request:
              <span className="text-blue-200"> React -&gt; Flask -&gt; weather API -&gt; model -&gt; risk label</span>
            </div>
          )}
        </form>

        <div className="space-y-6">
          <div
            className={`glass-panel border rounded-3xl p-6 md:p-7 min-h-[280px] ${styles.panel}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
                  Risk Response
                </p>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {prediction || "Waiting for prediction"}
                </h2>
                <p className="text-sm text-slate-300 max-w-sm">
                  Current response risk field:
                  <span className="text-white">
                    {` { "risk": "${prediction || "Low Risk"}" }`}
                  </span>
                </p>
                {predictionDetails ? (
                  <p className="text-sm text-slate-400 mt-3 max-w-sm">
                    Class {predictionDetails.predictionClass} selected with feature mode{" "}
                    <span className="text-white">{predictionDetails.featureMode}</span>.
                  </p>
                ) : null}
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10">
                <Activity size={28} className="text-blue-300" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${styles.badge}`}>
                {prediction || "No result yet"}
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm border border-white/10 bg-white/5 text-slate-300">
                Model ready
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm border border-white/10 bg-white/5 text-slate-300">
                Live weather ready
              </span>
            </div>

            {liveWeatherMeta ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <MapPin size={15} />
                  Live weather source
                </div>
                <div className="text-white font-medium">
                  {liveWeatherMeta.name}
                  {liveWeatherMeta.region ? `, ${liveWeatherMeta.region}` : ""}
                  {liveWeatherMeta.country ? `, ${liveWeatherMeta.country}` : ""}
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  Local time: {liveWeatherMeta.localtime || "N/A"}
                </div>
                {liveWeatherSource ? (
                  <div className="text-sm text-slate-400 mt-1">
                    Source: {liveWeatherSource}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <CloudRain size={15} />
                  Rain signal
                </div>
                <div className="text-2xl font-semibold text-white">
                  {submittedPayload.rain} mm
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <Gauge size={15} />
                  AQ snapshot
                </div>
                <div className="text-2xl font-semibold text-white">
                  {Math.max(submittedPayload.pm25, submittedPayload.pm10)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <Wind size={15} />
                  Gust
                </div>
                <div className="text-2xl font-semibold text-white">
                  {submittedPayload.gust} km/h
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-1 gap-6">
            {predictionDetails ? (
              <div className="glass-panel border border-white/10 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Activity size={18} className="text-blue-300" />
                  <h3 className="text-lg font-semibold text-white">
                    Response Debug
                  </h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Predicted Class
                    </div>
                    <div className="text-2xl font-semibold text-white">
                      {predictionDetails.predictionClass}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Probability Split
                    </div>
                    <div className="space-y-1 text-sm text-slate-300">
                      {Object.entries(predictionDetails.probabilities).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-white">{(value * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="glass-panel border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck size={18} className="text-emerald-300" />
                <h3 className="text-lg font-semibold text-white">
                  Frontend Integration
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                The page now supports both manual values and city-based realtime
                weather lookup. Live weather is fetched from the Flask backend so
                your API key stays hidden on the server side.
              </p>
            </div>

            <div className="glass-panel border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={18} className="text-amber-300" />
                <h3 className="text-lg font-semibold text-white">
                  Error Handling
                </h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Invalid or missing values are blocked in the UI and rechecked in
                Flask. API failures surface as a friendly message in the same
                panel, so the page never silently fails.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
