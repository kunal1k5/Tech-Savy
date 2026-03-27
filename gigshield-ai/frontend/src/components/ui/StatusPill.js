import React from "react";
import clsx from "clsx";

const TONES = {
  default: "border-white/10 bg-white/5 text-slate-300",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  danger: "border-red-500/25 bg-red-500/10 text-red-200",
};

export default function StatusPill({ children, tone = "default", className = "" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase",
        TONES[tone] || TONES.default,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
