import React from "react";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { ShieldCheck, Wallet } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import { formatINR } from "../../utils/helpers";

export default function ActivePolicyCard({
  planName,
  premiumAmount,
  coverageSummary,
  riskLevel,
}) {
  return (
    <motion.section
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Active Profile</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {planName}
          </h3>
        </div>
        <StatusBadge status="active" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Wallet size={16} />
            Engine Cost
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
            Risk Engine Link
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">
            {riskLevel} risk currently applied
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-500">Profile Summary</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{coverageSummary}</p>
      </div>
    </motion.section>
  );
}
