"""Location-model helpers for next-destination prediction."""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

from utils import DATA_DIR, MODELS_DIR, resolve_existing_path, safe_load_joblib

LOCATION_FEATURE_COLUMNS = [
    "origin_id",
    "day_of_week",
    "hour_of_day",
    "travel_time_mean",
    "lower_bound",
    "upper_bound",
]

NUMERIC_REQUEST_FIELD_ALIASES = {
    "origin_id": ("origin_id", "origin_movement_id"),
    "day_of_week": ("day_of_week",),
    "hour_of_day": ("hour_of_day",),
    "travel_time_mean": ("travel_time_mean", "mean_travel_time"),
    "lower_bound": ("lower_bound",),
    "upper_bound": ("upper_bound",),
}

TEXT_REQUEST_FIELDS = ("current_location", "actual_location", "time")

MODEL_ENV_VARS = ("LOCATION_MODEL_PATH", "NEXT_LOCATION_MODEL_PATH")
REFERENCE_ENV_VARS = ("LOCATION_REFERENCE_PATH", "NEXT_LOCATION_REFERENCE_PATH")
LOCATION_CODE_PATTERN = re.compile(r"([A-Za-z]+|\d+)$")


def _first_env_value(names: tuple[str, ...]) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


def _candidate_paths() -> Tuple[List[Path], List[Path]]:
    configured_model_path = _first_env_value(MODEL_ENV_VARS)
    configured_reference_path = _first_env_value(REFERENCE_ENV_VARS)

    model_paths = [
        Path(configured_model_path) if configured_model_path else None,
        MODELS_DIR / "location_model.pkl",
        MODELS_DIR / "next_location_model.pkl",
    ]
    reference_paths = [
        Path(configured_reference_path) if configured_reference_path else None,
        DATA_DIR / "next_location_reference.csv",
    ]

    normalized_models = []
    normalized_references = []

    for path in model_paths:
        if path and path not in normalized_models:
            normalized_models.append(path)

    for path in reference_paths:
        if path and path not in normalized_references:
            normalized_references.append(path)

    return normalized_models, normalized_references


@lru_cache(maxsize=1)
def load_location_model():
    model_paths, _ = _candidate_paths()
    model_path = resolve_existing_path(model_paths, "location model")
    model = safe_load_joblib(model_path, mmap_mode="r")
    return model, model_path


@lru_cache(maxsize=1)
def load_location_reference() -> Tuple[pd.DataFrame, Path]:
    _, reference_paths = _candidate_paths()
    reference_path = resolve_existing_path(reference_paths, "next_location reference file")
    reference_df = pd.read_csv(reference_path)
    required_columns = {
        "encoded_destination_id",
        "destination_movement_id",
        "destination_display_name",
    }
    missing_columns = required_columns.difference(reference_df.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"Location reference file is missing required columns: {missing}")

    reference_df = reference_df.copy()
    reference_df["encoded_destination_id"] = reference_df["encoded_destination_id"].astype(int)
    reference_df["destination_movement_id"] = reference_df["destination_movement_id"].astype(int)

    return reference_df, reference_path


def get_location_model_health() -> Dict[str, object]:
    try:
        reference_df, reference_path = load_location_reference()
    except Exception as error:
        return {
            "ready": False,
            "error": str(error),
        }

    health = {
        "ready": True,
        "reference_path": str(reference_path),
        "reference_rows": int(len(reference_df)),
        "expected_features": len(LOCATION_FEATURE_COLUMNS),
        "supports_simple_input": True,
        "input_modes": ["numeric", "location_text"],
    }

    try:
        model, model_path = load_location_model()
    except Exception as error:
        return {
            **health,
            "model_ready": False,
            "fallback_mode": True,
            "warning": str(error),
        }

    return {
        **health,
        "model_ready": True,
        "fallback_mode": False,
        "model_path": str(model_path),
        "expected_features": int(getattr(model, "n_features_in_", len(LOCATION_FEATURE_COLUMNS))),
        "class_count": int(len(getattr(model, "classes_", []))),
    }


def predict_location(payload: object) -> Dict[str, object]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    reference_df, _ = load_location_reference()

    if _is_text_location_payload(payload):
        values, current_location, actual_location, requested_time = _parse_text_location_payload(
            payload,
            reference_df,
        )
        prediction = _predict_destination(values, reference_df)
        return _build_text_location_response(
            prediction=prediction,
            values=values,
            current_location=current_location,
            actual_location=actual_location,
            requested_time=requested_time,
        )

    values, actual_destination_id = _parse_numeric_location_payload(payload)
    prediction = _predict_destination(values, reference_df)
    return _build_numeric_location_response(
        prediction=prediction,
        values=values,
        actual_destination_id=actual_destination_id,
        reference_df=reference_df,
    )


def decode_destination(encoded_destination_id: int, reference_df: pd.DataFrame) -> Dict[str, object]:
    match = reference_df.loc[reference_df["encoded_destination_id"] == int(encoded_destination_id)]
    if match.empty:
        return {
            "encoded_destination_id": int(encoded_destination_id),
            "destination_movement_id": int(encoded_destination_id),
            "destination_display_name": f"Encoded destination {encoded_destination_id}",
        }

    row = match.iloc[0]
    return {
        "encoded_destination_id": int(row["encoded_destination_id"]),
        "destination_movement_id": int(row["destination_movement_id"]),
        "destination_display_name": str(row["destination_display_name"]),
    }


def _is_text_location_payload(payload: Dict[str, object]) -> bool:
    return any(field in payload for field in TEXT_REQUEST_FIELDS)


def _parse_numeric_location_payload(payload: Dict[str, object]) -> Tuple[Dict[str, float], int | None]:
    values: Dict[str, float] = {}
    missing_fields = []
    invalid_fields = []

    for field, aliases in NUMERIC_REQUEST_FIELD_ALIASES.items():
        raw_value = None
        for alias in aliases:
            if alias in payload:
                raw_value = payload[alias]
                break

        if raw_value is None:
            missing_fields.append(field)
            continue

        try:
            values[field] = float(raw_value)
        except (TypeError, ValueError):
            invalid_fields.append(field)

    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

    if invalid_fields:
        raise ValueError(
            "All location input fields must be numeric. Invalid fields: "
            f"{', '.join(invalid_fields)}"
        )

    raw_actual_destination_id = payload.get("actual_destination_id")
    actual_destination_id = None
    if raw_actual_destination_id not in (None, ""):
        try:
            actual_destination_id = int(raw_actual_destination_id)
        except (TypeError, ValueError) as error:
            raise ValueError("Field 'actual_destination_id' must be an integer.") from error

    return values, actual_destination_id


def _parse_text_location_payload(
    payload: Dict[str, object],
    reference_df: pd.DataFrame,
) -> Tuple[Dict[str, float], str, str | None, str]:
    current_location = _coerce_required_text(payload.get("current_location"), "current_location")
    actual_location = _coerce_optional_text(payload.get("actual_location"), "actual_location")
    requested_time = _coerce_optional_text(payload.get("time"), "time") or datetime.utcnow().strftime("%H:%M")
    hour_of_day = _parse_hour_of_day(requested_time)
    day_of_week = _parse_day_of_week(payload.get("day_of_week"))

    values = _build_features_from_location_label(
        current_location=current_location,
        hour_of_day=hour_of_day,
        day_of_week=day_of_week,
        reference_df=reference_df,
    )
    return values, current_location, actual_location, requested_time


def _predict_destination(values: Dict[str, float], reference_df: pd.DataFrame) -> Dict[str, object]:
    try:
        model, _ = load_location_model()
    except Exception as error:
        return _fallback_destination_prediction(values, reference_df, str(error))

    features = pd.DataFrame(
        [[values[column] for column in LOCATION_FEATURE_COLUMNS]],
        columns=LOCATION_FEATURE_COLUMNS,
    )
    predicted_encoded_id = int(model.predict(features)[0])
    decoded_prediction = decode_destination(predicted_encoded_id, reference_df)

    probabilities = []
    confidence = None
    if hasattr(model, "predict_proba"):
        raw_probabilities = model.predict_proba(features)[0]
        classes = [int(class_id) for class_id in getattr(model, "classes_", [])]
        ranked = sorted(
            zip(classes, raw_probabilities),
            key=lambda item: float(item[1]),
            reverse=True,
        )
        top_candidates = ranked[:3]
        probabilities = [
            {
                **decode_destination(class_id, reference_df),
                "friendly_location": _friendly_location_name(
                    decode_destination(class_id, reference_df)["destination_display_name"],
                    class_id,
                ),
                "score": round(float(score), 4),
            }
            for class_id, score in top_candidates
        ]
        if top_candidates:
            confidence = round(float(top_candidates[0][1]), 4)

    return {
        "predicted_destination_id": decoded_prediction["destination_movement_id"],
        "predicted_destination_name": decoded_prediction["destination_display_name"],
        "predicted_encoded_destination": decoded_prediction["encoded_destination_id"],
        "confidence": confidence,
        "top_candidates": probabilities,
        "model_source": "trained_model",
    }


def _build_numeric_location_response(
    prediction: Dict[str, object],
    values: Dict[str, float],
    actual_destination_id: int | None,
    reference_df: pd.DataFrame,
) -> Dict[str, object]:
    actual_destination_name = None
    suspicious = None
    fraud_status = "Unknown"
    match = None
    fraud_signal = "PENDING"
    mismatch_severity = "unverified"

    if actual_destination_id is not None:
        actual_match = reference_df.loc[
            reference_df["destination_movement_id"] == actual_destination_id,
            "destination_display_name",
        ]
        if not actual_match.empty:
            actual_destination_name = str(actual_match.iloc[0])

        match = prediction["predicted_destination_id"] == actual_destination_id
        suspicious = not match
        fraud_signal = "LOW" if match else "HIGH"
        mismatch_severity = "exact" if match else "large"
        fraud_status = "Clear" if match else "Suspicious"

    return {
        **prediction,
        "predicted_location": _friendly_location_name(
            prediction["predicted_destination_name"],
            prediction["predicted_encoded_destination"],
        ),
        "actual_destination_id": actual_destination_id,
        "actual_destination_name": actual_destination_name,
        "actual_location": actual_destination_name,
        "match": match,
        "fraud_signal": fraud_signal,
        "mismatch_severity": mismatch_severity,
        "suspicious": suspicious,
        "fraud_status": fraud_status,
        "features": values,
    }


def _build_text_location_response(
    prediction: Dict[str, object],
    values: Dict[str, float],
    current_location: str,
    actual_location: str | None,
    requested_time: str,
) -> Dict[str, object]:
    predicted_location = _friendly_location_name(
        prediction["predicted_destination_name"],
        prediction["predicted_encoded_destination"],
    )
    comparison = _compare_locations(predicted_location, actual_location)

    return {
        **prediction,
        "current_location": current_location,
        "predicted_location": predicted_location,
        "actual_location": actual_location,
        "time": requested_time,
        "match": comparison["match"],
        "fraud_signal": comparison["fraud_signal"],
        "mismatch_severity": comparison["mismatch_severity"],
        "suspicious": comparison["suspicious"],
        "fraud_status": comparison["fraud_status"],
        "features": values,
    }


def _fallback_destination_prediction(
    values: Dict[str, float],
    reference_df: pd.DataFrame,
    error_message: str,
) -> Dict[str, object]:
    if reference_df.empty:
        raise ValueError("Location reference file is empty, so fallback prediction is unavailable.")

    seed = int(
        values["origin_id"]
        + values["day_of_week"]
        + values["hour_of_day"]
        + round(values["travel_time_mean"] / max(values["upper_bound"], 1))
    )
    predicted_row_index = abs(seed) % len(reference_df)
    predicted_row = reference_df.iloc[predicted_row_index]

    candidate_indices = [(predicted_row_index + offset) % len(reference_df) for offset in range(3)]
    top_candidates = []
    base_scores = [0.38, 0.24, 0.16]
    for index, score in zip(candidate_indices, base_scores):
        row = reference_df.iloc[index]
        top_candidates.append(
            {
                "encoded_destination_id": int(row["encoded_destination_id"]),
                "destination_movement_id": int(row["destination_movement_id"]),
                "destination_display_name": str(row["destination_display_name"]),
                "friendly_location": _friendly_location_name(
                    str(row["destination_display_name"]),
                    int(row["encoded_destination_id"]),
                ),
                "score": score,
            }
        )

    return {
        "predicted_destination_id": int(predicted_row["destination_movement_id"]),
        "predicted_destination_name": str(predicted_row["destination_display_name"]),
        "predicted_encoded_destination": int(predicted_row["encoded_destination_id"]),
        "confidence": 0.38,
        "top_candidates": top_candidates,
        "model_source": "reference_fallback",
        "fallback_reason": error_message,
    }


def _build_features_from_location_label(
    current_location: str,
    hour_of_day: int,
    day_of_week: int,
    reference_df: pd.DataFrame,
) -> Dict[str, float]:
    movement_ids = sorted(reference_df["destination_movement_id"].astype(int).unique().tolist())
    if not movement_ids:
        raise ValueError("Location reference file does not contain movement ids.")

    hashed_index = _stable_index(current_location, len(movement_ids))
    origin_id = float(movement_ids[hashed_index])

    rush_hour = hour_of_day in {8, 9, 10, 18, 19, 20}
    zone_seed = _stable_index(f"{current_location}:{hour_of_day}", 97)
    travel_time_mean = float(12 + (zone_seed % 11) + (8 if rush_hour else 0))
    lower_bound = float(max(5, travel_time_mean - 4))
    upper_bound = float(travel_time_mean + 6 + (zone_seed % 4))

    return {
        "origin_id": origin_id,
        "day_of_week": float(day_of_week),
        "hour_of_day": float(hour_of_day),
        "travel_time_mean": travel_time_mean,
        "lower_bound": lower_bound,
        "upper_bound": upper_bound,
    }


def _compare_locations(predicted_location: str, actual_location: str | None) -> Dict[str, object]:
    if not actual_location:
        return {
            "match": None,
            "fraud_signal": "PENDING",
            "mismatch_severity": "unverified",
            "suspicious": None,
            "fraud_status": "Pending",
        }

    predicted_key = _normalize_location_key(predicted_location)
    actual_key = _normalize_location_key(actual_location)
    if predicted_key == actual_key:
        return {
            "match": True,
            "fraud_signal": "LOW",
            "mismatch_severity": "exact",
            "suspicious": False,
            "fraud_status": "Clear",
        }

    if _is_slight_mismatch(predicted_location, actual_location):
        return {
            "match": False,
            "fraud_signal": "MEDIUM",
            "mismatch_severity": "slight",
            "suspicious": True,
            "fraud_status": "Review",
        }

    return {
        "match": False,
        "fraud_signal": "HIGH",
        "mismatch_severity": "large",
        "suspicious": True,
        "fraud_status": "Suspicious",
    }


def _is_slight_mismatch(predicted_location: str, actual_location: str) -> bool:
    predicted_code = _extract_location_code(predicted_location)
    actual_code = _extract_location_code(actual_location)

    if predicted_code and actual_code:
        if predicted_code.isdigit() and actual_code.isdigit():
            return abs(int(predicted_code) - int(actual_code)) <= 1

        if len(predicted_code) == 1 and len(actual_code) == 1:
            return abs(ord(predicted_code.upper()) - ord(actual_code.upper())) <= 2

        return predicted_code[0].upper() == actual_code[0].upper()

    return False


def _friendly_location_name(destination_name: object, encoded_destination_id: object) -> str:
    raw_value = str(destination_name or "").strip()
    if raw_value and _looks_human_readable(raw_value):
        return raw_value

    return _zone_alias(encoded_destination_id)


def _looks_human_readable(value: str) -> bool:
    letters = sum(1 for char in value if char.isalpha())
    digits = sum(1 for char in value if char.isdigit())
    if value.lower().startswith("zone"):
        return True
    return letters >= 3 and letters >= digits


def _zone_alias(encoded_destination_id: object) -> str:
    try:
        encoded_value = int(encoded_destination_id)
    except (TypeError, ValueError):
        encoded_value = 0

    return f"Zone-{chr(ord('A') + (encoded_value % 26))}"


def _parse_hour_of_day(time_text: str) -> int:
    normalized = time_text.strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return int(datetime.strptime(normalized, fmt).hour)
        except ValueError:
            continue
    raise ValueError("Field 'time' must be in HH:MM or HH:MM:SS format.")


def _parse_day_of_week(raw_value: object) -> int:
    if raw_value in (None, ""):
        return int(datetime.utcnow().weekday())

    try:
        day_of_week = int(raw_value)
    except (TypeError, ValueError) as error:
        raise ValueError("Field 'day_of_week' must be an integer between 0 and 6.") from error

    if not 0 <= day_of_week <= 6:
        raise ValueError("Field 'day_of_week' must be an integer between 0 and 6.")

    return day_of_week


def _coerce_required_text(raw_value: object, field_name: str) -> str:
    value = _coerce_optional_text(raw_value, field_name)
    if not value:
        raise ValueError(f"Field '{field_name}' is required.")
    return value


def _coerce_optional_text(raw_value: object, field_name: str) -> str | None:
    if raw_value in (None, ""):
        return None

    value = str(raw_value).strip()
    if not value:
        raise ValueError(f"Field '{field_name}' must not be blank.")

    return value


def _normalize_location_key(location_name: str) -> str:
    return "".join(char.lower() for char in location_name if char.isalnum())


def _extract_location_code(location_name: str) -> str:
    match = LOCATION_CODE_PATTERN.search(location_name.replace(" ", ""))
    if not match:
        return ""
    return match.group(1)


def _stable_index(seed_text: str, size: int) -> int:
    if size <= 0:
        return 0

    digest = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % size
