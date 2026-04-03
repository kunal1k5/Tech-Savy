"""Location-model helpers for next-destination prediction."""

from __future__ import annotations

import os
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

REQUEST_FIELD_ALIASES = {
    "origin_id": ("origin_id", "origin_movement_id"),
    "day_of_week": ("day_of_week",),
    "hour_of_day": ("hour_of_day",),
    "travel_time_mean": ("travel_time_mean", "mean_travel_time"),
    "lower_bound": ("lower_bound",),
    "upper_bound": ("upper_bound",),
}

MODEL_ENV_VARS = ("LOCATION_MODEL_PATH", "NEXT_LOCATION_MODEL_PATH")
REFERENCE_ENV_VARS = ("LOCATION_REFERENCE_PATH", "NEXT_LOCATION_REFERENCE_PATH")


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

    try:
        model, model_path = load_location_model()
    except Exception as error:
        return {
            "ready": True,
            "model_ready": False,
            "fallback_mode": True,
            "warning": str(error),
            "reference_path": str(reference_path),
            "reference_rows": int(len(reference_df)),
            "expected_features": len(LOCATION_FEATURE_COLUMNS),
        }

    return {
        "ready": True,
        "model_ready": True,
        "fallback_mode": False,
        "model_path": str(model_path),
        "reference_path": str(reference_path),
        "expected_features": int(getattr(model, "n_features_in_", len(LOCATION_FEATURE_COLUMNS))),
        "class_count": int(len(getattr(model, "classes_", []))),
        "reference_rows": int(len(reference_df)),
    }


def parse_location_payload(payload: object) -> Tuple[Dict[str, float], int | None]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    values: Dict[str, float] = {}
    missing_fields = []
    invalid_fields = []

    for field, aliases in REQUEST_FIELD_ALIASES.items():
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


def predict_location(payload: object) -> Dict[str, object]:
    values, actual_destination_id = parse_location_payload(payload)
    reference_df, _ = load_location_reference()

    try:
        model, _ = load_location_model()
    except Exception as error:
        return _fallback_location_prediction(values, actual_destination_id, reference_df, str(error))

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
                "score": round(float(score), 4),
            }
            for class_id, score in top_candidates
        ]
        if top_candidates:
            confidence = round(float(top_candidates[0][1]), 4)

    suspicious = None
    fraud_status = "Unknown"
    actual_destination_name = None
    if actual_destination_id is not None:
        actual_match = reference_df.loc[
            reference_df["destination_movement_id"] == actual_destination_id,
            "destination_display_name",
        ]
        if not actual_match.empty:
            actual_destination_name = str(actual_match.iloc[0])

        suspicious = decoded_prediction["destination_movement_id"] != actual_destination_id
        fraud_status = "Suspicious" if suspicious else "Clear"

    return {
        "predicted_destination_id": decoded_prediction["destination_movement_id"],
        "predicted_destination_name": decoded_prediction["destination_display_name"],
        "predicted_encoded_destination": decoded_prediction["encoded_destination_id"],
        "confidence": confidence,
        "top_candidates": probabilities,
        "actual_destination_id": actual_destination_id,
        "actual_destination_name": actual_destination_name,
        "suspicious": suspicious,
        "fraud_status": fraud_status,
        "features": values,
        "model_source": "trained_model",
    }


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


def _fallback_location_prediction(
    values: Dict[str, float],
    actual_destination_id: int | None,
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
                "score": score,
            }
        )

    actual_destination_name = None
    suspicious = None
    fraud_status = "Unknown"
    if actual_destination_id is not None:
        actual_match = reference_df.loc[
            reference_df["destination_movement_id"] == actual_destination_id,
            "destination_display_name",
        ]
        if not actual_match.empty:
            actual_destination_name = str(actual_match.iloc[0])

        suspicious = int(predicted_row["destination_movement_id"]) != actual_destination_id
        fraud_status = "Suspicious" if suspicious else "Clear"

    return {
        "predicted_destination_id": int(predicted_row["destination_movement_id"]),
        "predicted_destination_name": str(predicted_row["destination_display_name"]),
        "predicted_encoded_destination": int(predicted_row["encoded_destination_id"]),
        "confidence": 0.38,
        "top_candidates": top_candidates,
        "actual_destination_id": actual_destination_id,
        "actual_destination_name": actual_destination_name,
        "suspicious": suspicious,
        "fraud_status": fraud_status,
        "features": values,
        "model_source": "reference_fallback",
        "fallback_reason": error_message,
    }
