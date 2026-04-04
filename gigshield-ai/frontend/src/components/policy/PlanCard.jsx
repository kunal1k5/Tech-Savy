import React from "react";
import { motion } from "framer-motion";
import { Check, Shield } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import SurfaceButton from "../ui/SurfaceButton";
import { cn } from "../../utils/cn";

export default function PlanCard({
  title,
  coverageLabel,
  premiumLabel,
  features,
  isRecommended = false,
  isActive = false,
  isLoading = false,
  onSelect,
}) {
  return (
    <motion.article
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-2xl border bg-white p-6 shadow-md transition-colors",
        isActive
          ? "border-emerald-200"
          : isRecommended
            ? "border-blue-200 ring-1 ring-blue-100"
            : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{coverageLabel}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h3>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Shield size={18} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isRecommended ? <StatusBadge status="recommended" /> : null}
        {isActive ? <StatusBadge status="active" /> : null}
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-500">Engine Cost</p>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {premiumLabel}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={12} />
            </div>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <SurfaceButton
        onClick={onSelect}
        whileHover={undefined}
        loading={isLoading}
        className={cn(
          "mt-6 w-full",
          isActive
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : ""
        )}
        variant={isActive ? "success" : "primary"}
      >
        {isActive ? "Active Profile" : "Use Profile"}
      </SurfaceButton>
    </motion.article>
  );
}
