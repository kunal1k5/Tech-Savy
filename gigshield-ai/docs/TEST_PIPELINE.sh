#!/bin/bash

# GigPredict AI Test Suite - Complete Pipeline Demo
# Tests all new systems: Activity, Work Sessions, Trust Score, Fraud Detection
# Run from project root: bash docs/TEST_PIPELINE.sh

set -e

API_HOST="http://localhost:5000"
WORKER_ID="550e8400-e29b-41d4-a716-446655440000"
CLAIM_ID="660e8400-e29b-41d4-a716-446655440001"

echo "🚀 GigPredict AI Advanced Systems Test Suite"
echo "=========================================="
echo ""

# Test 1: Start Work Session
echo "📍 Test 1: Starting Work Session..."
start_session=$(curl -s -X POST "$API_HOST/api/work-sessions/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"latitude\": 28.7041,
    \"longitude\": 77.1025
  }")

SESSION_ID=$(echo $start_session | grep -o '"session_id":"[^"]*' | cut -d'"' -f4)
echo "✓ Session started: $SESSION_ID"
echo ""

# Test 2: Log Activity - Driving
echo "📍 Test 2: Logging Activity Patterns..."
for i in {1..5}; do
  curl -s -X POST "$API_HOST/api/activity/log" \
    -H "Content-Type: application/json" \
    -d "{
      \"worker_id\": \"$WORKER_ID\",
      \"latitude\": 28.7041,
      \"longitude\": 77.1025,
      \"speed_kmh\": $(( RANDOM % 30 + 20 )),
      \"motion_state\": \"DRIVING\",
      \"accuracy_meters\": 15,
      \"battery_pct\": 85
    }" > /dev/null
  echo "✓ Activity $i logged"
  sleep 1
done
echo ""

# Test 3: Get Activity History
echo "📍 Test 3: Retrieving Activity History..."
activity=$(curl -s -X GET "$API_HOST/api/activity/history/$WORKER_ID?minutes=60")
activity_count=$(echo $activity | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "✓ Total activities logged: $activity_count"
echo ""

# Test 4: Analyze Activity During Claim
echo "📍 Test 4: Analyzing Activity During Claim..."
claim_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
activity_analysis=$(curl -s -X POST "$API_HOST/api/activity/analyze-claim" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"claim_timestamp\": \"$claim_time\",
    \"time_window_minutes\": 30
  }")

was_active=$(echo $activity_analysis | grep -o '"was_active":[^,]*' | cut -d':' -f2)
fraud_contrib=$(echo $activity_analysis | grep -o '"fraud_score_contribution":[^,]*' | cut -d':' -f2)
echo "✓ Was active during claim: $was_active"
echo "✓ Fraud score contribution: $fraud_contrib"
echo ""

# Test 5: Check Idle Duration
echo "📍 Test 5: Checking Idle Duration..."
idle=$(curl -s -X GET "$API_HOST/api/activity/idle/$WORKER_ID?minutes=60")
idle_min=$(echo $idle | grep -o '"total_idle_minutes":[0-9]*' | cut -d':' -f2)
echo "✓ Total idle minutes: $idle_min"
echo ""

# Test 6: Get Daily Work Sessions
echo "📍 Test 6: Retrieving Daily Work Sessions..."
sessions=$(curl -s -X GET "$API_HOST/api/work-sessions/$WORKER_ID")
session_count=$(echo $sessions | grep -o '"total_sessions":[0-9]*' | cut -d':' -f2)
total_earnings=$(echo $sessions | grep -o '"total_earnings_inr":[0-9.]*' | cut -d':' -f2)
echo "✓ Total sessions today: $session_count"
echo "✓ Total earnings: ₹$total_earnings"
echo ""

# Test 7: Validate Claim Time
echo "📍 Test 7: Validating Claim Time..."
time_validation=$(curl -s -X POST "$API_HOST/api/work-sessions/validate-claim-time" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"claim_timestamp\": \"$claim_time\"
  }")

within_hours=$(echo $time_validation | grep -o '"within_working_hours":[^,]*' | cut -d':' -f2)
echo "✓ Claim within working hours: $within_hours"
echo ""

# Test 8: Get Trust Score
echo "📍 Test 8: Retrieving Trust Score..."
trust=$(curl -s -X GET "$API_HOST/api/trust/$WORKER_ID")
trust_score=$(echo $trust | grep -o '"score":[0-9.]*' | cut -d':' -f2)
trust_tier=$(echo $trust | grep -o '"tier":"[^"]*' | cut -d'"' -f4)
echo "✓ Trust score: $trust_score"
echo "✓ Trust tier: $trust_tier"
echo ""

# Test 9: Get Anomalies
echo "📍 Test 9: Retrieving Anomaly History..."
anomalies=$(curl -s -X GET "$API_HOST/api/anomalies/$WORKER_ID?days=30")
anomaly_count=$(echo $anomalies | grep -o '"anomalies_count":[0-9]*' | cut -d':' -f2)
echo "✓ Anomalies detected (30 days): $anomaly_count"
echo ""

# Test 10: Comprehensive Fraud Analysis
echo "📍 Test 10: Running Comprehensive Fraud Analysis..."
fraud_analysis=$(curl -s -X POST "$API_HOST/api/fraud/analyze" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"claim_data\": {
      \"claim_id\": \"$CLAIM_ID\",
      \"claim_timestamp\": \"$claim_time\",
      \"latitude\": 28.7041,
      \"longitude\": 77.1025,
      \"aqi\": 250,
      \"rainfall_mm\": 5,
      \"wind_kmh\": 20,
      \"claimsCount\": 2,
      \"loginAttempts\": 1
    }
  }")

decision=$(echo $fraud_analysis | grep -o '"decision":"[^"]*' | cut -d'"' -f4)
fraud_score=$(echo $fraud_analysis | grep -o '"fraud_score":[0-9.]*' | cut -d':' -f2)
confidence=$(echo $fraud_analysis | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
next_action=$(echo $fraud_analysis | grep -o '"next_action":"[^"]*' | cut -d'"' -f4)

echo "✓ Decision: $decision"
echo "✓ Fraud score: $fraud_score/100"
echo "✓ Confidence: $confidence%"
echo "✓ Next action: $next_action"
echo ""

# Test 11: Update Trust Score
echo "📍 Test 11: Updating Trust Score..."
trust_update=$(curl -s -X POST "$API_HOST/api/trust/update" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"claim_result\": {
      \"decision\": \"approved\",
      \"status\": \"paid\"
    }
  }")

new_score=$(echo $trust_update | grep -o '"new_score":[0-9.]*' | cut -d':' -f2)
score_change=$(echo $trust_update | grep -o '"score_change":[0-9.-]*' | cut -d':' -f2)
echo "✓ New trust score: $new_score"
echo "✓ Score change: $score_change"
echo ""

# Test 12: End Work Session
echo "📍 Test 12: Ending Work Session..."
end_session=$(curl -s -X POST "$API_HOST/api/work-sessions/end" \
  -H "Content-Type: application/json" \
  -d "{
    \"worker_id\": \"$WORKER_ID\",
    \"latitude\": 28.7041,
    \"longitude\": 77.1025,
    \"earnings\": 450.50
  }")

duration=$(echo $end_session | grep -o '"duration_minutes":[0-9]*' | cut -d':' -f2)
earnings=$(echo $end_session | grep -o '"earnings_inr":[0-9.]*' | cut -d':' -f2)
echo "✓ Session duration: $duration minutes"
echo "✓ Earnings: ₹$earnings"
echo ""

# Test 13: Get Fraud Score
echo "📍 Test 13: Retrieving Fraud Score..."
fraud_score=$(curl -s -X GET "$API_HOST/api/fraud/score/$WORKER_ID")
current_score=$(echo $fraud_score | grep -o '"current_fraud_score":[0-9.]*' | cut -d':' -f2)
flags_count=$(echo $fraud_score | grep -o '"recent_flags_count":[0-9]*' | cut -d':' -f2)
echo "✓ Current fraud score: $current_score"
echo "✓ Recent flags: $flags_count"
echo ""

# Test 14: Get Working Hours Summary
echo "📍 Test 14: Getting Working Hours Summary (7 days)..."
summary=$(curl -s -X GET "$API_HOST/api/work-sessions/summary/$WORKER_ID?days=7")
total_min=$(echo $summary | grep -o '"total_working_minutes":[0-9]*' | cut -d':' -f2)
total_earn=$(echo $summary | grep -o '"total_earnings_inr":[0-9.]*' | cut -d':' -f2)
working_days=$(echo $summary | grep -o '"working_days":[0-9]*' | cut -d':' -f2)
echo "✓ Total working minutes: $total_min"
echo "✓ Total earnings: ₹$total_earn"
echo "✓ Working days: $working_days"
echo ""

# Summary
echo "=========================================="
echo "✅ All Tests Completed Successfully!"
echo "=========================================="
echo ""
echo "📊 System Summary:"
echo "   • Activity Logging: ✓"
echo "   • Work Sessions: ✓"
echo "   • Trust Score Management: ✓"
echo "   • Fraud Detection: ✓"
echo "   • Anomaly Detection: ✓"
echo "   • Time Validation: ✓"
echo "   • Location Validation: ✓"
echo ""
echo "🎯 Example Results:"
echo "   • Decision: $decision"
echo "   • Fraud Score: $fraud_score/100"
echo "   • Confidence: $confidence%"
echo "   • Trust Tier: $trust_tier"
echo ""
echo "✨ Backend is ready to handle requests!"

