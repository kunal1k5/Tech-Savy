"""Fraud-service helpers for claim review scoring."""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional

import numpy as np

from utils import MODELS_DIR, clamp_score, fraud_recommendation_from_score, fraud_risk_level_from_score, safe_load_joblib

MODEL_PATH = MODELS_DIR / "fraud_model.pkl"
HIGH_SPEED_THRESHOLD_KMPH = 80.0
MEDIUM_SPEED_THRESHOLD_KMPH = 50.0


@lru_cache(maxsize=1)
def _load_model():
    if MODEL_PATH.exists():
        try:
            return safe_load_joblib(MODEL_PATH)
        except Exception:
            return None
    return None


def get_fraud_service_health() -> Dict[str, object]:
    model = _load_model()
    return {
        "ready": model is not None,
        "model_path": str(MODEL_PATH),
        "model_loaded": model is not None,
    }


def _calculate_travel_speed(location_jump_km: float, location_window_minutes: int) -> float:
    if location_jump_km <= 0 or location_window_minutes <= 0:
        return 0.0

    hours = location_window_minutes / 60.0
    return float(location_jump_km / hours)


def risk_level(fraud_score: float) -> str:
    return fraud_risk_level_from_score(fraud_score)


def recommendation(fraud_score: float) -> str:
    return fraud_recommendation_from_score(fraud_score)


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
        base_score = clamp_score(model.predict(model_features)[0])
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

    fraud_score = clamp_score(base_score + rule_score)

    if strong_signal_count == 0 and weak_signal_count <= 1:
        fraud_score = min(fraud_score, 45.0)

    if strong_signal_count == 1 and weak_signal_count == 0:
        fraud_score = min(fraud_score, 65.0)

    fraud_score = round(float(fraud_score), 2)
    risk = risk_level(fraud_score)

    return {
        "fraud_score": fraud_score,
        "risk_level": risk,
        "flags": flags,
        "recommendation": recommendation(fraud_score),
        "travel_speed_kmph": round(travel_speed_kmph, 2),
        "signal_summary": {
            "strong_signals": strong_signal_count,
            "weak_signals": weak_signal_count,
            "worker_id": worker_id,
            "trigger_type": trigger_type,
        },
    }
