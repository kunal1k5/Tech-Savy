import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import BrandIdentity from "../components/branding/BrandIdentity";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  Shield,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const stats = [
  { label: "Claims Auto Processed", value: "1,200+" },
  { label: "Avg Response Time", value: "< 5 sec" },
  { label: "Fraud Detection Accuracy", value: "92%" },
];

const features = [
  {
    icon: Activity,
    title: "Real-time Trigger Engine",
    description:
      "Real-time triggers monitor weather and AQI APIs and activate policy conditions instantly.",
  },
  {
    icon: ShieldCheck,
    title: "AI Fraud Detection System",
    description:
      "AI fraud detection evaluates each claim event before payout to stop suspicious activity early.",
  },
  {
    icon: Wallet,
    title: "Auto Claim + AI Validation",
    description:
      "Auto claim generation creates claims as soon as triggers fire and AI validation finalizes decisions.",
  },
];

const snapshotItems = [
  {
    label: "Live Rain Detected",
    value: "72mm",
    valueClassName: "text-slate-900",
  },
  {
    label: "Trigger Status",
    value: "ACTIVE",
    valueClassName: "text-emerald-700",
  },
  {
    label: "Claim",
    value: "GENERATED",
    valueClassName: "text-blue-700",
  },
  {
    label: "Fraud Score",
    value: "0.12",
    valueClassName: "text-slate-900",
  },
  {
    label: "Decision",
    value: "APPROVED",
    valueClassName: "text-emerald-700",
  },
];

const flowSteps = [
  { icon: Shield, label: "Policy" },
  { icon: Activity, label: "Trigger" },
  { icon: FileText, label: "Claim" },
  { icon: ShieldCheck, label: "AI Decision" },
  { icon: Wallet, label: "Payout" },
];

const trustItems = [
  "Real-time API data (Weather + AQI)",
  "AI fraud detection engine",
  "Automatic claim processing",
  "Secure KYC verification",
];

const liveSignals = [
  { label: "Rain", value: "72mm", emoji: "🌧" },
  { label: "AQI", value: "180", emoji: "🌫" },
  { label: "Status", value: "Monitoring Active", emoji: "🟢" },
];

const lifecycleSteps = [
  {
    label: "Detect",
    note: "Live weather and AQI streams are monitored continuously for policy conditions.",
  },
  {
    label: "Generate",
    note: "Auto claim generation starts immediately after a confirmed trigger.",
  },
  {
    label: "Validate",
    note: "AI fraud detection scores each claim and checks supporting context.",
  },
  {
    label: "Pay",
    note: "Approved claims move directly to payout with no manual request needed.",
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
            <BrandIdentity subtitle="AI parametric insurance platform" />
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
                Built for delivery and mobility workers
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[1.05]">
                  Real-Time AI Insurance for Gig Workers
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
                  Automatically detect risk, trigger claims, and approve payouts using real-time data and AI - no manual requests needed.
                </p>
                <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
                  An AI-powered parametric insurance platform for gig workers that automatically detects risk, generates claims, and prevents fraud in real time.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Start Monitoring
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Try Simulation
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Live demo</p>
                    <p className="text-sm text-slate-500">
                      Test how the system reacts to real-world scenarios
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Try Live Simulation
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Live System Signals
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {liveSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {signal.label}: {signal.value} {signal.emoji}
                    </div>
                  ))}
                </div>
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
                    <p className="text-sm font-medium text-slate-500">Live system output</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                      Real-time claim execution
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white p-3 text-[#2563EB]">
                    <ShieldCheck size={20} />
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Event stream</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        Parametric policy check in progress
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
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-slate-500">{item.label}</p>
                          <p className={`text-sm font-semibold ${item.valueClassName}`}>{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-slate-500">Updated 2s ago from live signals</p>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="mt-10 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)] md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Core flow
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-4">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === flowSteps.length - 1;

                return (
                  <React.Fragment key={step.label}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                      <Icon size={16} className="text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900">{step.label}</span>
                    </div>
                    {!isLast ? <ArrowRight size={16} className="text-slate-400" /> : null}
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-6 md:px-8">
            <p className="text-sm font-semibold text-slate-900">Trust and reliability</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {trustItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
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
                  Real-time insurance automation, made clear
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Auto claim generation, real-time triggers, and AI fraud detection in one clean workflow.
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
                    <p className="text-sm font-medium text-blue-700">Live automation loop</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      Trigger-to-payout lifecycle
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                      Real-time triggers, auto claim generation, and AI fraud detection work as one connected pipeline.
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

              <div className="mt-10 rounded-[28px] border border-blue-100 bg-blue-50 px-6 py-8 text-center">
                <p className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                  We built a system that doesn&apos;t just predict risk - it acts on it.
                </p>
              </div>
            </motion.div>
          </section>
        </main>
      </div>
    </div>
  );
}
