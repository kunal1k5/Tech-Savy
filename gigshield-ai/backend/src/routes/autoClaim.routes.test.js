const request = require("supertest");

const app = require("../app");

describe("POST /api/auto-claim", () => {
  it("triggers and pays a claim when risk is high and hours lost are eligible", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      hoursLost: 3,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        claimTriggered: true,
        payout: 450,
        status: "PAID",
        claimStates: ["CREATED", "PROCESSING", "PAID"],
        hoursLost: 3,
        hourlyRate: 150,
        message: "Claim automatically triggered due to high risk",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("returns no claim when the eligibility threshold is not met", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "MEDIUM",
      hoursLost: 3,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        status: null,
        claimStates: ["CREATED", "PROCESSING", "PAID"],
        hoursLost: 3,
        hourlyRate: 150,
        message: "No claim triggered. Eligibility not met.",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("validates hoursLost", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      hoursLost: -1,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "hoursLost must be a non-negative number.",
    });
  });
});
