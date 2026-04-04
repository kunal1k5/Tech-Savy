const request = require("supertest");

const app = require("../app");
const SessionStoreService = require("../services/demoStore.service");
const { resetDisputeStore, startDispute } = require("../services/dispute.service");

describe("Final QA audit", () => {
  beforeEach(() => {
    SessionStoreService.resetDemoStore();
    resetDisputeStore();
  });

  async function registerWorkerAndGetToken() {
    const response = await request(app).post("/api/auth/register").send({
      fullName: "QA Worker",
      phone: "9998887776",
      city: "Bengaluru",
      zone: "Koramangala",
      platform: "Swiggy",
      weeklyIncome: 22000,
    });

    return response.body.data.token;
  }

  it("handles extreme auto-claim values without crashing and sanitizes the response", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: "true",
      ordersCompleted: 999999999,
      duration: 999999999,
      earnings: -999999,
      hoursLost: -999999,
      hourlyRate: 999999999,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        hoursLost: 0,
        hourlyRate: 100000,
        ordersCompleted: 100000,
        duration: 100000,
        earnings: 0,
      },
    });
    expect(typeof response.body.data.claimTriggered).toBe("boolean");
  });

  it("handles empty input safely without crashing", async () => {
    const response = await request(app).post("/api/auto-claim").send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        isWorking: false,
        incomeLoss: false,
      },
    });
  });

  it("blocks spam clicks on claim trigger with cooldown protection", async () => {
    const token = await registerWorkerAndGetToken();

    const firstResponse = await request(app)
      .post("/api/claim/trigger")
      .set("Authorization", `Bearer ${token}`)
      .send({ rainfall: 60 });

    const secondResponse = await request(app)
      .post("/api/claim/trigger")
      .set("Authorization", `Bearer ${token}`)
      .send({ rainfall: 60 });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.body).toMatchObject({
      success: false,
      data: {
        blocked: true,
        triggered: false,
        cooldown: {
          active: true,
        },
      },
    });
  });

  it("rejects fake proof uploads with failing location and activity validation", async () => {
    const response = await request(app)
      .post("/api/upload-proof")
      .field("user_id", "qa-demo-user")
      .field("claim_id", "qa-claim-1")
      .field("proof_type", "SELFIE")
      .field("city", "Bengaluru")
      .field("zone", "Central")
      .field("latitude", "28.6139")
      .field("longitude", "77.2090")
      .attach("file", Buffer.from("qa-fake-proof"), {
        filename: "idle-ai-fake-selfie.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        locationMatch: false,
        activityValid: false,
        decision: {
          decision: "REJECTED",
        },
      },
    });
  });

  it("keeps the dispute proof review flow stable for fake uploads", async () => {
    const dispute = startDispute({
      userId: "qa-user",
      reason: "Final QA fake proof review",
    });

    await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "outside-proof.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "inactive-screen.png",
        contentType: "image/png",
      });

    const response = await request(app).post("/api/reverify-claim").send({
      disputeId: dispute.disputeId,
      claimTime: "14:00",
      userLocation: "Zone-A",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        finalStatus: "REJECTED",
        claimUpdate: {
          claimStatus: "REJECTED",
        },
      },
    });
  });
});
