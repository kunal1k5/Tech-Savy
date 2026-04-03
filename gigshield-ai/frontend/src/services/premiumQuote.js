import { DEFAULT_WEATHER_PAYLOAD, getPremium } from "./api";

export const SAMPLE_PREMIUM_PAYLOAD = DEFAULT_WEATHER_PAYLOAD;

export async function fetchCalculatedPremium(payload = SAMPLE_PREMIUM_PAYLOAD) {
  return getPremium(payload);
}
