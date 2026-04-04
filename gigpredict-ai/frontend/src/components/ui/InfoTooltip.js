import React from "react";
import { Info } from "lucide-react";

export default function InfoTooltip({ label, text }) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors duration-200 hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      >
        <Info size={12} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.1)] transition-all duration-200 group-hover:translate-y-1 group-hover:opacity-100 group-focus-within:translate-y-1 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}
