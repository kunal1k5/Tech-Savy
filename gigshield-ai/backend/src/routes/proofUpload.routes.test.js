const request = require("supertest");

const app = require("../app");
const { getDisputeById, resetDisputeStore, startDispute } = require("../services/dispute.service");

describe("POST /api/upload-proof", () => {
  beforeEach(() => {
    resetDisputeStore();
  });

  it("receives proof images for an existing dispute", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    const response = await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId)
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "geo.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "work.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "RECEIVED",
      },
      message: "Proof uploaded successfully.",
    });

    expect(getDisputeById(dispute.disputeId)).toMatchObject({
      status: "RECEIVED",
      proof: {
        status: "RECEIVED",
        geoImage: {
          originalName: "geo.png",
          mimeType: "image/png",
        },
        workScreenshot: {
          originalName: "work.png",
          mimeType: "image/png",
        },
      },
    });
  });

  it("rejects uploads when files are missing", async () => {
    const dispute = startDispute({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    const response = await request(app)
      .post("/api/upload-proof")
      .field("disputeId", dispute.disputeId);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: {},
      message: "Handled safely",
    });
  });

  it("rejects uploads for unknown disputes", async () => {
    const response = await request(app)
      .post("/api/upload-proof")
      .field("disputeId", "D9999")
      .attach("geoImage", Buffer.from("geo-image"), {
        filename: "geo.png",
        contentType: "image/png",
      })
      .attach("workScreenshot", Buffer.from("work-image"), {
        filename: "work.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      data: {},
      message: "Handled safely",
    });
  });

  it("runs automated claim-proof analysis for single proof uploads", async () => {
    const response = await request(app)
      .post("/api/upload-proof")
      .field("user_id", "demo-user-1")
      .field("claim_id", "claim-demo-1")
      .field("proof_type", "SELFIE")
      .field("latitude", "12.9716")
      .field("longitude", "77.5946")
      .attach("file", Buffer.from("demo-selfie-proof"), {
        filename: "live-selfie-outdoor.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: "RECEIVED",
      proof_type: "SELFIE",
      locationMatch: true,
      activityValid: true,
      warning: false,
      decision: expect.objectContaining({
        decision: expect.any(String),
        confidence: expect.any(Number),
        fraud_score: expect.any(Number),
      }),
      analysis: expect.objectContaining({
        image_validation: expect.any(Object),
        location_validation: expect.objectContaining({
          match: true,
        }),
        weather_validation: expect.any(Object),
        activity_validation: expect.any(Object),
      }),
    });
  });

  it("rejects uploaded proof when the proof location does not match the claim area", async () => {
    const response = await request(app)
      .post("/api/upload-proof")
      .field("user_id", "demo-user-3")
      .field("claim_id", "claim-demo-3")
      .field("proof_type", "SELFIE")
      .field("city", "Bengaluru")
      .field("zone", "Central")
      .field("latitude", "28.6139")
      .field("longitude", "77.2090")
      .attach("file", Buffer.from("demo-selfie-proof"), {
        filename: "live-selfie-outdoor.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      locationMatch: false,
      activityValid: true,
      reasons: expect.arrayContaining(["Proof location mismatch"]),
      decision: expect.objectContaining({
        decision: "REJECTED",
      }),
      analysis: expect.objectContaining({
        location_validation: expect.objectContaining({
          checked: true,
          match: false,
        }),
      }),
    });
  });

  it("rejects uploaded proof when the worker activity is invalid", async () => {
    const response = await request(app)
      .post("/api/upload-proof")
      .field("user_id", "demo-user-4")
      .field("claim_id", "claim-demo-4")
      .field("proof_type", "SELFIE")
      .field("city", "Bengaluru")
      .field("zone", "Central")
      .field("latitude", "12.9716")
      .field("longitude", "77.5946")
      .attach("file", Buffer.from("demo-selfie-proof"), {
        filename: "idle-selfie-proof.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      locationMatch: true,
      activityValid: false,
      reasons: expect.arrayContaining([
        "User inactive during claim",
        "Claim outside active work hours",
      ]),
      decision: expect.objectContaining({
        decision: "REJECTED",
      }),
      analysis: expect.objectContaining({
        activity_validation: expect.objectContaining({
          was_active: false,
          within_working_hours: false,
        }),
      }),
    });
  });

  it("flags duplicate and suspicious uploads through fallback heuristics", async () => {
    const suspiciousBuffer = Buffer.from("duplicate-proof-buffer");

    await request(app)
      .post("/api/upload-proof")
      .field("user_id", "demo-user-2")
      .field("claim_id", "claim-demo-2")
      .field("proof_type", "PARCEL")
      .attach("file", suspiciousBuffer, {
        filename: "parcel-base.png",
        contentType: "image/png",
      });

    const response = await request(app)
      .post("/api/upload-proof")
      .field("user_id", "demo-user-2")
      .field("claim_id", "claim-demo-2")
      .field("proof_type", "SELFIE")
      .attach("file", suspiciousBuffer, {
        filename: "old-ai-fake-selfie.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      duplicate_found: true,
      warning: true,
      reasons: expect.arrayContaining([
        "AI-generated image suspected",
        "Repeated proof image detected",
        "Proof was not captured live",
      ]),
    });
    expect(response.body.data.decision).toMatchObject({
      decision: "REJECTED",
    });
  }, 15000);
});
