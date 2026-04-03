"""Premium calculation API routes."""

from fastapi import APIRouter
from pydantic import BaseModel

from services.premium_service import get_full_quote

router = APIRouter()


class PremiumRequest(BaseModel):
    risk_score: float
    risk_tier: str
    avg_weekly_income: float


@router.post("/calculate")
async def calculate(req: PremiumRequest):
    return get_full_quote(
        risk_score=req.risk_score,
        risk_tier=req.risk_tier,
        avg_weekly_income=req.avg_weekly_income,
    )
