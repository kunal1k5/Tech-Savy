import React from "react";
import Card from "./ui/Card";
import Badge from "./ui/Badge";

const ACCENTS = {
  sky: "sky",
  emerald: "emerald",
  amber: "amber",
  rose: "rose",
  violet: "violet",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "sky",
  hint,
  trend,
  pulse = false,
}) {
  return (
    <Card glow={ACCENTS[accent] || "sky"} interactive className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <div className="font-display text-3xl font-semibold tracking-tight text-white md:text-[2rem]">
            {value}
          </div>
          {subtitle ? <p className="text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Icon size={20} />
          </div>
        ) : null}
      </div>

      {(hint || trend) && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {trend ? (
            <Badge tone={accent === "rose" ? "danger" : accent === "amber" ? "warning" : accent === "emerald" ? "success" : "info"} pulse={pulse}>
              {trend}
            </Badge>
          ) : null}
          {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
        </div>
      )}
    </Card>
  );
}
