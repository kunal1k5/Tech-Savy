import { useEffect, useMemo, useRef, useState } from "react";
import { extractApiErrorMessage, getFraudStatus } from "../services/api";
import { fetchBehaviorCheck } from "../services/behaviorCheck";
import { getPremium as getLivePremium } from "../services/workerFlow";
import { fetchLocationCheck } from "../services/locationCheck";
import { getToken, getUserFromToken } from "../utils/auth";
import { getAuthRiskProfile } from "../utils/authRisk";

const SNAPSHOT_CACHE_TTL_MS = 10000;
const snapshotCache = new Map();
const snapshotRequests = new Map();

function formatTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildBehaviorPayload(user, authRiskProfile) {
  const workType = String(user?.work_type || user?.workType || "").toLowerCase();

  return {
    claims_count: 0,
    last_claim_time: formatTime(),
    working_hours: workType === "driver" ? [6, 22] : [8, 20],
    login_attempts: authRiskProfile?.signals?.loginAttempts ?? 0,
  };
}

function buildLocationPayload(user) {
  const currentLocation = user?.zone || user?.city || "";
  if (!currentLocation) {
    return null;
  }

  return {
    current_location: currentLocation,
    actual_location: currentLocation,
    time: formatTime(),
  };
}

async function loadSharedSnapshot(payloadKey, loader) {
  const cachedSnapshot = snapshotCache.get(payloadKey);
  if (cachedSnapshot && Date.now() - cachedSnapshot.updatedAt < SNAPSHOT_CACHE_TTL_MS) {
    return cachedSnapshot.data;
  }

  const existingRequest = snapshotRequests.get(payloadKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = loader()
    .then((data) => {
      snapshotCache.set(payloadKey, {
        data,
        updatedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      snapshotRequests.delete(payloadKey);
    });

  snapshotRequests.set(payloadKey, request);
  return request;
}

export default function useLiveBackendData({
  refreshIntervalMs = 20000,
} = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const dataRef = useRef(null);
  const hasBackendSession = Boolean(getToken());
  const sessionUser = getUserFromToken();
  const authRiskProfile = getAuthRiskProfile(sessionUser?.phone);
  const sessionSnapshot = useMemo(() => {
    return {
      user: sessionUser,
      authRiskProfile,
      payloadKey: JSON.stringify({
        userId: sessionUser?.id || "",
        phone: sessionUser?.phone || "",
        city: sessionUser?.city || "",
        zone: sessionUser?.zone || "",
        workType: sessionUser?.work_type || sessionUser?.workType || "",
        loginAttempts: authRiskProfile?.signals?.loginAttempts ?? 0,
      }),
    };
  }, [
    authRiskProfile?.signals?.loginAttempts,
    sessionUser?.city,
    sessionUser?.id,
    sessionUser?.phone,
    sessionUser?.work_type,
    sessionUser?.workType,
    sessionUser?.zone,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadSnapshot({ background = false } = {}) {
      if (!background && !dataRef.current) {
        setIsLoading(true);
      }
      if (background) {
        setIsRefreshing(true);
      }

      try {
        const nextData = await loadSharedSnapshot(sessionSnapshot.payloadKey, async () => {
          const behaviorPayload = buildBehaviorPayload(
            sessionSnapshot.user,
            sessionSnapshot.authRiskProfile
          );
          const locationPayload = buildLocationPayload(sessionSnapshot.user);
          const premiumData = hasBackendSession ? await getLivePremium() : null;
          const behaviorData = await fetchBehaviorCheck(behaviorPayload);
          const locationData = locationPayload
            ? await fetchLocationCheck(locationPayload)
            : null;
          const fraudData = await getFraudStatus({
            risk: premiumData?.riskLevel || premiumData?.risk || "MEDIUM",
            locationMatch: locationData?.match ?? true,
            claimsCount: behaviorPayload.claims_count ?? 0,
            loginAttempts: behaviorPayload.login_attempts ?? 0,
            contextValid: Boolean(sessionSnapshot.user?.id || sessionSnapshot.user?.phone),
          });

          return {
            ...fraudData,
            premium: premiumData?.premium ?? fraudData?.premium ?? null,
            premium_risk: premiumData?.riskLevel || premiumData?.risk || fraudData?.risk || null,
            premium_source: premiumData?.source || fraudData?.source || null,
            premium_warning: premiumData?.warning || null,
            intelligence: {
              ...(fraudData?.intelligence || {}),
              behavior: {
                ...(fraudData?.intelligence?.behavior || {}),
                ...behaviorData,
                suspicious: behaviorData?.suspicious || false,
              },
              location: locationData
                ? {
                    ...(fraudData?.intelligence?.location || {}),
                    ...locationData,
                    suspicious: locationData?.suspicious || false,
                  }
                : fraudData?.intelligence?.location || null,
            },
          };
        });
        if (!mountedRef.current) {
          return;
        }
        setData((current) => {
          const merged = { ...(current || {}), ...nextData };
          dataRef.current = merged;
          return merged;
        });
        setError("");
      } catch (requestError) {
        if (!mountedRef.current) {
          return;
        }
        setError(
          dataRef.current
            ? "Service unavailable. Showing the last known values."
            : extractApiErrorMessage(requestError, "Service unavailable.")
        );
      } finally {
        if (!mountedRef.current) {
          return;
        }
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }

    loadSnapshot();

    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      loadSnapshot({ background: true });
    }, refreshIntervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [hasBackendSession, refreshIntervalMs, sessionSnapshot]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
  };
}
