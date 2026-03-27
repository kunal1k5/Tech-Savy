import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Compass,
  MapPinned,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  SAMPLE_LOCATION_PAYLOAD,
  predictNextLocation,
} from "../services/locationPrediction";

const FIELD_CONFIG = [
  { name: "origin_id", label: "Origin ID", unit: "encoded" },
  { name: "day_of_week", label: "Day Of Week", unit: "0-6" },
  { name: "hour_of_day", label: "Hour Of Day", unit: "0-23" },
  { name: "travel_time_mean", label: "Travel Time Mean", unit: "sec" },
  { name: "lower_bound", label: "Lower Bound", unit: "sec" },
  { name: "upper_bound", label: "Upper Bound", unit: "sec" },
  { name: "actual_destination_id", label: "Actual Destination ID", unit: "optional" },
];

const STATUS_STYLES = {
  Suspicious: "border-red-500/30 bg-red-500/10 text-red-200",
  Clear: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  Unknown: "border-white/10 bg-white/5 text-slate-300",
};

function toFormState(payload) {
  return Object.fromEntries(
    FIELD_CONFIG.map(({ name }) => [name, String(payload[name] ?? "")])
  );
}

function toPayload(formData) {
  const payload = {};

  for (const field of FIELD_CONFIG) {
    const rawValue = formData[field.name]?.trim();
    if (!rawValue) {
      if (field.name === "actual_destination_id") {
        continue;
      }
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

export default function LocationPredictor() {
  const [formData, setFormData] = useState(() => toFormState(SAMPLE_LOCATION_PAYLOAD));
  const [response, setResponse] = useState(null);
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fraudStatus = response?.fraud_status || "Unknown";
  const fraudStyle = STATUS_STYLES[fraudStatus] || STATUS_STYLES.Unknown;

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function loadSample() {
    setFormData(toFormState(SAMPLE_LOCATION_PAYLOAD));
    setApiError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setApiError("");

    try {
      const payload = toPayload(formData);
      const prediction = await predictNextLocation(payload);
      setResponse(prediction);
    } catch (error) {
      setApiError(error.message || "Location prediction failed.");
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
              Route Consistency Check
            </h1>
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1">
              Flask + rules
            </span>
          </div>
          <p className="text-slate-400 max-w-3xl">
            Estimate the most likely destination movement ID from origin and travel
            timing features, then compare it against the claimed destination to
            flag suspicious movement mismatches.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSample}
          className="px-4 py-2 rounded-full text-sm font-medium border border-white/10 text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
        >
          Load Sample Route
        </button>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.9fr] gap-6">
        <form
          onSubmit={handleSubmit}
          className="glass-panel border border-white/10 rounded-3xl p-6 md:p-8 space-y-6"
        >
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Input contract:
            <span className="text-cyan-200">
              {" "}origin_id, day_of_week, hour_of_day, travel_time_mean, lower_bound,
              upper_bound, and optional actual_destination_id.
            </span>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">
              Predictor Input
            </p>
            <h2 className="text-xl font-semibold text-white">
              POST /predict-location payload
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
              Fraud logic:
              <span className="text-blue-200">
                {" "}if predicted destination and actual destination differ, the API flags the trip as suspicious.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-[0_10px_30px_rgba(8,145,178,0.25)]"
          >
            <Send size={16} />
            {isSubmitting ? "Predicting..." : "Predict Destination"}
          </button>
        </form>

        <div className="space-y-6">
          <div className="glass-panel border border-white/10 rounded-3xl p-6 md:p-7 min-h-[280px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
                  Route Response
                </p>
                <h2 className="text-2xl font-bold text-white mb-3">
                {response?.predicted_destination_name || "Waiting for prediction"}
                </h2>
                <p className="text-sm text-slate-300 max-w-sm">
                  Predicted destination ID:
                  <span className="text-white">
                    {` ${response?.predicted_destination_id ?? "-"}`}
                  </span>
                </p>
                <p className="text-sm text-slate-400 mt-3 max-w-sm">
                  Confidence:
                  <span className="text-white">
                    {` ${response?.confidence != null ? `${(response.confidence * 100).toFixed(1)}%` : "N/A"}`}
                  </span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10">
                <Compass size={28} className="text-cyan-300" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm border ${fraudStyle}`}>
                {fraudStatus}
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm border border-white/10 bg-white/5 text-slate-300">
                Model ready
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm border border-white/10 bg-white/5 text-slate-300">
                Fraud rule active
              </span>
            </div>

            {response ? (
              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Route size={15} />
                    Predicted ID
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {response.predicted_destination_id}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <MapPinned size={15} />
                    Actual ID
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {response.actual_destination_id ?? "N/A"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <ShieldAlert size={15} />
                    Suspicious
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {response.suspicious == null ? "N/A" : response.suspicious ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-panel border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={18} className="text-cyan-300" />
              <h3 className="text-lg font-semibold text-white">
                Top Candidates
              </h3>
            </div>
            {response?.top_candidates?.length ? (
              <div className="space-y-3">
                {response.top_candidates.map((candidate) => (
                  <div
                    key={`${candidate.encoded_destination_id}-${candidate.destination_movement_id}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
                  >
                    <div className="text-white font-medium">
                      {candidate.destination_display_name}
                    </div>
                    <div className="text-sm text-slate-400">
                      ID {candidate.destination_movement_id} / Score {(candidate.score * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 leading-relaxed">
                The API will return up to three ranked destination candidates when
                the model exposes probabilities.
              </p>
            )}
          </div>

          <div className="glass-panel border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={18} className="text-amber-300" />
              <h3 className="text-lg font-semibold text-white">
                Dataset Note
              </h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The current Uber movement CSV has one origin and one record per destination,
              so holdout evaluation is weak. The integrated model still runs for inference,
              but production quality will improve once repeated origin-destination journeys
              are available.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
