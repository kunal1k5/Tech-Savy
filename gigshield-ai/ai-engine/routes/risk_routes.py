"""
Risk Assessment API Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os

from risk_model import compute_risk_score

router = APIRouter()

OPENWEATHERMAP_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")


class RiskAssessRequest(BaseModel):
    worker_id: str
    city: str
    zone: str


@router.post("/assess")
async def assess_risk(req: RiskAssessRequest):
    """
    Assess risk for a worker's zone.

    Flow:
      1. Fetch live weather data from OpenWeatherMap API
      2. Feed features into the risk model
      3. Return risk_score + risk_tier + feature snapshot
    """
    # Fetch weather data (fallback to defaults if API unavailable)
    weather = {"rainfall_mm": 5.0, "temperature_c": 32.0, "aqi": 120, "traffic_index": 3.0}

    if OPENWEATHERMAP_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"q": req.city, "appid": OPENWEATHERMAP_KEY, "units": "metric"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    weather["temperature_c"] = data.get("main", {}).get("temp", 32.0)
                    weather["rainfall_mm"] = data.get("rain", {}).get("1h", 0.0)
        except Exception:
            pass  # Use defaults

    result = compute_risk_score(
        rainfall_mm=weather["rainfall_mm"],
        temperature_c=weather["temperature_c"],
        aqi=weather["aqi"],
        traffic_index=weather["traffic_index"],
        zone_disruption_count=0,  # TODO: fetch from DB
    )

    return result
