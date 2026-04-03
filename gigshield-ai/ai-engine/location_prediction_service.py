"""Compatibility wrapper for legacy location-model imports."""

from services.location_service import get_location_model_health, predict_location

__all__ = ["get_location_model_health", "predict_location"]
