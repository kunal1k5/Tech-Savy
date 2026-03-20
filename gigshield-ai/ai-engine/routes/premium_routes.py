"""
Premium Calculation API Routes
"""

from fastapi import APIRouter
from pydantic import BaseModel

from premium_calculator import get_full_quote

router = APIRouter()


class PremiumRequest(BaseModel):
    risk_score: float
    risk_tier: str
    avg_weekly_income: float


@router.post("/calculate")
async def calculate(req: PremiumRequest):
    """
    Calculate weekly premium and coverage for a worker.
    """
    quote = get_full_quote(
        risk_score=req.risk_score,
        risk_tier=req.risk_tier,
        avg_weekly_income=req.avg_weekly_income,
    )
    return quote
