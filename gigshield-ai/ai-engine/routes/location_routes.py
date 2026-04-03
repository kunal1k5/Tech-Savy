"""Location prediction API routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.location_service import predict_location

router = APIRouter()


class LocationPredictionRequest(BaseModel):
    origin_id: float
    day_of_week: float
    hour_of_day: float
    travel_time_mean: float
    lower_bound: float
    upper_bound: float
    actual_destination_id: Optional[int] = None


@router.post("/predict")
async def predict_next_location(req: LocationPredictionRequest):
    payload = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else req.dict(exclude_none=True)
    return predict_location(payload)
