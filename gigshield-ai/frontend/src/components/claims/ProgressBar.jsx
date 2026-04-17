import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const STEPS = ["Trigger", "Claim Created", "AI Review", "Approved", "Paid"];

function getCurrentStepIndex(status) {
  const normalizedStatus = String(status || "pending").trim().toLowerCase();

  if (normalizedStatus === "paid") {
    return 4;
  }

  if (normalizedStatus === "approved") {
    return 3;
  }

  if (normalizedStatus === "pending" || normalizedStatus === "manual_review") {
    return 2;
  }

  if (normalizedStatus === "created") {
    return 1;
  }

  return 0;
}

function getProgressValue(currentStepIndex) {
  return ((currentStepIndex + 1) / STEPS.length) * 100;
}

export default function ProgressBar({ status }) {
  const currentStepIndex = getCurrentStepIndex(status);
  const progressValue = getProgressValue(currentStepIndex);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const isComplete = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                  isCurrent
                    ? "bg-blue-600 text-white ring-2 ring-blue-100"
                    : isComplete
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500"
                )}
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          );
        })}
      </div>

      <div className="h-2 rounded-full bg-slate-200">
        <motion.div
          className="h-2 rounded-full bg-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${progressValue}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
