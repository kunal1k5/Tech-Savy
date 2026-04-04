"""Lightweight image forensics heuristics for GigShield proof validation."""

from __future__ import annotations

import base64
import hashlib
import io
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

import numpy as np
from PIL import ExifTags, Image

EXIF_TAG_MAP = {tag_id: tag_name for tag_id, tag_name in ExifTags.TAGS.items()}
CAMERA_METADATA_KEYS = {"Make", "Model", "LensModel", "DateTimeOriginal", "DateTimeDigitized"}
AI_SOFTWARE_MARKERS = ("stable diffusion", "midjourney", "dall-e", "photoshop", "canva", "gimp")


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, float(value)))


def decode_image(file_base64: str) -> Tuple[Image.Image, bytes]:
    raw_bytes = base64.b64decode(file_base64)
    image = Image.open(io.BytesIO(raw_bytes))
    image.load()
    return image, raw_bytes


def extract_exif(image: Image.Image) -> Dict[str, Any]:
    exif_data: Dict[str, Any] = {}
    raw_exif = image.getexif()
    if not raw_exif:
        return exif_data

    for key, value in raw_exif.items():
        tag_name = EXIF_TAG_MAP.get(key, str(key))
        exif_data[tag_name] = value

    return exif_data


def parse_capture_time(metadata: Dict[str, Any]) -> datetime | None:
    for field in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
        raw_value = metadata.get(field)
        if not raw_value:
            continue

        if isinstance(raw_value, bytes):
            raw_value = raw_value.decode("utf-8", errors="ignore")

        try:
            return datetime.strptime(str(raw_value), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            try:
                return datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))
            except ValueError:
                continue

    return None


def parse_reference_time(context: Dict[str, Any]) -> datetime:
    reference_raw = (
        context.get("metadata", {}).get("requested_at")
        or context.get("metadata", {}).get("captured_at")
        or datetime.now(timezone.utc).isoformat()
    )
    try:
        return datetime.fromisoformat(str(reference_raw).replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


def calculate_noise_score(image: Image.Image) -> float:
    grayscale = np.asarray(image.convert("L"), dtype=np.float32)
    if grayscale.size == 0:
        return 0.0

    horizontal_diff = np.abs(np.diff(grayscale, axis=1))
    vertical_diff = np.abs(np.diff(grayscale, axis=0))
    mean_diff = float((horizontal_diff.mean() + vertical_diff.mean()) / 2.0)
    return clamp(mean_diff)


def calculate_blockiness(image: Image.Image) -> float:
    grayscale = np.asarray(image.convert("L"), dtype=np.float32)
    if grayscale.shape[0] < 16 or grayscale.shape[1] < 16:
        return 0.0

    vertical_boundaries = [index for index in range(8, grayscale.shape[1] - 1, 8)]
    horizontal_boundaries = [index for index in range(8, grayscale.shape[0] - 1, 8)]

    if not vertical_boundaries or not horizontal_boundaries:
        return 0.0

    vertical_edges = [np.abs(grayscale[:, index] - grayscale[:, index - 1]).mean() for index in vertical_boundaries]
    horizontal_edges = [np.abs(grayscale[index, :] - grayscale[index - 1, :]).mean() for index in horizontal_boundaries]
    return clamp(float(np.mean(vertical_edges + horizontal_edges)))


def resolution_mismatch_score(image: Image.Image) -> float:
    width, height = image.size
    if width <= 0 or height <= 0:
        return 0.0

    score = 0.0
    if width % 64 == 0 and height % 64 == 0:
        score += 12.0
    if width == height:
        score += 8.0
    if width >= 1024 and height >= 1024:
        score += 4.0

    return clamp(score)


def analyze_image_forensics(file_base64: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    analysis_context = context or {}
    image, raw_bytes = decode_image(file_base64)
    metadata = extract_exif(image)
    file_hash = hashlib.sha256(raw_bytes).hexdigest()
    duplicate_found = bool(analysis_context.get("duplicate_found"))
    known_hashes = set(analysis_context.get("known_hashes", []))
    if file_hash in known_hashes:
        duplicate_found = True

    capture_time = parse_capture_time(metadata)
    reference_time = parse_reference_time(analysis_context)
    capture_age_minutes = None
    if capture_time is not None:
        capture_age_minutes = abs((reference_time - capture_time).total_seconds()) / 60.0

    has_camera_metadata = any(metadata.get(key) for key in CAMERA_METADATA_KEYS)
    missing_exif = len(metadata) == 0
    software_value = str(metadata.get("Software", "")).lower()

    noise_score = calculate_noise_score(image)
    blockiness_score = calculate_blockiness(image)
    resolution_score = resolution_mismatch_score(image)

    ai_probability = 8.0
    if missing_exif:
        ai_probability += 18.0
    if not has_camera_metadata:
        ai_probability += 16.0
    if noise_score < 14:
        ai_probability += 22.0
    elif noise_score < 20:
        ai_probability += 12.0
    if blockiness_score < 6:
        ai_probability += 12.0
    if duplicate_found:
        ai_probability += 18.0
    ai_probability += resolution_score

    tampering_detected = False
    tamper_reasons = []

    if any(marker in software_value for marker in AI_SOFTWARE_MARKERS):
        ai_probability += 35.0
        tampering_detected = True
        tamper_reasons.append("Editing or generation software tag found in metadata.")

    if capture_age_minutes is not None and capture_age_minutes > 5:
        tamper_reasons.append("Capture timestamp is too old for live-capture policy.")

    if blockiness_score > 35 and noise_score < 12:
        tampering_detected = True
        tamper_reasons.append("Block compression pattern is inconsistent with natural image noise.")

    is_live_capture = bool(
        capture_time is not None
        and capture_age_minutes is not None
        and capture_age_minutes <= 5
        and has_camera_metadata
    )

    return {
        "ai_generated_probability": round(clamp(ai_probability), 2),
        "tampering_detected": tampering_detected,
        "duplicate_found": duplicate_found,
        "missing_exif": missing_exif,
        "camera_metadata_present": has_camera_metadata,
        "capture_timestamp": capture_time.isoformat() if capture_time else None,
        "capture_age_minutes": round(capture_age_minutes, 2) if capture_age_minutes is not None else None,
        "is_live_capture": is_live_capture,
        "file_hash": file_hash,
        "metadata": metadata,
        "heuristics": {
            "noise_score": round(noise_score, 2),
            "blockiness_score": round(blockiness_score, 2),
            "resolution_mismatch_score": round(resolution_score, 2),
        },
        "tamper_reasons": tamper_reasons,
    }
