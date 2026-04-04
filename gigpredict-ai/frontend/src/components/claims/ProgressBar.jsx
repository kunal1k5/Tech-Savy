import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const STEPS = ["Created", "Processing", "Paid"];

function getProgressValue(status) {
  if (status === "paid") {
    return 100;
  }

  if (status === "approved") {
    return 72;
  }

  if (status === "manual_review") {
    return 56;
  }

  return 42;
}

export default function ProgressBar({ status }) {
  const progressValue = getProgressValue(status);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const isComplete =
            (index === 0 && progressValue >= 34) ||
            (index === 1 && progressValue >= 56) ||
            (index === 2 && progressValue >= 100);

          return (
            <div key={step} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                  isComplete ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
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
