import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const TONE_STYLES = {
  success: {
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "Verified",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    label: "Warning",
  },
  danger: {
    badge: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    label: "Suspicious",
  },
};

export default function SurfaceScanPanel({
  title = "Real-time monitoring",
  description,
  tone = "success",
  badgeLabel,
  className,
}) {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.success;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4",
        className
      )}
    >
      <motion.div
        animate={{ x: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="absolute left-0 top-4 h-[2px] w-24 bg-blue-400"
      />
      <motion.div
        animate={{ x: ["-30%", "360%"] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 left-[-25%] w-20 bg-gradient-to-r from-transparent via-blue-100/80 to-transparent"
      />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.26, ease: "easeOut" }}
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            toneStyle.badge
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", toneStyle.dot)} />
          {badgeLabel || toneStyle.label}
        </motion.div>
      </div>
    </div>
  );
}
