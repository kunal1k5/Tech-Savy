import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const stats = [
  { label: "Avg payout time", value: "4 min" },
  { label: "Coverage starting", value: "\u20B915/week" },
  { label: "Active monitoring zones", value: "14" },
];

const features = [
  {
    icon: Activity,
    title: "Real-time risk detection",
    description: "Weather and route signals update cover automatically.",
  },
  {
    icon: Wallet,
    title: "Automatic claim system",
    description: "Eligible events trigger claims without manual follow-up.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud protection engine",
    description: "Suspicious activity is checked before any payout is released.",
  },
];

const snapshotItems = [
  {
    label: "Coverage",
    value: "Active",
    note: "Starter plan live in Bengaluru",
  },
  {
    label: "Latest event",
    value: "Rainfall detected",
    note: "Claim created and reviewed in real time",
  },
  {
    label: "Fraud status",
    value: "Protected",
    note: "Location and claim timing verified",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_42%)]" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-blue-50 blur-3xl" />
        <div className="absolute left-0 top-80 h-72 w-72 rounded-full bg-slate-100 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">GigShield</p>
              <p className="text-xs text-slate-500">Income protection</p>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Signup
            </Link>
          </nav>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <CheckCircle2 size={16} />
                Live protection for delivery and mobility workers
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[1.05]">
                  Income protection built for gig workers
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
                  Real-time risk monitoring, automatic claims, and smart fraud protection.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Start Demo
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Create Account
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-slate-950">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
            >
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Live protection view</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                      Clean, fast, payout-ready
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white p-3 text-[#2563EB]">
                    <ShieldCheck size={20} />
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Risk monitor</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        Automatic cover checks running
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {snapshotItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-slate-500">{item.label}</p>
                          <p className="text-sm font-semibold text-slate-950">{item.value}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="mt-16 rounded-[32px] bg-slate-50 px-6 py-16 md:px-8">
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="mx-auto max-w-5xl"
            >
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-blue-700">Product features</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Protection designed to feel simple
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Clear signals, fast claims, and quiet fraud checks in one clean workflow.
                </p>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-slate-950">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </section>
        </main>
      </div>
    </div>
  );
}
