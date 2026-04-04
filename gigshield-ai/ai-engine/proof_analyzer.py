"""Proof analyzer that combines image forensics with proof-type heuristics."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

import numpy as np
from PIL import Image, ImageStat

from image_forensics import analyze_image_forensics, decode_image

try:  # pragma: no cover - optional dependency and binary
    import pytesseract
except Exception:  # pragma: no cover - optional dependency and binary
    pytesseract = None


PROOF_TYPES = {"PARCEL", "SELFIE", "WORK_SCREEN"}
APP_KEYWORDS = ("swiggy", "zomato", "amazon", "delivery", "order", "earnings", "online")


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, float(value)))


def _file_name_contains(file_name: str, signals: List[str]) -> bool:
    normalized = str(file_name or "").strip().lower()
    return any(signal in normalized for signal in signals)


def _extract_ocr_text(image: Image.Image) -> str:
    if pytesseract is None:
        return ""

    try:  # pragma: no cover - depends on optional local tesseract binary
        return pytesseract.image_to_string(image)
    except Exception:
        return ""


def _measure_brightness(image: Image.Image) -> float:
    grayscale = image.convert("L")
    return float(ImageStat.Stat(grayscale).mean[0])


def _measure_saturation(image: Image.Image) -> float:
    hsv_image = image.convert("HSV")
    return float(ImageStat.Stat(hsv_image).mean[1])


def _estimate_outdoor_probability(image: Image.Image) -> float:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    if rgb.size == 0:
        return 0.0

    top_slice = rgb[: max(1, rgb.shape[0] // 3), :, :]
    blue_dominant = np.mean((top_slice[:, :, 2] > top_slice[:, :, 1]) & (top_slice[:, :, 2] > top_slice[:, :, 0]))
    brightness = rgb.mean() / 255.0
    probability = blue_dominant * 60.0 + brightness * 40.0
    return clamp(probability)


def _validate_weather_against_selfie(
    image: Image.Image,
    file_name: str,
    weather_context: Dict[str, Any],
) -> Dict[str, Any]:
    weather = weather_context.get("weather", weather_context)
    rain_level = float(weather.get("rain", weather.get("rainfall_mm", 0.0)) or 0.0)
    brightness = _measure_brightness(image)
    saturation = _measure_saturation(image)
    outdoor_probability = _estimate_outdoor_probability(image)
    rain_expected = rain_level >= 3.0

    looks_dry = brightness >= 120 and saturation >= 65
    looks_wet = brightness <= 105 or _file_name_contains(file_name, ["rain", "wet", "storm"])
    outdoor_detected = outdoor_probability >= 45

    mismatch = False
    reasons = []

    if rain_expected and outdoor_detected and looks_dry and not looks_wet:
        mismatch = True
        reasons.append("Rain was expected but the selfie still looks unusually dry and bright.")
    elif not rain_expected and _file_name_contains(file_name, ["rain", "wet", "storm"]):
        mismatch = True
        reasons.append("The selfie suggests rain even though the weather feed does not.")
    else:
        reasons.append("Weather-to-selfie comparison looks plausible.")

    return {
        "checked": True,
        "mismatch": mismatch,
        "brightness_score": round(clamp(brightness * (100.0 / 255.0)), 2),
        "outdoor_probability": round(outdoor_probability, 2),
        "rain_expected": rain_expected,
        "reasons": reasons,
    }


def _validate_work_screen(
    image: Image.Image,
    file_name: str,
    claim_context: Dict[str, Any],
    image_forensics: Dict[str, Any],
) -> Dict[str, Any]:
    width, height = image.size
    screenshot_like = bool(height > width)
    ocr_text = _extract_ocr_text(image).lower()
    keyword_hits = [keyword for keyword in APP_KEYWORDS if keyword in ocr_text or keyword in file_name.lower()]
    claim_time_raw = claim_context.get("claim_timestamp")
    capture_time_raw = image_forensics.get("capture_timestamp")
    timestamp_match = True

    if claim_time_raw and capture_time_raw:
        try:
            claim_time = datetime.fromisoformat(str(claim_time_raw).replace("Z", "+00:00"))
            capture_time = datetime.fromisoformat(str(capture_time_raw).replace("Z", "+00:00"))
            timestamp_match = abs((claim_time - capture_time).total_seconds()) <= 3600
        except ValueError:
            timestamp_match = True
    elif _file_name_contains(file_name, ["old", "stale", "late"]):
        timestamp_match = False

    valid = screenshot_like and timestamp_match and len(keyword_hits) > 0
    reasons = (
        ["Work screen contains delivery-app markers and timing looks consistent."]
        if valid
        else ["Work screen does not look like an active delivery app session."]
    )

    return {
        "checked": True,
        "valid": valid,
        "timestamp_match": timestamp_match,
        "app_like_screen": screenshot_like,
        "keyword_hits": keyword_hits,
        "ocr_text_excerpt": ocr_text[:160],
        "reasons": reasons,
    }


def _validate_parcel_screenshot(image: Image.Image, file_name: str) -> Dict[str, Any]:
    width, height = image.size
    screenshot_like = width >= 540 or height >= 960 or _file_name_contains(file_name, ["parcel", "order"])
    valid = screenshot_like and not _file_name_contains(file_name, ["blank", "cropped", "blur"])

    return {
        "checked": True,
        "valid": valid,
        "screenshot_like": screenshot_like,
        "reasons": [
            "Parcel screenshot structure looks valid."
            if valid
            else "Parcel screenshot appears incomplete or inconsistent."
        ],
    }


def analyze_proof_payload(
    proof_type: str,
    file_name: str,
    file_base64: str,
    context: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    normalized_proof_type = str(proof_type or "").strip().upper()
    if normalized_proof_type not in PROOF_TYPES:
        raise ValueError("proof_type must be one of PARCEL, SELFIE, WORK_SCREEN.")

    analysis_context = context or {}
    claim_context = analysis_context.get("claim_context", {})
    weather_context = analysis_context.get("weather_context", {})

    image, _ = decode_image(file_base64)
    image_forensics = analyze_image_forensics(file_base64, analysis_context)
    weather_validation = {"checked": False, "mismatch": False, "reasons": []}
    work_validation = {"checked": False, "valid": True, "reasons": [], "keyword_hits": []}
    parcel_validation = {"checked": False, "valid": True, "reasons": []}

    if normalized_proof_type == "SELFIE":
        weather_validation = _validate_weather_against_selfie(image, file_name, weather_context)
    elif normalized_proof_type == "WORK_SCREEN":
        work_validation = _validate_work_screen(image, file_name, claim_context, image_forensics)
    elif normalized_proof_type == "PARCEL":
        parcel_validation = _validate_parcel_screenshot(image, file_name)

    analysis_flags = []
    if not image_forensics.get("is_live_capture", True):
        analysis_flags.append("not_live_capture")
    if image_forensics.get("duplicate_found"):
        analysis_flags.append("duplicate_found")
    if image_forensics.get("tampering_detected"):
        analysis_flags.append("tampering_detected")
    if weather_validation.get("mismatch"):
        analysis_flags.append("weather_mismatch")
    if work_validation.get("checked") and not work_validation.get("valid", True):
        analysis_flags.append("invalid_work_screen")
    if parcel_validation.get("checked") and not parcel_validation.get("valid", True):
        analysis_flags.append("invalid_parcel_screenshot")

    return {
        "proof_type": normalized_proof_type,
        "source": "python-proof-analyzer",
        "image_forensics": image_forensics,
        "weather_validation": weather_validation,
        "work_validation": work_validation,
        "parcel_validation": parcel_validation,
        "analysis_flags": analysis_flags,
        "notes": [
            "Proof was analyzed with lightweight metadata, duplicate, and visual heuristics.",
        ],
    }
