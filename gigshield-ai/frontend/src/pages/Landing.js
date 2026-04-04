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
  { label: "Avg AI review", value: "4 min" },
  { label: "Trust baseline", value: "82%" },
  { label: "Live monitoring zones", value: "14" },
];

const features = [
  {
    icon: Activity,
    title: "Decision engine",
    description: "Real-time monitoring turns weather and route signals into live claim actions.",
  },
  {
    icon: Wallet,
    title: "Fraud Intelligence Engine",
    description: "Behavior, location, and context are fused into one trust-aware signal.",
  },
  {
    icon: ShieldCheck,
    title: "Self-correcting AI",
    description: "Disputes and proof uploads let the system re-check itself in real time.",
  },
];

const snapshotItems = [
  {
    label: "Decision Engine",
    value: "Live",
    note: "Real-time monitoring is active in Bengaluru",
  },
  {
    label: "Latest event",
    value: "Rainfall detected",
    note: "Decision routed and reviewed in real time",
  },
  {
    label: "Trust Signal",
    value: "Stable",
    note: "Location and timing confidence validated",
  },
];

const lifecycleSteps = [
  {
    label: "Detect",
    note: "Live monitoring watches risk, location, and behavioral signals.",
  },
  {
    label: "Decide",
    note: "The decision engine classifies the claim and sets the next action.",
  },
  {
    label: "Validate",
    note: "Users can challenge the result with disputes and proof uploads.",
  },
  {
    label: "Correct",
    note: "AI re-verification refines the outcome and updates the final claim state.",
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
              <p className="text-base font-semibold text-slate-900">GigShield AI</p>
              <p className="text-xs text-slate-500">Decision intelligence</p>
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
                Real-time decision intelligence for delivery and mobility workers
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[1.05]">
                  An AI Decision Intelligence System for gig workers
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
                  We are not an insurance platform - we are an AI Decision Intelligence System and real-time protection system for gig workers.
                </p>
                <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
                  Risk Engine, Decision Engine, Fraud Intelligence, and self-correcting AI work in one connected loop.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Open Workspace
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
                    <p className="text-sm font-medium text-slate-500">Live decision view</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                      Visible, fast, self-correcting
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white p-3 text-[#2563EB]">
                    <ShieldCheck size={20} />
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Decision Engine</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        Self-correcting AI checks running
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
                  Decision intelligence designed to feel simple
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Clear signals, fast decisions, and self-correcting AI in one clean workflow.
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

              <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)] md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium text-blue-700">Self-Correcting AI System</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      AI Decision Lifecycle
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                      Our system not only detects problems, it validates and corrects decisions.
                    </p>
                  </div>

                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    Adaptive loop
                  </span>
                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-4">
                  {lifecycleSteps.map((step, index) => (
                    <div
                      key={step.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{step.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>
        </main>
      </div>
    </div>
  );
}
