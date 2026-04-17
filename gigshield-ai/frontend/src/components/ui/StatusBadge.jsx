import React from "react";
import { cn } from "../../utils/cn";

const BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  approved: "bg-emerald-50 text-emerald-700",
  flagged: "bg-red-50 text-red-700",
  fraud: "bg-red-50 text-red-700",
  high: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-amber-50 text-amber-700",
  low: "bg-red-50 text-red-700",
  manual_review: "bg-amber-50 text-amber-700",
  medium: "bg-amber-50 text-amber-700",
  not_uploaded: "bg-slate-100 text-slate-600",
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  recommended: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  risk_high: "bg-red-50 text-red-700",
  risk_low: "bg-emerald-50 text-emerald-700",
  risk_medium: "bg-amber-50 text-amber-700",
  safe: "bg-emerald-50 text-emerald-700",
  verified: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
};

const BADGE_GLOWS = {
  active: "status-glow-safe",
  approved: "status-glow-safe",
  flagged: "status-glow-danger",
  fraud: "status-glow-danger",
  manual_review: "status-glow-warning",
  medium: "status-glow-warning",
  paid: "status-glow-safe",
  pending: "status-glow-warning",
  rejected: "status-glow-danger",
  risk_high: "status-glow-danger",
  risk_low: "status-glow-safe",
  risk_medium: "status-glow-warning",
  safe: "status-glow-safe",
  verified: "status-glow-safe",
  warning: "status-glow-warning",
};

const LABELS = {
  active: "Active",
  approved: "Approved",
  flagged: "Flagged",
  fraud: "Fraud",
  high: "High",
  in_progress: "In Progress",
  low: "Low",
  manual_review: "Manual Review",
  medium: "Medium",
  not_uploaded: "Not uploaded",
  paid: "Paid",
  pending: "Pending",
  recommended: "Recommended",
  rejected: "Rejected",
  risk_high: "High Risk",
  risk_low: "Low Risk",
  risk_medium: "Medium Risk",
  safe: "Safe",
  verified: "Verified",
  warning: "Warning",
};

export default function StatusBadge({ status, label, className }) {
  const normalizedStatus = String(status || "pending").toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-300",
        BADGE_STYLES[normalizedStatus] || BADGE_STYLES.pending,
        BADGE_GLOWS[normalizedStatus],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current/80" />
      {label || LABELS[normalizedStatus] || normalizedStatus}
    </span>
  );
}
