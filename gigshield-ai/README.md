# GigShield AI

GigShield is an income-protection platform for gig workers affected by rain, air-quality spikes, and route disruption.

The project is structured as a connected full-stack system:

- `frontend/` React app for dashboard, policy, claims, profile, and route/risk views
- `backend/` Express API for auth, workflow, persistence, and orchestration
- `ai-engine/` Python services for risk scoring, fraud checks, location prediction, premium pricing, and fraud orchestration
- `database/` SQL schema
- `docs/` architecture, API, and fraud-system notes

## Production-Style Upgrades

- AI model artifacts are separated from inference logic under `ai-engine/models/` and `ai-engine/services/`
- `ai-engine/fraud_orchestrator.py` combines multiple signals into one final fraud score
- frontend uses `frontend/src/modules/` for feature-based boundaries
- backend centralizes Python service calls in `backend/src/integrations/aiService.js`
- compose and env setup are aligned for frontend, backend, and AI-engine connectivity

## Final Structure

```text
gigshield-ai/
  frontend/
  backend/
  ai-engine/
    models/
    services/
    routes/
    utils/
    fraud_orchestrator.py
  database/
  docs/
  docker-compose.yml
  README.md
```

## Core Flows

1. Worker signs in and views protection status in the frontend.
2. Backend manages policy, claim, and payment workflow.
3. AI engine scores environmental risk and route consistency.
4. Fraud orchestrator combines fraud, risk, and location context.
5. Claims move toward pass, flag, or block decisions.

## Local Setup

```powershell
cd F:\guide\gigshield-ai
docker compose up --build
```

Manual startup also works:

```powershell
cd F:\guide\gigshield-ai\backend
npm install
npm run dev
```

```powershell
cd F:\guide\gigshield-ai\frontend
npm install
npm start
```

```powershell
cd F:\guide\gigshield-ai\ai-engine
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docs

- [Architecture](./docs/architecture.md)
- [API](./docs/api.md)
- [Fraud System](./docs/fraud-system.md)

Legacy deep-dive notes are still available in `docs/api-reference.md` and `docs/anti-fraud-strategy.md`.
