# GigShield Advanced Backend - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│                    http://localhost:3000                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    HTTPS/REST API
                             │
┌────────────────────────────┴────────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                       │
│                    http://localhost:5000                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    API Routes Layer                          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ • /api/activity/*           - Activity tracking             │  │
│  │ • /api/work-sessions/*      - Work session management       │  │
│  │ • /api/fraud/*              - Fraud analysis                │  │
│  │ • /api/trust/*              - Trust score management        │  │
│  │ • /api/anomalies/*          - Anomaly detection             │  │
│  │ • /api/proofs/*             - Proof validation              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐   │
│  │                    Business Logic Layer                     │   │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                 │  │
│  │  │ Activity        │  │ Work Sessions    │                 │  │
│  │  │ Service         │  │ Service          │                 │  │
│  │  │                 │  │                  │                 │  │
│  │  │ • logActivity() │  │ • startSession() │                 │  │
│  │  │ • analyze       │  │ • validateTime() │                 │  │
│  │  │ • validate      │  │ • getDailySess() │                 │  │
│  │  └─────────────────┘  └──────────────────┘                 │  │
│  │                                                              │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                 │  │
│  │  │ Trust Score     │  │ Anomaly          │                 │  │
│  │  │ Service         │  │ Service          │                 │  │
│  │  │                 │  │                  │                 │  │
│  │  │ • getTrust()    │  │ • detect()       │                 │  │
│  │  │ • updateScore() │  │ • frequency()    │                 │  │
│  │  │ • getTier()     │  │ • clustering()   │                 │  │
│  │  └─────────────────┘  └──────────────────┘                 │  │
│  │                                                              │  │
│  │  ┌─────────────────┐  ┌──────────────────┐                 │  │
│  │  │ Advanced Fraud  │  │ Proof            │                 │  │
│  │  │ Service         │  │ Validation       │                 │  │
│  │  │                 │  │ Service          │                 │  │
│  │  │ • analyze       │  │ • validateProof()│                 │  │
│  │  │ • combine       │  │ • checkTime()    │                 │  │
│  │  │ • decide        │  │ • checkLocation()│                 │  │
│  │  └─────────────────┘  └──────────────────┘                 │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                    PostgreSQL Driver
                              │
             ┌────────────────┴────────────────┐
             │                                 │
┌────────────┴────────────────┐   ┌───────────┴──────────────────┐
│        DATABASE             │   │   PYTHON AI ENGINE          │
│      PostgreSQL             │   │   (http://localhost:5001)   │
│                             │   │                             │
│  ┌───────────────────────┐  │   │  ┌─────────────────────┐    │
│  │   TABLES              │  │   │  │ Fraud Detection     │    │
│  ├───────────────────────┤  │   │  │ Engine              │    │
│  │ • workers             │  │   │  ├─────────────────────┤    │
│  │ • activity_logs       │  │   │  │ • FraudEngine       │    │
│  │ • work_sessions       │  │   │  │ • AnomalyDetector   │    │
│  │ • user_trust_score    │  │   │  │ • BehaviorAnalyzer  │    │
│  │ • anomaly_logs        │  │   │  │ • Confidence        │    │
│  │ • fraud_flags         │  │   │  │   scoring           │    │
│  │ • proof_uploads       │  │   │  └─────────────────────┘    │
│  │ • claims              │  │   │                             │
│  └───────────────────────┘  │   │  (Optional, for advanced)   │
│                             │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘
```

---

## Data Flow - Claim Decision Pipeline

```
1. CLAIM TRIGGERED
   └─> claim_id, worker_id, location, timestamp

2. ACTIVITY ANALYSIS
   ├─> Query activity_logs for last 30 minutes
   ├─> Check motion_state (IDLE/WALKING/DRIVING)
   ├─> Calculate average speed
   └─> Return: activity_score (0-30 points)

3. LOCATION VALIDATION
   ├─> Get claim location (lat/lon)
   ├─> Calculate distance to activity points
   ├─> Use Haversine formula
   └─> Return: location_score (0-35 points)

4. TIME VALIDATION
   ├─> Query work_sessions for today
   ├─> Check if claim_time within session hours
   ├─> Validate working hours
   └─> Return: time_score (0-40 points)

5. ANOMALY DETECTION
   ├─> Check claim frequency (24h window)
   ├─> Check location clustering
   ├─> Analyze success rate changes
   └─> Return: anomaly_score (0-35 points)

6. BEHAVIOR ANALYSIS
   ├─> Count login attempts
   ├─> Check claim timing (hour of day)
   ├─> Analyze behavioral patterns
   └─> Return: behavior_score (0-20 points)

7. TRUST MODIFIER
   ├─> Query user_trust_score
   ├─> Get worker reputation tier
   ├─> Calculate modifier
   └─> Return: trust_modifier (0-100 points)

8. WEIGHTED CALCULATION
   ├─> fraud_score = 
   │   activity(25%) + location(20%) + time(15%) +
   │   behavior(15%) + anomaly(15%) - trust(-10%)
   ├─> Clamp to 0-100
   └─> Return: fraud_score

9. DECISION
   ├─> fraud_score < 30  → SAFE (auto-approve)
   ├─> 30 ≤ score < 60   → WARNING (request proof)
   ├─> score ≥ 60        → FRAUD (could reject)
   └─> If HIGH trust: auto-approve; If LOW trust: strict checks

10. STORE RESULT
    ├─> Insert fraud_flags record
    ├─> Update trust_score
    ├─> Log decision
    └─> Return to frontend

11. FRONTEND ACTION
    ├─> SAFE       : Show "Approved"
    ├─> WARNING    : Show "Proof Required" form
    ├─> FRAUD      : Show "Claim Rejected"
    └─> Show confidence % and reasons
```

---

## Database Schema Relationships

```
workers (PK: id)
    ├─> activity_logs (FK: worker_id)
    ├─> work_sessions (FK: worker_id)
    ├─> user_trust_score (FK: worker_id, UNIQUE)
    ├─> anomaly_logs (FK: worker_id)
    ├─> fraud_flags (FK: worker_id)
    └─> proof_uploads (FK: worker_id)

claims (PK: id)
    ├─> fraud_flags (FK: claim_id)
    ├─> anomaly_logs (FK: claim_id)
    └─> proof_uploads (FK: claim_id)

policies (PK: id)
    └─> claims (FK: policy_id)
```

---

## Service Dependencies

```
Activity Service
    └─> Depends on: DB connection, UUID

Work Session Service
    ├─> Depends on: DB connection, UUID, Activity data
    └─> Used by: Time Correlation, Fraud Engine

Trust Score Service
    ├─> Depends on: DB connection, UUID
    └─> Used by: Fraud Engine

Anomaly Service
    ├─> Depends on: DB connection, Claims history
    └─> Used by: Fraud Engine

Advanced Fraud Service
    ├─> Depends on: All services above
    ├─> Calls: Activity, Location, Time, Behavior, Anomaly, Trust
    └─> Primary orchestrator

Proof Validation Service
    ├─> Depends on: DB connection, Claims data
    └─> Used by: Manual verification flow
```

---

## Request Flow Example

```
1. Frontend sends claim
   POST /api/fraud/analyze
   ├─ worker_id: "uuid"
   ├─ claim_data:
   │  ├─ claim_timestamp
   │  ├─ latitude, longitude
   │  └─ ... other data
   └─> Backend receives

2. Routes dispatch to service
   fraudAnalysis.routes.js
   └─> advancedFraudService.analyzeFraudRisk()

3. Service orchestrates analysis
   ├─ activityService.analyzeActivityDuringClaim()
   ├─ activityService.validateLocationConsistency()
   ├─ workSessionService.validateClaimWithinWorkingHours()
   ├─ analyzeBehaviorScore()
   ├─ anomalyService.detectAnomalies()
   └─ trustScoreService.getTrustScore()

4. Combine results
   ├─ Calculate weighted fraud_score
   ├─ Determine decision (SAFE/WARNING/FRAUD)
   ├─ Generate confidence percentage
   ├─ Collect reasons
   └─> Create response

5. Store audit trail
   └─> fraudService.logFraudDetection()
       ├─ Insert fraud_flags
       ├─ Timestamp
       └─ Details JSON

6. Return to frontend
   POST response:
   {
     decision: "SAFE|WARNING|FRAUD",
     fraud_score: 35.5,
     confidence: 78.4,
     reasons: ["...", "..."],
     ...
   }

7. Frontend displays
   ├─ If SAFE: Show approved
   ├─ If WARNING: Show proof form
   └─ If FRAUD: Show rejection
```

---

## Configuration & Environment

```
Backend (.env)
├─ Database
│  ├─ DB_HOST=localhost
│  ├─ DB_PORT=5432
│  ├─ DB_NAME=gigshield_dev
│  ├─ DB_USER=postgres
│  └─ DB_PASS=postgres
├─ Server
│  ├─ PORT=5000
│  ├─ NODE_ENV=development|production
│  └─ DEBUG=*
├─ External
│  ├─ AI_ENGINE_URL=http://localhost:5001
│  ├─ FRONTEND_URL=http://localhost:3000
│  └─ JWT_SECRET=your-secret
└─ Rate Limiting
   ├─ RATE_LIMIT_WINDOW_MS=900000
   └─ RATE_LIMIT_MAX=5000
```

---

## Error Handling

```
Application Layer
├─ Input validation (Joi)
├─ Request logging (Morgan)
├─ Rate limiting
└─ CORS handling

Service Layer
├─ Database error catching
├─ Try-catch blocks
├─ Graceful failure
└─ Error logging (Winston)

Route Layer
├─ 400 Bad Request
├─ 404 Not Found
├─ 500 Server Error
└─ 429 Rate Limit

Global Handler
└─ Catch-all error middleware
```

---

## Performance Optimizations

```
Database
├─ Indexes on:
│  ├─ worker_id (all tables)
│  ├─ timestamp (activity_logs)
│  ├─ created_at (claims, fraud_flags)
│  └─ status (work_sessions)
└─ Query optimization

Application
├─ Connection pooling
├─ Caching (future)
├─ Query batching
└─ Async/await patterns

Algorithms
├─ O(n) haversine calculations
├─ Efficient anomaly detection
└─ Weighted scoring (constant time)

Expected Performance
├─ API response: <500ms
├─ Database query: <100ms
└─ Full fraud analysis: <300ms
```

---

## Deployment Checklist

```
Pre-Deployment
☐ Environment variables configured
☐ Database migrations run
☐ Dummy data generated
☐ All tests passing
☐ API documentation reviewed

Deployment
☐ Backend started (npm start)
☐ Database connected
☐ Health check passing
☐ Logging configured
☐ Monitoring enabled

Post-Deployment
☐ All endpoints tested
☐ Fraud analysis working
☐ Trust scores updating
☐ Anomalies detected
☐ Proofs validating
☐ Frontend connected
```

---

## Monitoring & Logs

```
Winston Logs
├─ Levels:
│  ├─ error (critical)
│  ├─ warn (warnings)
│  ├─ info (informational)
│  └─ debug (debugging)
└─ Output:
   ├─ Console
   ├─ File (logs/combined.log)
   └─ Errors (logs/error.log)

Metrics to Track
├─ Fraud detection accuracy
├─ Average analysis time
├─ Decision distribution (SAFE/WARNING/FRAUD)
├─ Trust score changes
├─ Anomaly detection rate
└─ API latency
```

---

## Future Enhancements

```
ML Integration
├─ Replace rule-based anomaly with ML models
├─ Image verification for proofs
└─ Pattern recognition for fraud

API Integrations
├─ Real weather data (OpenWeatherMap)
├─ Payment processing (Razorpay)
├─ SMS notifications
└─ Email alerts

Analytics
├─ Dashboard for metrics
├─ Trend analysis
├─ Worker behavior insights
└─ Fraud pattern reports

Scaling
├─ Redis caching
├─ Message queues (RabbitMQ/Kafka)
├─ Database replication
└─ Horizontal scaling
```

---

## Quick Reference

| Component | Tech | Status | Performance |
|-----------|------|--------|-------------|
| Backend | Node.js 18+ | ✅ | <500ms |
| Database | PostgreSQL | ✅ | <100ms |
| AI Engine | Python 3.8+ | ✅ | <300ms |
| Frontend | React | ✅ | Live |
| Auth | JWT | ✅ | - |
| Logging | Winston | ✅ | - |
| Testing | Jest | ✅ | - |

---

**Architecture Version**: 2.0  
**Last Updated**: April 2025  
**Status**: Production Ready ✅
