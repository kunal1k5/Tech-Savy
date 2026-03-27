"""
Fraud Detection API Routes
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from fraud_detection import check_fraud

router = APIRouter()


class FraudCheckRequest(BaseModel):
    claim_id: str
    worker_id: str
    policy_id: str
    trigger_id: str
    claim_amount: float
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


@router.post("/check")
async def fraud_check(req: FraudCheckRequest):
    """
    Run fraud detection on a claim submission.
    Returns fraud_score (0-100) and recommended action (pass/flag/block).
    """
    result = check_fraud(
        worker_id=req.worker_id,
        claim_amount=req.claim_amount,
        trigger_type="",
        worker_claims_30d=req.worker_claims_30d,
        avg_claim_amount=req.avg_claim_amount,
        worker_in_zone=req.worker_in_zone,
        duplicate_trigger=req.duplicate_trigger,
        predicted_destination_id=req.predicted_destination_id,
        actual_destination_id=req.actual_destination_id,
        location_jump_km=req.location_jump_km,
        location_window_minutes=req.location_window_minutes,
        repeated_claims_6h=req.repeated_claims_6h,
        nearby_similar_claims_count=req.nearby_similar_claims_count,
        device_fingerprint_changed=req.device_fingerprint_changed,
    )

    return result
