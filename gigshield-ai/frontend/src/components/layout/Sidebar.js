import React from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { cn } from "../../utils/cn";
import { formatINR } from "../../utils/helpers";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Plans", path: "/insurance", icon: Shield },
  { name: "Claims", path: "/claims", icon: FileText },
  { name: "Risk", path: "/risk-map", icon: Activity },
  { name: "Route Check", path: "/location-predictor", icon: Compass },
];

function SidebarContent({ mobile = false, onClose = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { platformState, derivedData } = useGigShieldData();
  const riskTone =
    derivedData.currentRisk?.level === "High"
      ? "danger"
      : derivedData.currentRisk?.level === "Medium"
        ? "warning"
        : "success";

  function handleLogout() {
    clearSession();
    onClose();
    navigate("/login");
  }

  return (
    <>
      <div className="border-b border-white/10 px-5 pb-5 pt-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3 text-white">
            <div className="grid h-11 w-11 place-items-center rounded-[16px] border border-sky-400/20 bg-sky-400/10">
              <Shield className="fill-sky-300/15 text-sky-200" size={18} />
            </div>
            <div>
              <div className="font-display text-xl font-semibold">GigShield</div>
              <div className="text-xs text-slate-500">Income protection</div>
            </div>
          </Link>

          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-[16px] border border-white/10 bg-slate-900/70 p-2 text-slate-300 transition hover:border-white/20 hover:bg-slate-900 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-white/10 bg-slate-900/70 p-4">
          <div className="text-sm font-semibold text-white">{platformState.worker.name}</div>
          <div className="mt-1 text-sm text-slate-400">
            {platformState.worker.area}, {platformState.worker.city}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">Your earnings</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {formatINR(platformState.worker.weeklyIncome)}
              </div>
            </div>
            <Badge tone={riskTone} pulse={riskTone === "danger"}>
              {derivedData.currentRisk?.level || "Safe"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-[18px] border px-4 py-3 transition-colors",
                  isActive
                    ? "border-sky-400/25 bg-sky-400/10 text-sky-100"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-slate-900/70 hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "rounded-[14px] p-2.5",
                    isActive ? "bg-sky-400/10 text-sky-100" : "bg-slate-900/70 text-slate-400"
                  )}
                >
                  <Icon size={18} />
                </div>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        <Button type="button" onClick={handleLogout} variant="danger" block leftIcon={LogOut}>
          Logout
        </Button>
      </div>
    </>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] lg:block">
        <div className="glass-panel flex h-full flex-col overflow-hidden rounded-r-[26px] border-r border-white/10 bg-slate-950/85">
          <SidebarContent onClose={onClose} />
        </div>
      </aside>

      <AnimatePresence>
        {isOpen ? (
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            aria-hidden={!isOpen}
          >
            <div className="glass-panel flex h-full flex-col overflow-hidden rounded-r-[26px] border-r border-white/10 bg-slate-950/95 shadow-[0_16px_40px_rgba(2,6,23,0.38)]">
              <SidebarContent mobile onClose={onClose} />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
