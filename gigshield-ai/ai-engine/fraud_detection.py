"""
Fraud detection helpers for GigShield claims.

The engine combines a simple rule-based layer with an optional trained model.
It is designed for practical claim review, not just binary rejection.

Scoring bands:
  0-39   -> low fraud risk
  40-69  -> medium fraud risk
  70-100 -> high fraud risk

Recommendations:
  low    -> pass
  medium -> flag
  high   -> block
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fraud_model.pkl")
HIGH_SPEED_THRESHOLD_KMPH = 80.0
MEDIUM_SPEED_THRESHOLD_KMPH = 50.0


def _load_model():
    """Load a trained fraud model when available."""
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            return None
    return None


def _calculate_travel_speed(location_jump_km: float, location_window_minutes: int) -> float:
    if location_jump_km <= 0 or location_window_minutes <= 0:
        return 0.0

    hours = location_window_minutes / 60.0
    return float(location_jump_km / hours)


def _risk_level(fraud_score: float) -> str:
    if fraud_score < 40:
        return "low"
    if fraud_score < 70:
        return "medium"
    return "high"


def _recommendation(fraud_score: float) -> str:
    if fraud_score < 40:
        return "pass"
    if fraud_score < 70:
        return "flag"
    return "block"


def check_fraud(
    worker_id: str,
    claim_amount: float,
    trigger_type: str,
    worker_claims_30d: int = 0,
    avg_claim_amount: float = 0.0,
    worker_in_zone: bool = True,
    duplicate_trigger: bool = False,
    predicted_destination_id: Optional[int] = None,
    actual_destination_id: Optional[int] = None,
    location_jump_km: float = 0.0,
    location_window_minutes: int = 0,
    repeated_claims_6h: int = 0,
    nearby_similar_claims_count: int = 0,
    device_fingerprint_changed: bool = False,
) -> Dict[str, object]:
    """
    Score a claim for suspicious behavior.

    Existing callers can continue to use the original fields.
    New optional fields allow stronger checks such as route mismatch,
    unrealistic travel speed, and coordinated behavior patterns.
    """

    model = _load_model()
    flags: List[str] = []
    strong_signal_count = 0
    weak_signal_count = 0
    rule_score = 0.0

    if model is not None:
        model_features = np.array(
            [[
                claim_amount,
                worker_claims_30d,
                avg_claim_amount,
                1.0 if worker_in_zone else 0.0,
                1.0 if duplicate_trigger else 0.0,
            ]],
            dtype=float,
        )
        base_score = float(np.clip(model.predict(model_features)[0], 0, 100))
    else:
        base_score = 0.0

    if not worker_in_zone:
        rule_score += 20
        strong_signal_count += 1
        flags.append("zone_mismatch")

    if duplicate_trigger:
        rule_score += 30
        strong_signal_count += 1
        flags.append("duplicate_trigger")

    if worker_claims_30d > 3:
        rule_score += 12
        weak_signal_count += 1
        flags.append("high_claim_frequency_30d")
    elif worker_claims_30d > 1:
        rule_score += 5
        weak_signal_count += 1

    if repeated_claims_6h >= 2:
        rule_score += 18
        strong_signal_count += 1
        flags.append("repeat_claim_pattern_6h")
    elif repeated_claims_6h == 1:
        rule_score += 8
        weak_signal_count += 1

    if avg_claim_amount > 0 and claim_amount > avg_claim_amount * 2:
        rule_score += 12
        weak_signal_count += 1
        flags.append("amount_anomaly")

    if (
        predicted_destination_id is not None
        and actual_destination_id is not None
        and predicted_destination_id != actual_destination_id
    ):
        rule_score += 18
        strong_signal_count += 1
        flags.append("route_mismatch")

    travel_speed_kmph = _calculate_travel_speed(location_jump_km, location_window_minutes)
    if location_jump_km >= 5 and travel_speed_kmph >= HIGH_SPEED_THRESHOLD_KMPH:
        rule_score += 25
        strong_signal_count += 1
        flags.append("unrealistic_travel_speed")
    elif location_jump_km >= 3 and travel_speed_kmph >= MEDIUM_SPEED_THRESHOLD_KMPH:
        rule_score += 12
        weak_signal_count += 1
        flags.append("suspicious_travel_speed")

    if nearby_similar_claims_count >= 3:
        rule_score += 14
        strong_signal_count += 1
        flags.append("possible_group_fraud")
    elif nearby_similar_claims_count == 2:
        rule_score += 6
        weak_signal_count += 1

    if device_fingerprint_changed:
        rule_score += 12
        weak_signal_count += 1
        flags.append("device_fingerprint_changed")

    fraud_score = float(np.clip(base_score + rule_score, 0, 100))

    # False-positive protection:
    # keep single weak signals from becoming punitive.
    if strong_signal_count == 0 and weak_signal_count <= 1:
        fraud_score = min(fraud_score, 45.0)

    # One strong signal alone should usually lead to review, not an automatic block.
    if strong_signal_count == 1 and weak_signal_count == 0:
        fraud_score = min(fraud_score, 65.0)

    fraud_score = round(float(fraud_score), 2)
    risk_level = _risk_level(fraud_score)

    return {
        "fraud_score": fraud_score,
        "risk_level": risk_level,
        "flags": flags,
        "recommendation": _recommendation(fraud_score),
        "travel_speed_kmph": round(travel_speed_kmph, 2),
        "signal_summary": {
            "strong_signals": strong_signal_count,
            "weak_signals": weak_signal_count,
            "worker_id": worker_id,
            "trigger_type": trigger_type,
        },
    }
