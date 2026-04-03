"""Risk assessment API routes."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from services.risk_service import assess_zone_risk, fetch_live_weather

router = APIRouter()


class RiskAssessRequest(BaseModel):
    worker_id: str
    city: str
    zone: str


@router.post("/assess")
async def assess_risk(req: RiskAssessRequest):
    weather = {
        "rainfall_mm": 5.0,
        "temperature_c": 32.0,
        "aqi": 120,
        "traffic_index": 3.0,
        "source": "fallback",
    }

    try:
        live_weather = fetch_live_weather(req.city)
        normalized = live_weather["weather"]
        weather = {
            "rainfall_mm": float(normalized.get("rain", 0.0)),
            "temperature_c": float(normalized.get("temperature", 32.0)),
            "aqi": int(round(max(normalized.get("pm25", 0.0), normalized.get("pm10", 0.0)))),
            "traffic_index": float(max(min((normalized.get("wind", 0.0) + normalized.get("gust", 0.0)) / 10.0, 10.0), 0.0)),
            "source": live_weather.get("source", "weather-service"),
        }
    except Exception:
        pass

    result = assess_zone_risk(
        rainfall_mm=weather["rainfall_mm"],
        temperature_c=weather["temperature_c"],
        aqi=weather["aqi"],
        traffic_index=weather["traffic_index"],
        zone_disruption_count=0,
    )
    return {
        **result,
        "city": req.city,
        "zone": req.zone,
        "weather_source": weather["source"],
    }
