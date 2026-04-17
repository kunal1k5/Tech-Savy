import React, { Fragment, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

function getActiveIndex(steps, explicitActiveIndex) {
  if (Number.isFinite(explicitActiveIndex)) {
    return Math.max(0, Math.min(steps.length - 1, Number(explicitActiveIndex)));
  }

  const derivedIndex = steps.reduce(
    (lastIndex, step, index) => (step.active ? index : lastIndex),
    0
  );

  return Math.max(0, Math.min(steps.length - 1, derivedIndex));
}

export default function AnimatedPipeline({
  steps = [],
  activeIndex,
  variant = "light",
  className,
}) {
  const safeSteps = useMemo(
    () => steps.filter((step) => step && (step.label || step.key)),
    [steps]
  );

  if (!safeSteps.length) {
    return null;
  }

  const resolvedActiveIndex = getActiveIndex(safeSteps, activeIndex);
  const progressPercent =
    safeSteps.length > 1 ? (resolvedActiveIndex / (safeSteps.length - 1)) * 100 : 0;
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4",
        isDark
          ? "border-white/10 bg-white/[0.03]"
          : "border-slate-200 bg-gradient-to-r from-slate-50 to-white",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            isDark ? "text-slate-300" : "text-slate-500"
          )}
        >
          AI Pipeline Thinking
        </p>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
            isDark
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-emerald-50 text-emerald-700"
          )}
        >
          Real-time flow
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {safeSteps.map((step, index) => {
          const isActive = index <= resolvedActiveIndex;
          const isCurrent = index === resolvedActiveIndex;

          return (
            <Fragment key={step.key || `${step.label}-${index}`}>
              <motion.div
                animate={{
                  scale: isCurrent ? 1.03 : 1,
                  opacity: isActive ? 1 : 0.62,
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-300",
                  isDark
                    ? isActive
                      ? "bg-emerald-500/20 text-emerald-100"
                      : "bg-slate-800/85 text-slate-400"
                    : isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                )}
              >
                {step.label}
              </motion.div>

              {index < safeSteps.length - 1 ? (
                <div
                  className={cn(
                    "pipeline-link-wave relative h-[3px] w-7 rounded-full bg-gradient-to-r",
                    isDark
                      ? isActive
                        ? "from-emerald-400/70 via-cyan-300/80 to-emerald-400/70"
                        : "from-slate-700 via-slate-600 to-slate-700"
                      : isActive
                        ? "from-emerald-300 via-cyan-300 to-emerald-300"
                        : "from-slate-300 via-slate-200 to-slate-300"
                  )}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>

      <div
        className={cn(
          "relative mt-4 h-2 overflow-hidden rounded-full",
          isDark ? "bg-slate-800/80" : "bg-slate-200"
        )}
      >
        <div
          className={cn(
            "pipeline-link-wave absolute inset-0 bg-gradient-to-r",
            isDark
              ? "from-emerald-400/40 via-cyan-300/45 to-emerald-400/40"
              : "from-emerald-300/65 via-cyan-300/70 to-emerald-300/65"
          )}
        />
        <motion.div
          animate={{ left: `${progressPercent}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg",
            isDark ? "bg-emerald-300" : "bg-emerald-500"
          )}
        />
      </div>
    </div>
  );
}
