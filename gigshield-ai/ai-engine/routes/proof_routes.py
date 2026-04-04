"""Proof-analysis API routes."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from image_forensics import analyze_image_forensics
from proof_analyzer import analyze_proof_payload

router = APIRouter()


class ProofAnalysisRequest(BaseModel):
    proof_type: str = Field(..., description="PARCEL | SELFIE | WORK_SCREEN")
    file_name: str
    mime_type: str | None = None
    file_base64: str
    context: Dict[str, Any] = Field(default_factory=dict)


class ImageForensicsRequest(BaseModel):
    file_name: str
    mime_type: str | None = None
    file_base64: str
    context: Dict[str, Any] = Field(default_factory=dict)


@router.post("/analyze")
async def analyze_proof(request: ProofAnalysisRequest):
    payload = request.model_dump(exclude_none=True) if hasattr(request, "model_dump") else request.dict(exclude_none=True)
    return analyze_proof_payload(
        proof_type=payload["proof_type"],
        file_name=payload["file_name"],
        file_base64=payload["file_base64"],
        context=payload.get("context", {}),
    )


@router.post("/image")
async def analyze_image(request: ImageForensicsRequest):
    payload = request.model_dump(exclude_none=True) if hasattr(request, "model_dump") else request.dict(exclude_none=True)
    return analyze_image_forensics(
        file_base64=payload["file_base64"],
        context=payload.get("context", {}),
    )
