# GigPredict AI

GigPredict AI is a full-stack decision-intelligence platform built for gig workers. It monitors real-world risk signals, automates claim workflows, applies explainable fraud checks, and supports dispute re-verification with proof uploads.

## Live Links

- Pitch Deck: https://1drv.ms/p/c/ebd841bd10f2a4fe/IQAlOlae6Ua3Q5-PZnHrKW-XAR0_z_vBFiGTGe-3hejA3aM?e=h3aFuu
- Frontend Demo: https://tech-savy-8euw.vercel.app/
- Backend API: https://tech-savy.onrender.com
- Health Check: https://tech-savy.onrender.com/api/health
- Repository: https://github.com/kunal1k5/Tech-Savy

## Problem Statement

Gig workers can lose income because of rain, air quality, route disruption, or unsafe working conditions. Traditional insurance workflows are often manual and slow, with low transparency on claim decisions.

## Our Solution

GigPredict AI creates an automated decision loop:

1. Detect risk from environmental and behavior signals.
2. Evaluate claim eligibility and expected impact.
3. Run fraud scoring and decision logic.
4. Allow dispute + proof upload for re-verification.
5. Produce a final explainable claim outcome.

## Core Features

- Real-time risk monitoring (weather + AQI + behavior context)
- Dynamic risk-driven insurance intelligence
- Automated claim trigger and evaluation flow
- Rule-based explainable fraud scoring
- Work-profile screenshot verification for onboarding proof
- Dispute workflow with geo-proof and work screenshot upload
- Re-verification flow for final claim decision

## Product Workflow

1. Worker registers and completes verification.
2. Dashboard starts monitoring risk and operational signals.
3. Trigger conditions activate auto-claim checks.
4. Fraud engine marks claim as approve/review/reject.
5. Worker can raise dispute and upload proof.
6. Re-verification engine updates final status.

## High-Level Architecture

```text
Frontend (React)
	 |
	 v
Backend API (Node.js + Express)
	 |\
	 | \-- PostgreSQL (structured persistence)
	 | \-- MongoDB (auth + flow state)
	 |
	 \---- AI Engine / Risk Utilities (Python services)
```

## Tech Stack

- Frontend: React, React Router, Axios, Tailwind CSS, Framer Motion
- Backend: Node.js, Express, Joi, Multer, Winston
- Databases: PostgreSQL, MongoDB
- AI Utilities: Python services (risk/fraud support modules)
- Deployment: Vercel (frontend), Render (backend)

## Repository Structure

```text
Tech-Savy/
	gigshield-ai/
		ai-engine/        Python AI and scoring utilities
		backend/          Express API services
		frontend/         React client app
		database/         SQL schema and seed artifacts
		docs/             Architecture and API documentation
```

## Pitch Deck

https://1drv.ms/p/c/ebd841bd10f2a4fe/IQAlOlae6Ua3Q5-PZnHrKW-XAR0_z_vBFiGTGe-3hejA3aM?e=h3aFuu

## Recorded Video

https://video-gfid.vercel.app/

## Source Code

Repository:

https://github.com/kunal1k5/Tech-Savy

Dependencies and run instructions are included below for full local execution.

## Local Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Python 3.10+
- MongoDB and PostgreSQL (optional for full persistence)

### 1) Clone Repository

```powershell
git clone https://github.com/kunal1k5/Tech-Savy.git
cd Tech-Savy\gigshield-ai
```

### 2) Configure Environment Files

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Recommended local values:

- backend/.env
	- PORT=5005
	- NODE_ENV=development
	- JWT_SECRET=<your-secret>
	- OTP_HASH_SECRET=<your-secret>
	- MONGODB_URI=<your-mongodb-uri>
	- MONGODB_DB_NAME=GigPredict-AI

- frontend/.env
	- REACT_APP_API_URL=http://localhost:5005/api

### 3) Install Dependencies

```powershell
cd backend
npm install
cd ..\frontend
npm install
cd ..\ai-engine
python -m pip install -r requirements.txt
```

### 4) Run Services

Backend:

```powershell
cd backend
npm start
```

Frontend:

```powershell
cd frontend
npm start
```

AI Engine (optional if specific endpoints use it):

```powershell
cd ai-engine
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Key API Endpoints

- GET /api/health
- POST /api/ai-decision
- POST /api/risk-premium
- POST /api/auto-claim
- POST /api/start-dispute
- POST /api/upload-proof
- POST /api/work-profile-verify
- POST /api/reverify-claim

Detailed API examples:

https://github.com/kunal1k5/Tech-Savy/tree/main/gigshield-ai/docs

## Testing

Backend tests:

```powershell
cd backend
npx jest --runInBand
```

Frontend tests and build:

```powershell
cd frontend
$env:CI='true'; npm test -- --watchAll=false --runInBand
npm run build
```

## Deployment Notes

- Frontend deployed on Vercel.
- Backend deployed on Render.
- Health path for backend monitoring: /api/health.
- Root path / returns 404 by design because backend is API-only.

## Troubleshooting

- Mongo bad auth:
	- Verify Atlas DB user credentials and URI in deployment env.
	- Ensure 0.0.0.0/0 is temporarily enabled in Atlas Network Access during setup.

- Database unavailable warnings:
	- Add valid PostgreSQL credentials to backend environment.
	- Without DB credentials, backend runs with in-memory fallback for some flows.

- CORS issues:
	- Set FRONTEND_URL and FRONTEND_URLS to your deployed frontend URL.

## Team

Team Tech Savy

- Kunal
- Aditya
- Akashat
- Atharv
- Ranjeet

