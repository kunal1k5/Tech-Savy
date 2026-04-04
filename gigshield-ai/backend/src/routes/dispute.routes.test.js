const request = require("supertest");

const app = require("../app");
const { getDisputeById, resetDisputeStore } = require("../services/dispute.service");

describe("POST /api/start-dispute", () => {
  beforeEach(() => {
    resetDisputeStore();
  });

  it("starts a dispute and returns the initiated state", async () => {
    const response = await request(app).post("/api/start-dispute").send({
      userId: "123",
      reason: "System failed to detect actual issue",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        disputeId: "D1001",
        status: "INITIATED",
      },
      message: "Dispute started successfully.",
    });

    expect(getDisputeById("D1001")).toMatchObject({
      dispute: true,
      userId: "123",
      reason: "System failed to detect actual issue",
      status: "INITIATED",
    });
  });

  it("rejects invalid dispute requests", async () => {
    const response = await request(app).post("/api/start-dispute").send({
      userId: "",
      reason: "bad",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: {},
      message: "Handled safely",
    });
  });
});
