/**
 * Dummy Data Generation Script
 *
 * Generates realistic test data:
 * - 100+ workers
 * - Activity logs with motion patterns
 * - Work sessions
 * - Trust scores
 * - Claims with various fraud patterns
 * - Anomaly data
 */

const { v4: uuidv4 } = require("uuid");
const db = require("./database/connection");

// Cities and zones
const CITIES = ["Delhi", "Bangalore", "Mumbai", "Hyderabad", "Chennai"];
const ZONES = ["North", "South", "East", "West", "Central"];

// Platforms
const PLATFORMS = ["zomato", "swiggy", "amazon", "dunzo", "other"];
const VEHICLE_TYPES = ["bicycle", "motorcycle", "scooter", "car"];

// Motion states for realistic patterns
const MOTION_SEQUENCES = {
  NORMAL_WORK: ["DRIVING", "DRIVING", "IDLE", "DRIVING", "WALKING", "DRIVING"],
  SUSPICIOUS: ["IDLE", "IDLE", "IDLE", "IDLE", "IDLE"],
  ACTIVE: ["DRIVING", "DRIVING", "WALKING", "DRIVING", "DRIVING"],
};

/**
 * Generate random worker
 */
function generateWorker(index) {
  return {
    id: uuidv4(),
    full_name: `Worker ${index} ${Math.random().toString(36).substr(2, 9)}`,
    email: `worker${index}@gigpredict-ai.test`,
    phone: `98${Math.random().toString().substring(2, 12)}`,
    password_hash: "$2a$10$" + Math.random().toString(36).substr(2, 50), // dummy hash
    platform: PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)],
    city: CITIES[Math.floor(Math.random() * CITIES.length)],
    zone: ZONES[Math.floor(Math.random() * ZONES.length)],
    avg_weekly_income: Math.random() * 5000 + 5000, // 5k-10k
    vehicle_type: VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)],
    is_verified: Math.random() > 0.3, // 70% verified
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updated_at: new Date(),
  };
}

/**
 * Generate activity logs for a worker
 */
function generateActivityLogs(workerId, count = 50) {
  const activities = [];
  const now = Date.now();

  // Pick a pattern
  const patterns = Object.values(MOTION_SEQUENCES);
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 60 * 1000); // 1 activity per minute
    const patternMotion = pattern[i % pattern.length];

    let speed = 0;
    if (patternMotion === "DRIVING") speed = Math.random() * 40 + 20; // 20-60 kmh
    else if (patternMotion === "WALKING") speed = Math.random() * 5 + 3; // 3-8 kmh
    // IDLE = 0

    activities.push({
      id: uuidv4(),
      worker_id: workerId,
      timestamp,
      latitude: 28.7041 + (Math.random() - 0.5) * 0.1, // Delhi ± 0.05
      longitude: 77.1025 + (Math.random() - 0.5) * 0.1,
      speed_kmh: speed,
      motion_state: patternMotion,
      accuracy_meters: Math.random() * 20 + 5,
      battery_pct: Math.random() * 30 + 70, // 70-100%
      signal_strength: -50 + Math.random() * 30, // -80 to -50 dBm
    });
  }

  return activities;
}

/**
 * Generate work sessions
 */
function generateWorkSessions(workerId, count = 7) {
  const sessions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const daysAgo = count - i;
    const startTime = new Date(now - daysAgo * 24 * 60 * 60 * 1000 + Math.random() * 3600000);
    const durationMinutes = Math.random() * 240 + 120; // 2-6 hours
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    sessions.push({
      id: uuidv4(),
      worker_id: workerId,
      start_time: startTime,
      end_time: endTime,
      start_latitude: 28.7041 + (Math.random() - 0.5) * 0.1,
      start_longitude: 77.1025 + (Math.random() - 0.5) * 0.1,
      end_latitude: 28.7041 + (Math.random() - 0.5) * 0.1,
      end_longitude: 77.1025 + (Math.random() - 0.5) * 0.1,
      duration_minutes: Math.round(durationMinutes),
      status: "completed",
      distance_km: Math.random() * 50 + 10,
      earnings_inr: Math.random() * 800 + 200,
      orders_count: Math.floor(Math.random() * 20 + 5),
    });
  }

  return sessions;
}

/**
 * Generate trust score
 */
function generateTrustScore(workerId) {
  const score = Math.random() * 100;
  const totalClaims = Math.floor(Math.random() * 20 + 5);
  const fraudFlags = Math.floor(Math.random() * 3);
  const successfulClaims = totalClaims - fraudFlags;

  const history = [
    {
      timestamp: new Date().toISOString(),
      action: "INITIALIZED",
      score: 50,
      reason: "New registration",
    },
  ];

  for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
    history.push({
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      action: "CLAIM_PROCESSED",
      previous_score: score,
      new_score: score + Math.random() * 10 - 5,
      reason: Math.random() > 0.5 ? "Good claim" : "Fraud detected",
    });
  }

  return {
    id: uuidv4(),
    worker_id: workerId,
    score: score,
    total_claims: totalClaims,
    successful_claims: successfulClaims,
    fraud_flags: fraudFlags,
    history: JSON.stringify(history),
    created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    last_updated: new Date(),
  };
}

/**
 * Generate anomaly logs
 */
function generateAnomalyLogs(workerId, count = 3) {
  const anomalies = [];
  const types = ["high_frequency", "location_cluster", "behavior_change"];

  for (let i = 0; i < count; i++) {
    anomalies.push({
      id: uuidv4(),
      worker_id: workerId,
      claim_id: null,
      anomaly_score: Math.random() * 50 + 30, // 30-80
      anomaly_type: types[Math.floor(Math.random() * types.length)],
      conditions: JSON.stringify({
        reason: "Test anomaly",
        timestamp: new Date(),
      }),
      severity: Math.random() > 0.5 ? "high" : "medium",
      detected_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
    });
  }

  return anomalies;
}

/**
 * Seed database all data
 */
async function seedDatabase(workerCount = 100) {
  try {
    console.log("🌱 Starting database seeding...");
    console.log(`📊 Generating ${workerCount} workers with activity data...`);

    // Truncate existing data
    const tables = [
      "activity_logs",
      "work_sessions",
      "user_trust_score",
      "anomaly_logs",
      "fraud_flags",
      "workers",
    ];

    for (const table of tables) {
      try {
        await db(table).del();
        console.log(`✓ Cleared ${table}`);
      } catch (e) {
        console.log(`⚠ Could not clear ${table} (might not exist)`);
      }
    }

    // Generate workers
    const workers = [];
    for (let i = 1; i <= workerCount; i++) {
      workers.push(generateWorker(i));
    }

    await db("workers").insert(workers);
    console.log(`✓ Inserted ${workers.length} workers`);

    // For each worker, generate activity and work data
    const batchSize = 10;
    for (let i = 0; i < workers.length; i += batchSize) {
      const batch = workers.slice(i, i + batchSize);

      for (const worker of batch) {
        // Activity logs
        const activities = generateActivityLogs(worker.id, 100);
        await db("activity_logs").insert(activities);

        // Work sessions
        const sessions = generateWorkSessions(worker.id, 7);
        await db("work_sessions").insert(sessions);

        // Trust score
        const trust = generateTrustScore(worker.id);
        await db("user_trust_score").insert(trust);

        // Anomalies
        const anomalies = generateAnomalyLogs(worker.id, 2);
        await db("anomaly_logs").insert(anomalies);

        console.log(`✓ Generated data for worker ${i + 1}/${workers.length}`);
      }
    }

    console.log("\n✅ Database seeding completed successfully!");
    console.log("\n📈 Summary:");
    console.log(`   - Workers: ${workers.length}`);
    console.log(`   - Activity logs: ${workers.length * 100}`);
    console.log(`   - Work sessions: ${workers.length * 7}`);
    console.log(`   - Trust scores: ${workers.length}`);
    console.log(`   - Anomalies: ${workers.length * 2}`);

  } catch (error) {
    console.error("❌ Seeding error:", error.message);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run if called directly
if (require.main === module) {
  const workerCount = parseInt(process.argv[2]) || 100;
  seedDatabase(workerCount)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  generateWorker,
  generateActivityLogs,
  generateWorkSessions,
  generateTrustScore,
  generateAnomalyLogs,
  seedDatabase,
};

