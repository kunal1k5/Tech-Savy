import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-2xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))] bg-[length:200%_100%]",
        className
      )}
    />
  );
}

export function LoadingPanel({ title = "Loading workspace", className }) {
  return (
    <div className={cn("space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5", className)}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export function ScanPanel({
  label = "Scanning route continuity",
  status = "Verified",
  tone = "success",
  className,
}) {
  const toneClasses = {
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  };
  const lineClasses = {
    success: "via-emerald-300/90",
    danger: "via-rose-300/90",
    warning: "via-amber-300/90",
  };
  const statusLabel = tone === "danger" ? "Suspicious Activity" : "Verified";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-[24px] border px-4 py-4",
        toneClasses[tone] || toneClasses.success,
        className
      )}
    >
      <motion.div
        className={cn(
          "pointer-events-none absolute left-[-30%] top-4 h-[2px] w-[60%] bg-gradient-to-r from-transparent to-transparent",
          lineClasses[tone] || lineClasses.success
        )}
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-[-25%] w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ["-20%", "330%"] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
      />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            Fraud Check Running
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.26 }}
            className="mt-2 font-display text-lg font-semibold"
          >
            {status}
          </motion.div>
          <div className="mt-1 text-sm text-slate-300">{label}</div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.16, duration: 0.28 }}
            className={cn(
              "mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
              tone === "danger"
                ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
                : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
            )}
          >
            {statusLabel}
          </motion.div>
        </div>
        <motion.div
          animate={
            tone === "danger"
              ? { scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }
              : { scale: [1, 1.03, 1], opacity: [0.6, 0.9, 0.6] }
          }
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-slate-950/35"
        >
          <div className="scan-ring h-9 w-9 rounded-full border border-cyan-300/50" />
        </motion.div>
      </div>
    </motion.div>
  );
}
