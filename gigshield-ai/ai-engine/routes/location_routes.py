"""Location prediction API routes."""

from __future__ import annotations

from fastapi import APIRouter

from services.location_service import predict_location

router = APIRouter()


@router.post("/predict")
async def predict_next_location(payload: dict):
    return predict_location(payload)
