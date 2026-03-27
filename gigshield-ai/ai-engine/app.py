"""
Flask prediction API for the GigShield risk model.

This service accepts weather and air-quality inputs from the React frontend,
transforms them into a numpy array, runs the scikit-learn model, and returns
the mapped risk label.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Tuple

import httpx
import joblib
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from location_prediction_service import (
    get_location_model_health,
    predict_location,
)

ENV_PATH = Path(__file__).with_name(".env")
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

PREDICTION_LABELS = {
    0: "Low Risk",
    1: "Medium Risk",
    2: "High Risk",
}

MODEL_CANDIDATE_PATHS = (
    Path(__file__).with_name("risk_model.pkl"),
    Path(__file__).parent / "models" / "risk_model.pkl",
)

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


class ApiError(Exception):
    """Exception with an HTTP status code for API responses."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _load_model():
    """Load the first available model file from disk."""
    for path in MODEL_CANDIDATE_PATHS:
        if path.exists():
            return joblib.load(path), path
    searched = ", ".join(str(path) for path in MODEL_CANDIDATE_PATHS)
    raise FileNotFoundError(f"risk_model.pkl was not found. Checked: {searched}")


MODEL = None
MODEL_PATH = None
MODEL_FEATURE_COUNT = None


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify({"error": error.message}), error.status_code

    @app.errorhandler(FileNotFoundError)
    def handle_file_not_found(error: FileNotFoundError):
        return jsonify({"error": str(error)}), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unexpected prediction error: %s", error)
        return jsonify({"error": "Prediction failed. Please try again."}), 500

    @app.get("/health")
    def health():
        model, model_path, model_feature_count = _get_model()
        location_health = get_location_model_health()
        return jsonify(
            {
                "status": "ok",
                "model_path": str(model_path),
                "expected_features": model_feature_count,
                "weather_provider_configured": bool(_get_weather_api_key()),
                "weather_provider": "Indian API with Open-Meteo fallback",
                "next_location_model": location_health,
            }
        )

    @app.get("/weather/live")
    def weather_live():
        city = (request.args.get("city") or DEFAULT_WEATHER_CITY).strip()
        if not city:
            raise ApiError("Query parameter 'city' is required.", 400)

        weather_payload = _fetch_live_weather(city)
        return jsonify(weather_payload)

    @app.post("/predict")
    def predict():
        payload = request.get_json(silent=True)
        values = _parse_payload(payload)
        prediction_result = _predict_from_values(values)

        return jsonify(
            {
                **prediction_result,
                "features": values,
            }
        )

    @app.post("/predict/live")
    def predict_live():
        payload = request.get_json(silent=True) or {}
        city = str(payload.get("city") or payload.get("location") or DEFAULT_WEATHER_CITY).strip()
        if not city:
            raise ApiError("Field 'city' is required for live weather prediction.", 400)

        weather_payload = _fetch_live_weather(city)
        values = weather_payload["weather"]
        prediction_result = _predict_from_values(values)

        return jsonify(
            {
                **prediction_result,
                "city": weather_payload["city"],
                "resolved_location": weather_payload["resolved_location"],
                "weather": weather_payload["weather"],
                "source": weather_payload["source"],
            }
        )

    @app.post("/predict-location")
    def predict_next_location():
        payload = request.get_json(silent=True)
        try:
            prediction = predict_location(payload)
        except ValueError as error:
            raise ApiError(str(error), 400) from error

        return jsonify(prediction)

    return app


def _get_model():
    global MODEL, MODEL_PATH, MODEL_FEATURE_COUNT

    if MODEL is None:
        MODEL, MODEL_PATH = _load_model()
        MODEL_FEATURE_COUNT = getattr(MODEL, "n_features_in_", len(FEATURE_COLUMNS))

    return MODEL, MODEL_PATH, MODEL_FEATURE_COUNT


def _parse_payload(payload: object) -> Dict[str, float]:
    if not isinstance(payload, dict):
        raise ApiError("Request body must be a JSON object.", 400)

    missing_fields = [field for field in FEATURE_COLUMNS if field not in payload]
    if missing_fields:
        raise ApiError(f"Missing required fields: {', '.join(missing_fields)}", 400)

    values: Dict[str, float] = {}
    invalid_fields = []

    for field in FEATURE_COLUMNS:
        raw_value = payload.get(field)
        try:
            values[field] = float(raw_value)
        except (TypeError, ValueError):
            invalid_fields.append(field)

    if invalid_fields:
        raise ApiError(
            f"All input fields must be numeric. Invalid fields: {', '.join(invalid_fields)}",
            400,
        )

    return values


def _fetch_live_weather(city: str) -> Dict[str, object]:
    provider_errors = []
    weather_api_key = _get_weather_api_key()

    if weather_api_key:
        headers = {"x-api-key": weather_api_key}
        india_payload, india_error = _fetch_indianapi_payload("/india/weather", {"city": city}, headers)
        global_payload, global_error = _fetch_indianapi_payload(
            "/global/current",
            {"location": city},
            headers,
        )

        if india_payload is not None or global_payload is not None:
            weather = _normalize_indianapi_weather(india_payload, global_payload)
            resolved_name = city
            if india_payload and isinstance(india_payload.get("city"), str):
                resolved_name = india_payload["city"]

            return {
                "city": city,
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

    open_meteo_payload, open_meteo_error = _fetch_open_meteo_weather(city)
    if open_meteo_payload is not None:
        return open_meteo_payload

    provider_errors.append(f"Open-Meteo fallback failed: {open_meteo_error or 'Unknown error'}")
    raise ApiError(" | ".join(provider_errors), 502)


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
    model, _, _ = _get_model()
    features, mode = _build_feature_array(values)
    raw_prediction = model.predict(features)[0]
    risk_label = _map_prediction_to_label(raw_prediction)
    prediction_class = int(round(float(raw_prediction)))
    probabilities = _extract_prediction_probabilities(model, features)

    if mode != "direct":
        app.logger.warning(
            "Using compatibility feature mapping because the loaded model expects %s features.",
            MODEL_FEATURE_COUNT,
        )

    return {
        "risk": risk_label,
        "prediction_class": prediction_class,
        "probabilities": probabilities,
        "feature_mode": mode,
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


def _build_feature_array(values: Dict[str, float]) -> Tuple[np.ndarray, str]:
    direct_vector = np.array([[values[field] for field in FEATURE_COLUMNS]], dtype=float)

    if MODEL_FEATURE_COUNT == len(FEATURE_COLUMNS):
        return direct_vector, "direct"

    if MODEL_FEATURE_COUNT == 5:
        return _build_legacy_feature_array(values), "legacy"

    raise ApiError(
        (
            "Loaded model expects "
            f"{MODEL_FEATURE_COUNT} features, but the API received {len(FEATURE_COLUMNS)}. "
            "Update the model or adjust FEATURE_COLUMNS in ai-engine/app.py."
        ),
        500,
    )


def _build_legacy_feature_array(values: Dict[str, float]) -> np.ndarray:
    """
    Compatibility path for the repo's existing bundled regressor.

    The current checked-in model was trained on:
      rainfall_mm, temperature_c, aqi, traffic_index, zone_disruption_count

    We derive a reasonable demo-friendly mapping from the richer frontend
    payload so local predictions still work while a dedicated 11-feature
    model is being prepared.
    """

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

    if numeric_prediction <= 33:
        return "Low Risk"
    if numeric_prediction <= 66:
        return "Medium Risk"
    return "High Risk"


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
