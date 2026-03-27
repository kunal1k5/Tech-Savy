import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CloudRain,
  MapPinned,
  Shield,
  Siren,
  Wallet,
} from "lucide-react";
import { isAuthenticated } from "../utils/auth";

const features = [
  {
    icon: CloudRain,
    title: "Event detection",
    description:
      "Weather, AQI, and slowdown signals are watched continuously so disruption thresholds are caught early.",
  },
  {
    icon: Siren,
    title: "Automated claim flow",
    description:
      "Claims move from detection to review to payout with clear timestamps and status history.",
  },
  {
    icon: MapPinned,
    title: "Fraud controls",
    description:
      "Route consistency and rapid-repeat checks help separate normal claims from suspicious movement patterns.",
  },
];

const stats = [
  { label: "Average payout window", value: "4 min" },
  { label: "Signals monitored per zone", value: "14" },
  { label: "Weekly cover entry point", value: "INR 15" },
];

export default function Landing() {
  const homeCta = isAuthenticated() ? "/dashboard" : "/register";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[-10%] top-[-8%] h-[30rem] w-[30rem] rounded-full bg-sky-700/20 blur-[150px]" />
      <div className="pointer-events-none absolute right-[-10%] top-[25%] h-[28rem] w-[28rem] rounded-full bg-emerald-700/15 blur-[140px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 md:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2.5">
              <Shield className="fill-sky-400/15 text-sky-300" size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">GigShield</div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Data-driven income cover
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to={homeCta}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              {isAuthenticated() ? "Open dashboard" : "Start demo"}
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.9fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                <Wallet size={16} />
                Payout-ready protection for delivery and mobility workers
              </div>

              <div className="space-y-6">
                <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                  Protect earnings with
                  <span className="text-gradient"> automated, risk-based cover</span>
                  {" "}that feels real in a live demo.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                  GigShield combines disruption monitoring, automated claim handling,
                  and fraud checks into one polished workflow for gig worker income protection.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={homeCta}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  {isAuthenticated() ? "Open Dashboard" : "Launch Product Demo"}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/5"
                >
                  Create Demo Account
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="glass-panel rounded-3xl border border-white/10 px-5 py-4"
                  >
                    <div className="text-2xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] border border-white/10 p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    What judges can explore
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    One product story, four linked flows
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-200">
                  <Shield size={22} />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 transition hover:border-white/15 hover:bg-white/5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-lg font-medium text-white">{feature.title}</div>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
