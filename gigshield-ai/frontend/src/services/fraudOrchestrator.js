import { getFraudStatus } from "./api";

export async function fetchFraudOrchestrator(payload) {
  return getFraudStatus(payload);
}
