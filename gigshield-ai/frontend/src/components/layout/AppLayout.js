import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Menu, Shield } from "lucide-react";
import { useGigShieldData } from "../../context/GigShieldDataContext";
import Sidebar from "./Sidebar";
import StatusPill from "../ui/StatusPill";

const PAGE_META = {
  "/dashboard": {
    title: "Operations dashboard",
    subtitle: "Live disruption signals, claim automation, and payout readiness in one view.",
  },
  "/insurance": {
    title: "Coverage plans",
    subtitle: "Compare plans, adjust payout limits, and explain why the recommended plan fits your zone.",
  },
  "/claims": {
    title: "Claims timeline",
    subtitle: "Track automated detections, approval states, fraud checks, and released payouts.",
  },
  "/risk-map": {
    title: "Risk monitor",
    subtitle: "Send live weather inputs to the Flask service and inspect the returned risk response.",
  },
  "/location-predictor": {
    title: "Route consistency check",
    subtitle: "Compare predicted and claimed destination patterns to surface suspicious trips.",
  },
};

export default function AppLayout() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { platformState, derivedData } = useGigShieldData();
  const pageMeta = PAGE_META[location.pathname] || PAGE_META["/dashboard"];

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.body.classList.add("overflow-hidden");
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-40" />
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[34rem] w-[34rem] rounded-full bg-sky-900/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-900/15 blur-[120px]" />

      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <AnimatePresence>
        {isOpen ? (
          <motion.button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[76px] max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>

              <Link to="/dashboard" className="flex items-center gap-3 lg:hidden">
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2">
                  <Shield className="fill-sky-400/15 text-sky-300" size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[0.18em] text-slate-100">
                    GIGSHIELD
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    Automated cover
                  </div>
                </div>
              </Link>

              <div className="hidden min-w-0 lg:block">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {pageMeta.title}
                </div>
                <p className="mt-1 truncate text-sm text-slate-400">{pageMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <StatusPill
                tone={derivedData.currentRisk?.level === "High" ? "danger" : "info"}
                className="hidden md:inline-flex"
              >
                {derivedData.currentRisk?.zone || "Live"} {derivedData.currentRisk?.level || "Ready"}
              </StatusPill>
              <StatusPill
                tone={platformState.fraudWatch.status === "flagged" ? "danger" : "success"}
                className="hidden xl:inline-flex"
              >
                {derivedData.statusLabels.fraud}
              </StatusPill>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Active plan
                </div>
                <div className="text-sm font-medium text-white">{derivedData.activePlan.name}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-76px)]">
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid rgba(148, 163, 184, 0.14)",
                borderRadius: "18px",
              },
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24 }}
              className="min-h-[calc(100vh-76px)]"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
