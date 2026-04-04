"""Risk-service runtime helpers for weather-backed risk assessment."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Tuple

import httpx
import numpy as np
import pandas as pd
from dotenv import load_dotenv

from utils import MODELS_DIR, clamp_score, risk_tier_from_score, safe_load_joblib

LOGGER = logging.getLogger(__name__)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "wind",
    "pressure",
    "rain",
    "cloud",
    "uv",
    "pm25",
    "pm10",
    "visibility",
    "gust",
]

WEATHER_RISK_API_COLUMNS = [
    "temperature",
    "humidity",
    "precip_mm",
    "wind_kph",
    "aqi",
]

PREDICTION_LABELS = {
    0: "Low Risk",
    1: "Medium Risk",
    2: "High Risk",
}

MODEL_CANDIDATE_PATHS = (MODELS_DIR / "risk_model.pkl",)

WEATHER_API_BASE_URL = os.getenv("WEATHER_API_BASE_URL", "https://weather.indianapi.in").rstrip("/")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
WEATHER_API_TIMEOUT_SECONDS = float(os.getenv("WEATHER_API_TIMEOUT_SECONDS", "10"))
DEFAULT_WEATHER_CITY = os.getenv("DEFAULT_WEATHER_CITY", "Bengaluru")
WEATHER_API_KEY_PLACEHOLDER = "PASTE_YOUR_WEATHER_API_KEY_HERE"
DEFAULT_PRESSURE_HPA = 1013.25
DEFAULT_PM25 = 0.0
DEFAULT_PM10 = 0.0
DEFAULT_VISIBILITY_KM = 10.0
DEFAULT_GUST_FACTOR = 1.3
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

class RiskServiceError(Exception):
    """Exception with an HTTP status code for risk-service consumers."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@lru_cache(maxsize=1)
def _load_model():
    for path in MODEL_CANDIDATE_PATHS:
        if path.exists():
            return safe_load_joblib(path), path

    searched = ", ".join(str(path) for path in MODEL_CANDIDATE_PATHS)
    raise FileNotFoundError(f"risk_model.pkl was not found. Checked: {searched}")


def _get_model():
    model, model_path = _load_model()
    model_feature_count = getattr(model, "n_features_in_", len(FEATURE_COLUMNS))
    return model, model_path, model_feature_count


def get_risk_service_health() -> Dict[str, object]:
    try:
        _, model_path, model_feature_count = _get_model()
    except Exception as error:
        return {
            "ready": False,
            "error": str(error),
            "weather_provider_configured": bool(_get_weather_api_key()),
            "weather_provider": "Indian API with Open-Meteo fallback",
        }

    return {
        "ready": True,
        "model_path": str(model_path),
        "expected_features": int(model_feature_count),
        "weather_provider_configured": bool(_get_weather_api_key()),
        "weather_provider": "Indian API with Open-Meteo fallback",
    }


def parse_payload(payload: object) -> Dict[str, float]:
    if not isinstance(payload, dict):
        raise RiskServiceError("Request body must be a JSON object.", 400)

    missing_fields = [field for field in FEATURE_COLUMNS if field not in payload]
    if missing_fields:
        raise RiskServiceError(f"Missing required fields: {', '.join(missing_fields)}", 400)

    values: Dict[str, float] = {}
    invalid_fields = []

    for field in FEATURE_COLUMNS:
        raw_value = payload.get(field)
        try:
            values[field] = float(raw_value)
        except (TypeError, ValueError):
            invalid_fields.append(field)

    if invalid_fields:
        raise RiskServiceError(
            f"All input fields must be numeric. Invalid fields: {', '.join(invalid_fields)}",
            400,
        )

    return values


def predict_from_payload(payload: object) -> Dict[str, object]:
    values = parse_payload(payload)
    prediction_result = _predict_from_values(values)
    return {
        **prediction_result,
        "features": values,
    }


def predict_weather_risk(payload: object) -> Dict[str, object]:
    """Serve the trained weather risk model through a simple Flask-friendly contract."""
    values = parse_weather_risk_payload(payload)
    try:
        feature_frame = build_weather_risk_frame(values)
        model, model_path, model_feature_count = _get_model()
        feature_frame = _align_weather_risk_frame(feature_frame, model, model_feature_count)
        score = _extract_weather_risk_score(model, feature_frame)

        return {
            "risk": map_weather_risk_level(score),
            "score": round(score, 4),
            "model_path": str(model_path),
            "source": "trained_model",
        }
    except Exception as error:
        LOGGER.warning("Weather risk model unavailable, using fallback scoring: %s", error)
        score = _fallback_weather_risk_score(values)
        return {
            "risk": map_weather_risk_level(score),
            "score": round(score, 4),
            "model_path": "rule-fallback",
            "source": "rule-fallback",
            "warning": str(error),
        }


def parse_weather_risk_payload(payload: object) -> Dict[str, float]:
    if not isinstance(payload, dict):
        raise RiskServiceError("Request body must be a JSON object.", 400)

    missing_fields = [field for field in WEATHER_RISK_API_COLUMNS if field not in payload]
    if missing_fields:
        raise RiskServiceError(
            f"Missing required fields: {', '.join(missing_fields)}",
            400,
        )

    values: Dict[str, float] = {}
    invalid_fields = []

    for field in WEATHER_RISK_API_COLUMNS:
        raw_value = payload.get(field)
        try:
            values[field] = float(raw_value)
        except (TypeError, ValueError):
            invalid_fields.append(field)

    if invalid_fields:
        raise RiskServiceError(
            f"All input fields must be numeric. Invalid fields: {', '.join(invalid_fields)}",
            400,
        )

    return values


def build_weather_risk_frame(values: Dict[str, float]) -> pd.DataFrame:
    return pd.DataFrame([[values[column] for column in WEATHER_RISK_API_COLUMNS]], columns=WEATHER_RISK_API_COLUMNS)


def map_weather_risk_level(score: float) -> str:
    if score < 0.3:
        return "LOW"
    if score < 0.7:
        return "MEDIUM"
    return "HIGH"


def _fallback_weather_risk_score(values: Dict[str, float]) -> float:
    score = 0.0

    if values["precip_mm"] >= 20:
        score += 0.35
    elif values["precip_mm"] >= 8:
        score += 0.18

    if values["aqi"] >= 220:
        score += 0.3
    elif values["aqi"] >= 120:
        score += 0.16

    if values["wind_kph"] >= 30:
        score += 0.18
    elif values["wind_kph"] >= 18:
        score += 0.1

    if values["humidity"] >= 85:
        score += 0.1
    elif values["humidity"] >= 70:
        score += 0.05

    if values["temperature"] >= 38:
        score += 0.07
    elif values["temperature"] >= 33:
        score += 0.03

    return clamp_score(score, 0.0, 1.0)


def fetch_live_weather(city: str) -> Dict[str, object]:
    city_name = str(city or "").strip()
    if not city_name:
        raise RiskServiceError("Query parameter 'city' is required.", 400)

    provider_errors = []
    weather_api_key = _get_weather_api_key()

    if weather_api_key:
        headers = {"x-api-key": weather_api_key}
        india_payload, india_error = _fetch_indianapi_payload("/india/weather", {"city": city_name}, headers)
        global_payload, global_error = _fetch_indianapi_payload(
            "/global/current",
            {"location": city_name},
            headers,
        )

        if india_payload is not None or global_payload is not None:
            weather = _normalize_indianapi_weather(india_payload, global_payload)
            resolved_name = city_name
            if india_payload and isinstance(india_payload.get("city"), str):
                resolved_name = india_payload["city"]

            return {
                "city": city_name,
                "resolved_location": {
                    "name": resolved_name,
                    "region": "",
                    "country": "India",
                    "localtime": "",
                },
                "weather": weather,
                "source": "Indian API /india/weather + /global/current",
            }

        error_parts = [part for part in [india_error, global_error] if part]
        if error_parts:
            provider_errors.append(f"Indian API weather lookup failed: {' | '.join(error_parts)}")
    else:
        provider_errors.append(
            f"Indian API key is missing in {ENV_PATH}. Falling back to Open-Meteo."
        )

    open_meteo_payload, open_meteo_error = _fetch_open_meteo_weather(city_name)
    if open_meteo_payload is not None:
        return open_meteo_payload

    provider_errors.append(f"Open-Meteo fallback failed: {open_meteo_error or 'Unknown error'}")
    raise RiskServiceError(" | ".join(provider_errors), 502)


def predict_live_risk(payload: object) -> Dict[str, object]:
    request_payload = payload if isinstance(payload, dict) else {}
    city = str(
        request_payload.get("city")
        or request_payload.get("location")
        or DEFAULT_WEATHER_CITY
    ).strip()
    if not city:
        raise RiskServiceError("Field 'city' is required for live weather prediction.", 400)

    weather_payload = fetch_live_weather(city)
    prediction_result = _predict_from_values(weather_payload["weather"])

    return {
        **prediction_result,
        "city": weather_payload["city"],
        "resolved_location": weather_payload["resolved_location"],
        "weather": weather_payload["weather"],
        "source": weather_payload["source"],
    }


def assess_zone_risk(
    rainfall_mm: float,
    temperature_c: float,
    aqi: int,
    traffic_index: float,
    zone_disruption_count: int = 0,
) -> Dict[str, object]:
    model = None
    model_feature_count = None
    try:
        model, _, model_feature_count = _get_model()
    except Exception as error:
        LOGGER.warning("Risk model unavailable, using rule fallback for zone assessment: %s", error)
        model = None

    if model is not None and model_feature_count == 5:
        features = np.array(
            [[rainfall_mm, temperature_c, aqi, traffic_index, zone_disruption_count]],
            dtype=float,
        )
        risk_score = clamp_score(model.predict(features)[0])
        source = "model"
    else:
        risk_score = _compute_rule_based_zone_risk(
            rainfall_mm=rainfall_mm,
            temperature_c=temperature_c,
            aqi=aqi,
            traffic_index=traffic_index,
            zone_disruption_count=zone_disruption_count,
        )
        source = "rule-fallback"

    risk_tier = risk_tier_from_score(risk_score)

    return {
        "risk_score": round(risk_score, 2),
        "risk_tier": risk_tier,
        "source": source,
        "features": {
            "rainfall_mm": rainfall_mm,
            "temperature_c": temperature_c,
            "aqi": aqi,
            "traffic_index": traffic_index,
            "zone_history": {"disruption_count_30d": zone_disruption_count},
        },
    }


def compute_risk_score(
    rainfall_mm: float,
    temperature_c: float,
    aqi: int,
    traffic_index: float,
    zone_disruption_count: int = 0,
) -> Dict[str, object]:
    return assess_zone_risk(
        rainfall_mm=rainfall_mm,
        temperature_c=temperature_c,
        aqi=aqi,
        traffic_index=traffic_index,
        zone_disruption_count=zone_disruption_count,
    )


def _compute_rule_based_zone_risk(
    rainfall_mm: float,
    temperature_c: float,
    aqi: int,
    traffic_index: float,
    zone_disruption_count: int = 0,
) -> float:
    score = 0.0

    if rainfall_mm > 100:
        score += 30
    elif rainfall_mm > 50:
        score += 20
    elif rainfall_mm > 20:
        score += 10

    if temperature_c > 45 or temperature_c < 5:
        score += 20
    elif temperature_c > 40 or temperature_c < 10:
        score += 12
    elif temperature_c > 35:
        score += 5

    if aqi > 400:
        score += 25
    elif aqi > 300:
        score += 18
    elif aqi > 200:
        score += 10
    elif aqi > 150:
        score += 5

    score += min(traffic_index * 1.5, 15)
    score += min(zone_disruption_count * 2, 10)
    return clamp_score(score)


def _extract_weather_api_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "Unknown weather API error"

    if isinstance(payload, dict):
        error = payload.get("error") or payload.get("detail") or payload.get("message")
        if isinstance(error, dict):
            return str(error.get("message") or error)
        if error:
            return str(error)

    return str(payload)


def _fetch_indianapi_payload(
    endpoint: str,
    params: Dict[str, object],
    headers: Dict[str, str],
) -> Tuple[Dict[str, object] | None, str | None]:
    url = f"{WEATHER_API_BASE_URL}{endpoint}"

    try:
        response = httpx.get(
            url,
            params=params,
            headers=headers,
            timeout=WEATHER_API_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        return None, f"{endpoint} request failed: {error}"

    if response.status_code != 200:
        error_message = _extract_weather_api_error(response)
        return None, f"{endpoint} -> {response.status_code}: {error_message}"

    try:
        return response.json(), None
    except ValueError:
        return None, f"{endpoint} returned invalid JSON."


def _normalize_indianapi_weather(
    india_payload: Dict[str, object] | None,
    global_payload: Dict[str, object] | None,
) -> Dict[str, float]:
    india_current = ((india_payload or {}).get("weather") or {}).get("current") or {}
    india_temperature = india_current.get("temperature") or {}
    india_humidity = india_current.get("humidity") or {}
    global_current = global_payload or {}

    condition_text = str(global_current.get("condition") or "").strip()
    rainfall_mm = _first_number(india_current.get("rainfall"), 0.0)
    min_temp = _first_number((india_temperature.get("min") or {}).get("value"))
    max_temp = _first_number((india_temperature.get("max") or {}).get("value"))
    avg_temp = _average_numbers(min_temp, max_temp)
    avg_humidity = _average_numbers(
        _first_number(india_humidity.get("morning")),
        _first_number(india_humidity.get("evening")),
    )
    wind_speed = _first_number(global_current.get("wind_speed"), 0.0)

    return {
        "temperature": _first_number(global_current.get("temperature"), avg_temp, 0.0),
        "humidity": _first_number(global_current.get("humidity"), avg_humidity, 0.0),
        "wind": wind_speed,
        "pressure": _first_number(
            global_current.get("pressure"),
            global_current.get("pressure_mb"),
            DEFAULT_PRESSURE_HPA,
        ),
        "rain": rainfall_mm,
        "cloud": _first_number(
            global_current.get("cloud"),
            global_current.get("cloud_cover"),
            _infer_cloud_percent(condition_text, rainfall_mm),
        ),
        "uv": _first_number(global_current.get("uv_index"), 0.0),
        "pm25": _first_number(
            (global_current.get("air_quality") or {}).get("pm2_5"),
            global_current.get("pm25"),
            DEFAULT_PM25,
        ),
        "pm10": _first_number(
            (global_current.get("air_quality") or {}).get("pm10"),
            global_current.get("pm10"),
            DEFAULT_PM10,
        ),
        "visibility": _first_number(
            global_current.get("visibility"),
            global_current.get("vis_km"),
            _infer_visibility_km(condition_text, rainfall_mm),
        ),
        "gust": _first_number(
            global_current.get("gust"),
            global_current.get("gust_kph"),
            wind_speed * DEFAULT_GUST_FACTOR,
        ),
    }


def _fetch_open_meteo_weather(city: str) -> Tuple[Dict[str, object] | None, str | None]:
    geo_params = {
        "name": city,
        "count": 1,
        "language": "en",
        "format": "json",
    }

    try:
        geo_response = httpx.get(
            OPEN_METEO_GEOCODING_URL,
            params=geo_params,
            timeout=WEATHER_API_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        return None, f"geocoding request failed: {error}"

    if geo_response.status_code != 200:
        return None, f"geocoding -> {geo_response.status_code}: {geo_response.text}"

    try:
        geo_data = geo_response.json()
    except ValueError:
        return None, "geocoding returned invalid JSON."

    results = geo_data.get("results") or []
    if not results:
        return None, f"no geocoding result found for '{city}'."

    location = results[0]
    latitude = location.get("latitude")
    longitude = location.get("longitude")
    timezone = location.get("timezone") or "auto"

    weather_params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,precipitation,cloud_cover,"
            "pressure_msl,wind_speed_10m,wind_gusts_10m"
        ),
        "timezone": timezone,
        "forecast_days": 1,
    }

    air_quality_params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "pm10,pm2_5,uv_index",
        "timezone": timezone,
        "forecast_days": 1,
    }

    try:
        weather_response = httpx.get(
            OPEN_METEO_FORECAST_URL,
            params=weather_params,
            timeout=WEATHER_API_TIMEOUT_SECONDS,
        )
        air_quality_response = httpx.get(
            OPEN_METEO_AIR_QUALITY_URL,
            params=air_quality_params,
            timeout=WEATHER_API_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        return None, f"forecast request failed: {error}"

    if weather_response.status_code != 200:
        return None, f"forecast -> {weather_response.status_code}: {weather_response.text}"
    if air_quality_response.status_code != 200:
        return None, f"air quality -> {air_quality_response.status_code}: {air_quality_response.text}"

    try:
        weather_data = weather_response.json()
        air_quality_data = air_quality_response.json()
    except ValueError:
        return None, "Open-Meteo returned invalid JSON."

    current_weather = weather_data.get("current") or {}
    current_air_quality = air_quality_data.get("current") or {}

    payload = {
        "city": city,
        "resolved_location": {
            "name": location.get("name", city),
            "region": location.get("admin1", ""),
            "country": location.get("country", ""),
            "localtime": current_weather.get("time", ""),
        },
        "weather": {
            "temperature": float(current_weather.get("temperature_2m", 0.0)),
            "humidity": float(current_weather.get("relative_humidity_2m", 0.0)),
            "wind": float(current_weather.get("wind_speed_10m", 0.0)),
            "pressure": float(current_weather.get("pressure_msl", DEFAULT_PRESSURE_HPA)),
            "rain": float(current_weather.get("precipitation", 0.0)),
            "cloud": float(current_weather.get("cloud_cover", 0.0)),
            "uv": float(current_air_quality.get("uv_index", 0.0)),
            "pm25": float(current_air_quality.get("pm2_5", DEFAULT_PM25)),
            "pm10": float(current_air_quality.get("pm10", DEFAULT_PM10)),
            "visibility": DEFAULT_VISIBILITY_KM,
            "gust": float(current_weather.get("wind_gusts_10m", 0.0)),
        },
        "source": "Open-Meteo geocoding + forecast + air-quality",
    }

    return payload, None


def _first_number(*candidates: object) -> float | None:
    for candidate in candidates:
        if candidate is None:
            continue
        if isinstance(candidate, dict) and "value" in candidate:
            candidate = candidate.get("value")
        try:
            return float(candidate)
        except (TypeError, ValueError):
            continue
    return None


def _average_numbers(*values: float | None) -> float | None:
    filtered = [value for value in values if value is not None]
    if not filtered:
        return None
    return sum(filtered) / len(filtered)


def _infer_cloud_percent(condition_text: str, rainfall_mm: float) -> float:
    text = condition_text.lower()
    if "storm" in text or "thunder" in text:
        return 100.0
    if "overcast" in text:
        return 95.0
    if "cloud" in text:
        return 75.0 if "partly" not in text else 45.0
    if "rain" in text or rainfall_mm > 0:
        return 85.0
    if "fog" in text or "mist" in text or "haze" in text:
        return 60.0
    if "clear" in text or "sunny" in text:
        return 10.0
    return 40.0


def _infer_visibility_km(condition_text: str, rainfall_mm: float) -> float:
    text = condition_text.lower()
    if "fog" in text or "mist" in text:
        return 2.0
    if "haze" in text or "smoke" in text:
        return 3.0
    if "rain" in text or rainfall_mm > 0:
        return 5.0
    if "overcast" in text or "cloud" in text:
        return 8.0
    return DEFAULT_VISIBILITY_KM


def _get_weather_api_key() -> str:
    if not WEATHER_API_KEY:
        return ""
    if WEATHER_API_KEY.strip() == WEATHER_API_KEY_PLACEHOLDER:
        return ""
    return WEATHER_API_KEY.strip()


def _predict_from_values(values: Dict[str, float]) -> Dict[str, object]:
    try:
        model, _, model_feature_count = _get_model()
    except Exception as error:
        LOGGER.warning("Risk model unavailable, using rule fallback for prediction: %s", error)
        return _fallback_prediction_from_values(values)

    features, mode = _build_feature_array(values, model_feature_count)
    raw_prediction = model.predict(features)[0]
    risk_label = _map_prediction_to_label(raw_prediction)
    prediction_class = int(round(float(raw_prediction)))
    probabilities = _extract_prediction_probabilities(model, features)

    if mode != "direct":
        LOGGER.warning(
            "Using compatibility feature mapping because the loaded model expects %s features.",
            getattr(model, "n_features_in_", len(FEATURE_COLUMNS)),
        )

    return {
        "risk": risk_label,
        "prediction_class": prediction_class,
        "probabilities": probabilities,
        "feature_mode": mode,
    }


def _fallback_prediction_from_values(values: Dict[str, float]) -> Dict[str, object]:
    rainfall_mm = values["rain"]
    temperature_c = values["temperature"]
    aqi_proxy = int(round(max(values["pm25"], values["pm10"])))
    traffic_index_proxy = float(np.clip((values["wind"] + values["gust"]) / 10.0, 0, 10))
    disruption_proxy = int(
        int(values["cloud"] >= 75) + int(values["visibility"] <= 4) + int(values["uv"] >= 8)
    )

    risk_score = _compute_rule_based_zone_risk(
        rainfall_mm=rainfall_mm,
        temperature_c=temperature_c,
        aqi=aqi_proxy,
        traffic_index=traffic_index_proxy,
        zone_disruption_count=disruption_proxy,
    )
    risk_label = _score_to_display_label(risk_score)
    prediction_class = {"Low Risk": 0, "Medium Risk": 1, "High Risk": 2}[risk_label]

    return {
        "risk": risk_label,
        "prediction_class": prediction_class,
        "probabilities": {},
        "feature_mode": "rule-fallback",
    }


def _extract_prediction_probabilities(model, features: np.ndarray) -> Dict[str, float]:
    if not hasattr(model, "predict_proba"):
        return {}

    raw_probabilities = model.predict_proba(features)[0]
    classes = getattr(model, "classes_", range(len(raw_probabilities)))

    labeled_probabilities: Dict[str, float] = {}
    for class_value, probability in zip(classes, raw_probabilities):
        class_index = int(class_value)
        label = PREDICTION_LABELS.get(class_index, str(class_index))
        labeled_probabilities[label] = round(float(probability), 4)

    return labeled_probabilities


def _align_weather_risk_frame(
    feature_frame: pd.DataFrame,
    model,
    model_feature_count: int,
) -> pd.DataFrame:
    expected_columns = list(getattr(model, "feature_names_in_", []))
    if expected_columns:
        if expected_columns == WEATHER_RISK_API_COLUMNS:
            return feature_frame[expected_columns]

        raise RiskServiceError(
            (
                "Feature mismatch detected. Model expects columns "
                f"{expected_columns}, but API received {WEATHER_RISK_API_COLUMNS}."
            ),
            500,
        )

    if model_feature_count != len(WEATHER_RISK_API_COLUMNS):
        raise RiskServiceError(
            (
                "Feature mismatch detected. Model expects "
                f"{model_feature_count} inputs, but API received {len(WEATHER_RISK_API_COLUMNS)}."
            ),
            500,
        )

    return feature_frame


def _extract_weather_risk_score(model, feature_frame: pd.DataFrame) -> float:
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(feature_frame)[0]
        classes = list(getattr(model, "classes_", range(len(probabilities))))

        if len(probabilities) == 2:
            positive_index = 1
            if 1 in classes:
                positive_index = classes.index(1)
            return clamp_score(float(probabilities[positive_index]), 0.0, 1.0)

        return clamp_score(float(max(probabilities)), 0.0, 1.0)

    if hasattr(model, "predict"):
        prediction = model.predict(feature_frame)[0]
        return clamp_score(float(prediction), 0.0, 1.0)

    raise RiskServiceError("Loaded model does not support predict_proba or predict.", 500)


def _build_feature_array(values: Dict[str, float], model_feature_count: int) -> Tuple[np.ndarray, str]:
    direct_vector = np.array([[values[field] for field in FEATURE_COLUMNS]], dtype=float)

    if model_feature_count == len(FEATURE_COLUMNS):
        return direct_vector, "direct"

    if model_feature_count == 5:
        return _build_legacy_feature_array(values), "legacy"

    raise RiskServiceError(
        (
            "Loaded model expects "
            f"{model_feature_count} features, but the API received {len(FEATURE_COLUMNS)}. "
            "Update the model or adjust FEATURE_COLUMNS in ai-engine/services/risk_service.py."
        ),
        500,
    )


def _build_legacy_feature_array(values: Dict[str, float]) -> np.ndarray:
    rainfall_mm = values["rain"]
    temperature_c = values["temperature"]
    aqi_proxy = max(values["pm25"], values["pm10"])
    traffic_index_proxy = float(np.clip((values["wind"] + values["gust"]) / 10.0, 0, 10))
    disruption_proxy = float(
        int(values["cloud"] >= 75) + int(values["visibility"] <= 4) + int(values["uv"] >= 8)
    )

    return np.array(
        [[rainfall_mm, temperature_c, aqi_proxy, traffic_index_proxy, disruption_proxy]],
        dtype=float,
    )


def _map_prediction_to_label(raw_prediction: object) -> str:
    numeric_prediction = float(raw_prediction)
    discrete_prediction = int(round(numeric_prediction))

    if discrete_prediction in PREDICTION_LABELS and abs(numeric_prediction - discrete_prediction) < 1e-9:
        return PREDICTION_LABELS[discrete_prediction]

    return _score_to_display_label(numeric_prediction)


def _score_to_display_label(score: float) -> str:
    if score <= 33:
        return "Low Risk"
    if score <= 66:
        return "Medium Risk"
    return "High Risk"
