# TrustGrid AI Architecture

TrustGrid AI is organized as a three-layer system:

`frontend -> backend -> ai-engine -> database`

## High-Level Flow

1. `frontend/` renders the worker dashboard, onboarding, policy, claims, and profile experiences.
2. `backend/` owns workflow orchestration, auth, persistence, and business rules.
3. `backend/src/integrations/aiService.js` is the shared bridge from Node to the Python AI layer.
4. `ai-engine/` runs risk scoring, location prediction, fraud scoring, premium pricing, and the composite fraud orchestrator.
5. `database/` holds the relational schema and operational tables.

## AI Engine Separation

The AI layer now makes model assets and runtime logic explicit:

```text
ai-engine/
  models/
    risk_model.pkl
    fraud_model.pkl
    location_model.pkl
  services/
    risk_service.py
    fraud_service.py
    premium_service.py
    location_service.py
  routes/
  utils/
  fraud_orchestrator.py
```

This keeps `Model != Logic` visible in the repository:

- `models/` stores serialized artifacts only.
- `services/` contains loading, inference, scoring, and response shaping.
- `utils/` contains shared config, model-loading, and score-mapping helpers.
- `fraud_orchestrator.py` combines risk, location, fraud, and payout context into a final fraud score.
- compatibility wrappers such as `risk_model.py` and `fraud_detection.py` remain thin entrypoints for older imports.

## Frontend Structure

The frontend now exposes a feature-based module layer in `frontend/src/modules/`:

```text
modules/
  auth/
  claims/
  dashboard/
  policy/
  profile/
```

Routes can import from modules instead of reaching directly into page files, which makes feature ownership clearer without forcing a risky full-page move during judging week.

## Backend Structure

Important backend responsibilities:

- `controllers/` handle HTTP transport concerns.
- `services/` implement domain workflows.
- `integrations/aiService.js` centralizes all backend calls to Flask/FastAPI.
- `models/` and `database/` handle persistence access.

## Runtime Topology

For local development, Docker Compose runs:

- `frontend` on `:3000`
- `backend` on `:5000`
- `ai-engine` on `:8000`
- `postgres` on `:5432`
- `redis` on `:6379`

## Key Design Choice

The most important architectural upgrade is that fraud review is no longer a single-model story.
The orchestrator can combine:

- behavioral fraud signals
- route consistency from the location model
- environment risk context
- premium and payout pressure context

That gives the project a clearer production-grade narrative for judges and reviewers.
