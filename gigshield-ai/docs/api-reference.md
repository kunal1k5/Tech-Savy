# GigPredict AI API Reference

## Base URL

`http://localhost:5000/api`

## Standard Response Envelope

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully."
}
```

## 1. POST /api/risk-premium

Request:

```json
{
  "aqi": 340,
  "rain": 24,
  "wind": 35
}
```

Response:

```json
{
  "success": true,
  "data": {
    "risk": "HIGH",
    "premium": 30,
    "riskReason": "AQI above 300 + rain above 20 mm + wind above 30 km/h",
    "reason": "AQI above 300 + rain above 20 mm + wind above 30 km/h"
  },
  "message": "Risk and premium calculated successfully."
}
```

## 2. POST /api/auto-claim

Request:

```json
{
  "risk": "HIGH",
  "isWorking": true,
  "ordersCompleted": 0,
  "duration": 180,
  "workingMinutes": 180,
  "earnings": 0,
  "hoursLost": 3,
  "hourlyRate": 150
}
```

Response:

```json
{
  "success": true,
  "data": {
    "claimTriggered": true,
    "payout": 450,
    "status": "PAID",
    "claimStates": ["CREATED", "PROCESSING", "PAID"],
    "isWorking": true,
    "incomeLoss": true,
    "incomeLossReason": "NO_ORDERS_COMPLETED",
    "riskReason": "Risk level is HIGH",
    "claimReason": "active work confirmed + no orders completed + duration above 30 minutes",
    "reason": "Risk level is HIGH + active work confirmed + no orders completed + duration above 30 minutes",
    "ordersCompleted": 0,
    "duration": 180,
    "workingMinutes": 180,
    "earnings": 0,
    "eligibility": {
      "riskEligible": true,
      "activeWorkConfirmed": true,
      "incomeLossDetected": true,
      "durationThresholdMet": true
    },
    "hoursLost": 3,
    "hourlyRate": 150,
    "message": "Claim auto-triggered after confirming high risk, active work, income loss, and duration threshold."
  },
  "message": "Auto-claim decision generated successfully."
}
```

## 3. POST /api/fraud-check

Request:

```json
{
  "risk": "HIGH",
  "locationMatch": false,
  "claimsCount": 4,
  "loginAttempts": 5,
  "contextValid": false
}
```

Optional anomaly inputs:

```json
{
  "claimTriggered": true,
  "suspiciousPattern": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "risk": "HIGH",
    "fraudScore": 110,
    "fraud_score": 110,
    "trustScore": 0,
    "trust_score": 0,
    "status": "FRAUD",
    "riskReason": "Risk level is HIGH",
    "fraudReason": "high claim frequency + excessive login attempts + location mismatch + invalid context",
    "reason": "Risk level is HIGH + high claim frequency + excessive login attempts + location mismatch + invalid context",
    "locationMatch": false,
    "claimsCount": 4,
    "loginAttempts": 5
  },
  "message": "Fraud check completed successfully."
}
```

## 4. POST /api/ai-decision

Request:

```json
{
  "aqi": 350,
  "rain": 25,
  "wind": 40,
  "claimsCount": 4,
  "loginAttempts": 5,
  "locationMatch": false,
  "contextValid": false
}
```

Optional anomaly inputs:

```json
{
  "claimTriggered": true,
  "suspiciousPattern": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "risk": "HIGH",
    "fraudScore": 110,
    "trustScore": 0,
    "trust_score": 0,
    "status": "FRAUD",
    "decision": "FRAUD",
    "nextAction": "REJECT_CLAIM",
    "riskReason": "AQI above 300 + rain above 20 mm + wind above 30 km/h",
    "fraudReason": "high claim frequency + excessive login attempts + location mismatch + invalid context",
    "reason": "AQI above 300 + rain above 20 mm + wind above 30 km/h + high claim frequency + excessive login attempts + location mismatch + invalid context"
  },
  "message": "AI decision generated successfully."
}
```

## 5. POST /api/start-dispute

Request:

```json
{
  "userId": "123",
  "reason": "System failed to detect actual issue"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "disputeId": "D1001",
    "status": "INITIATED"
  },
  "message": "Dispute started successfully."
}
```

## 6. POST /api/upload-proof

Form data fields:

- `disputeId`
- `geoImage`
- `workScreenshot`

Response:

```json
{
  "success": true,
  "data": {
    "status": "RECEIVED"
  },
  "message": "Proof uploaded successfully."
}
```

## 7. POST /api/reverify-claim

Request:

```json
{
  "disputeId": "D1001",
  "claimTime": "14:00",
  "userLocation": "Zone-A"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "finalStatus": "APPROVED",
    "confidence": 85,
    "claimUpdate": {
      "claimStatus": "PAID",
      "payoutStatus": "PAYOUT_RELEASED",
      "fraudStatus": "verified"
    }
  },
  "message": "Claim re-verification completed."
}
```

## Supporting Endpoints

- `POST /api/auth/login`
- `POST /api/auth/verify-otp`
- `POST /api/auth/register`
- `GET /api/policy`
- `POST /api/policy/buy`
- `GET /api/premium`
- `GET /api/claims`
- `POST /api/claim/trigger`
- `GET /api/health`
