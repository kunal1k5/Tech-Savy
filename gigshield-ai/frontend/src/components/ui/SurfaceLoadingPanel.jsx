import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

function SurfaceSkeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,#f8fafc,rgba(226,232,240,0.9),#f8fafc)] bg-[length:200%_100%]",
        className
      )}
    />
  );
}

export default function SurfaceLoadingPanel({
  title = "Loading",
  description = "Preparing the latest data",
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-md", className)}
    >
      <div className="space-y-2">
        <SurfaceSkeleton className="h-3 w-24" />
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-5 space-y-3">
        <SurfaceSkeleton className="h-12 w-full" />
        <SurfaceSkeleton className="h-20 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SurfaceSkeleton className="h-16 w-full" />
          <SurfaceSkeleton className="h-16 w-full" />
        </div>
      </div>
    </motion.div>
  );
}
