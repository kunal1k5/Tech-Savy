import React from "react";
import { riskTierColor } from "../utils/helpers";

/**
 * RiskBadge — Displays risk tier as a coloured badge.
 */
function RiskBadge({ tier, score }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${riskTierColor(tier)}`}>
      {tier.toUpperCase()} — {score}
    </span>
  );
}

export default RiskBadge;
