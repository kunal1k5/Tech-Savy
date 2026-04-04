const CLAIM_COOLDOWN_MS = 5 * 60 * 1000;

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsedValue = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getClaimCooldownState(lastClaimTime, now = Date.now()) {
  const lastClaimTimestamp = normalizeTimestamp(lastClaimTime);

  if (!lastClaimTimestamp) {
    return {
      active: false,
      cooldownMs: CLAIM_COOLDOWN_MS,
      lastClaimTime: null,
      remainingMs: 0,
      remainingSeconds: 0,
      retryAfterAt: null,
    };
  }

  const currentTimestamp = Number.isFinite(now) ? now : Date.now();
  const elapsedMs = Math.max(currentTimestamp - lastClaimTimestamp, 0);
  const remainingMs = Math.max(CLAIM_COOLDOWN_MS - elapsedMs, 0);

  return {
    active: remainingMs > 0,
    cooldownMs: CLAIM_COOLDOWN_MS,
    lastClaimTime: new Date(lastClaimTimestamp).toISOString(),
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    retryAfterAt:
      remainingMs > 0 ? new Date(lastClaimTimestamp + CLAIM_COOLDOWN_MS).toISOString() : null,
  };
}

function formatCooldownWait(remainingMs) {
  const totalSeconds = Math.max(Math.ceil(Number(remainingMs || 0) / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

module.exports = {
  CLAIM_COOLDOWN_MS,
  formatCooldownWait,
  getClaimCooldownState,
};
