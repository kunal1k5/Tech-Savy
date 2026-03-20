"""
Premium Calculator — Dynamic weekly premium computation.

STRATEGY:
  Weekly Premium = Base Premium + (Risk Score × Risk Factor)

  Tier     | Base (₹) | Risk Factor | Premium Range
  ---------|----------|-------------|---------------
  Low      |   10     |    0.10     |  ₹10 – ₹12.50
  Medium   |   18     |    0.15     |  ₹18 – ₹25.50
  High     |   30     |    0.25     |  ₹30 – ₹48.75
  Critical |   45     |    0.35     |  ₹45 – ₹80.00

  Coverage Amount = avg_weekly_income × 0.80 (80%)

IMPORTANT CONSTRAINTS:
  - Coverage is ONLY for income loss (no health/vehicle/accident).
  - Pricing is WEEKLY — not monthly or annual.
  - Minimum premium: ₹10/week.
  - Maximum premium: ₹80/week (capped to keep affordability).
"""

PREMIUM_CONFIG = {
    "low":      {"base": 10, "risk_factor": 0.10},
    "medium":   {"base": 18, "risk_factor": 0.15},
    "high":     {"base": 30, "risk_factor": 0.25},
    "critical": {"base": 45, "risk_factor": 0.35},
}

MIN_PREMIUM = 10.0
MAX_PREMIUM = 80.0
COVERAGE_MULTIPLIER = 0.80  # 80% of avg weekly income


def calculate_premium(risk_score: float, risk_tier: str) -> float:
    """
    Calculate weekly premium in INR based on risk score and tier.
    """
    config = PREMIUM_CONFIG.get(risk_tier, PREMIUM_CONFIG["medium"])
    premium = config["base"] + (risk_score * config["risk_factor"])
    premium = max(MIN_PREMIUM, min(premium, MAX_PREMIUM))
    return round(premium, 2)


def calculate_coverage(avg_weekly_income: float) -> float:
    """
    Calculate the maximum coverage (payout) amount.
    Coverage = 80% of the worker's average weekly income.
    """
    return round(avg_weekly_income * COVERAGE_MULTIPLIER, 2)


def get_full_quote(risk_score: float, risk_tier: str, avg_weekly_income: float) -> dict:
    """
    Generate a complete premium quote.
    """
    premium = calculate_premium(risk_score, risk_tier)
    coverage = calculate_coverage(avg_weekly_income)

    return {
        "weekly_premium": premium,
        "coverage_amount": coverage,
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "coverage_type": "income_loss_only",
        "billing_cycle": "weekly",
    }
