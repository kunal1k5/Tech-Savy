import React, { useState } from "react";
import {
  AlertTriangle,
  Compass,
  MapPinned,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Card, { CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { LoadingPanel } from "../components/ui/Loader";
import SectionHeader from "../components/ui/SectionHeader";
import {
  SAMPLE_LOCATION_PAYLOAD,
  predictNextLocation,
} from "../services/locationPrediction";

const FIELD_CONFIG = [
  { name: "origin_id", label: "Origin ID", unit: "encoded" },
  { name: "day_of_week", label: "Day of Week", unit: "0-6" },
  { name: "hour_of_day", label: "Hour of Day", unit: "0-23" },
  { name: "travel_time_mean", label: "Travel Time Mean", unit: "sec" },
  { name: "lower_bound", label: "Lower Bound", unit: "sec" },
  { name: "upper_bound", label: "Upper Bound", unit: "sec" },
  { name: "actual_destination_id", label: "Actual Destination ID", unit: "optional" },
];

const STATUS_STYLES = {
  Suspicious: { tone: "danger", glow: "rose" },
  Clear: { tone: "success", glow: "emerald" },
  Unknown: { tone: "info", glow: "sky" },
};

function toFormState(payload) {
  return Object.fromEntries(FIELD_CONFIG.map(({ name }) => [name, String(payload[name] ?? "")]));
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
  const statusStyle = STATUS_STYLES[fraudStatus] || STATUS_STYLES.Unknown;

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
    <div className="page-shell">
      <SectionHeader
        eyebrow="Route integrity"
        title="Route consistency and fraud validation"
        description="This tool now feels more like an internal trust-and-safety console: cleaner inputs, stronger result framing, and clearer suspicious route feedback."
        action={
          <Button type="button" variant="secondary" onClick={loadSample}>
            Load Sample Route
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card glow="violet">
          <form onSubmit={handleSubmit} className="space-y-6">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Predictor Input
                </div>
                <CardTitle className="mt-2">POST /predict-location payload</CardTitle>
                <CardDescription className="mt-2">
                  Compare route timing features against likely destinations and spot suspicious mismatches instantly.
                </CardDescription>
              </div>
              <Badge tone="violet">Flask + rules</Badge>
            </CardHeader>

            <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-sm text-cyan-100">
              The predictor checks route consistency using encoded origin, time windows, and optional claimed destination data.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                If predicted and actual destination IDs diverge, the route can be flagged as suspicious.
              </div>
            )}

            <Button type="submit" variant="primary" rightIcon={Send} loading={isSubmitting}>
              {isSubmitting ? "Predicting Destination" : "Predict Destination"}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          {isSubmitting ? <LoadingPanel title="Checking route integrity" /> : null}

          <Card glow={statusStyle.glow}>
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Route Response</div>
                <CardTitle className="mt-2">
                  {response?.predicted_destination_name || "Waiting for prediction"}
                </CardTitle>
                <CardDescription className="mt-2">
                  The result prioritizes route trust: clear destination output, confidence, and fraud verdict in one panel.
                </CardDescription>
              </div>
              <Badge tone={statusStyle.tone} pulse={fraudStatus === "Suspicious"}>
                {fraudStatus}
              </Badge>
            </CardHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Route size={15} className="text-cyan-300" />
                  Predicted ID
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {response?.predicted_destination_id ?? "-"}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MapPinned size={15} className="text-sky-300" />
                  Actual ID
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {response?.actual_destination_id ?? "N/A"}
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldAlert size={15} className="text-rose-300" />
                  Confidence
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {response?.confidence != null ? `${(response.confidence * 100).toFixed(1)}%` : "N/A"}
                </div>
              </div>
            </div>
          </Card>

          <Card glow="sky">
            <CardHeader>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Top Candidates</div>
                <CardTitle className="mt-2">Ranked destination options</CardTitle>
              </div>
              <Compass size={18} className="text-cyan-300" />
            </CardHeader>
            {response?.top_candidates?.length ? (
              <div className="space-y-3">
                {response.top_candidates.map((candidate) => (
                  <motion.div
                    key={`${candidate.encoded_destination_id}-${candidate.destination_movement_id}`}
                    whileHover={{ x: 4 }}
                    className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="font-semibold text-white">{candidate.destination_display_name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Movement ID {candidate.destination_movement_id}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-sky-400"
                        style={{ width: `${candidate.score * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      Score {(candidate.score * 100).toFixed(1)}%
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-slate-400">
                Run a route check to surface ranked destination candidates from the model.
              </div>
            )}
          </Card>

          <Card glow="amber">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-1 text-amber-300" />
              <div>
                <div className="font-semibold text-white">Dataset note</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  The current model demonstrates the route-consistency story well, and it will improve further with denser repeated origin-destination trip history.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
