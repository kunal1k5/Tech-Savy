"""Compatibility wrapper for legacy fraud imports."""

from services.fraud_service import check_fraud

__all__ = ["check_fraud"]
