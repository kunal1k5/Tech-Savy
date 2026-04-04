# GigShield AI

GigShield AI is a full-stack fintech prototype for gig worker income protection. It combines risk monitoring, premium calculation, automated claims, fraud scoring, dispute handling, proof upload, and AI-style re-verification into one end-to-end product workflow.

## Problem

Gig workers lose income because of rain, pollution, route disruption, and suspicious claim handling delays. Traditional claim systems are slow, manual, and hard to trust.

## Solution

GigShield turns the claim journey into a connected decision system:

1. Detect environmental and behavioral risk.
2. Calculate premium and claim eligibility.
3. Score fraud automatically.
4. Trigger smart actions such as approve, verify, or reject.
5. Let the user raise a dispute when needed.
6. Accept proof uploads and run re-verification before the final payout decision.

## Core Features

- AI risk engine for weather and AQI-based claim risk
- Dynamic premium calculation from live risk inputs
- Auto-claim engine for eligible high-risk downtime
- Fraud detection using behavior, location, and context signals
- Smart decision layer with `SAFE`, `VERIFY`, and `FRAUD`
- Dispute workflow for challenged decisions
- Proof upload for geo-image and work screenshot evidence
- AI re-verification flow with final claim status update
- Authenticated dashboard, policy, profile, and claims experience

## Tech Stack

- Frontend: React, React Router, Framer Motion, Axios, Tailwind utility styling
- Backend: Node.js, Express, Joi, Multer, Winston, Jest, Supertest
- AI Engine: Python service layer for risk and fraud-related inference utilities
- Database: PostgreSQL schema in [`database/schema.sql`](/f:/guide/gigshield-ai/database/schema.sql)
- DevOps: Docker Compose, environment-based configuration

## Project Structure

```text
gigshield-ai/
  ai-engine/      Python AI services
  backend/        Express API and orchestration layer
  database/       SQL schema
  docs/           API and architecture notes
  frontend/       React application
  docker-compose.yml
  README.md
```

## Standard API Format

All production-ready routes now return a consistent envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully."
}
```

Error responses use:

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed"
}
```

## Key API Endpoints

- `POST /api/ai-decision`
- `POST /api/risk-premium`
- `POST /api/auto-claim`
- `POST /api/fraud-check`
- `POST /api/start-dispute`
- `POST /api/upload-proof`
- `POST /api/reverify-claim`

Detailed examples live in [`docs/api-reference.md`](/f:/guide/gigshield-ai/docs/api-reference.md).

## Local Setup

### 1. Environment

Copy the sample env file and fill the required values:

```powershell
cd F:\guide\gigshield-ai
copy .env.example .env
copy backend\.env.example backend\.env
```

Important variables:

- `REACT_APP_API_URL`
- `PORT`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `AI_ENGINE_URL`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

### 2. Install dependencies

```powershell
cd F:\guide\gigshield-ai\backend
npm install
```

```powershell
cd F:\guide\gigshield-ai\frontend
npm install
```

### 3. Run services

Backend:

```powershell
cd F:\guide\gigshield-ai\backend
npm run dev
```

Frontend:

```powershell
cd F:\guide\gigshield-ai\frontend
npm start
```

AI engine:

```powershell
cd F:\guide\gigshield-ai\ai-engine
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Optional Docker startup

```powershell
cd F:\guide\gigshield-ai
docker compose up --build
```

## Demo Flow

1. Register a gig worker account.
2. Sign in with mobile OTP demo flow.
3. Open the dashboard and run a monitored scenario.
4. Watch risk, premium, claim, fraud, and AI decision update together.
5. Raise a dispute when the decision is `VERIFY` or `FRAUD`.
6. Upload geo proof and work screenshot.
7. Run AI re-verification and view final claim status.

## Testing

Backend:

```powershell
cd F:\guide\gigshield-ai\backend
npx jest --runInBand
```

Frontend:

```powershell
cd F:\guide\gigshield-ai\frontend
$env:CI='true'; npm test -- --watch=false
npm run build
```

## Production Prep Notes

- API responses are standardized across success and error paths.
- Duplicate route mounting at `/` has been removed; public API lives under `/api`.
- Dispute and proof flows are connected end to end.
- Obvious dead mock data artifacts were removed from the frontend.
- Secrets are expected from `.env` files and sample values remain in `.env.example`.

## Current Limitation

The dispute/proof/re-verification workflow is still backed by in-memory storage in the backend service layer, so those records reset on server restart. For a full production deployment, move those records and uploaded files to persistent storage.

## Useful Docs

- [API Summary](/f:/guide/gigshield-ai/docs/api.md)
- [API Reference](/f:/guide/gigshield-ai/docs/api-reference.md)

## GitHub Submission

```powershell
git add .
git commit -m "Final submission - GigShield AI system"
git push origin main
```
