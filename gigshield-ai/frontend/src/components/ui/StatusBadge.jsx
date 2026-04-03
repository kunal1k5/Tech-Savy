import React from "react";
import { cn } from "../../utils/cn";

const BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700",
  approved: "bg-blue-50 text-blue-700",
  high: "bg-emerald-50 text-emerald-700",
  low: "bg-red-50 text-red-700",
  manual_review: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  not_uploaded: "bg-slate-100 text-slate-600",
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  recommended: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  risk_high: "bg-red-50 text-red-700",
  risk_low: "bg-emerald-50 text-emerald-700",
  risk_medium: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
};

const LABELS = {
  active: "Active",
  approved: "Approved",
  high: "High",
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
  verified: "Verified",
};

export default function StatusBadge({ status, label, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
        BADGE_STYLES[status] || BADGE_STYLES.pending,
        className
      )}
    >
      {label || LABELS[status] || status}
    </span>
  );
}
