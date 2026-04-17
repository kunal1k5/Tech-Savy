import React from "react";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { CalendarDays, CloudRain, Wallet, Wind } from "lucide-react";
import ProgressBar from "./ProgressBar";
import StatusBadge from "../ui/StatusBadge";
import { formatINR } from "../../utils/helpers";
import { cn } from "../../utils/cn";

function getReason(claim) {
  if (claim.eventType === "Rainfall") {
    return "Rain";
  }

  if (claim.eventType === "AQI") {
    return "AQI";
  }

  return "Traffic";
}

function getIcon(claim) {
  if (claim.eventType === "Rainfall") {
    return CloudRain;
  }

  if (claim.eventType === "AQI") {
    return Wind;
  }

  return Wallet;
}

function getStatus(claim) {
  const normalizedStatus = String(claim.status || "pending").trim().toLowerCase();

  if (normalizedStatus === "paid") {
    return { status: "paid", label: "Payout Completed" };
  }

  if (normalizedStatus === "approved") {
    return { status: "approved", label: "Approved by AI" };
  }

  return { status: "pending", label: "Under AI Review" };
}

export default function ClaimCard({ claim }) {
  const Icon = getIcon(claim);
  const status = getStatus(claim);
  const normalizedStatus = String(claim.status || "pending").trim().toLowerCase();
  const isPaid = normalizedStatus === "paid";
  const isPending = normalizedStatus === "pending" || normalizedStatus === "manual_review";

  return (
    <motion.article
      layout
      initial={isPending ? { opacity: 0, y: 14 } : false}
      animate={
        isPaid
          ? {
              opacity: 1,
              y: 0,
              boxShadow: [
                "0 10px 28px rgba(15, 23, 42, 0.08)",
                "0 16px 34px rgba(16, 185, 129, 0.16)",
                "0 10px 28px rgba(15, 23, 42, 0.08)",
              ],
            }
          : { opacity: 1, y: 0 }
      }
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-md",
        isPaid && "border-emerald-200"
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Icon size={18} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">Reason: {getReason(claim)}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{claim.headline}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Auto claim triggered due to {getReason(claim).toLowerCase()} conditions in {claim.area}.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-2xl bg-slate-50 p-4 lg:min-w-[220px]",
            isPaid && "bg-emerald-50/70"
          )}
        >
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            <CountUp
              end={claim.amount}
              duration={1.2}
              formattingFn={(value) => formatINR(Math.round(value))}
              preserveValue
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={14} />
            {new Date(claim.detectedAt).toLocaleDateString()}
          </div>
          <motion.div
            key={claim.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="mt-3"
          >
            <StatusBadge status={status.status} label={status.label} />
          </motion.div>
        </div>
      </div>

      <div className="mt-6">
        <ProgressBar status={normalizedStatus} />
      </div>
    </motion.article>
  );
}
