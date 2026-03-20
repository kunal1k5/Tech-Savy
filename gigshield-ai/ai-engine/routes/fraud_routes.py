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
    )

    return result
