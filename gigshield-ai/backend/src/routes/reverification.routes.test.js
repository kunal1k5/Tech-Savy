const request = require("supertest");

const app = require("../app");
const { getDisputeById, resetDisputeStore, startDispute } = require("../services/dispute.service");
const { getFinalStatus } = require("../services/reverification.service");

describe("POST /api/reverify-claim", () => {
  beforeEach(() => {
    resetDisputeStore();
  });

  it("approves a claim when all proof checks match", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "geo-proof.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "active-order.png",
        contentType: "image/png",
      });

    const response = await request(app).post("/api/reverify-claim").send({
      disputeId: dispute.disputeId,
      claimTime: "14:00",
      userLocation: "Zone-A",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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

    expect(getDisputeById(dispute.disputeId)).toMatchObject({
      status: "APPROVED",
      verification: {
        finalStatus: "APPROVED",
        confidence: 85,
        score: 80,
        checks: {
          locationMatch: true,
          timeMatch: true,
          activityValid: true,
        },
      },
    });
  });

  it("rejects a claim when proof signals do not match", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "outside-old-proof.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "offline-screen.png",
        contentType: "image/png",
      });

    const response = await request(app).post("/api/reverify-claim").send({
      disputeId: dispute.disputeId,
      claimTime: "14:00",
      userLocation: "Zone-A",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        finalStatus: "REJECTED",
        confidence: 5,
        claimUpdate: {
          claimStatus: "REJECTED",
          payoutStatus: "BLOCKED",
          fraudStatus: "flagged",
        },
      },
      message: "Claim re-verification completed.",
    });
  });

  it("rejects a claim when location proof does not match even if activity looks valid", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "outside-proof.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "active-order.png",
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
          payoutStatus: "BLOCKED",
          fraudStatus: "flagged",
        },
      },
    });

    expect(getDisputeById(dispute.disputeId)).toMatchObject({
      verification: {
        checks: {
          locationMatch: false,
          activityValid: true,
        },
      },
    });
  });

  it("rejects a claim when activity proof is invalid even if location matches", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "geo-proof.png",
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
          payoutStatus: "BLOCKED",
          fraudStatus: "flagged",
        },
      },
    });

    expect(getDisputeById(dispute.disputeId)).toMatchObject({
      verification: {
        checks: {
          locationMatch: true,
          activityValid: false,
        },
      },
    });
  });

  it("hard-rejects when a critical proof check fails even if the score is otherwise high", () => {
    expect(
      getFinalStatus({
        score: 80,
        locationMatch: false,
        activityValid: true,
      })
    ).toBe("REJECTED");

    expect(
      getFinalStatus({
        score: 80,
        locationMatch: true,
        activityValid: false,
      })
    ).toBe("REJECTED");
  });

  it("requires uploaded proof before re-verification", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    const response = await request(app).post("/api/reverify-claim").send({
      disputeId: dispute.disputeId,
      claimTime: "14:00",
      userLocation: "Zone-A",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: {},
      message: "Handled safely",
    });
  });
});
