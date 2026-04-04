"""FastAPI entrypoint for GigPredict AI services."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from routes.fraud_routes import router as fraud_router
from routes.location_routes import router as location_router
from routes.premium_routes import router as premium_router
from routes.proof_routes import router as proof_router
from routes.risk_routes import router as risk_router
from services import get_fraud_service_health
from services.location_service import get_location_model_health, predict_location
from services.risk_service import (
    RiskServiceError,
    fetch_live_weather,
    get_risk_service_health,
    predict_from_payload,
    predict_live_risk,
    predict_weather_risk,
)

app = FastAPI(
    title="GigPredict AI Engine",
    description="Risk scoring, premium pricing, location consistency, and fraud orchestration",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _raise_http(error: Exception) -> None:
    if isinstance(error, RiskServiceError):
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    if isinstance(error, ValueError):
        raise HTTPException(status_code=400, detail=str(error)) from error
    if isinstance(error, FileNotFoundError):
        raise HTTPException(status_code=500, detail=str(error)) from error
    raise HTTPException(status_code=500, detail="AI engine request failed.") from error


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "gigpredict-ai-engine",
        "risk_model": get_risk_service_health(),
        "fraud_model": get_fraud_service_health(),
        "next_location_model": get_location_model_health(),
        "orchestrator": {"enabled": True, "path": "ai-engine/fraud_orchestrator.py"},
        "weather_risk_api": {"endpoint": "/predict-risk", "method": "POST"},
    }


@app.get("/weather/live")
def weather_live(city: str = Query(..., min_length=1)):
    try:
        return fetch_live_weather(city)
    except Exception as error:  # pragma: no cover - thin transport layer
        _raise_http(error)


@app.post("/predict")
def predict(payload: dict):
    try:
        return predict_from_payload(payload)
    except Exception as error:  # pragma: no cover - thin transport layer
        _raise_http(error)


@app.post("/predict-risk")
def predict_risk(payload: dict):
    try:
        return predict_weather_risk(payload)
    except Exception as error:  # pragma: no cover - thin transport layer
        _raise_http(error)


@app.post("/predict/live")
def predict_live(payload: dict):
    try:
        return predict_live_risk(payload)
    except Exception as error:  # pragma: no cover - thin transport layer
        _raise_http(error)


@app.post("/predict-location")
def predict_location_route(payload: dict):
    try:
        return predict_location(payload)
    except Exception as error:  # pragma: no cover - thin transport layer
        _raise_http(error)


app.include_router(risk_router, prefix="/api/risk", tags=["Risk Assessment"])
app.include_router(fraud_router, prefix="/api/fraud", tags=["Fraud Detection"])
app.include_router(premium_router, prefix="/api/premium", tags=["Premium Calculation"])
app.include_router(location_router, prefix="/api/location", tags=["Location Prediction"])
app.include_router(proof_router, prefix="/api/proof", tags=["Proof Analysis"])
app.include_router(proof_router, prefix="/api/forensics", tags=["Image Forensics"])

