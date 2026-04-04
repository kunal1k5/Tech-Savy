"""Centralized path constants for the AI engine."""

from __future__ import annotations

from pathlib import Path

AI_ENGINE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = AI_ENGINE_DIR / "models"
DATA_DIR = AI_ENGINE_DIR / "data"
