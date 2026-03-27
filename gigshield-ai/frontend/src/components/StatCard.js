import React from "react";
import clsx from "clsx";

const ACCENTS = {
  sky: "from-sky-500/18 to-sky-500/0 text-sky-200 border-sky-500/20",
  emerald: "from-emerald-500/18 to-emerald-500/0 text-emerald-200 border-emerald-500/20",
  amber: "from-amber-500/18 to-amber-500/0 text-amber-200 border-amber-500/20",
  rose: "from-rose-500/18 to-rose-500/0 text-rose-200 border-rose-500/20",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "sky",
  hint,
  trend,
}) {
  return (
    <div
      className={clsx(
        "glass-panel rounded-3xl border bg-gradient-to-br p-5",
        ACCENTS[accent] || ACCENTS.sky
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
          {subtitle ? <p className="text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-white">
            <Icon size={20} />
          </div>
        ) : null}
      </div>

      {(hint || trend) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
          {trend ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
              {trend}
            </span>
          ) : null}
          {hint ? <span className="text-slate-500">{hint}</span> : null}
        </div>
      )}
    </div>
  );
}
