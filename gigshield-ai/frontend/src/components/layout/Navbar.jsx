import React from "react";
import { Bell, Menu } from "lucide-react";
import { useGigShieldData } from "../../context/GigShieldDataContext";
import SurfaceButton from "../ui/SurfaceButton";

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

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
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
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 md:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
              {getInitials(worker.name)}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">{worker.name}</p>
              <p className="truncate text-xs text-slate-500">{worker.platform}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
