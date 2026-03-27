import React from "react";
import { Info } from "lucide-react";

export default function InfoTooltip({ label, text }) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-slate-200"
      >
        <Info size={12} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-2 text-xs leading-relaxed text-slate-300 shadow-[0_20px_40px_rgba(2,6,23,0.45)] group-hover:block">
        {text}
      </span>
    </span>
  );
}
