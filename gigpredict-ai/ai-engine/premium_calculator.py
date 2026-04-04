"""Compatibility wrapper for legacy premium imports."""

from services.premium_service import calculate_coverage, calculate_premium, get_full_quote

__all__ = ["calculate_coverage", "calculate_premium", "get_full_quote"]
