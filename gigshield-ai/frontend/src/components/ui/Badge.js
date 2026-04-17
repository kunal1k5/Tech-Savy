import React from "react";
import { cn } from "../../utils/cn";

const TONES = {
  default: "border-white/10 bg-white/5 text-slate-200",
  info: "border-sky-400/30 bg-sky-400/[0.12] text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.18)]",
  success:
    "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.18)]",
  warning:
    "border-amber-400/30 bg-amber-400/[0.12] text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
  danger:
    "border-rose-400/30 bg-rose-400/[0.12] text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)]",
  violet:
    "border-violet-400/30 bg-violet-400/[0.12] text-violet-100 shadow-[0_0_28px_rgba(167,139,250,0.2)]",
};

const SIZES = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
};

export function badgeStyles({ tone = "default", size = "md", pulse = false } = {}) {
  const pulseClassName =
    pulse && tone === "danger"
      ? "status-glow-danger"
      : pulse && tone === "warning"
        ? "status-glow-warning"
        : pulse && (tone === "success" || tone === "info" || tone === "violet")
          ? "status-glow-safe"
          : pulse
            ? "risk-pulse"
            : "";

  return cn(
    "inline-flex items-center gap-2 rounded-full border font-semibold uppercase tracking-[0.22em] backdrop-blur-xl transition-colors",
    TONES[tone] || TONES.default,
    SIZES[size] || SIZES.md,
    pulseClassName
  );
}

export default function Badge({
  children,
  tone = "default",
  size = "md",
  dot = true,
  pulse = false,
  className,
}) {
  return (
    <span className={cn(badgeStyles({ tone, size, pulse }), className)}>
      {dot ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
