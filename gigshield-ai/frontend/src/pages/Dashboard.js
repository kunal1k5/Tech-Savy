import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  AlertTriangle,
  Clock3,
  MapPinned,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button, { buttonStyles } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { ScanPanel } from "../components/ui/Loader";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { getFraudStatusLabel, getStatusLabel } from "../data/mockPlatform";
import { cn } from "../utils/cn";
import { formatINR } from "../utils/helpers";

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: "easeOut",
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: "easeOut" },
  },
};

function getRiskTone(level) {
  if (level === "High") {
    return "danger";
  }

  if (level === "Medium") {
    return "warning";
  }

  return "success";
}

function getClaimTone(status) {
  if (status === "paid") {
    return "success";
  }

  if (status === "manual_review") {
    return "danger";
  }

  if (status === "approved") {
    return "info";
  }

  return "warning";
}

function MetricCard({
  label,
  value,
  countValue,
  formatValue,
  subtitle,
  tone = "default",
  icon: Icon,
  featured = false,
  pulse = false,
}) {
  const toneStyles = {
    success: "border-emerald-400/20",
    warning: "border-amber-400/20",
    danger: "border-rose-400/20",
    info: "border-sky-400/20",
    default: "border-white/10",
  };

  return (
    <motion.div
      className="rounded-[26px]"
      animate={
        pulse
          ? {
              boxShadow: [
                "0 0 0 rgba(244,63,94,0)",
                "0 0 26px rgba(244,63,94,0.28)",
                "0 0 0 rgba(244,63,94,0)",
              ],
            }
          : undefined
      }
      transition={pulse ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <Card
        glow={tone === "danger" ? "rose" : tone === "warning" ? "amber" : tone === "success" ? "emerald" : "sky"}
        interactive
        className={cn(toneStyles[tone] || toneStyles.default, pulse && "risk-pulse")}
      >
        {featured ? (
          <motion.div
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["0%", "260%"] }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          />
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-400">{label}</div>
            <div
              className={`font-display font-semibold tracking-tight text-white ${
                featured ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
              }`}
            >
              {typeof countValue === "number" ? (
                <CountUp
                  end={countValue}
                  duration={1.5}
                  formattingFn={formatValue}
                  preserveValue
                />
              ) : (
                value
              )}
            </div>
            <div className="text-sm leading-6 text-slate-400">{subtitle}</div>
          </div>
          {Icon ? (
            <div className="rounded-[18px] border border-white/10 bg-slate-900/80 p-3 text-white">
              <Icon size={featured ? 22 : 20} />
            </div>
          ) : null}
        </div>
        {tone !== "default" ? (
          <div className="mt-5">
            <Badge tone={tone} pulse={pulse}>
              {label}
            </Badge>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { platformState, derivedData, actions } = useGigShieldData();
  const latestClaim = derivedData.latestClaim;
  const riskLevel = derivedData.currentRisk?.level || "Safe";
  const riskTone = getRiskTone(riskLevel);

  const activityItems = [
    {
      label: derivedData.hasActivePolicy ? "Active policy" : "Recommended policy",
      value: `${derivedData.displayPlan.name} • ${formatINR(derivedData.dynamicPremium)}/week`,
      tone: derivedData.hasActivePolicy ? "success" : "info",
    },
    {
      label: "Risk update",
      value: platformState.liveMonitor.headline,
      tone: riskTone,
    },
    {
      label: "Fraud check",
      value: getFraudStatusLabel(platformState.fraudWatch.status),
      tone: derivedData.fraudTone,
    },
    {
      label: "Latest claim",
      value: latestClaim ? getStatusLabel(latestClaim.status) : "No claim yet",
      tone: latestClaim ? getClaimTone(latestClaim.status) : "info",
    },
  ];

  return (
    <motion.div
      className="page-shell"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="space-y-2"
      >
        <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">
          Hi {platformState.worker.name.split(" ")[0]}
        </h1>
        <div className="flex items-center gap-2 text-base text-slate-400">
          <MapPinned size={16} className="text-sky-300" />
          <span>
            {platformState.worker.area}, {platformState.worker.city}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge tone={derivedData.hasActivePolicy ? "success" : "info"}>
            {derivedData.hasActivePolicy ? derivedData.activePlan.name : `${derivedData.displayPlan.name} recommended`}
          </Badge>
          <Badge tone="success">Premium {formatINR(derivedData.dynamicPremium)}/week</Badge>
        </div>
      </motion.div>

      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 xl:grid-cols-[1.45fr_1fr_0.95fr]"
      >
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Your Earnings"
            countValue={platformState.worker.weeklyIncome}
            formatValue={(val) => formatINR(Math.round(val))}
            subtitle={`Average weekly income. Active today: ${platformState.worker.activeHoursToday} hours.`}
            icon={Wallet}
            tone="success"
            featured
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <MetricCard
            label="Today's Loss"
            countValue={derivedData.latestLossAmount}
            formatValue={(val) => formatINR(Math.round(val))}
            subtitle={`${derivedData.hoursLostToday} hours lost today.`}
            icon={Clock3}
            tone="warning"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <MetricCard
            label="Risk Level"
            value={riskLevel}
            subtitle={`${derivedData.currentRisk?.zone || "Your area"} is currently being watched.`}
            icon={AlertTriangle}
            tone={riskTone}
            pulse={riskTone === "danger"}
          />
        </motion.div>
      </motion.div>

      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.1 }}
        className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"
      >
        <motion.div variants={itemVariants}>
          <Card interactive>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">Claims</h2>
                <p className="mt-1 text-sm text-slate-400">See your recent claims and payout status.</p>
              </div>
              <Link to="/claims" className={cn(buttonStyles({ variant: "secondary", size: "sm" }))}>
                View all
              </Link>
            </div>

            {platformState.claims.length ? (
              <div className="mt-5 space-y-3">
                {platformState.claims.slice(0, 3).map((claim, index) => (
                  <motion.div
                    key={claim.id}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.08, duration: 0.34, ease: "easeOut" }}
                    whileHover={{ x: 4, scale: 1.015 }}
                    className="rounded-[20px] border border-white/10 bg-slate-900/75 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">{claim.headline}</div>
                        <div className="mt-1 text-sm text-slate-400">{claim.area}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">{formatINR(claim.amount)}</div>
                        <div className="mt-2">
                          <Badge tone={getClaimTone(claim.status)}>{getStatusLabel(claim.status)}</Badge>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  icon={ShieldCheck}
                  title="No claims yet"
                  description="A new claim will show here when a disruption affects your work."
                  action={
                    <Button type="button" variant="primary" onClick={() => actions.triggerScenario("rainBurst")}>
                      Check now
                    </Button>
                  }
                />
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card interactive>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">Activity</h2>
                <p className="mt-1 text-sm text-slate-400">Quick status for risk, fraud, and claims.</p>
              </div>
              <Badge tone={riskTone} pulse={riskTone === "danger"}>
                {riskLevel}
              </Badge>
            </div>

            <div className="mt-5">
              <ScanPanel
                status={platformState.fraudWatch.status === "flagged" ? "Suspicious" : "Verified"}
                label={platformState.fraudWatch.summary}
                tone={derivedData.fraudTone}
              />
            </div>

            <div className="mt-5 space-y-3">
              {activityItems.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.08, duration: 0.34, ease: "easeOut" }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-slate-900/75 px-4 py-4"
                >
                  <div>
                    <div className="text-sm text-slate-400">{item.label}</div>
                    <div className="mt-1 text-base font-medium text-white">{item.value}</div>
                  </div>
                  <Badge tone={item.tone}>{item.label}</Badge>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={actions.refreshSignals}>
                Cycle risk
              </Button>
              <Button type="button" variant="secondary" onClick={actions.runFraudDrill}>
                Check fraud
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
