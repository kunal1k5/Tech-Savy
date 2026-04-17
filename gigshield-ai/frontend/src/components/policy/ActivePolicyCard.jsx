import React from "react";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { CalendarClock, MapPin, ShieldCheck, Wallet, Waves } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import { cn } from "../../utils/cn";
import { formatINR } from "../../utils/helpers";

export default function ActivePolicyCard({
  planName,
  premiumAmount,
  coverageSummary,
  riskLevel,
  statusLabel = "Active",
  createdAt = null,
  triggerType = null,
  threshold = null,
  location = null,
  payoutAmount = null,
  isHighlighted = false,
}) {
  const createdLabel = createdAt ? new Date(createdAt).toLocaleString() : "Just now";
  const triggerLabel =
    triggerType && (threshold || threshold === 0) ? `${triggerType} > ${threshold}` : "Waiting for trigger setup";
  const claimPayoutLabel = formatINR(Number(payoutAmount ?? 0));

  return (
    <motion.section
      whileHover={{ y: -2, scale: 1.02 }}
      animate={isHighlighted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition-all",
        isHighlighted && "border-blue-300 ring-2 ring-blue-100"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Active Policy</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{planName}</h3>
        </div>
        <motion.div
          animate={isHighlighted ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <StatusBadge status="active" label={statusLabel} />
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Wallet size={16} />
            Live Insurance Premium
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            <CountUp
              end={premiumAmount}
              duration={1.5}
              formattingFn={(value) => `${formatINR(Math.round(value))}/week`}
              preserveValue
            />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck size={16} />
            Policy Risk Status
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">{riskLevel} risk currently applied</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Waves size={16} />
            Trigger
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">{triggerLabel}</div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Wallet size={16} />
            Payout
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">{claimPayoutLabel}</div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <CalendarClock size={16} />
            Status
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900">{statusLabel}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <CalendarClock size={16} />
          Created Time
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-900">{createdLabel}</div>
      </div>

      {location ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <MapPin size={16} />
            Location
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">{location}</div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-500">Policy Summary</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{coverageSummary}</p>
      </div>
    </motion.section>
  );
}
