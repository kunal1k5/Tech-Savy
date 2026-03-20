# GigShield AI — API Reference

## Base URL: `http://localhost:5000/api`

---

## Health Check

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| GET    | `/api/health` | Service health check |

---

## Workers

| Method | Endpoint              | Auth | Description                    |
|--------|-----------------------|------|--------------------------------|
| POST   | `/api/workers/register` | No   | Register a new worker account |
| POST   | `/api/workers/login`    | No   | Login and receive JWT         |
| GET    | `/api/workers/profile`  | Yes  | Get authenticated worker profile |

### POST /api/workers/register

```json
{
  "full_name": "Rahul Kumar",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "password": "securePassword123",
  "platform": "zomato",
  "city": "Mumbai",
  "zone": "Andheri West",
  "avg_weekly_income": 3500,
  "vehicle_type": "motorcycle"
}
```

### POST /api/workers/login

```json
{
  "email": "rahul@example.com",
  "password": "securePassword123"
}
```

---

## Risk Assessment

| Method | Endpoint           | Auth | Description                      |
|--------|--------------------|------|----------------------------------|
| POST   | `/api/risk/assess` | Yes  | Trigger new risk assessment      |
| GET    | `/api/risk/latest` | Yes  | Get latest assessment for worker |

---

## Policies

| Method | Endpoint                | Auth | Description                  |
|--------|-------------------------|------|------------------------------|
| GET    | `/api/policies/quote`   | Yes  | Get weekly premium quote    |
| POST   | `/api/policies/purchase` | Yes  | Purchase a weekly policy    |
| GET    | `/api/policies/active`  | Yes  | List active policies        |

### POST /api/policies/purchase

```json
{
  "assessment_id": "uuid-of-risk-assessment",
  "payment_id": "razorpay_payment_id"
}
```

---

## Claims

| Method | Endpoint                  | Auth    | Description               |
|--------|---------------------------|---------|---------------------------|
| GET    | `/api/claims/my`          | Worker  | Get worker's claim history |
| POST   | `/api/claims/:id/process` | Admin   | Process a pending claim   |

---

## Triggers

| Method | Endpoint                 | Auth          | Description                    |
|--------|--------------------------|---------------|--------------------------------|
| POST   | `/api/triggers/evaluate` | Yes           | Evaluate weather data          |
| POST   | `/api/triggers/manual`   | Super Admin   | Fire manual trigger (curfew)   |

### POST /api/triggers/evaluate

```json
{
  "city": "Mumbai",
  "zone": "Andheri West",
  "rainfall_mm": 75.5,
  "temperature_c": 28.0,
  "aqi": 350,
  "traffic_index": 8.5
}
```

### POST /api/triggers/manual

```json
{
  "trigger_type": "curfew",
  "city": "Mumbai",
  "zone": "Andheri West",
  "severity": "high",
  "threshold_met": "Government-imposed curfew due to protests"
}
```

---

## Payments

| Method | Endpoint                     | Auth | Description                  |
|--------|------------------------------|------|------------------------------|
| POST   | `/api/payments/create-order` | Yes  | Create Razorpay order        |
| POST   | `/api/payments/verify`       | Yes  | Verify payment signature     |

### POST /api/payments/verify

```json
{
  "order_id": "order_xxxxxxxxxxxx",
  "payment_id": "pay_xxxxxxxxxxxx",
  "signature": "hmac_sha256_signature"
}
```

---

## Admin

| Method | Endpoint                      | Auth  | Description                   |
|--------|-------------------------------|-------|-------------------------------|
| GET    | `/api/admin/dashboard`        | Admin | Platform-wide statistics      |
| GET    | `/api/admin/triggers/recent`  | Admin | Recent trigger events         |
| GET    | `/api/admin/claims/flagged`   | Admin | Claims flagged for review     |

---

## AI Engine Endpoints (Internal)

Base URL: `http://localhost:8000`

| Method | Endpoint               | Description                     |
|--------|------------------------|---------------------------------|
| GET    | `/health`              | AI engine health check          |
| POST   | `/api/risk/assess`     | Compute risk score              |
| POST   | `/api/fraud/check`     | Run fraud detection             |
| POST   | `/api/premium/calculate` | Calculate weekly premium      |
