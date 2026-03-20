"""
Risk Model — AI-powered risk scoring for delivery workers.

MODEL ARCHITECTURE (Phase-1):
  - Algorithm: Gradient Boosting Regressor (scikit-learn)
  - Input features:
      • rainfall_mm      — current rainfall in the zone
      • temperature_c    — current temperature
      • aqi              — Air Quality Index
      • traffic_index    — traffic congestion (0-10)
      • zone_disruption_count — historical disruptions in this zone (30 days)
  - Output: risk_score (0-100)

  Risk Tier Mapping:
      0-25   → low
      26-50  → medium
      51-75  → high
      76-100 → critical

TRAINING STRATEGY:
  Phase-1 uses a rule-based model as a baseline. The trained model
  can be loaded from disk (models/risk_model.pkl) when available.
"""

import numpy as np
import os
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "risk_model.pkl")


def _load_model():
    """Load trained model from disk if available."""
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return None


def compute_risk_score(
    rainfall_mm: float,
    temperature_c: float,
    aqi: int,
    traffic_index: float,
    zone_disruption_count: int = 0,
) -> dict:
    """
    Compute risk score for a worker's zone.

    Phase-1 uses a weighted rule-based model as baseline.
    When a trained sklearn model is available on disk, it is used instead.
    """
    model = _load_model()

    if model is not None:
        # Use trained ML model
        features = np.array([[rainfall_mm, temperature_c, aqi, traffic_index, zone_disruption_count]])
        risk_score = float(np.clip(model.predict(features)[0], 0, 100))
    else:
        # Rule-based baseline model (Phase-1 fallback)
        score = 0.0

        # Rainfall contribution (0-30 points)
        if rainfall_mm > 100:
            score += 30
        elif rainfall_mm > 50:
            score += 20
        elif rainfall_mm > 20:
            score += 10

        # Temperature contribution (0-20 points)
        if temperature_c > 45 or temperature_c < 5:
            score += 20
        elif temperature_c > 40 or temperature_c < 10:
            score += 12
        elif temperature_c > 35:
            score += 5

        # AQI contribution (0-25 points)
        if aqi > 400:
            score += 25
        elif aqi > 300:
            score += 18
        elif aqi > 200:
            score += 10
        elif aqi > 150:
            score += 5

        # Traffic contribution (0-15 points)
        score += min(traffic_index * 1.5, 15)

        # Zone history contribution (0-10 points)
        score += min(zone_disruption_count * 2, 10)

        risk_score = min(score, 100)

    # Determine tier
    if risk_score <= 25:
        risk_tier = "low"
    elif risk_score <= 50:
        risk_tier = "medium"
    elif risk_score <= 75:
        risk_tier = "high"
    else:
        risk_tier = "critical"

    return {
        "risk_score": round(risk_score, 2),
        "risk_tier": risk_tier,
        "features": {
            "rainfall_mm": rainfall_mm,
            "temperature_c": temperature_c,
            "aqi": aqi,
            "traffic_index": traffic_index,
            "zone_history": {"disruption_count_30d": zone_disruption_count},
        },
    }
