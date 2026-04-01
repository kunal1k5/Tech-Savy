import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CloudRain,
  MapPinned,
  Shield,
  Siren,
  Wallet,
} from "lucide-react";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import { buttonStyles } from "../components/ui/Button";
import { isAuthenticated } from "../utils/auth";

const features = [
  {
    icon: CloudRain,
    title: "Trigger-led protection",
    description:
      "Weather, AQI, and route slowdown signals create claims automatically when disruption crosses policy thresholds.",
  },
  {
    icon: Siren,
    title: "Visual claim lifecycle",
    description:
      "Claims move from Created to Processing to Paid with visible timestamps, rupee values, and payout timing.",
  },
  {
    icon: MapPinned,
    title: "Fraud-aware payout flow",
    description:
      "Route consistency checks and anomaly detection stay visible without making the product feel overly technical.",
  },
];

const stats = [
  { label: "Average payout window", value: "4 min" },
  { label: "Signals watched per zone", value: "14" },
  { label: "Starter cover", value: "₹15 / week" },
];

export default function Landing() {
  const homeCta = isAuthenticated() ? "/dashboard" : "/register";

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[-8%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-sky-500/[0.16] blur-[180px]" />
      <div className="pointer-events-none absolute right-[-8%] top-[20%] h-[28rem] w-[28rem] rounded-full bg-violet-500/[0.18] blur-[160px]" />
      <div className="pointer-events-none absolute bottom-[-14%] right-[16%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/[0.14] blur-[150px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 md:px-6 lg:px-8">
        <header className="glass-panel flex items-center justify-between rounded-[30px] px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[20px] border border-sky-400/25 bg-sky-400/10">
              <Shield className="fill-sky-300/15 text-sky-200" size={20} />
            </div>
            <div>
              <div className="font-display text-xl font-semibold">GigShield</div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Income Protection OS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonStyles({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link to={homeCta} className={buttonStyles({ variant: "primary" })}>
              {isAuthenticated() ? "Open Dashboard" : "Start Demo"}
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 lg:py-16">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <Badge tone="success" className="w-fit">
                Payout-ready cover for delivery and mobility workers
              </Badge>

              <div className="space-y-5">
                <h1 className="font-display max-w-5xl text-5xl font-semibold leading-[1.05] text-white md:text-7xl">
                  Gig worker income protection that
                  <span className="text-gradient"> looks and feels production-ready.</span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                  GigShield combines live disruption monitoring, automated claims, and fraud checks into one premium fintech workflow designed to impress judges and feel intuitive for users.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to={homeCta} className={buttonStyles({ variant: "primary", size: "lg" })}>
                  {isAuthenticated() ? "Launch Dashboard" : "Launch Product Demo"}
                  <ArrowRight size={16} />
                </Link>
                <Link to="/register" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                  Create Demo Account
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <Card key={stat.label} glow="sky" padding="md">
                    <div className="font-display text-3xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
                  </Card>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <Card glow="violet">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Product Story
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold text-white">
                      One platform, four linked flows
                    </div>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-[20px] border border-white/10 bg-slate-950/55 text-white">
                    <Wallet size={18} />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <motion.div
                        key={feature.title}
                        whileHover={{ x: 4 }}
                        className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-white">
                            <Icon size={18} />
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-white">{feature.title}</div>
                            <p className="mt-2 text-sm leading-7 text-slate-400">{feature.description}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
