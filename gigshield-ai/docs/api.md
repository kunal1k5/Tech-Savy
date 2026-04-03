# GigShield API

## Public App Base

`http://localhost:5000/api`

## Backend Endpoints

### Health

- `GET /health`

### Worker / Auth

- `POST /workers/register`
- `POST /workers/login`
- `GET /workers/profile`

### Risk

- `POST /risk/assess`
- `GET /risk/latest`

### Policy

- `GET /policies/quote`
- `POST /policies/purchase`
- `GET /policies/active`

### Claims

- `GET /claims/my`
- `POST /claims/:id/process`

### Triggers

- `POST /triggers/evaluate`
- `POST /triggers/manual`

### Payments

- `POST /payments/create-order`
- `POST /payments/verify`

## AI Engine Base

`http://localhost:8000`

## AI Engine Endpoints

### Health and Live Data

- `GET /health`
- `GET /weather/live?city=Bengaluru`

### Risk Prediction

- `POST /predict`
- `POST /predict/live`
- `POST /api/risk/assess`

### Location Prediction

- `POST /predict-location`

### Fraud and Premium

- `POST /api/fraud/check`
- `POST /api/premium/calculate`

## Integration Notes

- backend talks to Python through `backend/src/integrations/aiService.js`
- frontend risk and location screens talk to the AI engine directly for demo-friendly live feedback
- fraud review can now return orchestrated context, not just a single raw score
