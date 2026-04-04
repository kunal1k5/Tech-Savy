const request = require("supertest");

const app = require("../app");
const { resetDisputeStore } = require("../services/dispute.service");

describe("GigPredict AI workflow audit", () => {
  beforeEach(() => {
    resetDisputeStore();
  });

  it("runs the full decision, dispute, upload, and re-verification flow", async () => {
    const riskPremiumResponse = await request(app).post("/api/risk-premium").send({
      aqi: 340,
      rain: 24,
      wind: 35,
    });

    expect(riskPremiumResponse.status).toBe(200);
    expect(riskPremiumResponse.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        premium: 30,
        riskReason: "AQI above 300 + rain above 20 mm + wind above 30 km/h",
        reason: "AQI above 300 + rain above 20 mm + wind above 30 km/h",
      },
      message: "Risk and premium calculated successfully.",
    });

    const autoClaimResponse = await request(app).post("/api/auto-claim").send({
      risk: riskPremiumResponse.body.data.risk,
      isWorking: true,
      ordersCompleted: 0,
      workingMinutes: 180,
      earnings: 0,
      hoursLost: 3,
      hourlyRate: 150,
    });

    expect(autoClaimResponse.status).toBe(200);
    expect(autoClaimResponse.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: true,
        payout: 450,
        status: "PAID",
        incomeLoss: true,
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work confirmed + no orders completed + duration above 30 minutes",
        reason:
          "Risk level is HIGH + active work confirmed + no orders completed + duration above 30 minutes",
      },
    });

    const fraudResponse = await request(app).post("/api/fraud-check").send({
      risk: riskPremiumResponse.body.data.risk,
      locationMatch: false,
      claimsCount: 4,
      loginAttempts: 5,
      contextValid: false,
    });

    expect(fraudResponse.status).toBe(200);
    expect(fraudResponse.body).toMatchObject({
      success: true,
      data: {
        status: "FRAUD",
        fraudScore: 110,
        riskReason: "Risk level is HIGH",
        fraudReason:
          "high claim frequency + excessive login attempts + location mismatch + invalid context",
        reason:
          "Risk level is HIGH + high claim frequency + excessive login attempts + location mismatch + invalid context",
      },
    });

    const aiDecisionResponse = await request(app).post("/api/ai-decision").send({
      aqi: 340,
      rain: 24,
      wind: 35,
      claimsCount: 4,
      loginAttempts: 5,
      locationMatch: false,
      contextValid: false,
    });

    expect(aiDecisionResponse.status).toBe(200);
    expect(aiDecisionResponse.body).toMatchObject({
      success: true,
      data: {
        risk: "HIGH",
        decision: "FRAUD",
        nextAction: "REJECT_CLAIM",
        riskReason: "AQI above 300 + rain above 20 mm + wind above 30 km/h",
        fraudReason:
          "high claim frequency + excessive login attempts + location mismatch + invalid context",
        reason:
          "AQI above 300 + rain above 20 mm + wind above 30 km/h + high claim frequency + excessive login attempts + location mismatch + invalid context",
      },
    });

    const disputeResponse = await request(app).post("/api/start-dispute").send({
      userId: "worker-123",
      reason: "System failed to detect actual issue",
    });

    expect(disputeResponse.status).toBe(201);
    expect(disputeResponse.body).toEqual({
      success: true,
      data: {
        disputeId: "D1001",
        status: "INITIATED",
      },
      message: "Dispute started successfully.",
    });

    const uploadResponse = await request(app)
      .post("/api/upload-proof")
      .field("disputeId", disputeResponse.body.data.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "geo-proof.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "active-order.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body).toEqual({
      success: true,
      data: {
        status: "RECEIVED",
      },
      message: "Proof uploaded successfully.",
    });

    const reverificationResponse = await request(app).post("/api/reverify-claim").send({
      disputeId: disputeResponse.body.data.disputeId,
      claimTime: "14:00",
      userLocation: "Zone-A",
    });

    expect(reverificationResponse.status).toBe(200);
    expect(reverificationResponse.body).toEqual({
      success: true,
      data: {
        finalStatus: "APPROVED",
        confidence: 85,
        claimUpdate: {
          claimStatus: "PAID",
          payoutStatus: "PAYOUT_RELEASED",
          fraudStatus: "verified",
        },
      },
      message: "Claim re-verification completed.",
    });
  });
});

