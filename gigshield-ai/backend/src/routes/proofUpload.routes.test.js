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
      message: "Geo-location image is required.",
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
      message: "Dispute not found.",
    });
  });
});
