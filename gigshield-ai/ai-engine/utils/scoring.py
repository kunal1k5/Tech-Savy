"""Score and label helpers shared across AI services."""

from __future__ import annotations


def clamp_score(score: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(float(score), maximum))


def risk_tier_from_score(risk_score: float) -> str:
    score = float(risk_score)
    if score <= 25:
        return "low"
    if score <= 50:
        return "medium"
    if score <= 75:
        return "high"
    return "critical"


def fraud_risk_level_from_score(fraud_score: float) -> str:
    score = float(fraud_score)
    if score < 40:
        return "low"
    if score < 70:
        return "medium"
    return "high"


def fraud_recommendation_from_score(fraud_score: float) -> str:
    score = float(fraud_score)
    if score < 40:
        return "pass"
    if score < 70:
        return "flag"
    return "block"
