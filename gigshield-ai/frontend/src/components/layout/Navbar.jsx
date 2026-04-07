import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Menu,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useGigPredictAIData } from "../../context/GigPredictAIDataContext";
import { cn } from "../../utils/cn";
import SurfaceButton from "../ui/SurfaceButton";

const LIVE_INDICATORS = [
  {
    label: "Monitoring Active",
    className: "bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-500",
  },
  {
    label: "Decision Engine Running",
    className: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  {
    label: "Fraud Detection Active",
    className: "bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
];

const NOTIFICATION_TONE_STYLES = {
  info: {
    card: "border-blue-100 bg-blue-50/70",
    icon: "bg-blue-100 text-blue-700",
    dot: "bg-blue-600",
  },
  success: {
    card: "border-emerald-100 bg-emerald-50/70",
    icon: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-600",
  },
  warning: {
    card: "border-amber-100 bg-amber-50/80",
    icon: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  danger: {
    card: "border-rose-100 bg-rose-50/80",
    icon: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
  },
};

function getRelativeTimeLabel(timestamp) {
  if (!timestamp) {
    return "Live now";
  }

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Live now";
  }

  const elapsedMinutes = Math.max(0, Math.round((Date.now() - parsedDate.getTime()) / 60000));
  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hr ago`;
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function getClaimTone(status) {
  if (status === "paid") {
    return "success";
  }

  if (status === "manual_review") {
    return "danger";
  }

  if (status === "approved" || status === "pending") {
    return "warning";
  }

  return "info";
}

function buildNotifications(platformState, uiState, derivedData) {
  const notifications = [];
  const latestClaim = derivedData.latestClaim;
  const currentRisk = derivedData.currentRisk;
  const activeFlagsCount = platformState.fraudWatch.activeFlags?.length || 0;

  if (uiState.claimTriggering) {
    notifications.push({
      id: "claim-triggering",
      title: "Auto-claim evaluation started",
      body: "The decision engine is checking trigger conditions and payout eligibility.",
      timeLabel: "Live now",
      tone: "warning",
      icon: RefreshCw,
      isUnread: true,
    });
  } else if (uiState.planUpdating) {
    notifications.push({
      id: "plan-updating",
      title: "Policy activation in progress",
      body: "Your protection plan is being linked to the live premium and claim engine.",
      timeLabel: "Live now",
      tone: "info",
      icon: Wallet,
      isUnread: true,
    });
  } else if (uiState.riskUpdating) {
    notifications.push({
      id: "risk-updating",
      title: "Risk score is recalculating",
      body: "Fresh environmental signals are being processed for the latest premium.",
      timeLabel: "Live now",
      tone: "info",
      icon: RefreshCw,
      isUnread: true,
    });
  } else if (uiState.syncing) {
    notifications.push({
      id: "syncing",
      title: "Syncing protection data",
      body: "Pulling policy, claims, and fraud watch data from the backend.",
      timeLabel: "Live now",
      tone: "info",
      icon: RefreshCw,
      isUnread: true,
    });
  }

  notifications.push({
    id: "live-monitor",
    title: platformState.liveMonitor.headline || "Live protection online",
    body:
      platformState.liveMonitor.summary ||
      "Risk, claim, and fraud monitoring updates will appear here.",
    timeLabel: getRelativeTimeLabel(platformState.liveMonitor.lastHeartbeatAt),
    tone: getClaimTone(platformState.liveMonitor.stage),
    icon: Activity,
    isUnread: true,
  });

  if (latestClaim) {
    notifications.push({
      id: `claim-${latestClaim.id}`,
      title: `Claim update: ${derivedData.statusLabels.claim}`,
      body:
        latestClaim.status === "paid"
          ? `${latestClaim.headline} completed and payout has been released.`
          : latestClaim.status === "manual_review"
            ? `${latestClaim.headline} moved to manual review because suspicious activity was detected.`
            : `${latestClaim.headline} is moving through the automated payout checks.`,
      timeLabel: getRelativeTimeLabel(latestClaim.updatedAt || latestClaim.detectedAt),
      tone: getClaimTone(latestClaim.status),
      icon: Wallet,
      isUnread: true,
    });
  }

  notifications.push({
    id: "fraud-watch",
    title: `Fraud watch: ${derivedData.statusLabels.fraud}`,
    body:
      activeFlagsCount > 0
        ? `${activeFlagsCount} active flag${activeFlagsCount === 1 ? "" : "s"} detected. ${platformState.fraudWatch.latestAudit}`
        : platformState.fraudWatch.summary,
    timeLabel: getRelativeTimeLabel(platformState.fraudWatch.lastCheckedAt),
    tone:
      platformState.fraudWatch.status === "flagged"
        ? "danger"
        : platformState.fraudWatch.status === "in_progress"
          ? "warning"
          : "success",
    icon:
      platformState.fraudWatch.status === "flagged"
        ? AlertTriangle
        : ShieldCheck,
    isUnread: platformState.fraudWatch.status !== "verified",
  });

  if (currentRisk) {
    notifications.push({
      id: "risk-snapshot",
      title: `Risk engine: ${currentRisk.level} risk`,
      body: `${currentRisk.zone || platformState.worker.area || "Your area"} is currently scoring ${currentRisk.score}/100.`,
      timeLabel: getRelativeTimeLabel(platformState.liveMonitor.lastHeartbeatAt),
      tone:
        currentRisk.level === "High"
          ? "danger"
          : currentRisk.level === "Medium"
            ? "warning"
            : "success",
      icon: Activity,
      isUnread: currentRisk.level !== "Low",
    });
  }

  if (derivedData.displayPlan) {
    notifications.push({
      id: "policy-status",
      title: derivedData.hasActivePolicy
        ? `${derivedData.displayPlan.name} cover is active`
        : `${derivedData.displayPlan.name} plan is ready`,
      body: derivedData.hasActivePolicy
        ? `Weekly premium is ${derivedData.dynamicPremium} INR with up to ${derivedData.totalProtectedAmount} INR protected.`
        : "Activate protection to unlock live claim automation and payout support.",
      timeLabel: "Current setup",
      tone: derivedData.hasActivePolicy ? "success" : "info",
      icon: Wallet,
      isUnread: !derivedData.hasActivePolicy,
    });
  }

  return notifications.slice(0, 5);
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Navbar({ title, onMenuClick }) {
  const { platformState, uiState, derivedData } = useGigPredictAIData();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationsRef = useRef(null);
  const worker = platformState.worker;
  const displayName = worker.name || "Gig worker";
  const displayPlatform = worker.platform || "Profile incomplete";
  const notifications = useMemo(
    () => buildNotifications(platformState, uiState, derivedData),
    [derivedData, platformState, uiState]
  );
  const unreadCount = notifications.filter((notification) => notification.isUnread).length;

  useEffect(() => {
    if (!isNotificationOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!notificationsRef.current?.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsNotificationOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationOpen]);

  useEffect(() => {
    setIsNotificationOpen(false);
  }, [title]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SurfaceButton
            onClick={onMenuClick}
            variant="icon"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </SurfaceButton>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-900 md:text-2xl">{title}</h1>
            <p className="mt-1 hidden text-sm text-slate-500 md:block">
              Decision intelligence is live and monitoring your environment
            </p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {LIVE_INDICATORS.map((indicator) => (
            <div
              key={indicator.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${indicator.className}`}
            >
              <span className={`h-2 w-2 rounded-full animate-pulse ${indicator.dotClassName}`} />
              {indicator.label}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 md:hidden">
            <span className="h-2 w-2 rounded-full animate-pulse bg-blue-500" />
            Monitoring Active
          </div>

          <div className="relative" ref={notificationsRef}>
            <SurfaceButton
              onClick={() => setIsNotificationOpen((current) => !current)}
              variant="icon"
              size="icon"
              className="relative"
              aria-label="Open notifications"
              aria-expanded={isNotificationOpen}
              aria-haspopup="dialog"
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </SurfaceButton>

            <AnimatePresence>
              {isNotificationOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.16)]"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                          Notification Center
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-slate-900">
                          {unreadCount > 0
                            ? `${unreadCount} live update${unreadCount === 1 ? "" : "s"}`
                            : "All caught up"}
                        </h2>
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Live feed
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[26rem] overflow-y-auto px-3 py-3">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => {
                        const Icon = notification.icon;
                        const toneStyles =
                          NOTIFICATION_TONE_STYLES[notification.tone] ||
                          NOTIFICATION_TONE_STYLES.info;

                        return (
                          <article
                            key={notification.id}
                            className={cn(
                              "mb-3 rounded-3xl border px-4 py-4 last:mb-0",
                              toneStyles.card
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                                  toneStyles.icon
                                )}
                              >
                                <Icon size={18} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {notification.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {notification.body}
                                    </p>
                                  </div>

                                  {notification.isUnread ? (
                                    <span
                                      className={cn(
                                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                                        toneStyles.dot
                                      )}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </div>

                                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  {notification.timeLabel}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        New claim, fraud, and policy notifications will appear here.
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {getInitials(displayName)}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{displayPlatform}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
