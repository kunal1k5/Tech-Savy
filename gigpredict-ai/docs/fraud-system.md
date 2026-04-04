# Fraud System

GigPredict AI now treats fraud review as a composed decision, not a single check.

## Core Idea

`fraud_orchestrator.py` combines:

- behavioral fraud signals from `services/fraud_service.py`
- route consistency from `services/location_service.py`
- environmental risk context from `services/risk_service.py`
- payout pressure context from `services/premium_service.py`

## Why It Matters

This makes the system easier to defend in front of judges:

- one weak signal should not block a valid worker
- multiple independent signals can raise confidence
- model outputs stay explainable because each component is surfaced

## Final Fraud Score

The orchestrator starts with a behavioral fraud score, then adjusts it using:

- route mismatch confidence
- environmental disruption severity
- claim-to-coverage payout pressure

The final verdict remains:

- `0-39` -> pass
- `40-69` -> flag
- `70-100` -> block

## Returned Context

The fraud API can now return:

- final `fraud_score`
- `risk_level`
- `recommendation`
- `flags`
- score components
- optional location context
- optional environment context
- optional premium context

## Judge-Friendly Story

The fraud system is now easy to explain as a production-style trust layer:

1. Score raw suspicious behavior.
2. Verify whether the route story makes sense.
3. Check whether the environmental claim context matches the worker story.
4. Compare payout pressure with expected protection.
5. Produce one final review decision with visible reasoning.
