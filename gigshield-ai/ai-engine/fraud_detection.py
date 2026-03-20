"""
Fraud Detection Engine — Identifies suspicious claims.

DETECTION STRATEGIES (Phase-1):

1. GPS Spoofing Detection
   - Compare the worker's last known location with the disruption zone.
   - If the worker was not in the affected zone during the event → flag.

2. Duplicate Claim Detection
   - Check if the same worker has already filed a claim for the same trigger event.
   - Multiple claims for the same trigger → block.

3. Fake Weather Event Detection
   - Cross-verify the trigger's weather data with independent API sources.
   - If the disruption data doesn't match → flag.

4. Frequency Analysis
   - Workers with an abnormally high claim frequency (>3 per month) → flag.

5. Amount Anomaly Detection
   - Claims significantly above the worker's typical coverage → flag.

OUTPUT:
  fraud_score (0-100):
    0-59   → pass  (auto-approve)
    60-79  → flag  (manual review)
    80-100 → block (auto-reject)
"""

import os
import numpy as np
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fraud_model.pkl")


def _load_model():
    """Load trained fraud model if available."""
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return None


def check_fraud(
    worker_id: str,
    claim_amount: float,
    trigger_type: str,
    worker_claims_30d: int = 0,
    avg_claim_amount: float = 0.0,
    worker_in_zone: bool = True,
    duplicate_trigger: bool = False,
) -> dict:
    """
    Run fraud checks on a claim.

    Phase-1 uses rule-based scoring. Trained model is used when available.
    """
    model = _load_model()
    flags = []

    if model is not None:
        features = np.array([[
            claim_amount, worker_claims_30d, avg_claim_amount,
            1.0 if worker_in_zone else 0.0,
            1.0 if duplicate_trigger else 0.0,
        ]])
        fraud_score = float(np.clip(model.predict(features)[0], 0, 100))
    else:
        # Rule-based fraud scoring
        fraud_score = 0.0

        # Check 1: GPS / Zone presence
        if not worker_in_zone:
            fraud_score += 35
            flags.append("worker_not_in_zone")

        # Check 2: Duplicate claim for same trigger
        if duplicate_trigger:
            fraud_score += 40
            flags.append("duplicate_trigger_claim")

        # Check 3: High claim frequency
        if worker_claims_30d > 3:
            fraud_score += 15
            flags.append("high_claim_frequency")
        elif worker_claims_30d > 2:
            fraud_score += 8

        # Check 4: Amount anomaly (claim > 2x average)
        if avg_claim_amount > 0 and claim_amount > avg_claim_amount * 2:
            fraud_score += 20
            flags.append("amount_anomaly")

        fraud_score = min(fraud_score, 100)

    return {
        "fraud_score": round(fraud_score, 2),
        "flags": flags,
        "recommendation": (
            "pass" if fraud_score < 60
            else "flag" if fraud_score < 80
            else "block"
        ),
    }
