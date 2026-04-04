const request = require("supertest");

const app = require("../app");

describe("POST /api/auto-claim", () => {
  it("triggers and pays a claim when high risk, active work, and income loss are confirmed", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      ordersCompleted: 0,
      workingMinutes: 180,
      earnings: 0,
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
        isWorking: true,
        incomeLoss: true,
        incomeLossReason: "NO_ORDERS_COMPLETED",
        ordersCompleted: 0,
        workingMinutes: 180,
        earnings: 0,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: true,
          incomeLossDetected: true,
        },
        hoursLost: 3,
        hourlyRate: 150,
        message: "Claim auto-triggered after confirming active work and income loss.",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("returns no claim when income loss is not detected", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      ordersCompleted: 2,
      workingMinutes: 150,
      earnings: 320,
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
        isWorking: true,
        incomeLoss: false,
        incomeLossReason: "NONE",
        ordersCompleted: 2,
        workingMinutes: 150,
        earnings: 320,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: true,
          incomeLossDetected: false,
        },
        hoursLost: 3,
        hourlyRate: 150,
        message: "No claim triggered. Active work and income loss could not both be confirmed.",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("keeps the flow stable for legacy payloads by inferring income loss from lost hours", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      hoursLost: 3,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: true,
        payout: 450,
        isWorking: true,
        incomeLoss: true,
        incomeLossReason: "HOURS_LOST_FALLBACK",
      },
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
