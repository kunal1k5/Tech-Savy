import React from "react";
import { LogOut, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import BrandIdentity from "../branding/BrandIdentity";
import { useGigPredictAIData } from "../../context/GigPredictAIDataContext";
import { clearSession } from "../../utils/auth";
import { cn } from "../../utils/cn";
import { NAV_ITEMS } from "./navigation";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SidebarContent({ onNavigate = () => {}, showClose = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { platformState } = useGigPredictAIData();
  const worker = platformState.worker;
  const displayName = worker.name || "Gig worker";
  const displayArea = [worker.area, worker.city].filter(Boolean).join(", ") || "Complete profile";

  function handleSignOut() {
    clearSession();
    onNavigate();
    navigate("/login");
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-5">
        <NavLink to="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <BrandIdentity
            subtitle="Decision intelligence"
            logoClassName="h-10 w-10"
            titleClassName="text-base"
          />
        </NavLink>

        {showClose ? (
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.matches(location.pathname);

            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
                    isActive
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-400 group-hover:bg-white group-hover:text-slate-700"
                  )}
                >
                  <Icon size={18} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{displayArea}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
        <div className="h-full overflow-hidden">
          <SidebarContent />
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-slate-900/30 transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Close sidebar overlay"
        />

        <aside
          className={cn(
            "relative h-full w-60 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full overflow-hidden">
            <SidebarContent onNavigate={onClose} showClose />
          </div>
        </aside>
      </div>
    </>
  );
}
