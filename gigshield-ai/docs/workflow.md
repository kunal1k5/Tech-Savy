# TrustGrid AI Workflow Documentation

## Complete System Workflow

### 1. Worker Onboarding

```
┌─────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│  Worker  │────►│  Register │────►│  Validate │────►│  Store   │
│  Opens   │     │  Form     │     │  Input    │     │  in DB   │
│  App     │     │  (React)  │     │  (Joi)    │     │  (PG)    │
└─────────┘     └───────────┘     └───────────┘     └────┬─────┘
                                                          │
                                                     Issue JWT
                                                          │
                                                    ┌─────▼─────┐
                                                    │  Dashboard │
                                                    └───────────┘
```

**Data Collected:**
- Full name, email, phone (verified format)
- Delivery platform (Zomato / Swiggy / Amazon / Dunzo)
- City and operational zone
- Average weekly income (self-reported)
- Vehicle type

---

### 2. Risk Assessment Flow

```
Worker requests quote
        │
        ▼
Backend fetches worker profile (city, zone)
        │
        ▼
Backend calls AI Engine POST /api/risk/assess
        │
        ▼
AI Engine fetches live data:
  ├── OpenWeatherMap → rainfall_mm, temperature_c
  ├── Air Quality API → AQI
  └── Google Maps → traffic_index
        │
        ▼
Risk Model computes risk_score (0-100)
        │
        ├── 0-25   → LOW      (low disruption probability)
        ├── 26-50  → MEDIUM   (moderate risk)
        ├── 51-75  → HIGH     (significant disruption risk)
        └── 76-100 → CRITICAL (severe conditions expected)
        │
        ▼
Assessment persisted in risk_assessments table
```

---

### 3. Premium Calculation

```
FORMULA:
  Weekly Premium = Base + (risk_score × risk_factor)

TIER TABLE:
  ┌──────────┬──────────┬─────────────┬─────────────────┐
  │ Tier     │ Base (₹) │ Risk Factor │ Premium Range   │
  ├──────────┼──────────┼─────────────┼─────────────────┤
  │ Low      │   10     │    0.10     │  ₹10 – ₹12.50  │
  │ Medium   │   18     │    0.15     │  ₹18 – ₹25.50  │
  │ High     │   30     │    0.25     │  ₹30 – ₹48.75  │
  │ Critical │   45     │    0.35     │  ₹45 – ₹80.00  │
  └──────────┴──────────┴─────────────┴─────────────────┘

COVERAGE:
  max_payout = avg_weekly_income × 0.80

EXAMPLE:
  Worker: Rahul, Zomato, Mumbai Zone-3
  Avg Weekly Income: ₹3,500
  Risk Score: 42 (MEDIUM)
  Premium = 18 + (42 × 0.15) = ₹24.30/week
  Coverage = ₹3,500 × 0.80 = ₹2,800 max payout
```

---

### 4. Policy Purchase

```
Worker sees quote on /quote page
        │
        ▼
Worker clicks "Purchase Policy"
        │
        ▼
Backend creates Razorpay order (amount in paise)
        │
        ▼
Frontend opens Razorpay checkout widget
        │
        ▼
Worker completes payment
        │
        ▼
Razorpay sends payment_id + signature
        │
        ▼
Backend verifies HMAC-SHA256 signature
        │
        ▼
Policy created: week_start → week_end (7 days)
        │
        ▼
Payment logged in payments table
```

---

### 5. Parametric Trigger System

```
TRIGGER THRESHOLDS:
  ┌────────────────────┬─────────────────────────────────┐
  │ Trigger Type       │ Threshold                        │
  ├────────────────────┼─────────────────────────────────┤
  │ Extreme Weather    │ rainfall > 50mm/hr               │
  │                    │ OR temp > 45°C OR temp < 5°C     │
  │ High AQI           │ AQI > 300 (hazardous)            │
  │ Flooding           │ rainfall > 100mm/hr              │
  │ Heatwave           │ temp > 44°C sustained            │
  │ Curfew             │ Manual admin trigger              │
  │ Zone Shutdown      │ Manual admin trigger              │
  └────────────────────┴─────────────────────────────────┘

MONITORING FLOW:
  Cron job runs every 15 minutes
        │
        ▼
  Fetch weather data for all active zones
        │
        ▼
  Evaluate each zone against thresholds
        │
        ├── No threshold breached → log & continue
        │
        └── Threshold breached → FIRE TRIGGER
                │
                ▼
         Record trigger in parametric_triggers table
                │
                ▼
         Find all active policies in affected zone
                │
                ▼
         Auto-create claims for each policy
                │
                ▼
         Route claims to fraud detection engine
```

---

### 6. Fraud Detection Pipeline

```
New claim created
        │
        ▼
┌───────────────────────────────────────┐
│         FRAUD DETECTION ENGINE        │
│                                       │
│  Check 1: GPS/Zone Verification       │
│    Worker not in zone? → +35 points   │
│                                       │
│  Check 2: Duplicate Claims            │
│    Same trigger + same worker? → +40  │
│                                       │
│  Check 3: Claim Frequency             │
│    > 3 claims in 30 days? → +15       │
│                                       │
│  Check 4: Amount Anomaly              │
│    Claim > 2× average? → +20         │
│                                       │
│  TOTAL → fraud_score (0-100)          │
└───────────────┬───────────────────────┘
                │
        ┌───────┼───────┐
        │       │       │
     <60     60-80    >80
        │       │       │
   AUTO-       FLAG    AUTO-
   APPROVE   (Manual)  REJECT
        │       │       │
        ▼       ▼       ▼
     Payout   Admin   Denied
     via      Review   + Log
     Razorpay
```

---

### 7. Claim Payout Flow

```
Claim approved (fraud_score < 60)
        │
        ▼
Calculate payout:
  payout = coverage_amount × severity_multiplier
  
  Severity Multipliers:
    Low      → 25% of coverage
    Medium   → 50% of coverage
    High     → 75% of coverage
    Critical → 100% of coverage
        │
        ▼
Initiate Razorpay payout to worker's account
        │
        ▼
Update claim status → 'paid'
Update policy status → 'claimed'
Log payment in payments table
```

---

### 8. Admin Dashboard

```
METRICS DISPLAYED:
  • Total registered workers
  • Active policies count
  • Pending / approved / flagged claims
  • Total payouts (₹)
  • Trigger events (last 7 days)
  • Flagged claims requiring manual review
  • Recent parametric triggers with severity

ADMIN ROLES:
  super_admin → Full access + manual triggers
  analyst     → Dashboard + claim review
  support     → Dashboard only
```
