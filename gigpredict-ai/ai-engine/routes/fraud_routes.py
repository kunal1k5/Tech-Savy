"""Fraud detection API routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from fraud_orchestrator import orchestrate_fraud_review

router = APIRouter()


class FraudCheckRequest(BaseModel):
    claim_id: str
    worker_id: str
    policy_id: str
    trigger_id: str
    claim_amount: float
    trigger_type: Optional[str] = ""
    worker_claims_30d: Optional[int] = 0
    avg_claim_amount: Optional[float] = 0.0
    worker_in_zone: Optional[bool] = True
    duplicate_trigger: Optional[bool] = False
    predicted_destination_id: Optional[int] = None
    actual_destination_id: Optional[int] = None
    location_jump_km: Optional[float] = 0.0
    location_window_minutes: Optional[int] = 0
    repeated_claims_6h: Optional[int] = 0
    nearby_similar_claims_count: Optional[int] = 0
    device_fingerprint_changed: Optional[bool] = False
    avg_weekly_income: Optional[float] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    rainfall_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    aqi: Optional[int] = None
    traffic_index: Optional[float] = None
    zone_disruption_count: Optional[int] = 0
    origin_id: Optional[float] = None
    day_of_week: Optional[float] = None
    hour_of_day: Optional[float] = None
    travel_time_mean: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@router.post("/check")
async def fraud_check(req: FraudCheckRequest):
    payload = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else req.dict(exclude_none=True)
    return orchestrate_fraud_review(payload)
