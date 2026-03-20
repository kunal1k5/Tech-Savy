-- ============================================================
-- GigShield AI — Database Schema (PostgreSQL)
-- Phase-1: Core tables for parametric insurance platform
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. WORKERS — Gig delivery worker profiles
-- ============================================================
CREATE TABLE workers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(120)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone           VARCHAR(15)     NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,
    platform        VARCHAR(50)     NOT NULL CHECK (platform IN ('zomato', 'swiggy', 'amazon', 'dunzo', 'other')),
    city            VARCHAR(100)    NOT NULL,
    zone            VARCHAR(100)    NOT NULL,           -- operational zone / pincode area
    avg_weekly_income NUMERIC(10,2) NOT NULL DEFAULT 0, -- self-reported or verified
    vehicle_type    VARCHAR(30)     CHECK (vehicle_type IN ('bicycle', 'motorcycle', 'scooter', 'car')),
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workers_city_zone ON workers(city, zone);
CREATE INDEX idx_workers_platform  ON workers(platform);

-- ============================================================
-- 2. RISK_ASSESSMENTS — AI-generated risk scores per worker
-- ============================================================
CREATE TABLE risk_assessments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    risk_score      NUMERIC(5,2)    NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_tier       VARCHAR(10)     NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
    -- Feature snapshot at assessment time
    rainfall_mm     NUMERIC(7,2),
    temperature_c   NUMERIC(5,2),
    aqi             INTEGER,
    traffic_index   NUMERIC(5,2),
    zone_history    JSONB,          -- historical disruption events in the zone
    model_version   VARCHAR(20)     NOT NULL DEFAULT 'v1.0',
    assessed_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_worker   ON risk_assessments(worker_id);
CREATE INDEX idx_risk_tier     ON risk_assessments(risk_tier);

-- ============================================================
-- 3. POLICIES — Weekly insurance policies purchased by workers
-- ============================================================
CREATE TABLE policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    risk_assessment_id UUID         NOT NULL REFERENCES risk_assessments(id),
    week_start      DATE            NOT NULL,
    week_end        DATE            NOT NULL,
    premium_amount  NUMERIC(10,2)   NOT NULL,           -- weekly premium in INR
    coverage_amount NUMERIC(10,2)   NOT NULL,           -- max payout for income loss
    status          VARCHAR(20)     NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'cancelled', 'claimed')),
    payment_id      VARCHAR(100),                       -- Razorpay payment reference
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_week_range CHECK (week_end = week_start + INTERVAL '6 days')
);

CREATE INDEX idx_policies_worker ON policies(worker_id);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_week   ON policies(week_start, week_end);

-- ============================================================
-- 4. PARAMETRIC_TRIGGERS — External disruption events
-- ============================================================
CREATE TABLE parametric_triggers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_type    VARCHAR(30)     NOT NULL
                    CHECK (trigger_type IN ('extreme_weather', 'high_aqi', 'curfew', 'zone_shutdown', 'flooding', 'heatwave')),
    city            VARCHAR(100)    NOT NULL,
    zone            VARCHAR(100)    NOT NULL,
    severity        VARCHAR(10)     NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    -- Trigger data
    data_snapshot   JSONB           NOT NULL,           -- raw API data that triggered the event
    threshold_met   TEXT            NOT NULL,            -- human-readable threshold description
    triggered_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ                          -- NULL if still active
);

CREATE INDEX idx_triggers_city_zone ON parametric_triggers(city, zone);
CREATE INDEX idx_triggers_type      ON parametric_triggers(trigger_type);
CREATE INDEX idx_triggers_time      ON parametric_triggers(triggered_at);

-- ============================================================
-- 5. CLAIMS — Automated insurance claims
-- ============================================================
CREATE TABLE claims (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id       UUID            NOT NULL REFERENCES policies(id),
    worker_id       UUID            NOT NULL REFERENCES workers(id),
    trigger_id      UUID            NOT NULL REFERENCES parametric_triggers(id),
    claim_amount    NUMERIC(10,2)   NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'flagged')),
    fraud_score     NUMERIC(5,2)    DEFAULT 0,          -- 0-100, set by fraud engine
    fraud_flags     JSONB,                               -- detailed fraud check results
    payout_ref      VARCHAR(100),                        -- Razorpay payout reference
    reviewed_by     UUID,                                -- admin who reviewed (if manual)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_claims_policy  ON claims(policy_id);
CREATE INDEX idx_claims_worker  ON claims(worker_id);
CREATE INDEX idx_claims_status  ON claims(status);

-- ============================================================
-- 6. FRAUD_LOGS — Audit trail for fraud detection decisions
-- ============================================================
CREATE TABLE fraud_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id        UUID            NOT NULL REFERENCES claims(id),
    worker_id       UUID            NOT NULL REFERENCES workers(id),
    check_type      VARCHAR(50)     NOT NULL,            -- 'gps_spoofing', 'duplicate_claim', 'fake_weather', etc.
    result          VARCHAR(10)     NOT NULL CHECK (result IN ('pass', 'flag', 'block')),
    confidence      NUMERIC(5,2)    NOT NULL,
    details         JSONB,
    checked_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_claim  ON fraud_logs(claim_id);
CREATE INDEX idx_fraud_worker ON fraud_logs(worker_id);

-- ============================================================
-- 7. PAYMENTS — All financial transactions
-- ============================================================
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id),
    type            VARCHAR(20)     NOT NULL CHECK (type IN ('premium', 'payout')),
    amount          NUMERIC(10,2)   NOT NULL,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'INR',
    razorpay_id     VARCHAR(100),
    razorpay_status VARCHAR(30),
    metadata        JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_worker ON payments(worker_id);
CREATE INDEX idx_payments_type   ON payments(type);

-- ============================================================
-- 8. ADMINS — Platform administrators
-- ============================================================
CREATE TABLE admins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(120)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'analyst'
                    CHECK (role IN ('super_admin', 'analyst', 'support')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. ZONE_WEATHER_CACHE — Cached external data for zones
-- ============================================================
CREATE TABLE zone_weather_cache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city            VARCHAR(100)    NOT NULL,
    zone            VARCHAR(100)    NOT NULL,
    temperature_c   NUMERIC(5,2),
    rainfall_mm     NUMERIC(7,2),
    humidity_pct    NUMERIC(5,2),
    wind_speed_kmh  NUMERIC(5,2),
    aqi             INTEGER,
    traffic_index   NUMERIC(5,2),
    fetched_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weather_cache_zone ON zone_weather_cache(city, zone);
CREATE INDEX idx_weather_cache_time ON zone_weather_cache(fetched_at);
