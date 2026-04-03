import { DEFAULT_FRAUD_PAYLOAD, getFraudStatus } from "./api";

export const SAMPLE_FRAUD_ORCHESTRATOR_PAYLOAD = DEFAULT_FRAUD_PAYLOAD;

export async function fetchFraudOrchestrator(payload = SAMPLE_FRAUD_ORCHESTRATOR_PAYLOAD) {
  return getFraudStatus(payload);
}
