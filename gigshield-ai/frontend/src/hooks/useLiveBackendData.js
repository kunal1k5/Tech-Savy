import { useEffect, useRef, useState } from "react";
import { DEFAULT_FRAUD_PAYLOAD, getSystemSnapshot } from "../services/api";

const SNAPSHOT_CACHE_TTL_MS = 10000;
const snapshotCache = new Map();
const snapshotRequests = new Map();

async function loadSharedSnapshot(payloadKey, payload) {
  const cachedSnapshot = snapshotCache.get(payloadKey);
  if (cachedSnapshot && Date.now() - cachedSnapshot.updatedAt < SNAPSHOT_CACHE_TTL_MS) {
    return cachedSnapshot.data;
  }

  const existingRequest = snapshotRequests.get(payloadKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = getSystemSnapshot(payload)
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
  payload = DEFAULT_FRAUD_PAYLOAD,
  refreshIntervalMs = 20000,
} = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const dataRef = useRef(null);
  const payloadKey = JSON.stringify(payload);

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
        const nextData = await loadSharedSnapshot(payloadKey, payload);
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
        setError(requestError.response?.data?.error || requestError.message || "Backend data unavailable.");
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
  }, [payloadKey, refreshIntervalMs]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
  };
}
