"""
Model Training Script — Train and save risk & fraud models.

Usage:
  python train_models.py

This script generates synthetic training data (Phase-1) and trains
scikit-learn models that are saved to the models/ directory.
In production, replace synthetic data with real historical data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, accuracy_score
import joblib
import os

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

np.random.seed(42)


def generate_risk_data(n=5000):
    """Generate synthetic risk assessment training data."""
    data = pd.DataFrame({
        "rainfall_mm": np.random.exponential(15, n),
        "temperature_c": np.random.normal(33, 8, n),
        "aqi": np.random.randint(30, 500, n),
        "traffic_index": np.random.uniform(0, 10, n),
        "zone_disruption_count": np.random.poisson(2, n),
    })

    # Synthetic target: weighted combination with noise
    data["risk_score"] = np.clip(
        data["rainfall_mm"] * 0.3
        + np.abs(data["temperature_c"] - 28) * 0.4
        + data["aqi"] * 0.04
        + data["traffic_index"] * 1.5
        + data["zone_disruption_count"] * 2
        + np.random.normal(0, 5, n),
        0, 100
    )

    return data


def generate_fraud_data(n=3000):
    """Generate synthetic fraud detection training data."""
    data = pd.DataFrame({
        "claim_amount": np.random.uniform(100, 3000, n),
        "worker_claims_30d": np.random.poisson(1, n),
        "avg_claim_amount": np.random.uniform(200, 1500, n),
        "worker_in_zone": np.random.choice([1, 0], n, p=[0.85, 0.15]),
        "duplicate_trigger": np.random.choice([1, 0], n, p=[0.05, 0.95]),
    })

    # Synthetic fraud labels (1 = fraud)
    fraud_prob = (
        (1 - data["worker_in_zone"]) * 0.4
        + data["duplicate_trigger"] * 0.35
        + (data["worker_claims_30d"] > 3).astype(float) * 0.15
        + ((data["claim_amount"] / (data["avg_claim_amount"] + 1)) > 2).astype(float) * 0.1
        + np.random.uniform(0, 0.1, n)
    )
    data["is_fraud"] = (fraud_prob > 0.3).astype(int)

    return data


def train_risk_model():
    """Train and save the risk scoring model."""
    print("Training risk model...")
    data = generate_risk_data()
    X = data[["rainfall_mm", "temperature_c", "aqi", "traffic_index", "zone_disruption_count"]]
    y = data["risk_score"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    print(f"  Risk Model RMSE: {rmse:.2f}")

    path = os.path.join(MODELS_DIR, "risk_model.pkl")
    joblib.dump(model, path)
    print(f"  Saved to {path}")


def train_fraud_model():
    """Train and save the fraud detection model."""
    print("Training fraud model...")
    data = generate_fraud_data()
    X = data[["claim_amount", "worker_claims_30d", "avg_claim_amount", "worker_in_zone", "duplicate_trigger"]]
    y = data["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingClassifier(
        n_estimators=150, max_depth=4, learning_rate=0.1, random_state=42
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"  Fraud Model Accuracy: {acc:.4f}")

    path = os.path.join(MODELS_DIR, "fraud_model.pkl")
    joblib.dump(model, path)
    print(f"  Saved to {path}")


if __name__ == "__main__":
    train_risk_model()
    train_fraud_model()
    print("\nAll models trained and saved successfully!")
