"""Combine fraud, location, risk, and premium signals into one review result."""

from __future__ import annotations

from typing import Any, Dict

from services.fraud_service import check_fraud, recommendation, risk_level
from services.location_service import predict_location
from services.premium_service import get_full_quote
from services.risk_service import assess_zone_risk, fetch_live_weather
from utils import clamp_score

ORCHESTRATOR_VERSION = "2026.04.03"


def orchestrate_fraud_review(payload: Dict[str, Any]) -> Dict[str, object]:
    request = payload if isinstance(payload, dict) else {}

    behavior_result = check_fraud(
        worker_id=str(request.get("worker_id") or ""),
        claim_amount=float(request.get("claim_amount") or 0.0),
        trigger_type=str(request.get("trigger_type") or request.get("reason") or ""),
        worker_claims_30d=int(request.get("worker_claims_30d") or 0),
        avg_claim_amount=float(request.get("avg_claim_amount") or 0.0),
        worker_in_zone=bool(request.get("worker_in_zone", True)),
        duplicate_trigger=bool(request.get("duplicate_trigger", False)),
        predicted_destination_id=_int_or_none(request.get("predicted_destination_id")),
        actual_destination_id=_int_or_none(request.get("actual_destination_id")),
        location_jump_km=float(request.get("location_jump_km") or 0.0),
        location_window_minutes=int(request.get("location_window_minutes") or 0),
        repeated_claims_6h=int(request.get("repeated_claims_6h") or 0),
        nearby_similar_claims_count=int(request.get("nearby_similar_claims_count") or 0),
        device_fingerprint_changed=bool(request.get("device_fingerprint_changed", False)),
    )

    flags = list(behavior_result.get("flags") or [])
    location_context = _resolve_location_context(request, flags)
    environment_context = _resolve_environment_context(request, flags)
    premium_context = _resolve_premium_context(request, environment_context)

    location_adjustment = _location_adjustment(location_context, flags)
    environment_adjustment = _environment_adjustment(environment_context, flags)
    payout_adjustment = _payout_adjustment(
        claim_amount=float(request.get("claim_amount") or 0.0),
        premium_context=premium_context,
        flags=flags,
    )

    raw_score = (
        float(behavior_result["fraud_score"])
        + location_adjustment
        + environment_adjustment
        + payout_adjustment
    )
    fraud_score = round(clamp_score(raw_score), 2)

    result_risk_level = risk_level(fraud_score)
    return {
        "fraud_score": fraud_score,
        "risk_level": result_risk_level,
        "recommendation": recommendation(fraud_score),
        "flags": sorted(set(flags)),
        "components": {
            "behavior_model": round(float(behavior_result["fraud_score"]), 2),
            "location_mismatch": round(location_adjustment, 2),
            "environment_context": round(environment_adjustment, 2),
            "payout_pressure": round(payout_adjustment, 2),
        },
        "contexts": {
            "behavioral": behavior_result,
            "location": location_context,
            "environment": environment_context,
            "premium": premium_context,
        },
        "signal_summary": behavior_result.get("signal_summary", {}),
        "orchestrator_version": ORCHESTRATOR_VERSION,
    }


def _resolve_location_context(request: Dict[str, Any], flags: list[str]) -> Dict[str, object] | None:
    required_fields = [
        "origin_id",
        "day_of_week",
        "hour_of_day",
        "travel_time_mean",
        "lower_bound",
        "upper_bound",
    ]
    if not all(field in request for field in required_fields):
        return None

    try:
        prediction = predict_location(request)
    except Exception as error:
        flags.append("location_model_unavailable")
        return {"ready": False, "error": str(error)}

    return {
        "ready": True,
        **prediction,
    }


def _resolve_environment_context(request: Dict[str, Any], flags: list[str]) -> Dict[str, object] | None:
    env_keys = ["rainfall_mm", "temperature_c", "aqi", "traffic_index"]
    if all(key in request for key in env_keys):
        try:
            return assess_zone_risk(
                rainfall_mm=float(request.get("rainfall_mm") or 0.0),
                temperature_c=float(request.get("temperature_c") or 0.0),
                aqi=int(request.get("aqi") or 0),
                traffic_index=float(request.get("traffic_index") or 0.0),
                zone_disruption_count=int(request.get("zone_disruption_count") or 0),
            )
        except Exception as error:
            flags.append("environment_context_unavailable")
            return {"ready": False, "error": str(error)}

    city = str(request.get("city") or "").strip()
    if not city:
        return None

    try:
        live_weather = fetch_live_weather(city)
        weather = live_weather["weather"]
        return {
            **assess_zone_risk(
                rainfall_mm=float(weather.get("rain", 0.0)),
                temperature_c=float(weather.get("temperature", 0.0)),
                aqi=int(round(max(weather.get("pm25", 0.0), weather.get("pm10", 0.0)))),
                traffic_index=float(
                    max(min((weather.get("wind", 0.0) + weather.get("gust", 0.0)) / 10.0, 10.0), 0.0)
                ),
                zone_disruption_count=int(request.get("zone_disruption_count") or 0),
            ),
            "city": city,
            "zone": request.get("zone"),
            "weather_source": live_weather.get("source"),
        }
    except Exception as error:
        flags.append("environment_context_unavailable")
        return {"ready": False, "error": str(error)}


def _resolve_premium_context(
    request: Dict[str, Any],
    environment_context: Dict[str, object] | None,
) -> Dict[str, object] | None:
    avg_weekly_income = request.get("avg_weekly_income")
    if avg_weekly_income in (None, "") or not environment_context:
        return None
    if "risk_score" not in environment_context or "risk_tier" not in environment_context:
        return None

    return get_full_quote(
        risk_score=float(environment_context["risk_score"]),
        risk_tier=str(environment_context["risk_tier"]),
        avg_weekly_income=float(avg_weekly_income),
    )


def _location_adjustment(location_context: Dict[str, object] | None, flags: list[str]) -> float:
    if not location_context or not location_context.get("ready"):
        return 0.0
    if location_context.get("suspicious") is True:
        confidence = float(location_context.get("confidence") or 0.5)
        flags.append("predicted_route_mismatch")
        return min(22.0, max(12.0, confidence * 25.0))
    return 0.0


def _environment_adjustment(environment_context: Dict[str, object] | None, flags: list[str]) -> float:
    if not environment_context or "risk_tier" not in environment_context:
        return 0.0

    tier = str(environment_context["risk_tier"])
    if tier == "low":
        flags.append("claim_vs_low_environment_risk")
        return 10.0
    if tier == "medium":
        return 4.0
    if tier == "high":
        return -6.0

    flags.append("claim_supported_by_critical_conditions")
    return -12.0


def _payout_adjustment(
    claim_amount: float,
    premium_context: Dict[str, object] | None,
    flags: list[str],
) -> float:
    if not premium_context:
        return 0.0

    coverage_amount = float(premium_context.get("coverage_amount") or 0.0)
    if coverage_amount <= 0:
        return 0.0

    ratio = claim_amount / coverage_amount
    if ratio >= 0.8:
        flags.append("high_payout_pressure")
        return 8.0
    if ratio >= 0.6:
        return 4.0
    return 0.0


def _int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    return int(value)
