# 🛡️ GigShield AI

> **This system uses parametric insurance where claims are triggered automatically based on external data, eliminating the need for manual claim requests.**

### 🔥 Core Value Proposition
- **Zero-touch claims** (no manual filing required)
- **Parametric insurance model** ensures instant payouts
- **Designed specifically for India’s gig economy**

### 🧠 Why This Matters
Gig workers currently have **no safety net**. When heavy rains flood the streets or extreme pollution forces zone shutdowns, they lose their daily wages. Our solution ensures **financial stability** during uncontrollable disruptions.

---

## 🥈 1. PLANNING (Workflow + Features)

**Simple Flow:**
1. Worker registers on platform
2. System calculates risk score based on location
3. Weekly premium is generated
4. Worker purchases insurance
5. System continuously monitors disruptions
6. If disruption occurs → claim automatically triggered
7. Instant payout is processed

---

## 🥉 2. ARCHITECTURE (High-Level)

**Tech Stack Flow:**
```text
Frontend (React + Tailwind + Framer Motion)
       ↓
Backend (Node.js + Express)
       ↓
AI Engine (Python Risk + Fraud Models)
       ↓
External APIs (Weather, Traffic, AQI)
       ↓
Database (PostgreSQL)
       ↓
Payment System (Razorpay API)
```

---

## 🧠 3. AI INTEGRATION PLAN

This is the core logic that powers GigShield AI's intelligence:

### 🎯 Risk Model
We use an AI-based risk scoring system that evaluates environmental and location-based risks in real-time.
*   **Inputs:** Rainfall (mm/h), Temperature (°C), AQI (pollution), Traffic congestion
*   **Output:** Risk Score (0–100)

### 💰 Premium Model
Pricing is completely dynamic, keeping it affordable for low-risk zones while protecting high-risk zones.
*   **Formula:** `Weekly Premium = Base Price + (Risk Score × Risk Factor)`

### 🚨 Fraud Detection Plan
We will use anomaly detection techniques to identify malicious actors to protect the insurance pool:
*   Duplicate claims from the same device
*   GPS spoofing (verifying if the worker was actually in the disrupted zone)
*   Fake disruption events

### ⚡ Parametric Triggers
Claims are automatically triggered when predefined thresholds are met. **No surveyors, no paperwork.**
*   🌧️ **Rainfall** > 50mm
*   🌫️ **AQI** > 400
*   🌡️ **Temperature** > 45°C

---

## 📦 FINAL SUBMISSION CHECKLIST (Phase-1)
- [x] ✔ UI working (React + Tailwind + Framer Motion)
- [x] ✔ सभी pages complete (Auth, Dashboard, Policy, Claims, Risk Map)
- [x] ✔ README strong & polished
- [x] ✔ AI logic explained
- [x] ✔ Triggers defined
- [ ] ⏳ Demo video recorded (Pending recording)
