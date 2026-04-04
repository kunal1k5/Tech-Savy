import React from "react";
import { Bell, Menu } from "lucide-react";
import { useGigShieldData } from "../../context/GigShieldDataContext";
import SurfaceButton from "../ui/SurfaceButton";

const LIVE_INDICATORS = [
  {
    label: "Monitoring Active",
    className: "bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-500",
  },
  {
    label: "Auto Claim Enabled",
    className: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  {
    label: "Fraud Detection Active",
    className: "bg-slate-100 text-slate-700",
    dotClassName: "bg-slate-500",
  },
];

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Navbar({ title, onMenuClick }) {
  const { platformState } = useGigShieldData();
  const worker = platformState.worker;
  const displayName = worker.name || "Gig worker";
  const displayPlatform = worker.platform || "Profile incomplete";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SurfaceButton
            onClick={onMenuClick}
            variant="icon"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </SurfaceButton>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-900 md:text-2xl">{title}</h1>
            <p className="mt-1 hidden text-sm text-slate-500 md:block">
              System is monitoring your environment
            </p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {LIVE_INDICATORS.map((indicator) => (
            <div
              key={indicator.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${indicator.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${indicator.dotClassName}`} />
              {indicator.label}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 md:hidden">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Monitoring Active
          </div>

          <SurfaceButton
            variant="icon"
            size="icon"
            aria-label="Open notifications"
          >
            <Bell size={18} />
          </SurfaceButton>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {getInitials(displayName)}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{displayPlatform}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
