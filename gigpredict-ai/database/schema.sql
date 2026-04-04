-- ============================================================
-- GigPredict AI — Database Schema (PostgreSQL)
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

-- ============================================================
-- 10. ACTIVITY_LOGS — Real-time worker activity tracking
-- ============================================================
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    latitude        NUMERIC(10,8),
    longitude       NUMERIC(11,8),
    speed_kmh       NUMERIC(10,2),
    motion_state    VARCHAR(20)     NOT NULL DEFAULT 'IDLE'
                    CHECK (motion_state IN ('IDLE', 'WALKING', 'DRIVING')),
    accuracy_meters NUMERIC(10,2),
    battery_pct     INTEGER,
    signal_strength INTEGER,
    metadata        JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_worker ON activity_logs(worker_id);
CREATE INDEX idx_activity_timestamp ON activity_logs(timestamp);
CREATE INDEX idx_activity_location ON activity_logs(worker_id, timestamp);

-- ============================================================
-- 11. WORK_SESSIONS — Tracked work periods
-- ============================================================
CREATE TABLE work_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    start_time      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    end_time        TIMESTAMPTZ,
    start_latitude  NUMERIC(10,8),
    start_longitude NUMERIC(11,8),
    end_latitude    NUMERIC(10,8),
    end_longitude   NUMERIC(11,8),
    duration_minutes INTEGER,
    status          VARCHAR(20)     DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    distance_km     NUMERIC(10,2),
    earnings_inr    NUMERIC(10,2),
    orders_count    INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_worker ON work_sessions(worker_id);
CREATE INDEX idx_session_time ON work_sessions(start_time, end_time);
CREATE INDEX idx_session_status ON work_sessions(status);

-- ============================================================
-- 12. USER_TRUST_SCORE — Dynamic reputation system
-- ============================================================
CREATE TABLE user_trust_score (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
    score           NUMERIC(5,2)    NOT NULL DEFAULT 50
                    CHECK (score BETWEEN 0 AND 100),
    total_claims    INTEGER         DEFAULT 0,
    successful_claims INTEGER       DEFAULT 0,
    fraud_flags     INTEGER         DEFAULT 0,
    last_updated    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    history         JSONB,          -- audit trail of score changes
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_worker ON user_trust_score(worker_id);
CREATE INDEX idx_trust_score ON user_trust_score(score DESC);

-- ============================================================
-- 13. ANOMALY_LOGS — Anomaly detection audit
-- ============================================================
CREATE TABLE anomaly_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    claim_id        UUID            REFERENCES claims(id) ON DELETE CASCADE,
    anomaly_score   NUMERIC(5,2)    NOT NULL DEFAULT 0
                    CHECK (anomaly_score BETWEEN 0 AND 100),
    anomaly_type    VARCHAR(50),    -- 'high_frequency', 'location_cluster', 'behavior_change'
    conditions      JSONB,          -- which conditions triggered
    severity        VARCHAR(10)     CHECK (severity IN ('low', 'medium', 'high')),
    detected_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomaly_worker ON anomaly_logs(worker_id);
CREATE INDEX idx_anomaly_claim ON anomaly_logs(claim_id);
CREATE INDEX idx_anomaly_severity ON anomaly_logs(severity);

-- ============================================================
-- 14. FRAUD_FLAGS — Detailed fraud detection log
-- ============================================================
CREATE TABLE fraud_flags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    claim_id        UUID            REFERENCES claims(id) ON DELETE CASCADE,
    flag_type       VARCHAR(50)     NOT NULL,  -- 'gps_mismatch', 'inactive_during_claim', 'high_frequency', etc.
    flag_value      NUMERIC(5,2)    NOT NULL,  -- score contribution (0-100)
    flag_reason     TEXT,
    confidence      NUMERIC(5,2),
    details         JSONB,
    flagged_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flag_worker ON fraud_flags(worker_id);
CREATE INDEX idx_flag_claim ON fraud_flags(claim_id);
CREATE INDEX idx_flag_type ON fraud_flags(flag_type);

-- ============================================================
-- 15. PROOF_UPLOADS — File metadata and validation
-- ============================================================
CREATE TABLE proof_uploads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id        UUID            NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    worker_id       UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    file_type       VARCHAR(30)     NOT NULL CHECK (file_type IN ('screenshot', 'photo', 'video')),
    file_path       TEXT            NOT NULL,
    file_size       INTEGER,
    file_hash       VARCHAR(255),
    upload_timestamp TIMESTAMPTZ,
    location_latitude NUMERIC(10,8),
    location_longitude NUMERIC(11,8),
    metadata        JSONB,
    validation_status VARCHAR(20) DEFAULT 'pending'
                    CHECK (validation_status IN ('pending', 'valid', 'invalid', 'flagged')),
    validation_details JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proof_claim ON proof_uploads(claim_id);
CREATE INDEX idx_proof_worker ON proof_uploads(worker_id);
CREATE INDEX idx_proof_validation ON proof_uploads(validation_status);

-- ============================================================
-- 16. PROOFS — Structured fraud-proof uploads
-- ============================================================
CREATE TABLE proofs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    claim_id        UUID            NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    type            VARCHAR(30)     NOT NULL
                    CHECK (type IN ('PARCEL', 'SELFIE', 'WORK_SCREEN')),
    file_path       TEXT            NOT NULL,
    timestamp       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    lat             NUMERIC(10,8),
    lng             NUMERIC(11,8),
    metadata_json   JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proofs_user ON proofs(user_id);
CREATE INDEX idx_proofs_claim ON proofs(claim_id);
CREATE INDEX idx_proofs_type ON proofs(type);

-- ============================================================
-- 17. PROOF_ANALYSIS — Fraud scoring per proof artifact
-- ============================================================
CREATE TABLE proof_analysis (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proof_id                UUID            NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
    user_id                 UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    claim_id                UUID            NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    ai_generated_probability NUMERIC(5,2)   DEFAULT 0,
    tampering_detected      BOOLEAN         NOT NULL DEFAULT FALSE,
    duplicate_found         BOOLEAN         NOT NULL DEFAULT FALSE,
    weather_mismatch        BOOLEAN         NOT NULL DEFAULT FALSE,
    activity_valid          BOOLEAN         NOT NULL DEFAULT TRUE,
    work_screen_valid       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_live_capture         BOOLEAN         NOT NULL DEFAULT TRUE,
    fraud_score_delta       NUMERIC(6,2)    DEFAULT 0,
    warning_reasons         JSONB,
    analysis_json           JSONB,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proof_analysis_proof ON proof_analysis(proof_id);
CREATE INDEX idx_proof_analysis_claim ON proof_analysis(claim_id);
CREATE INDEX idx_proof_analysis_risk ON proof_analysis(ai_generated_probability DESC, fraud_score_delta DESC);

-- ============================================================
-- 18. IMAGE_HASHES — Duplicate proof detection
-- ============================================================
CREATE TABLE image_hashes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proof_id        UUID            NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    claim_id        UUID            NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    image_hash      VARCHAR(128)    NOT NULL,
    perceptual_hash VARCHAR(128),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_image_hashes_hash ON image_hashes(image_hash);
CREATE INDEX idx_image_hashes_user ON image_hashes(user_id, created_at DESC);

-- ============================================================
-- 19. AI_DETECTION_LOGS — Detector outputs for auditability
-- ============================================================
CREATE TABLE ai_detection_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proof_id        UUID            NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
    claim_id        UUID            NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    detector_name   VARCHAR(50)     NOT NULL,
    result_json     JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_detection_logs_proof ON ai_detection_logs(proof_id);
CREATE INDEX idx_ai_detection_logs_claim ON ai_detection_logs(claim_id);
CREATE INDEX idx_ai_detection_logs_detector ON ai_detection_logs(detector_name, created_at DESC);

