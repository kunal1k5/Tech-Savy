import { getPremium } from "./api";

export async function fetchCalculatedPremium(payload) {
  return getPremium(payload);
}
