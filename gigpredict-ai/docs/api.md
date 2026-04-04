# GigPredict AI API

## Base URL

`http://localhost:5000/api`

## Response Format

Successful responses:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully."
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed"
}
```

## Primary Workflow Endpoints

### Decision and Fraud

- `POST /ai-decision`
- `POST /risk-premium`
- `POST /auto-claim`
- `POST /fraud-check`

### Dispute and Proof

- `POST /start-dispute`
- `POST /upload-proof`
- `POST /reverify-claim`

## Supporting App Endpoints

### Auth and Worker

- `POST /auth/login`
- `POST /auth/verify-otp`
- `POST /auth/register`
- `GET /workers/profile`

### Policy and Claim Demo Flow

- `GET /policy`
- `POST /policy/buy`
- `GET /premium`
- `GET /claims`
- `POST /claim/trigger`

### Platform APIs

- `GET /health`
- `POST /analyze-behavior`
- `POST /predict-location`
- `POST /calculate-premium`
- `POST /predict`
- `POST /predict/live`
- `GET /weather/live`

## Integration Notes

- The dashboard uses the backend as the single source of truth for the AI decision workflow.
- `POST /auto-claim` now triggers only when risk is `HIGH`, active work is confirmed, income loss is confirmed, and duration is above 30 minutes.
- `POST /fraud-check` and `POST /ai-decision` now add anomaly scoring for low-risk triggered claims, too many claims, and suspicious claim patterns.
- Core decision responses now include human-readable `reason` text plus `riskReason`, and where applicable `fraudReason` or `claimReason`.
- Trust score is standardized as `100 - fraudScore` and returned with fraud and AI decision responses.
- The dispute flow depends on a previously created dispute record and uploaded proof files.
- `POST /reverify-claim` reads the uploaded dispute proof, simulates location/time/activity checks, and returns the final claim outcome.
- Demo auth and policy endpoints are still available for the onboarding and dashboard experience.
