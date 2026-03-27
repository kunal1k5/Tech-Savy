# GigShield

GigShield is a fintech platform built for gig workers whose income drops the moment work is disrupted.

It focuses on a very practical problem: when heavy rain, bad air quality, or severe route slowdowns make deliveries impossible, workers lose earnings immediately. Most of them do not need complex insurance paperwork. They need fast income protection.

## Problem

Gig workers depend on daily earnings.

When a delivery partner cannot work because roads are flooded, air quality becomes dangerous, or traffic conditions collapse, income stops at once. Traditional insurance is not designed for this kind of short-term income disruption. It usually depends on manual claims, long verification cycles, and delayed settlement.

The real problem is not paperwork. The real problem is income loss during disruption.

## Solution

GigShield is a risk-based protection platform that estimates likely income loss, triggers support automatically when disruption thresholds are crossed, and helps move workers from interruption to payout with minimal friction.

Instead of waiting for users to file a claim, the system watches disruption signals, estimates downtime, checks for fraud, and moves eligible claims forward through an automated workflow.

## How it Works

1. The system monitors disruption signals such as rainfall, air quality, and route instability.
2. It evaluates the worker's current operating area and disruption severity.
3. It estimates how many working hours were lost.
4. It calculates likely income loss for that worker.
5. It creates a claim automatically when the policy threshold is met.
6. It runs fraud checks before approval.
7. It moves the claim through pending -> approved -> paid.

## Loss Calculation Logic

GigShield uses a simple and transparent loss model:

`loss = income_per_hour x hours_lost`

Example:

- If a worker earns INR 120 per hour
- And loses 3 hours because of flooding
- Estimated loss = INR 360

This makes the payout logic easy to explain, fast to compute, and practical for real-world disruption cover.

## Claims System

GigShield is designed around automated claims.

- No manual claim form is required for normal disruption events
- No long settlement flow is needed for routine cases
- Claims start when the platform detects that a covered disruption crossed the policy threshold
- Status stays visible in the product: pending -> approved -> paid
- Timestamps and history make the process easy to audit

The goal is to reduce the gap between disruption and financial support.

## Fraud Detection Strategy

GigShield does not assume every claim is genuine.

The fraud layer checks whether the claim is consistent with the worker's actual behavior and movement pattern. It looks for:

- location mismatch
- unrealistic travel speed
- repeated claims in a short window
- duplicate trigger usage
- suspicious route jumps
- coordinated behavior across multiple users

Claims are not rejected on one weak signal alone. Stronger actions happen only when multiple signals point to suspicious activity.

A detailed anti-fraud design note is available in [docs/anti-fraud-strategy.md](docs/anti-fraud-strategy.md).

## Architecture

The system follows a simple flow:

`Frontend -> Backend -> Risk/Fraud Services -> Claim Logic -> Payout Flow`

Current project structure:

- `frontend/` -> React app for worker dashboard, claims, monitoring, and route checks
- `backend/` -> Express API for application logic and workflow orchestration
- `ai-engine/` -> Flask and Python services for risk prediction, route checks, and fraud scoring

Product flow:

1. React frontend collects worker input and displays live statuses
2. Express backend manages business workflows
3. Flask services run prediction and fraud checks
4. Claim logic estimates disruption impact
5. Eligible claims move toward payout

## Why This Matters

Gig workers operate with very thin financial buffers.

Missing even a few hours of work can affect fuel, rent, food, and loan payments. GigShield matters because it treats disruption as an income protection problem, not as a slow insurance administration problem.

It is also useful for platforms and ecosystem partners because it creates:

- faster worker support
- clearer claim rules
- better fraud control
- higher trust in automated payouts

## Future Scope

- Expand to more cities and zone-level disruption coverage
- Add richer traffic, flood, and pollution data sources
- Improve payout automation with partner integrations
- Strengthen anti-fraud with graph-based group behavior analysis
- Add insurer, platform, and payment network partnerships
- Build worker-specific pricing based on route behavior and reliability

## Demo Highlights

The current project includes:

- a responsive fintech-style frontend
- live risk response screens
- automated claim lifecycle simulation
- fraud status visibility in the UI
- next-destination consistency checks
- weather-backed risk prediction through the Flask service

UI structure notes are available in [docs/ui-redesign-notes.md](docs/ui-redesign-notes.md).

## Local Setup

### Frontend

```powershell
cd F:\guide\gigshield-ai\frontend
npm install
$env:REACT_APP_FLASK_API_URL = "http://localhost:8000"
npm start
```

### Flask Services

```powershell
cd F:\guide\gigshield-ai\ai-engine
python -m pip install -r requirements.txt
python app.py
```

### Main Routes

- `/dashboard`
- `/insurance`
- `/claims`
- `/risk-map`
- `/location-predictor`

## Key Service Endpoints

- `GET /health`
- `POST /predict`
- `POST /predict/live`
- `POST /predict-location`

## Notes

- Weather-based risk prediction uses the Flask service in `ai-engine/app.py`
- Route consistency checks use `next_location_model.pkl`
- Fraud scoring logic starts in `ai-engine/fraud_detection.py`
- If Indian weather API endpoints fail upstream, the system falls back to Open-Meteo
