import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Bell, ChevronDown, Menu, Shield } from "lucide-react";
import { useGigShieldData } from "../../context/GigShieldDataContext";
import Sidebar from "./Sidebar";
import Badge from "../ui/Badge";
import Button, { buttonStyles } from "../ui/Button";
import { cn } from "../../utils/cn";

const PAGE_META = {
  "/dashboard": { title: "Dashboard", subtitle: "Simple view of earnings, loss, and risk." },
  "/insurance": { title: "Plans", subtitle: "Choose the cover that fits your route." },
  "/claims": { title: "Claims", subtitle: "Track claim status and payout progress." },
  "/risk-map": { title: "Risk", subtitle: "Check live weather risk." },
  "/location-predictor": { title: "Route Check", subtitle: "Check if a route looks suspicious." },
};

export default function AppLayout() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { platformState, derivedData } = useGigShieldData();
  const pageMeta = PAGE_META[location.pathname] || PAGE_META["/dashboard"];
  const riskTone =
    derivedData.currentRisk?.level === "High"
      ? "danger"
      : derivedData.currentRisk?.level === "Medium"
        ? "warning"
        : "success";
  const initials = platformState.worker.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    <div className="relative min-h-screen overflow-x-hidden text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-20" />
      <div className="pointer-events-none absolute left-[-10%] top-[-14%] h-[30rem] w-[30rem] rounded-full bg-sky-500/[0.08] blur-[160px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-14%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/[0.07] blur-[150px]" />

      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <AnimatePresence>
        {isOpen ? (
          <motion.button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen lg:pl-[280px]">
        <header className="sticky top-0 z-30 pl-4 pr-6 py-4 md:pl-6 md:pr-8 lg:pl-8 lg:pr-10">
          <div className="glass-panel mx-auto flex min-h-[74px] max-w-[1500px] items-center justify-between rounded-[24px] px-4 py-3 md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                onClick={() => setIsOpen(true)}
                className="lg:hidden"
                size="sm"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </Button>

              <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-[16px] border border-sky-400/20 bg-sky-400/10 lg:hidden">
                <Shield className="fill-sky-300/15 text-sky-200" size={18} />
              </Link>

              <div className="min-w-0">
                <div className="truncate font-display text-xl font-semibold text-white md:text-2xl">
                  {pageMeta.title}
                </div>
                <p className="hidden truncate text-sm text-slate-400 md:block">{pageMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <Badge tone={riskTone} pulse={riskTone === "danger"} className="hidden sm:inline-flex">
                {derivedData.currentRisk?.level || "Safe"}
              </Badge>

              <button type="button" className={cn(buttonStyles({ size: "sm" }), "px-3")}>
                <Bell size={16} />
              </button>

              <button
                type="button"
                className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-slate-900/70 px-3 py-2 transition hover:border-white/20 hover:bg-slate-900"
              >
                <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-sky-500 text-sm font-semibold text-white">
                  {initials}
                </div>
                <div className="hidden text-left md:block">
                  <div className="text-sm font-semibold text-white">{platformState.worker.name}</div>
                  <div className="text-xs text-slate-400">{platformState.worker.area}</div>
                </div>
                <ChevronDown size={16} className="hidden text-slate-400 md:block" />
              </button>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-100px)]">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 2800,
              style: {
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                borderRadius: "18px",
                boxShadow: "0 18px 40px rgba(2, 6, 23, 0.3)",
              },
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="min-h-[calc(100vh-100px)]"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
