import React from "react";
import CountUp from "react-countup";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import InfoTooltip from "../components/ui/InfoTooltip";
import SurfaceLoadingPanel from "../components/ui/SurfaceLoadingPanel";
import SurfaceScanPanel from "../components/ui/SurfaceScanPanel";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { cn } from "../utils/cn";
import { formatINR } from "../utils/helpers";

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut",
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: "easeOut" },
  },
};

const riskStyles = {
  Low: {
    pill: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    accent: "text-emerald-700",
  },
  Medium: {
    pill: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    accent: "text-amber-700",
  },
  High: {
    pill: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    accent: "text-red-700",
  },
};

function getFirstName(name = "") {
  return name.trim().split(" ")[0] || "there";
}

function getClaimStatus(status) {
  if (status === "paid") {
    return { label: "Paid", className: "bg-emerald-50 text-emerald-700" };
  }

  if (status === "manual_review") {
    return { label: "Manual Review", className: "bg-red-50 text-red-700" };
  }

  return { label: "Processing", className: "bg-amber-50 text-amber-700" };
}

function getFraudState(status, flags = []) {
  if (status === "flagged") {
    return {
      score: Math.min(96, 82 + flags.length * 4),
      label: "Suspicious",
      className: "bg-red-50 text-red-700",
      dot: "bg-red-500",
      bar: "bg-red-500",
      tone: "danger",
    };
  }

  if (status === "in_progress") {
    return {
      score: 58,
      label: "Warning",
      className: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      tone: "warning",
    };
  }

  return {
    score: Math.max(12, 22 - flags.length * 2),
    label: "Safe",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    tone: "success",
  };
}

function getRiskAnimation(level) {
  if (level === "High") {
    return {
      animate: { opacity: [1, 0.6, 1], scale: [1, 1.35, 1] },
      transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
    };
  }

  if (level === "Medium") {
    return {
      animate: { opacity: [0.85, 1, 0.85], scale: [1, 1.14, 1] },
      transition: { repeat: Infinity, duration: 2.3, ease: "easeInOut" },
    };
  }

  return {
    animate: undefined,
    transition: undefined,
  };
}

function DashboardCard({ children, className }) {
  return (
    <motion.section
      variants={itemVariants}
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-md", className)}
    >
      {children}
    </motion.section>
  );
}

function CurrencyValue({ value, className }) {
  return (
    <div className={cn("text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl", className)}>
      <CountUp
        end={value}
        duration={1.5}
        formattingFn={(currentValue) => formatINR(Math.round(currentValue))}
        preserveValue
      />
    </div>
  );
}

export default function Dashboard() {
  const { platformState, derivedData, uiState } = useGigShieldData();
  const workerFirstName = getFirstName(platformState.worker.name);
  const currentRisk = derivedData.currentRisk?.level || "Low";
  const currentRiskStyle = riskStyles[currentRisk] || riskStyles.Low;
  const riskAnimation = getRiskAnimation(currentRisk);
  const activePlan = derivedData.activePlan || derivedData.displayPlan;
  const recentClaims = platformState.claims.slice(0, 2);
  const fraudState = getFraudState(
    platformState.fraudWatch.status,
    platformState.fraudWatch.activeFlags
  );

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Hi, {workerFirstName} 👋
        </h2>
        <p className="text-sm text-slate-600 md:text-base">Here&apos;s your activity overview</p>
      </motion.header>

      <AnimatePresence>
        {uiState.syncing ? (
          <SurfaceLoadingPanel
            title="Refreshing dashboard"
            description="Updating monitoring signals, premium changes, and claim activity."
          />
        ) : null}
      </AnimatePresence>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <DashboardCard className="overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Protected Income</p>
              <CurrencyValue value={platformState.worker.weeklyIncome} className="mt-4 text-blue-600" />
              <p className="mt-2 text-sm text-slate-500">This week</p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Wallet size={20} />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Risk-based protection is active under your current plan
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Loss Detected</p>
              <CurrencyValue value={derivedData.latestLossAmount} className="mt-4" />
              <p className="mt-2 text-sm text-slate-500">Due to disruption</p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <AlertTriangle size={20} />
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Current Risk</p>
              <div className="mt-4 flex items-center gap-3">
                <motion.span
                  className={cn("h-3 w-3 rounded-full", currentRiskStyle.dot)}
                  animate={riskAnimation.animate}
                  transition={riskAnimation.transition}
                />
                <div className={cn("text-3xl font-semibold tracking-tight md:text-4xl", currentRiskStyle.accent)}>
                  {currentRisk}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {derivedData.currentRisk?.zone || platformState.worker.area}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
                currentRiskStyle.pill
              )}
            >
              {currentRisk}
            </span>
          </div>
        </DashboardCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <DashboardCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Policy</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {activePlan?.name || "No active plan"}
              </h3>
            </div>

            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Active
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Premium</p>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                <CountUp
                  end={derivedData.dynamicPremium}
                  duration={1.5}
                  formattingFn={(value) => formatINR(Math.round(value))}
                  preserveValue
                />
                <span className="ml-1 text-sm font-medium text-slate-500">/week</span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Coverage status</p>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                Active coverage
              </div>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Claims Preview</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                Recent claims
              </h3>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FileText size={18} />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {recentClaims.length ? (
              recentClaims.map((claim) => {
                const claimStatus = getClaimStatus(claim.status);

                return (
                  <motion.div
                    key={claim.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {claim.headline}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{formatINR(claim.amount)}</p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold",
                        claimStatus.className
                      )}
                    >
                      {claimStatus.label}
                    </span>
                  </motion.div>
                );
              })
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No recent claims yet.
              </div>
            )}
          </div>
        </DashboardCard>
      </section>

      <DashboardCard>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-500">Fraud Intelligence</p>
              <InfoTooltip
                label="Fraud intelligence information"
                text="Automated system checks route continuity, repeated claims, and document signals before payout."
              />
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Claim trust overview
            </h3>
          </div>

          <span
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
              fraudState.className
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", fraudState.dot)} />
            {fraudState.label}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[220px_220px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Risk Score</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              <CountUp end={fraudState.score} duration={1} preserveValue />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Status</p>
            <div className="mt-3">
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold",
                  fraudState.className
                )}
              >
                {fraudState.label}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <SurfaceScanPanel
              title="Real-time monitoring"
              description={platformState.fraudWatch.summary}
              tone={fraudState.tone}
              badgeLabel={fraudState.label === "Safe" ? "Verified" : fraudState.label}
            />

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <BadgeCheck size={16} />
                Automated system
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {platformState.fraudWatch.latestAudit || platformState.fraudWatch.summary}
              </p>

              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <motion.div
                  className={cn("h-2 rounded-full", fraudState.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${fraudState.score}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>
    </motion.div>
  );
}
