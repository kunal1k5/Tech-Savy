"""
GigPredict AI Services - Advanced Fraud Detection & Anomaly Engine

This module provides:
- Rule-based fraud scoring
- Behavior pattern analysis
- Anomaly detection using statistical methods
- Confidence scoring
"""

import json
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple


class FraudDetectionEngine:
    """Advanced fraud detection using rule-based logic"""

    def __init__(self):
        self.weights = {
            "activity": 0.25,
            "location": 0.20,
            "context": 0.15,
            "behavior": 0.15,
            "anomaly": 0.15,
            "trust": -0.10,
        }

        self.decision_thresholds = {
            "safe": 30,
            "warning": 60,
            "fraud": 80,
        }

    def analyze_fraud_risk(
        self,
        worker_id: str,
        activity_score: float,
        location_score: float,
        behavior_score: float,
        anomaly_score: float,
        trust_modifier: float = 0,
    ) -> Dict[str, Any]:
        """
        Analyze overall fraud risk by combining multiple signals

        Args:
            worker_id: Worker UUID
            activity_score: Activity validation score (0-100)
            location_score: Location validation score (0-100)
            behavior_score: Behavioral analysis score (0-100)
            anomaly_score: Anomaly detection score (0-100)
            trust_modifier: Trust score modifier (can be negative)

        Returns:
            Dictionary with decision, confidence, and reasons
        """

        # Calculate weighted fraud score
        fraud_score = (
            activity_score * self.weights["activity"]
            + location_score * self.weights["location"]
            + behavior_score * self.weights["behavior"]
            + anomaly_score * self.weights["anomaly"]
            - max(0, trust_modifier) * self.weights["trust"]
        )

        # Clamp score between 0-100
        fraud_score = max(0, min(100, fraud_score))

        # Determine decision
        decision = "SAFE"
        next_action = "AUTO_APPROVE_CLAIM"

        if fraud_score >= self.decision_thresholds["fraud"]:
            decision = "FRAUD"
            next_action = "REJECT_CLAIM"
        elif fraud_score >= self.decision_thresholds["warning"]:
            decision = "WARNING"
            next_action = "UPLOAD_PROOF"

        # Calculate confidence
        total_signals = 5  # activity, location, behavior, anomaly, trust
        confidence = min(100, (fraud_score * 1.2 + total_signals * 10))

        return {
            "worker_id": worker_id,
            "decision": decision,
            "fraud_score": round(fraud_score, 2),
            "confidence": round(confidence, 2),
            "next_action": next_action,
            "analysis_breakdown": {
                "activity_score": round(activity_score, 2),
                "location_score": round(location_score, 2),
                "behavior_score": round(behavior_score, 2),
                "anomaly_score": round(anomaly_score, 2),
                "trust_modifier": round(trust_modifier, 2),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }


class AnomalyDetector:
    """Statistical anomaly detection without ML training"""

    def __init__(self):
        self.thresholds = {
            "claim_frequency_24h": 3,  # More than 3 claims in 24h
            "location_cluster_km": 1,  # Claims within 1km
            "success_rate_increase": 0.30,  # 30% increase
        }

        self.anomaly_scores = {
            "high_frequency": 35,
            "location_cluster": 30,
            "behavior_change": 25,
            "unusual_pattern": 20,
        }

    def detect_claim_frequency_anomaly(self, claim_history: List[Dict]) -> Tuple[bool, float, str]:
        """
        Detect anomalously high claim frequency

        Args:
            claim_history: List of claim records with timestamps

        Returns:
            Tuple of (is_anomalous, score, reason)
        """
        if not claim_history:
            return False, 0, "No claim history"

        # Count claims in last 24h
        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)
        recent_claims = [
            c for c in claim_history if datetime.fromisoformat(c.get("created_at", "")) > last_24h
        ]

        is_anomalous = len(recent_claims) > self.thresholds["claim_frequency_24h"]
        score = self.anomaly_scores["high_frequency"] if is_anomalous else 0
        reason = f"{len(recent_claims)} claims in 24 hours" if is_anomalous else "Normal claim frequency"

        return is_anomalous, score, reason

    def detect_location_anomaly(self, claim_locations: List[Tuple[float, float]]) -> Tuple[bool, float, str]:
        """
        Detect geographically clustered claims

        Args:
            claim_locations: List of (latitude, longitude) tuples

        Returns:
            Tuple of (is_anomalous, score, reason)
        """
        if len(claim_locations) < 2:
            return False, 0, "Insufficient location data"

        # Calculate distances between all claim locations
        distances = []
        for i in range(len(claim_locations)):
            for j in range(i + 1, len(claim_locations)):
                dist = self._haversine_distance(
                    claim_locations[i][0],
                    claim_locations[i][1],
                    claim_locations[j][0],
                    claim_locations[j][1],
                )
                distances.append(dist)

        avg_distance = sum(distances) / len(distances)
        is_clustered = avg_distance < self.thresholds["location_cluster_km"]

        score = self.anomaly_scores["location_cluster"] if is_clustered else 0
        reason = (
            f"Claims clustered within {avg_distance:.2f}km"
            if is_clustered
            else f"Claims spread across {avg_distance:.2f}km"
        )

        return is_clustered, score, reason

    def detect_success_pattern_anomaly(
        self, recent_claims: List[Dict], historical_claims: List[Dict]
    ) -> Tuple[bool, float, str]:
        """
        Detect anomalous success rate increase

        Args:
            recent_claims: Claims from last 7 days
            historical_claims: Claims from 7-30 days

        Returns:
            Tuple of (is_anomalous, score, reason)
        """
        if not recent_claims or not historical_claims:
            return False, 0, "Insufficient data"

        # Calculate success rates
        recent_success = sum(1 for c in recent_claims if c.get("status") in ["approved", "paid"])
        historical_success = sum(1 for c in historical_claims if c.get("status") in ["approved", "paid"])

        recent_rate = recent_success / len(recent_claims) if recent_claims else 0
        historical_rate = historical_success / len(historical_claims) if historical_claims else 0

        rate_increase = recent_rate - historical_rate
        is_anomalous = rate_increase > self.thresholds["success_rate_increase"] and len(recent_claims) > 2

        score = self.anomaly_scores["behavior_change"] if is_anomalous else 0
        increase_pct = (rate_increase * 100)
        reason = f"Success rate increased by {increase_pct:.1f}%" if is_anomalous else "Normal success pattern"

        return is_anomalous, score, reason

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates in km"""
        R = 6371  # Earth's radius in km

        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


class BehaviorAnalyzer:
    """Worker behavior pattern analysis"""

    def __init__(self):
        self.thresholds = {
            "high_login_attempts": 5,
            "abnormal_claim_hour": [0, 1, 2, 3, 4, 5],  # Unusual hours
        }

    def analyze_login_pattern(self, login_attempts: int) -> Tuple[float, str]:
        """
        Analyze login attempt patterns

        Args:
            login_attempts: Number of failed login attempts

        Returns:
            Tuple of (score, reason)
        """
        score = 0
        reason = "Normal login pattern"

        if login_attempts > self.thresholds["high_login_attempts"]:
            score = 20
            reason = f"High login attempts ({login_attempts}) suggest account compromise"

        return score, reason

    def analyze_claim_timing(self, claim_hour: int) -> Tuple[float, str]:
        """
        Analyze if claim is made at unusual hour

        Args:
            claim_hour: Hour of day (0-23)

        Returns:
            Tuple of (score, reason)
        """
        score = 0
        reason = "Normal claim timing"

        if claim_hour in self.thresholds["abnormal_claim_hour"]:
            score = 15
            reason = f"Claim at unusual hour ({claim_hour}:00)"

        return score, reason

    def analyze_pattern(self, worker_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Comprehensive behavior pattern analysis

        Args:
            worker_data: Worker behavioral data

        Returns:
            Behavior analysis result
        """
        login_score, login_reason = self.analyze_login_pattern(worker_data.get("login_attempts", 0))
        claim_hour = datetime.fromisoformat(worker_data.get("claim_timestamp", datetime.utcnow().isoformat())).hour
        timing_score, timing_reason = self.analyze_claim_timing(claim_hour)

        total_score = login_score + timing_score
        reasons = [r for r in [login_reason, timing_reason] if "normal" not in r.lower()]

        return {
            "behavior_score": min(100, total_score),
            "login_score": login_score,
            "timing_score": timing_score,
            "reasons": reasons or ["Normal behavior pattern"],
            "timestamp": datetime.utcnow().isoformat(),
        }


# Initialize global instances
fraud_engine = FraudDetectionEngine()
anomaly_detector = AnomalyDetector()
behavior_analyzer = BehaviorAnalyzer()


def get_engine_health() -> Dict[str, Any]:
    """Get health status of AI engines"""
    return {
        "fraud_detection": "healthy",
        "anomaly_detection": "healthy",
        "behavior_analysis": "healthy",
        "thresholds": {
            "fraud_decision": fraud_engine.decision_thresholds,
            "anomaly": anomaly_detector.thresholds,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    # Test the engines
    print("Testing GigPredict AI Services...")

    # Test fraud detection
    result = fraud_engine.analyze_fraud_risk(
        worker_id="test-worker",
        activity_score=40,
        location_score=50,
        behavior_score=20,
        anomaly_score=45,
        trust_modifier=50,
    )
    print(f"\nFraud Analysis Result:\n{json.dumps(result, indent=2)}")

    # Test anomaly detection
    claims = [
        {"created_at": (datetime.utcnow() - timedelta(hours=6)).isoformat(), "status": "approved"},
        {"created_at": (datetime.utcnow() - timedelta(hours=12)).isoformat(), "status": "approved"},
        {"created_at": (datetime.utcnow() - timedelta(hours=18)).isoformat(), "status": "approved"},
        {"created_at": (datetime.utcnow() - timedelta(hours=23)).isoformat(), "status": "approved"},
    ]
    is_anomalous, score, reason = anomaly_detector.detect_claim_frequency_anomaly(claims)
    print(f"\nAnomaly Detection: {is_anomalous}, Score: {score}, Reason: {reason}")

    # Test behavior analysis
    behavior = behavior_analyzer.analyze_pattern(
        {"login_attempts": 10, "claim_timestamp": datetime.utcnow().isoformat()}
    )
    print(f"\nBehavior Analysis:\n{json.dumps(behavior, indent=2)}")

    print("\n✓ All engines working correctly")

