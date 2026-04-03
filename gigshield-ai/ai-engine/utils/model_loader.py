"""Reusable model-loading helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import joblib


def resolve_existing_path(paths: Iterable[Path], label: str) -> Path:
    for path in paths:
        if path.exists():
            return path

    searched = ", ".join(str(path) for path in paths)
    raise FileNotFoundError(f"{label} was not found. Checked: {searched}")


def safe_load_joblib(path: Path, mmap_mode: str | None = None):
    if not path.exists():
        raise FileNotFoundError(f"Model file was not found: {path}")
    return joblib.load(path, mmap_mode=mmap_mode)
