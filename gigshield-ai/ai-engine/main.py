"""
GigShield AI — AI Engine (FastAPI)

Serves three core AI services:
  1. /api/risk/assess     — Risk score prediction
  2. /api/fraud/check     — Fraud detection for claims
  3. /api/premium/calculate — Premium calculation

Each endpoint is backed by a scikit-learn model that can be
trained on historical data and hot-reloaded from disk.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.risk_routes import router as risk_router
from routes.fraud_routes import router as fraud_router
from routes.premium_routes import router as premium_router

app = FastAPI(
    title="GigShield AI Engine",
    description="ML-powered risk assessment, fraud detection, and premium calculation",
    version="1.0.0",
)

# CORS — allow backend to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
def health():
    return {"status": "ok", "service": "gigshield-ai-engine"}

# Mount route modules
app.include_router(risk_router, prefix="/api/risk", tags=["Risk Assessment"])
app.include_router(fraud_router, prefix="/api/fraud", tags=["Fraud Detection"])
app.include_router(premium_router, prefix="/api/premium", tags=["Premium Calculation"])
