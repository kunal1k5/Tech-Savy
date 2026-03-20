# GigShield AI — System Architecture

## Phase-1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GIGSHIELD AI PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐       ┌──────────────────┐        ┌──────────────────────┐    │
│  │   FRONTEND   │       │   BACKEND API     │        │     AI ENGINE        │    │
│  │  React.js    │◄─────►│   Node/Express    │◄──────►│   Python/FastAPI     │    │
│  │  TailwindCSS │ REST  │                   │  REST  │                      │    │
│  │              │       │  ┌─────────────┐  │        │  ┌────────────────┐  │    │
│  │  Pages:      │       │  │ Controllers │  │        │  │ Risk Model     │  │    │
│  │  • Landing   │       │  ├─────────────┤  │        │  │ (GBRegressor)  │  │    │
│  │  • Register  │       │  │ Services    │  │        │  ├────────────────┤  │    │
│  │  • Login     │       │  ├─────────────┤  │        │  │ Fraud Detector │  │    │
│  │  • Dashboard │       │  │ Routes      │  │        │  │ (GBClassifier) │  │    │
│  │  • Quote     │       │  ├─────────────┤  │        │  ├────────────────┤  │    │
│  │  • Claims    │       │  │ Middleware  │  │        │  │ Premium Calc   │  │    │
│  │  • Admin     │       │  │ (Auth/RBAC) │  │        │  │ (Rule Engine)  │  │    │
│  │              │       │  ├─────────────┤  │        │  └────────────────┘  │    │
│  └─────────────┘       │  │ Models (DB) │  │        └──────────────────────┘    │
│                         │  └─────────────┘  │                                    │
│                         └────────┬──────────┘                                    │
│                                  │                                               │
│                    ┌─────────────┼──────────────┐                                │
│                    │             │               │                                │
│              ┌─────▼─────┐ ┌────▼────┐  ┌──────▼──────┐                         │
│              │ PostgreSQL │ │  Redis  │  │  Razorpay   │                         │
│              │  Database  │ │  Cache  │  │  Sandbox    │                         │
│              └────────────┘ └─────────┘  └─────────────┘                         │
│                                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ EXTERNAL API INTEGRATIONS  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐           │
│  │ OpenWeatherMap    │  │ Google Maps API  │  │ Air Quality APIs     │           │
│  │ (Weather data)    │  │ (Traffic index)  │  │ (AQI data)           │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘           │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Module Interaction Flow

```
                 ┌──────────────────────────────────────────────┐
                 │              WORKER APPLICATION              │
                 │   (Register → Profile → Buy Policy → Claims) │
                 └──────────────┬───────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     API GATEWAY        │
                    │  (Express Middleware)   │
                    │  • JWT Auth             │
                    │  • Rate Limiting        │
                    │  • Input Validation     │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
   ┌──────▼──────┐    ┌────────▼────────┐    ┌───────▼────────┐
   │   POLICY     │    │  RISK ENGINE    │    │   TRIGGER      │
   │   MANAGEMENT │    │  (AI Service)   │    │   ENGINE       │
   │              │    │                 │    │                │
   │  • Quote     │    │  • Risk Score   │    │  • Weather     │
   │  • Purchase  │    │  • Risk Tier    │    │    Monitoring  │
   │  • Renewal   │    │  • Feature      │    │  • Threshold   │
   │  • Status    │    │    Analysis     │    │    Evaluation  │
   └──────┬───────┘    └────────┬────────┘    │  • Auto-Claim  │
          │                     │              │    Creation    │
          │                     │              └───────┬────────┘
          │                     │                      │
          │            ┌────────▼────────┐             │
          │            │  FRAUD DETECTION │             │
          │            │  ENGINE          │             │
          │            │                  │◄────────────┘
          │            │  • GPS Spoofing  │
          │            │  • Duplicates    │
          │            │  • Frequency     │
          │            │  • Amount Anomaly│
          │            └────────┬─────────┘
          │                     │
   ┌──────▼─────────────────────▼──────┐
   │        CLAIMS PROCESSING          │
   │                                   │
   │  fraud_score < 60 → Auto-Approve  │
   │  fraud_score 60-80 → Flag (Review)│
   │  fraud_score > 80 → Auto-Reject   │
   └──────────────┬────────────────────┘
                  │
           ┌──────▼──────┐
           │   PAYMENT    │
           │   SYSTEM     │
           │  (Razorpay)  │
           │              │
           │  • Premium   │
           │    Collection│
           │  • Claim     │
           │    Payout    │
           └──────────────┘
```

## Data Flow — End-to-End

```
1. ONBOARDING
   Worker registers → Profile stored in DB → JWT issued

2. RISK ASSESSMENT
   Worker requests quote → Backend calls AI Engine →
   AI Engine fetches weather/AQI data → Runs Risk Model →
   Returns risk_score + risk_tier → Stored in risk_assessments table

3. POLICY PURCHASE
   Quote displayed to worker → Worker pays via Razorpay →
   Payment verified → Weekly policy created in DB

4. CONTINUOUS MONITORING
   Cron job / webhook fetches weather data per zone →
   Trigger Service evaluates against thresholds →
   If threshold breached → Parametric trigger fired

5. AUTO-CLAIM PROCESSING
   Trigger fires → All active policies in zone identified →
   Claims auto-created → Fraud Engine scores each claim →
   Low fraud → Auto-approve → Payout via Razorpay
   High fraud → Flag for admin review

6. ADMIN OVERSIGHT
   Admin dashboard shows real-time stats →
   Flagged claims listed for manual review →
   Recent triggers and payout summaries visible
```

## Technology Decisions

| Component       | Technology          | Rationale                                            |
|----------------|---------------------|------------------------------------------------------|
| Frontend       | React + TailwindCSS | Fast prototyping, component-based, responsive        |
| Backend API    | Node.js + Express   | Non-blocking I/O, rich ecosystem, fast development   |
| AI Engine      | Python + FastAPI    | Best-in-class ML libraries, async performance        |
| Database       | PostgreSQL          | ACID compliance, JSONB support, production-grade     |
| Cache          | Redis               | Sub-ms latency for weather cache, session storage    |
| Payments       | Razorpay            | Indian market leader, sandbox available, INR native  |
| ML Models      | scikit-learn        | Phase-1 simplicity, upgradeable to TensorFlow later  |
| Containerisation | Docker Compose    | One-command dev setup, production-ready              |

## Security Architecture

```
┌──────────────────────────────────────────────┐
│               SECURITY LAYERS                 │
├──────────────────────────────────────────────┤
│                                              │
│  1. Transport: HTTPS / TLS (production)      │
│  2. Auth: JWT with bcrypt password hashing   │
│  3. RBAC: Role-based access control          │
│  4. Input: Joi schema validation             │
│  5. Rate Limiting: 100 req / 15 min          │
│  6. Headers: Helmet.js security headers      │
│  7. CORS: Whitelist frontend origin          │
│  8. SQL: Parameterised queries (no ORMs)     │
│  9. Payments: Razorpay signature verification│
│ 10. Fraud: ML-powered claim verification     │
│                                              │
└──────────────────────────────────────────────┘
```
