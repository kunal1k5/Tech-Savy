import React from "react";
import { cn } from "../../utils/cn";

function StatusChip({ label, tone = "safe" }) {
  const tones = {
    safe: "bg-emerald-50 text-emerald-700 status-glow-safe",
    warning: "bg-amber-50 text-amber-700 status-glow-warning",
    danger: "bg-rose-50 text-rose-700 status-glow-danger",
    info: "bg-sky-50 text-sky-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]",
        tones[tone] || tones.info
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current/90" />
      {label}
    </span>
  );
}

export default function SystemStatusBar({
  monitoringLabel = "Monitoring Active",
  engineLabel = "Decision Engine Running",
  fraudLabel = "Fraud Detection Active",
  engineBusy = false,
  fraudHighRisk = false,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(112deg,rgba(14,116,144,0.08),rgba(16,185,129,0.08),rgba(15,23,42,0.02))] px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-cyan-300/20 to-transparent" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Intelligence Control Stream
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            AI is actively monitoring your risk, behavior, and claim flow in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={monitoringLabel} tone="safe" />
          <StatusChip label={engineLabel} tone={engineBusy ? "warning" : "safe"} />
          <StatusChip label={fraudLabel} tone={fraudHighRisk ? "danger" : "safe"} />
        </div>
      </div>
    </div>
  );
}
