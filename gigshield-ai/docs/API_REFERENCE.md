# GigShield API Reference — Advanced Systems

## Activity & Work Tracking

### Log Activity
```
POST /api/activity/log
Content-Type: application/json

{
  "worker_id": "uuid",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "speed_kmh": 25.5,
  "motion_state": "DRIVING|WALKING|IDLE",
  "accuracy_meters": 15,
  "battery_pct": 85,
  "signal_strength": -55
}

Response 200:
{
  "success": true,
  "data": {
    "activity_id": "uuid",
    "message": "Activity logged successfully"
  }
}
```

### Get Activity History
```
GET /api/activity/history/:workerId?minutes=60

Response 200:
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "uuid",
        "timestamp": "2025-04-04T10:30:00Z",
        "latitude": 28.7041,
        "longitude": 77.1025,
        "speed_kmh": 25.5,
        "motion_state": "DRIVING"
      }
    ],
    "count": 50
  }
}
```

### Analyze Activity During Claim
```
POST /api/activity/analyze-claim
Content-Type: application/json

{
  "worker_id": "uuid",
  "claim_timestamp": "2025-04-04T10:30:00Z",
  "time_window_minutes": 30
}

Response 200:
{
  "success": true,
  "data": {
    "was_active": true,
    "analysis": "NORMAL",
    "fraud_score_contribution": 0,
    "reason": "Worker was actively moving during claim",
    "activities_count": 45,
    "motion_breakdown": {
      "idle_pct": 15,
      "driving_pct": 70,
      "walking_pct": 15
    },
    "avg_speed_kmh": 28.5,
    "time_window": {
      "start": "2025-04-04T10:00:00Z",
      "end": "2025-04-04T11:00:00Z"
    }
  }
}
```

### Get Idle Duration
```
GET /api/activity/idle/:workerId?minutes=120

Response 200:
{
  "success": true,
  "data": {
    "total_idle_minutes": 45,
    "max_continuous_idle_minutes": 32,
    "idle_events": [
      {
        "start": "2025-04-04T09:00:00Z",
        "end": "2025-04-04T09:32:00Z",
        "duration_minutes": 32
      }
    ],
    "suspicious": false
  }
}
```

---

## Work Sessions

### Start Work Session
```
POST /api/work-sessions/start
Content-Type: application/json

{
  "worker_id": "uuid",
  "latitude": 28.7041,
  "longitude": 77.1025
}

Response 200:
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "start_time": "2025-04-04T08:00:00Z",
    "message": "Work session started"
  }
}
```

### End Work Session
```
POST /api/work-sessions/end
Content-Type: application/json

{
  "worker_id": "uuid",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "earnings": 450.50
}

Response 200:
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "duration_minutes": 480,
    "earnings_inr": 450.50,
    "message": "Work session ended"
  }
}
```

### Get Daily Work Sessions
```
GET /api/work-sessions/:workerId?date=2025-04-04

Response 200:
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "worker_id": "uuid",
        "start_time": "2025-04-04T08:00:00Z",
        "end_time": "2025-04-04T14:00:00Z",
        "duration_minutes": 360,
        "earnings_inr": 450.50,
        "orders_count": 28
      }
    ],
    "summary": {
      "total_sessions": 2,
      "total_earnings_inr": 950.75,
      "total_orders": 52,
      "total_working_minutes": 720,
      "avg_session_duration_minutes": 360
    }
  }
}
```

### Validate Claim Time
```
POST /api/work-sessions/validate-claim-time
Content-Type: application/json

{
  "worker_id": "uuid",
  "claim_timestamp": "2025-04-04T10:30:00Z"
}

Response 200:
{
  "success": true,
  "data": {
    "within_working_hours": true,
    "fraud_score_contribution": 0,
    "reason": "Claim within working hours",
    "overlapping_session": {
      "id": "uuid",
      "start_time": "2025-04-04T08:00:00Z",
      "end_time": "2025-04-04T14:00:00Z",
      "duration_minutes": 360
    }
  }
}
```

### Get Working Hours Summary
```
GET /api/work-sessions/summary/:workerId?days=7

Response 200:
{
  "success": true,
  "data": {
    "period_days": 7,
    "total_working_minutes": 2100,
    "total_earnings_inr": 5000.50,
    "avg_daily_income_inr": 714.36,
    "working_days": 5,
    "sessions_count": 10,
    "avg_session_duration_minutes": 210,
    "daily_breakdown": [
      {
        "date": "Fri Apr 04 2025",
        "sessions": 2,
        "total_minutes": 720,
        "earnings": 950.75
      }
    ]
  }
}
```

---

## Fraud Analysis

### Comprehensive Fraud Analysis
```
POST /api/fraud/analyze
Content-Type: application/json

{
  "worker_id": "uuid",
  "claim_data": {
    "claim_id": "uuid",
    "claim_timestamp": "2025-04-04T10:30:00Z",
    "latitude": 28.7041,
    "longitude": 77.1025,
    "aqi": 250,
    "rainfall_mm": 5,
    "wind_kmh": 20,
    "claimsCount": 2,
    "loginAttempts": 1
  }
}

Response 200:
{
  "success": true,
  "data": {
    "decision": "SAFE|WARNING|FRAUD",
    "fraud_score": 35.5,
    "confidence": 72.4,
    "next_action": "AUTO_APPROVE_CLAIM|UPLOAD_PROOF|REJECT_CLAIM",
    "reasons": [
      "Location matches activity zone",
      "Worker actively moving during claim"
    ],
    "analysis_breakdown": {
      "activity_score": 0,
      "location_score": 0,
      "time_score": 0,
      "behavior_score": 15,
      "anomaly_score": 20,
      "trust_modifier": 60
    },
    "checks_performed": 6,
    "analysis_time_ms": 245
  }
}
```

### Get Fraud Score
```
GET /api/fraud/score/:workerId

Response 200:
{
  "success": true,
  "data": {
    "worker_id": "uuid",
    "current_fraud_score": 35.2,
    "recent_flags_count": 2,
    "recent_flags": [
      {
        "id": "uuid",
        "flag_type": "HIGH_FREQUENCY",
        "flag_value": 35,
        "flagged_at": "2025-04-04T10:00:00Z"
      }
    ]
  }
}
```

### Apply Fraud Flag
```
POST /api/fraud/flag
Content-Type: application/json

{
  "worker_id": "uuid",
  "reason": "GPS spoofing detected"
}

Response 200:
{
  "success": true,
  "data": {
    "previous_score": 65,
    "new_score": 45,
    "new_tier": "BRONZE",
    "message": "Fraud flag applied"
  }
}
```

---

## Trust Score Management

### Get Trust Score
```
GET /api/trust/:workerId

Response 200:
{
  "success": true,
  "data": {
    "worker_id": "uuid",
    "score": 72.5,
    "tier": "GOLD",
    "total_claims": 15,
    "successful_claims": 13,
    "fraud_flags": 1,
    "approval_strategy": {
      "level": "HIGH_TRUST",
      "auto_approve": true,
      "verification_required": false,
      "description": "Auto-approve claims with minimal checks"
    }
  }
}
```

### Update Trust Score
```
POST /api/trust/update
Content-Type: application/json

{
  "worker_id": "uuid",
  "claim_result": {
    "decision": "approved",
    "status": "paid"
  }
}

Response 200:
{
  "success": true,
  "data": {
    "previous_score": 72.5,
    "new_score": 77.5,
    "score_change": 5,
    "reason": "Successful claim approved",
    "new_tier": "GOLD"
  }
}
```

### Get Trust History
```
GET /api/trust/history/:workerId?limit=20

Response 200:
{
  "success": true,
  "data": {
    "worker_id": "uuid",
    "current_score": 77.5,
    "history": [
      {
        "timestamp": "2025-04-04T10:30:00Z",
        "action": "CLAIM_PROCESSED",
        "previous_score": 72.5,
        "new_score": 77.5,
        "change": 5,
        "reason": "Successful claim approved"
      }
    ]
  }
}
```

---

## Anomaly Detection

### Get Anomaly History
```
GET /api/anomalies/:workerId?days=30

Response 200:
{
  "success": true,
  "data": {
    "worker_id": "uuid",
    "period_days": 30,
    "anomalies_count": 3,
    "anomalies": [
      {
        "id": "uuid",
        "anomaly_score": 45,
        "anomaly_type": "high_frequency",
        "severity": "medium",
        "detected_at": "2025-04-04T10:00:00Z"
      }
    ]
  }
}
```

---

## Proof Validation

### Validate Proof Upload
```
POST /api/fraud/proofs/validate
Content-Type: application/json

{
  "claim_id": "uuid",
  "worker_id": "uuid",
  "proof_data": {
    "file_path": "/uploads/proof_123.jpg",
    "file_type": "screenshot",
    "file_size": 245000,
    "file_hash": "abc123def456",
    "upload_timestamp": "2025-04-04T10:35:00Z",
    "location_latitude": 28.7041,
    "location_longitude": 77.1025
  }
}

Response 200:
{
  "success": true,
  "data": {
    "proof_id": "uuid",
    "is_valid": true,
    "validation_score": 55,
    "validations": [
      {
        "check": "TIMESTAMP_VALIDATION",
        "is_valid": true,
        "score": 20,
        "reason": "Proof timestamp matches claim time"
      },
      {
        "check": "LOCATION_VALIDATION",
        "is_valid": true,
        "score": 20,
        "reason": "Proof location matches claim zone"
      },
      {
        "check": "FILE_INTEGRITY",
        "is_valid": true,
        "score": 15,
        "reason": "File integrity verified"
      }
    ],
    "status": "valid"
  }
}
```

### Get Claim Proofs
```
GET /api/fraud/proofs/:claimId

Response 200:
{
  "success": true,
  "data": {
    "claim_id": "uuid",
    "proofs_count": 2,
    "proofs": [
      {
        "id": "uuid",
        "file_type": "screenshot",
        "validation_status": "valid",
        "upload_timestamp": "2025-04-04T10:35:00Z"
      }
    ]
  }
}
```

---

## Error Responses

### Missing Parameters
```
Response 400:
{
  "success": false,
  "data": null,
  "message": "Missing worker_id or claim_data"
}
```

### Server Error
```
Response 500:
{
  "success": false,
  "data": null,
  "message": "Error message describing the issue"
}
```

---

## Decision Logic Tree

```
Start Fraud Check
  ├─ Check Activity
  │   ├─ IDLE during claim? → Fraud +30
  │   └─ Moving? → Fraud +0
  ├─ Check Location
  │   ├─ Matches GPS? → Fraud +0
  │   └─ Mismatch? → Fraud +35
  ├─ Check Time
  │   ├─ Within hours? → Fraud +0
  │   └─ Outside hours? → Fraud +40
  ├─ Check Behavior
  │   ├─ Normal? → Fraud +0
  │   └─ Suspicious? → Fraud +15-20
  ├─ Check Anomalies
  │   ├─ High frequency? → Fraud +35
  │   ├─ Location cluster? → Fraud +30
  │   └─ Behavior change? → Fraud +25
  └─ Apply Trust
      ├─ High trust? → Reduce fraud score
      ├─ Low trust? → Increase verification
      └─ New user? → Standard process

Final Score Threshold:
  ├─ < 30: SAFE → Auto-approve
  ├─ 30-60: WARNING → Request proof
  └─ > 80: FRAUD → Auto-reject
```

---

## Testing with cURL

```bash
# Start work session
curl -X POST http://localhost:5000/api/work-sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "550e8400-e29b-41d4-a716-446655440000",
    "latitude": 28.7041,
    "longitude": 77.1025
  }'

# Log activity
curl -X POST http://localhost:5000/api/activity/log \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "550e8400-e29b-41d4-a716-446655440000",
    "latitude": 28.7041,
    "longitude": 77.1025,
    "motion_state": "DRIVING",
    "speed_kmh": 25
  }'

# Analyze fraud
curl -X POST http://localhost:5000/api/fraud/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "550e8400-e29b-41d4-a716-446655440000",
    "claim_data": {
      "claim_timestamp": "2025-04-04T10:30:00Z",
      "latitude": 28.7041,
      "longitude": 77.1025
    }
  }'

# Get trust score
curl http://localhost:5000/api/trust/550e8400-e29b-41d4-a716-446655440000
```

---

**API Version**: 2.0  
**Status**: Production Ready ✅  
**Last Updated**: April 2025
