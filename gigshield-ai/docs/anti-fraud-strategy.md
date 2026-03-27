# GigShield Anti-Fraud Strategy

GigShield is designed to protect real income loss, so the fraud system has to be strong without blocking genuine workers who are already under stress.

This strategy focuses on practical signals that can be explained clearly during a demo and scaled later in production.

## 1. Fraud Detection Logic

GigShield checks a claim in layers instead of trusting one signal alone.

### Step 1: Verify zone presence

- Check whether the worker was actually in the affected zone when the disruption happened
- If the worker was clearly outside the zone, increase suspicion

### Step 2: Compare predicted vs actual route

- Use route prediction or destination consistency logic
- If the predicted destination does not match the claimed destination, add suspicion
- A mismatch alone should not block a claim, but it should trigger extra review

### Step 3: Measure movement realism

- Compute location change over time
- Convert it into travel speed
- If the implied speed is unrealistic for city travel, flag possible GPS spoofing

### Step 4: Check recent claim frequency

- Count claims from the same worker in the last few hours and last 30 days
- Repeated claims in a short time window increase risk

### Step 5: Check duplicate trigger behavior

- Detect whether the same worker is trying to claim the same disruption event more than once

### Step 6: Look for coordinated fraud

- Check whether multiple users show the same suspicious pattern at nearly the same time
- Example: same route jump, same zone, same timing, same device pattern, or same repetitive trigger behavior

### Step 7: Score and decide

- Combine these signals into one fraud score from 0 to 100
- Use the final score to decide whether the claim should pass, be flagged, or be blocked

## 2. What Data is Used

GigShield uses simple but useful signals:

- worker GPS location
- timestamps
- disruption zone and time
- predicted destination vs claimed destination
- travel distance and travel speed
- number of recent claims
- duplicate trigger history
- device or session fingerprint changes
- nearby similar claim behavior from other users
- average claim amount and current claim amount

These signals make the fraud logic stronger than a simple yes/no zone check.

## 3. How Suspicious Users Are Flagged

Users are not treated as fraudulent immediately.

### Low concern

- one weak signal
- minor location mismatch
- slightly high claim frequency

Action:

- allow the claim to continue
- keep the user in monitored state

### Medium concern

- one strong signal or multiple weak signals
- suspicious route mismatch
- repeated claims in a short period

Action:

- mark the claim as flagged
- show "Fraud Check in Progress" or "Flagged for Review"
- require manual review before payout

### High concern

- multiple strong signals together
- unrealistic speed + location mismatch
- repeated short-window claims + coordinated pattern
- duplicate trigger abuse

Action:

- block automatic payout
- send the claim to manual review or rejection workflow

## 4. How False Positives Are Reduced

This is critical.

GigShield should not punish honest workers because of one noisy signal.

### False-positive controls

- Do not block a claim on one weak signal alone
- Use multiple-signal confirmation before high-risk actions
- Add tolerance windows for location drift and network delay
- Treat a first-time mismatch as review, not automatic rejection
- Use manual review for borderline scores
- Adjust for real urban conditions like traffic, detours, and GPS noise
- Prefer "flag" before "block" unless abuse is very clear

The goal is to protect the system without damaging worker trust.

## 5. Fraud Risk Scoring

Use a simple three-level model:

### Low Fraud Risk

- Score: 0 to 39
- Meaning: behavior looks normal
- Action: auto-approve if claim conditions are met

### Medium Fraud Risk

- Score: 40 to 69
- Meaning: some suspicious behavior exists, but evidence is not strong enough to reject
- Action: flag for manual review

### High Fraud Risk

- Score: 70 to 100
- Meaning: multiple strong fraud signals are present
- Action: block automatic payout and escalate

## Simple Pseudo-code

```text
fraud_score = 0
flags = []

if worker_not_in_zone:
    fraud_score += 20
    flags.append("zone_mismatch")

if predicted_destination != actual_destination:
    fraud_score += 18
    flags.append("route_mismatch")

speed = distance_km / (minutes / 60)
if speed > city_speed_limit:
    fraud_score += 25
    flags.append("unrealistic_travel_speed")

if repeated_claims_within_6h >= 2:
    fraud_score += 18
    flags.append("repeat_claim_pattern")

if duplicate_trigger:
    fraud_score += 30
    flags.append("duplicate_trigger")

if nearby_similar_claims_count >= 3:
    fraud_score += 14
    flags.append("possible_group_fraud")

if only_one_weak_signal:
    fraud_score = min(fraud_score, 45)

if fraud_score < 40:
    status = "verified"
elif fraud_score < 70:
    status = "flagged"
else:
    status = "high_risk"
```

## UI Representation

The fraud system should be visible in the product so judges can understand it quickly.

### Suggested statuses

- Fraud Check in Progress
- Verified
- Flagged for Review
- High Risk Claim

### Suggested UI behavior

- Show status chips beside every claim
- Show the latest fraud check result in the dashboard
- Show short reasons such as:
  - "Route mismatch detected"
  - "Repeated claims in 4 hours"
  - "Unrealistic movement speed"
- Show timestamps for every fraud state transition
- Keep manual review claims clearly separate from normal paid claims

## Why This Strategy Works for GigShield

It is simple enough to demo clearly, strong enough to feel realistic, and structured enough to grow into a production fraud system.

Most importantly, it balances two goals:

- protect the platform from abuse
- avoid harming genuine workers who need fast support
