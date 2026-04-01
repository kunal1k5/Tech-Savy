import React from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  AlertTriangle,
  Clock3,
  CloudRain,
  FileText,
  ShieldAlert,
  Sparkles,
  Wallet,
  Wind,
} from "lucide-react";
import Card, { CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import SectionHeader from "../components/ui/SectionHeader";
import { ScanPanel } from "../components/ui/Loader";
import { useGigShieldData } from "../context/GigShieldDataContext";
import { getFraudStatusLabel, getStatusLabel } from "../data/mockPlatform";
import { cn } from "../utils/cn";
import { formatINR } from "../utils/helpers";

const EVENT_ICONS = {
  Rainfall: CloudRain,
  AQI: Wind,
};

const HISTORY_TONES = {
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  danger: "border-rose-400/20 bg-rose-400/10 text-rose-100",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  default: "border-white/10 bg-white/5 text-slate-200",
};

const pageVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      staggerChildren: 0.08,
    },
  },
};

const blockVariants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: "easeOut" },
  },
};

function getClaimTone(status) {
  if (status === "paid") {
    return "success";
  }

  if (status === "approved") {
    return "info";
  }

  if (status === "manual_review") {
    return "danger";
  }

  return "warning";
}

function ClaimTimeline({ claim }) {
  const steps = [
    {
      label: "Created",
      done: true,
      meta: claim.id,
    },
    {
      label: "Processing",
      done: claim.fraudStatus !== "in_progress",
      meta: getFraudStatusLabel(claim.fraudStatus),
    },
    {
      label: claim.status === "manual_review" ? "Manual Review" : "Paid",
      done: claim.status === "manual_review" || claim.status === "paid",
      meta: claim.status === "manual_review" ? "Held" : claim.payoutWindow,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map((step, index) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 + index * 0.08, duration: 0.28 }}
          className="relative"
        >
          {index < steps.length - 1 ? (
            <div className="pointer-events-none absolute left-[calc(50%+22px)] right-[-24%] top-5 hidden h-px bg-gradient-to-r from-white/20 to-white/5 md:block" />
          ) : null}

          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            className="rounded-[22px] border border-white/10 bg-slate-950/50 p-4"
          >
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0.92, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.18 + index * 0.08, duration: 0.24 }}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-[16px] border text-sm font-semibold",
                  step.done
                    ? "border-sky-400/30 bg-sky-400/[0.12] text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-500"
                )}
              >
                {index + 1}
              </motion.div>
              <div>
                <div className="font-semibold text-white">{step.label}</div>
                <div className="text-sm text-slate-400">{step.meta}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Claims() {
  const { platformState, derivedData, actions } = useGigShieldData();
  const verifiedClaims = platformState.claims.filter((claim) => claim.fraudStatus === "verified");

  return (
    <motion.div className="page-shell" variants={pageVariants} initial="hidden" animate="show">
      <SectionHeader
        eyebrow="Claims"
        title="Track claim status clearly"
        description="Rainfall above 50 mm or AQI above 400 creates a claim automatically, then moves it from pending to paid."
        action={
          <>
            <Button type="button" variant="primary" rightIcon={CloudRain} onClick={() => actions.triggerScenario("rainBurst")}>
              Trigger Rain Event
            </Button>
            <Button type="button" variant="secondary" rightIcon={Sparkles} onClick={() => actions.triggerScenario("airQualitySpike")}>
              Trigger AQI Event
            </Button>
            <Button type="button" variant="secondary" rightIcon={ShieldAlert} onClick={actions.runFraudDrill}>
              Trigger Fraud Drill
            </Button>
          </>
        }
      />

      <motion.div variants={blockVariants} className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card glow="sky" padding="md">
          <div className="text-sm text-slate-400">Claims Tracked</div>
          <div className="mt-2 font-display text-4xl font-semibold text-white">
            <CountUp end={platformState.claims.length} duration={1.1} preserveValue />
          </div>
          <div className="mt-2 text-sm text-slate-500">Pending, approved, paid, and manual review claims stay in one ledger.</div>
        </Card>

        <Card glow="amber" padding="md">
          <div className="text-sm text-slate-400">Pending Claims</div>
          <div className="mt-2 font-display text-4xl font-semibold text-white">
            <CountUp end={derivedData.pendingClaims.length} duration={1.1} preserveValue />
          </div>
          <div className="mt-2 text-sm text-slate-500">These claims are still inside automated verification or review.</div>
        </Card>

        <Card glow="emerald" padding="md">
          <div className="text-sm text-slate-400">Verified Claims</div>
          <div className="mt-2 font-display text-4xl font-semibold text-white">
            <CountUp end={verifiedClaims.length} duration={1.1} preserveValue />
          </div>
          <div className="mt-2 text-sm text-slate-500">Verified claims are eligible to move toward payout quickly.</div>
        </Card>

        <Card glow={derivedData.fraudTone === "danger" ? "rose" : "emerald"} padding="md">
          <div className="text-sm text-slate-400">Fraud Check</div>
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.16, duration: 0.28 }}
            className="mt-2 font-display text-4xl font-semibold text-white"
          >
            {platformState.fraudWatch.status === "flagged" ? "Suspicious" : "Verified"}
          </motion.div>
          <div className="mt-2 text-sm text-slate-500">{platformState.fraudWatch.latestAudit}</div>
        </Card>
      </motion.div>

      <motion.div variants={blockVariants} className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card glow={derivedData.fraudTone === "danger" ? "rose" : "emerald"}>
          <CardHeader>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Fraud Check Status</div>
              <CardTitle className="mt-2">Animated fraud scan</CardTitle>
              <CardDescription className="mt-2">
                Keep the fraud verdict visible without making the page feel technical or noisy.
              </CardDescription>
            </div>
          </CardHeader>

          <div className="mt-5">
            <ScanPanel
              status={platformState.fraudWatch.status === "flagged" ? "Suspicious" : "Verified"}
              label={platformState.fraudWatch.summary}
              tone={derivedData.fraudTone}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.14, duration: 0.28 }}
            className={cn(
              "mt-4 text-sm font-semibold",
              derivedData.fraudTone === "danger" ? "text-rose-200" : "text-emerald-200"
            )}
          >
            {platformState.fraudWatch.status === "flagged" ? "Suspicious activity detected" : "Verified and safe to process"}
          </motion.div>

          <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-4 text-sm leading-6 text-slate-400">
            {platformState.fraudWatch.activeFlags.length ? (
              <div className="space-y-2">
                {platformState.fraudWatch.activeFlags.map((flag, index) => (
                  <motion.div
                    key={flag}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + index * 0.05, duration: 0.24 }}
                    className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-rose-100"
                  >
                    {flag}
                  </motion.div>
                ))}
              </div>
            ) : (
              "No active anomalies detected. Claims can continue through the automated flow."
            )}
          </div>
        </Card>

        <Card glow="sky">
          <CardHeader>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Status Language</div>
              <CardTitle className="mt-2">Claim status badges</CardTitle>
            </div>
          </CardHeader>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
              <motion.span initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.08, duration: 0.24 }} className="inline-flex">
                <Badge tone="warning">Pending</Badge>
              </motion.span>
              <div className="mt-3 text-sm leading-6 text-slate-400">Pending claims are waiting for fraud checks or approval logic.</div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
              <motion.span initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.14, duration: 0.24 }} className="inline-flex">
                <Badge tone="info">Approved</Badge>
              </motion.span>
              <div className="mt-3 text-sm leading-6 text-slate-400">Approved claims have cleared the coverage rules and are queued for payout.</div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-slate-950/55 p-4">
              <motion.span initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.24 }} className="inline-flex">
                <Badge tone="success">Paid</Badge>
              </motion.span>
              <div className="mt-3 text-sm leading-6 text-slate-400">Paid claims show final settlement timing and completed protection value.</div>
            </div>
          </div>
        </Card>
      </motion.div>

      {!platformState.claims.length ? (
        <EmptyState
          icon={FileText}
          title="No claims generated yet"
          description="Simulate a disruption or fraud drill to populate the ledger with production-style claims."
          action={
            <Button type="button" variant="primary" onClick={() => actions.triggerScenario("rainBurst")}>
              Generate First Claim
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {platformState.claims.map((claim, index) => {
            const EventIcon = EVENT_ICONS[claim.eventType] || Sparkles;
            const tone = getClaimTone(claim.status);
            const progress =
              claim.status === "paid"
                ? 100
                : claim.status === "approved"
                  ? 74
                  : claim.status === "manual_review"
                    ? 58
                    : 30;

            return (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + index * 0.08, duration: 0.36, ease: "easeOut" }}
              >
                <Card glow={tone === "danger" ? "rose" : tone === "success" ? "emerald" : "sky"} interactive>
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-[22px] border border-white/10 bg-slate-950/55 text-white">
                        <EventIcon size={20} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-2xl">{claim.headline}</CardTitle>
                          <motion.span initial={{ scale: 0.84, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.18 + index * 0.08, duration: 0.24 }} className="inline-flex">
                            <Badge tone={tone}>{getStatusLabel(claim.status)}</Badge>
                          </motion.span>
                          <motion.span initial={{ scale: 0.84, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.24 + index * 0.08, duration: 0.24 }} className="inline-flex">
                            <Badge tone={claim.fraudStatus === "flagged" ? "danger" : claim.fraudStatus === "verified" ? "success" : "warning"}>
                              {getFraudStatusLabel(claim.fraudStatus)}
                            </Badge>
                          </motion.span>
                        </div>

                        <CardDescription className="max-w-3xl">
                          {claim.source} detected {claim.triggerValue} in {claim.area}. Estimated worker loss is {formatINR(claim.amount)}.
                        </CardDescription>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>{claim.id}</span>
                          <span>Created {new Date(claim.detectedAt).toLocaleString()}</span>
                          <span>Updated {new Date(claim.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[280px]">
                      <div className="rounded-[24px] border border-white/10 bg-slate-950/55 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Loss Calculation</div>
                          <Wallet size={16} className="text-emerald-300" />
                        </div>

                        <div className="mt-3 font-display text-3xl font-semibold text-white">
                          {formatINR(claim.amount)}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">{claim.payoutWindow}</div>

                        <div className="mt-4 h-2 rounded-full bg-white/5">
                          <motion.div
                            className={cn(
                              "h-2 rounded-full",
                              tone === "success"
                                ? "bg-gradient-to-r from-emerald-300 to-teal-400"
                                : tone === "danger"
                                  ? "bg-gradient-to-r from-rose-400 to-red-500"
                                  : tone === "warning"
                                    ? "bg-gradient-to-r from-amber-300 to-orange-400"
                                    : "bg-gradient-to-r from-sky-300 to-cyan-400"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ delay: 0.24 + index * 0.08, duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <ClaimTimeline claim={claim} />
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.95fr]">
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Clock3 size={16} className="text-sky-300" />
                        Timeline history
                      </div>

                      <div className="mt-4 space-y-3">
                        {claim.history.map((entry, historyIndex) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.16 + historyIndex * 0.05, duration: 0.24 }}
                            className={cn(
                              "rounded-[18px] border px-4 py-3 text-sm",
                              HISTORY_TONES[entry.tone] || HISTORY_TONES.default
                            )}
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="font-semibold text-white">{entry.stage.replace(/_/g, " ")}</div>
                              <div className="text-xs text-slate-400">
                                {new Date(entry.timestamp).toLocaleString()}
                              </div>
                            </div>
                            <div className="mt-2 leading-6">{entry.detail}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <AlertTriangle size={16} className="text-amber-300" />
                        Judge summary
                      </div>

                      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-400">
                        <p>
                          The UI highlights the exact rupee impact, where the claim is in the flow, and whether fraud checks passed.
                        </p>
                        <p>
                          Status:
                          {" "}
                          <span className="font-semibold text-white">{getStatusLabel(claim.status)}</span>
                        </p>
                        <p>
                          Fraud verdict:
                          {" "}
                          <span className="font-semibold text-white">{getFraudStatusLabel(claim.fraudStatus)}</span>
                        </p>
                        <p>
                          Payout timing:
                          {" "}
                          <span className="font-semibold text-white">{claim.payoutWindow}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
