/**
 * Format currency in INR.
 */
export function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Map risk tier to a TailwindCSS color class.
 */
export function riskTierColor(tier) {
  const colors = {
    low: "text-green-600 bg-green-100",
    medium: "text-yellow-600 bg-yellow-100",
    high: "text-orange-600 bg-orange-100",
    critical: "text-red-600 bg-red-100",
  };
  return colors[tier] || "text-gray-600 bg-gray-100";
}
