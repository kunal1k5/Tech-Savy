"""Premium-service helpers for dynamic income-protection pricing."""

from __future__ import annotations

PREMIUM_CONFIG = {
    "low": {"base": 10, "risk_factor": 0.10},
    "medium": {"base": 18, "risk_factor": 0.15},
    "high": {"base": 30, "risk_factor": 0.25},
    "critical": {"base": 45, "risk_factor": 0.35},
}

MIN_PREMIUM = 10.0
MAX_PREMIUM = 80.0
COVERAGE_MULTIPLIER = 0.80


def calculate_premium(risk_score: float, risk_tier: str) -> float:
    config = PREMIUM_CONFIG.get(risk_tier, PREMIUM_CONFIG["medium"])
    premium = config["base"] + (risk_score * config["risk_factor"])
    premium = max(MIN_PREMIUM, min(premium, MAX_PREMIUM))
    return round(premium, 2)


def calculate_coverage(avg_weekly_income: float) -> float:
    return round(avg_weekly_income * COVERAGE_MULTIPLIER, 2)


def get_full_quote(risk_score: float, risk_tier: str, avg_weekly_income: float) -> dict:
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
