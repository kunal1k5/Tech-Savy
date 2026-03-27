const HOUR = 60 * 60 * 1000;

function isoOffset(offsetMs) {
  return new Date(Date.now() - offsetMs).toISOString();
}

function createHistoryEntry(stage, detail, offsetMs, tone = "default") {
  return {
    id: `${stage}-${offsetMs}`,
    stage,
    detail,
    timestamp: isoOffset(offsetMs),
    tone,
  };
}

function createHistoricalClaim({
  id,
  eventType,
  headline,
  triggerValue,
  area,
  amount,
  status,
  fraudStatus,
  payoutWindow,
  offsetMs,
  flags = [],
}) {
  const detectedOffset = offsetMs + 28 * 60 * 1000;
  const approvedOffset = offsetMs + 18 * 60 * 1000;
  const fraudOffset = offsetMs + 24 * 60 * 1000;

  return {
    id,
    eventType,
    headline,
    triggerValue,
    area,
    amount,
    status,
    fraudStatus,
    flags,
    source: "Automated trigger monitor",
    detectedAt: isoOffset(detectedOffset),
    updatedAt: isoOffset(offsetMs),
    payoutWindow,
    history: [
      createHistoryEntry(
        status === "paid" ? "paid" : status,
        status === "paid"
          ? `Payout released to linked account in ${payoutWindow}.`
          : "Claim routed to analyst queue for manual review.",
        offsetMs,
        status === "paid" ? "success" : "warning"
      ),
      createHistoryEntry(
        fraudStatus === "verified" ? "fraud_verified" : "fraud_flagged",
        fraudStatus === "verified"
          ? "Location continuity and claim frequency look normal."
          : "Location jump and repeated requests require review.",
        fraudOffset,
        fraudStatus === "verified" ? "info" : "danger"
      ),
      createHistoryEntry(
        "claim_created",
        `${headline} crossed policy threshold and generated a claim.`,
        approvedOffset,
        "info"
      ),
      createHistoryEntry(
        "event_detected",
        `${eventType} monitor reported ${triggerValue} in ${area}.`,
        detectedOffset,
        "default"
      ),
    ],
  };
}

export const disruptionScenarios = {
  rainBurst: {
    id: "rainBurst",
    title: "Rain burst detected",
    eventType: "Rainfall",
    triggerValue: "72 mm/hr",
    area: "Koramangala, Bengaluru",
    amount: 460,
    riskLevel: "High",
    riskScore: 82,
    summary: "Road flooding and low rider availability increased disruption risk.",
    driverNotes: ["Drainage congestion", "Ride speed down 36%", "4 streets flagged"],
    zoneUpdates: [
      { zone: "Koramangala", level: "High", score: 82, change: "+14" },
      { zone: "Indiranagar", level: "Medium", score: 63, change: "+8" },
      { zone: "HSR Layout", level: "Medium", score: 58, change: "+6" },
      { zone: "Whitefield", level: "Low", score: 41, change: "-2" },
    ],
    fraudInputs: {
      locationJumpKm: 1.6,
      locationWindowMinutes: 18,
      repeatedClaimsWithin6h: 0,
      deviceSwitch: false,
    },
  },
  airQualitySpike: {
    id: "airQualitySpike",
    title: "Air quality threshold crossed",
    eventType: "AQI",
    triggerValue: "PM2.5 at 188",
    area: "Indiranagar, Bengaluru",
    amount: 320,
    riskLevel: "Medium",
    riskScore: 68,
    summary: "Hazardous exposure threshold reached during the evening delivery block.",
    driverNotes: ["AQI crossed red zone", "Visibility reduced", "Heat map trending east"],
    zoneUpdates: [
      { zone: "Koramangala", level: "Medium", score: 64, change: "+3" },
      { zone: "Indiranagar", level: "High", score: 78, change: "+11" },
      { zone: "HSR Layout", level: "Low", score: 45, change: "-1" },
      { zone: "Whitefield", level: "Medium", score: 57, change: "+5" },
    ],
    fraudInputs: {
      locationJumpKm: 2.2,
      locationWindowMinutes: 22,
      repeatedClaimsWithin6h: 0,
      deviceSwitch: false,
    },
  },
  gpsSpoof: {
    id: "gpsSpoof",
    title: "Suspicious movement pattern",
    eventType: "Zone disruption",
    triggerValue: "Route jump of 24 km in 12 min",
    area: "Outer Ring Road, Bengaluru",
    amount: 380,
    riskLevel: "High",
    riskScore: 76,
    summary: "Claim request overlaps with an abnormal device location jump.",
    driverNotes: ["GPS jump 24 km", "2 claims in 4 hours", "Device fingerprint changed"],
    zoneUpdates: [
      { zone: "Koramangala", level: "High", score: 74, change: "+5" },
      { zone: "Indiranagar", level: "Medium", score: 61, change: "+2" },
      { zone: "HSR Layout", level: "Medium", score: 59, change: "+1" },
      { zone: "Whitefield", level: "Low", score: 38, change: "-3" },
    ],
    fraudInputs: {
      locationJumpKm: 24,
      locationWindowMinutes: 12,
      repeatedClaimsWithin6h: 2,
      deviceSwitch: true,
    },
  },
};

export function createInitialPlatformState() {
  return {
    worker: {
      name: "Rahul Singh",
      city: "Bengaluru",
      area: "Koramangala",
      platform: "Swiggy",
      weeklyIncome: 18350,
      activeHoursToday: 6.4,
    },
    plans: [
      {
        id: "starter",
        name: "Starter Cover",
        premiumWeekly: 15,
        payoutCap: 300,
        description: "Entry plan for occasional disruptions.",
        features: [
          "Rainfall cover above 50 mm/hr",
          "Automated payouts up to 300/day",
          "Same-day claim status updates",
        ],
        note: "Best for riders with shorter evening shifts.",
      },
      {
        id: "smart",
        name: "Flex Cover",
        premiumWeekly: 21,
        payoutCap: 480,
        description: "Balanced cover for mixed weather and pollution events.",
        features: [
          "Rainfall and AQI disruption cover",
          "Payouts up to 480/day",
          "Priority fraud review handling",
        ],
        note: "Good fit for multi-zone riders.",
      },
      {
        id: "shield_plus",
        name: "Shield Plus",
        premiumWeekly: 29,
        payoutCap: 650,
        description: "Full protection tuned for high-variance delivery corridors.",
        features: [
          "Rain, AQI, and shutdown triggers",
          "Payouts up to 650/day",
          "Fast-track payout release when verified",
        ],
        note: "Recommended for Koramangala and Indiranagar routes.",
      },
    ],
    activePlanId: "shield_plus",
    recommendedPlanId: "shield_plus",
    riskFeed: [
      { zone: "Koramangala", level: "High", score: 76, change: "+9" },
      { zone: "Indiranagar", level: "Medium", score: 58, change: "+4" },
      { zone: "HSR Layout", level: "Medium", score: 54, change: "+2" },
      { zone: "Whitefield", level: "Low", score: 39, change: "-3" },
    ],
    earningsTrend: [
      { day: "Mon", earnings: 2280, payouts: 0, downtimeHours: 0.3, riskScore: 46 },
      { day: "Tue", earnings: 2410, payouts: 0, downtimeHours: 0.5, riskScore: 49 },
      { day: "Wed", earnings: 2170, payouts: 180, downtimeHours: 1.1, riskScore: 56 },
      { day: "Thu", earnings: 2640, payouts: 0, downtimeHours: 0.4, riskScore: 44 },
      { day: "Fri", earnings: 2510, payouts: 0, downtimeHours: 0.6, riskScore: 53 },
      { day: "Sat", earnings: 1980, payouts: 300, downtimeHours: 1.8, riskScore: 67 },
      { day: "Sun", earnings: 1720, payouts: 0, downtimeHours: 0.7, riskScore: 61 },
    ],
    liveMonitor: {
      stage: "arming",
      headline: "Monitoring live disruption feeds",
      summary: "Weather, AQI, and route slowdown signals are syncing for your area.",
      lastHeartbeatAt: isoOffset(3 * 60 * 1000),
      activeScenarioId: null,
    },
    fraudWatch: {
      status: "verified",
      summary: "Recent trips look consistent with the active coverage zone.",
      activeFlags: [],
      lastCheckedAt: isoOffset(16 * 60 * 1000),
      latestAudit: "Location continuity steady across the last 6 hours.",
    },
    claims: [
      createHistoricalClaim({
        id: "CLM-2403",
        eventType: "Rainfall",
        headline: "Cloudburst payout released",
        triggerValue: "68 mm/hr",
        area: "Koramangala, Bengaluru",
        amount: 450,
        status: "paid",
        fraudStatus: "verified",
        payoutWindow: "4 minutes",
        offsetMs: 5 * HOUR,
      }),
      createHistoricalClaim({
        id: "CLM-2398",
        eventType: "AQI",
        headline: "Air quality disruption cover",
        triggerValue: "PM2.5 at 166",
        area: "Indiranagar, Bengaluru",
        amount: 280,
        status: "paid",
        fraudStatus: "verified",
        payoutWindow: "6 minutes",
        offsetMs: 28 * HOUR,
      }),
      createHistoricalClaim({
        id: "CLM-2394",
        eventType: "Heat index",
        headline: "Heat stress review",
        triggerValue: "Feels like 43 C",
        area: "HSR Layout, Bengaluru",
        amount: 360,
        status: "manual_review",
        fraudStatus: "flagged",
        payoutWindow: "Pending analyst action",
        offsetMs: 47 * HOUR,
        flags: ["Repeated claims inside 3 hours", "Route mismatch detected"],
      }),
    ],
  };
}

export function createLiveClaimFromScenario(scenario, existingClaimsLength = 0) {
  const claimId = `CLM-${String(2404 + existingClaimsLength).padStart(4, "0")}`;
  const detectedAt = new Date().toISOString();

  return {
    id: claimId,
    eventType: scenario.eventType,
    headline: scenario.title,
    triggerValue: scenario.triggerValue,
    area: scenario.area,
    amount: scenario.amount,
    status: "pending",
    fraudStatus: "in_progress",
    flags: [],
    source: "Automated trigger monitor",
    detectedAt,
    updatedAt: detectedAt,
    payoutWindow: "Waiting for checks",
    history: [
      {
        id: `${claimId}-fraud`,
        stage: "fraud_in_progress",
        detail: "Fraud check in progress. Verifying route continuity and recent claim frequency.",
        timestamp: detectedAt,
        tone: "warning",
      },
      {
        id: `${claimId}-created`,
        stage: "claim_created",
        detail: `${scenario.title} crossed the active policy threshold.`,
        timestamp: detectedAt,
        tone: "info",
      },
      {
        id: `${claimId}-detected`,
        stage: "event_detected",
        detail: `${scenario.eventType} monitor reported ${scenario.triggerValue} in ${scenario.area}.`,
        timestamp: detectedAt,
        tone: "default",
      },
    ],
  };
}

export function createHistoryNote(stage, detail, tone = "default") {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    stage,
    detail,
    timestamp: new Date().toISOString(),
    tone,
  };
}

export function evaluateFraudSignals(scenario, claims) {
  const flags = [];
  const suspicious = [];
  const recentClaimCount = claims.filter((claim) => {
    const claimTime = new Date(claim.detectedAt).getTime();
    return Date.now() - claimTime < 6 * HOUR;
  }).length;

  if (scenario.fraudInputs.locationJumpKm >= 18) {
    flags.push(
      `Route changed by ${scenario.fraudInputs.locationJumpKm} km in ${scenario.fraudInputs.locationWindowMinutes} minutes.`
    );
    suspicious.push("GPS spoofing");
  }

  if (scenario.fraudInputs.repeatedClaimsWithin6h + recentClaimCount > 2) {
    flags.push("Repeated claims detected within a short time window.");
    suspicious.push("Repeated claims");
  }

  if (scenario.fraudInputs.deviceSwitch) {
    flags.push("New device fingerprint detected during the same claim window.");
    suspicious.push("Device switch");
  }

  if (flags.length === 0) {
    return {
      suspicious: false,
      status: "verified",
      flags: [],
      summary: "Location continuity and claim timing look normal.",
      latestAudit: "Claim verified with stable movement history and no repeat patterns.",
    };
  }

  return {
    suspicious: true,
    status: "flagged",
    flags,
    summary: `${suspicious.join(" + ")} triggered manual review.`,
    latestAudit: "Analyst review required before releasing payout.",
  };
}

export function updateTrendWithPayout(trend, amount) {
  return trend.map((entry, index) => {
    if (index !== trend.length - 1) {
      return entry;
    }

    return {
      ...entry,
      payouts: entry.payouts + amount,
      downtimeHours: Number((entry.downtimeHours + 1.2).toFixed(1)),
      riskScore: Math.min(95, entry.riskScore + 6),
    };
  });
}

export function getStatusLabel(status) {
  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    paid: "Paid",
    manual_review: "Manual Review",
  };

  return labels[status] || status;
}

export function getFraudStatusLabel(status) {
  const labels = {
    in_progress: "Fraud Check in Progress",
    verified: "Verified",
    flagged: "Flagged",
  };

  return labels[status] || status;
}
