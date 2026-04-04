-- ============================================================
-- GigPredict AI — Dummy fraud-proof data
-- Use after schema.sql when you want a realistic proof-analysis demo.
-- ============================================================

INSERT INTO workers (
    id,
    full_name,
    email,
    phone,
    password_hash,
    platform,
    city,
    zone,
    avg_weekly_income,
    vehicle_type,
    is_verified
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Demo Worker',
    'demo.worker@gigpredict-ai.test',
    '9898989898',
    'demo-password-hash',
    'swiggy',
    'Bengaluru',
    'Koramangala',
    9200,
    'motorcycle',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_assessments (
    id,
    worker_id,
    risk_score,
    risk_tier,
    rainfall_mm,
    temperature_c,
    aqi,
    traffic_index,
    zone_history
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    64,
    'high',
    14,
    29,
    126,
    7.5,
    '{"recent_zone_floods": 1}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO policies (
    id,
    worker_id,
    risk_assessment_id,
    week_start,
    week_end,
    premium_amount,
    coverage_amount,
    status
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '3 days',
    199,
    3500,
    'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO parametric_triggers (
    id,
    trigger_type,
    city,
    zone,
    severity,
    data_snapshot,
    threshold_met
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'extreme_weather',
    'Bengaluru',
    'Koramangala',
    'high',
    '{"rainfall_mm": 18, "wind_kmh": 24}',
    'Rainfall crossed operational threshold'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO claims (
    id,
    policy_id,
    worker_id,
    trigger_id,
    claim_amount,
    status,
    fraud_score,
    fraud_flags
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    650,
    'pending',
    35,
    '{"seeded": true}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_trust_score (
    id,
    worker_id,
    score,
    total_claims,
    successful_claims,
    fraud_flags,
    history
) VALUES (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    58,
    7,
    5,
    1,
    '[{"timestamp":"2026-04-04T08:00:00Z","action":"SEEDED","score":58}]'
) ON CONFLICT (worker_id) DO NOTHING;

INSERT INTO work_sessions (
    id,
    worker_id,
    start_time,
    end_time,
    start_latitude,
    start_longitude,
    end_latitude,
    end_longitude,
    duration_minutes,
    status,
    distance_km,
    earnings_inr,
    orders_count
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '1 hour',
    12.9352,
    77.6245,
    12.9460,
    77.6362,
    180,
    'active',
    18,
    540,
    9
) ON CONFLICT (id) DO NOTHING;

INSERT INTO activity_logs (
    id,
    worker_id,
    timestamp,
    latitude,
    longitude,
    speed_kmh,
    motion_state,
    accuracy_meters,
    battery_pct,
    signal_strength,
    metadata
) VALUES
(
    '88888888-8888-8888-8888-888888888881',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '10 minutes',
    12.9358,
    77.6251,
    22,
    'DRIVING',
    8,
    78,
    -61,
    '{"source":"dummy"}'
),
(
    '88888888-8888-8888-8888-888888888882',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '4 minutes',
    12.9391,
    77.6298,
    12,
    'WALKING',
    7,
    77,
    -58,
    '{"source":"dummy"}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO proofs (
    id,
    user_id,
    claim_id,
    type,
    file_path,
    timestamp,
    lat,
    lng,
    metadata_json
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    'WORK_SCREEN',
    'uploads/proofs/demo-work-screen.png',
    NOW() - INTERVAL '2 minutes',
    12.9391,
    77.6298,
    '{"original_name":"demo-swiggy-active-order.png","is_live_capture":true}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO proof_analysis (
    id,
    proof_id,
    user_id,
    claim_id,
    ai_generated_probability,
    tampering_detected,
    duplicate_found,
    weather_mismatch,
    activity_valid,
    work_screen_valid,
    is_live_capture,
    fraud_score_delta,
    warning_reasons,
    analysis_json
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    18,
    FALSE,
    FALSE,
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    28,
    '[]',
    '{"decision":{"decision":"APPROVED","confidence":82,"fraud_score":28}}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO image_hashes (
    id,
    proof_id,
    user_id,
    claim_id,
    image_hash
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    'dummy-proof-hash-demo-001'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_detection_logs (
    id,
    proof_id,
    claim_id,
    detector_name,
    result_json
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999999',
    '55555555-5555-5555-5555-555555555555',
    'proof_analyzer',
    '{"ai_generated_probability":18,"tampering_detected":false,"duplicate_found":false}'
) ON CONFLICT (id) DO NOTHING;

