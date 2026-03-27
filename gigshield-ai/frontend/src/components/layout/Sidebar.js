import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Compass,
  FileText,
  LayoutDashboard,
  LogOut,
  Shield,
  X,
} from "lucide-react";
import { useGigShieldData } from "../../context/GigShieldDataContext";
import { clearSession } from "../../utils/auth";
import StatusPill from "../ui/StatusPill";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Coverage", path: "/insurance", icon: Shield },
  { name: "Claims", path: "/claims", icon: FileText },
  { name: "Risk Monitor", path: "/risk-map", icon: Activity },
  { name: "Route Check", path: "/location-predictor", icon: Compass },
];

function SidebarContent({ mobile = false, onClose = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { platformState, derivedData } = useGigShieldData();

  function handleLogout() {
    clearSession();
    onClose();
    navigate("/login");
  }

  return (
    <>
      <div className="border-b border-white/5 px-5 pb-6 pt-5">
        <div className="mb-6 flex items-start justify-between gap-3">
          <Link
            to="/dashboard"
            onClick={onClose}
            className="flex items-center gap-3 text-white"
          >
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2.5 shadow-[0_0_18px_rgba(14,165,233,0.16)]">
              <Shield className="fill-sky-400/15 text-sky-300" size={22} />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">GigShield</div>
              <div className="text-xs uppercase tracking-[0.26em] text-slate-500">
                Risk-based cover
              </div>
            </div>
          </Link>

          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{platformState.worker.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {platformState.worker.platform} / {platformState.worker.area}
              </div>
            </div>
            <StatusPill
              tone={derivedData.currentRisk?.level === "High" ? "danger" : "info"}
              className="tracking-[0.14em]"
            >
              {derivedData.currentRisk?.level || "Live"}
            </StatusPill>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Monitoring now
            </div>
            <div className="mt-1 text-sm text-slate-200">
              {platformState.liveMonitor.headline}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar">
        <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Workspace
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? "border-sky-500/20 bg-sky-500/10 text-sky-200 shadow-[0_0_24px_rgba(14,165,233,0.12)]"
                    : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <div
                  className={`rounded-xl p-2 transition ${
                    isActive
                      ? "bg-sky-500/10 text-sky-200"
                      : "bg-slate-900/60 text-slate-400 group-hover:text-slate-100"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {item.path === "/dashboard"
                      ? "Signals, claims, payouts"
                      : item.path === "/insurance"
                        ? "Coverage plans and rules"
                        : item.path === "/claims"
                          ? "Automated claim lifecycle"
                          : item.path === "/risk-map"
                            ? "Live risk response"
                            : "Location consistency checks"}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/5 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-300 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <div className="glass-panel flex h-full flex-col border-r border-white/5 bg-slate-950/75">
          <SidebarContent onClose={onClose} />
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!isOpen}
      >
        <div className="glass-panel flex h-full flex-col border-r border-white/10 bg-slate-950/95 shadow-[0_24px_60px_rgba(2,6,23,0.6)]">
          <SidebarContent mobile onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
