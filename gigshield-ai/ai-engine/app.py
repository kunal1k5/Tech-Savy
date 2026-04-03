"""Flask adapter for GigShield AI services."""

from __future__ import annotations

import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from services import get_fraud_service_health
from services.location_service import get_location_model_health, predict_location
from services.risk_service import (
    RiskServiceError,
    fetch_live_weather,
    get_risk_service_health,
    predict_from_payload,
    predict_live_risk,
    predict_weather_risk,
)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    @app.errorhandler(RiskServiceError)
    def handle_risk_error(error: RiskServiceError):
        return jsonify({"error": error.message}), error.status_code

    @app.errorhandler(FileNotFoundError)
    def handle_file_not_found(error: FileNotFoundError):
        return jsonify({"error": str(error)}), 500

    @app.errorhandler(ValueError)
    def handle_value_error(error: ValueError):
        return jsonify({"error": str(error)}), 400

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unexpected AI engine error: %s", error)
        return jsonify({"error": "AI engine request failed. Please try again."}), 500

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "gigshield-ai-flask-adapter",
                "risk_model": get_risk_service_health(),
                "fraud_model": get_fraud_service_health(),
                "next_location_model": get_location_model_health(),
                "orchestrator": {"enabled": True, "path": "ai-engine/fraud_orchestrator.py"},
                "weather_risk_api": {"endpoint": "/predict-risk", "method": "POST"},
            }
        )

    @app.get("/weather/live")
    def weather_live():
        city = (request.args.get("city") or "").strip()
        return jsonify(fetch_live_weather(city))

    @app.post("/predict")
    def predict():
        payload = request.get_json(silent=True)
        return jsonify(predict_from_payload(payload))

    @app.post("/predict-risk")
    def predict_risk():
        payload = request.get_json(silent=True)
        return jsonify(predict_weather_risk(payload))

    @app.post("/predict/live")
    def predict_live():
        payload = request.get_json(silent=True)
        return jsonify(predict_live_risk(payload))

    @app.post("/predict-location")
    def predict_next_location():
        payload = request.get_json(silent=True)
        return jsonify(predict_location(payload))

    @app.post("/api/location/predict")
    def predict_next_location_api():
        payload = request.get_json(silent=True)
        return jsonify(predict_location(payload))

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
