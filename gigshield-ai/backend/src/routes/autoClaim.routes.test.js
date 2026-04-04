const request = require("supertest");

const app = require("../app");

describe("POST /api/auto-claim", () => {
  it("triggers and pays a claim when high risk, active work, and income loss are confirmed", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      ordersCompleted: 0,
      duration: 180,
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
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work confirmed + no orders completed + duration above 30 minutes",
        reason:
          "Risk level is HIGH + active work confirmed + no orders completed + duration above 30 minutes",
        ordersCompleted: 0,
        duration: 180,
        workingMinutes: 180,
        earnings: 0,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: true,
          incomeLossDetected: true,
          durationThresholdMet: true,
        },
        hoursLost: 3,
        hourlyRate: 150,
        message:
          "Claim auto-triggered after confirming high risk, active work, income loss, and duration threshold.",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("returns no claim when income loss is not detected", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      ordersCompleted: 2,
      duration: 150,
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
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work confirmed + income loss not detected + duration above 30 minutes",
        reason:
          "Risk level is HIGH + active work confirmed + income loss not detected + duration above 30 minutes",
        ordersCompleted: 2,
        duration: 150,
        workingMinutes: 150,
        earnings: 320,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: true,
          incomeLossDetected: false,
          durationThresholdMet: true,
        },
        hoursLost: 3,
        hourlyRate: 150,
        message:
          "No claim triggered. High risk, active work, income loss, and duration threshold must all be confirmed.",
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("does not trigger a claim from lost hours alone", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      hoursLost: 3,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        isWorking: false,
        incomeLoss: false,
        incomeLossReason: "NONE",
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work not confirmed + income loss not detected + duration not above 30 minutes",
        reason:
          "Risk level is HIGH + active work not confirmed + income loss not detected + duration not above 30 minutes",
        duration: null,
        workingMinutes: null,
        eligibility: {
          durationThresholdMet: false,
        },
      },
    });
  });

  it("does not trigger when duration is not above the threshold", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      incomeLoss: true,
      duration: 30,
      hoursLost: 2,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        isWorking: true,
        incomeLoss: true,
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work confirmed + income loss explicitly confirmed + duration not above 30 minutes",
        reason:
          "Risk level is HIGH + active work confirmed + income loss explicitly confirmed + duration not above 30 minutes",
        duration: 30,
        workingMinutes: 30,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: true,
          incomeLossDetected: true,
          durationThresholdMet: false,
        },
      },
    });
  });

  it("does not trigger when active work is not explicitly confirmed", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      incomeLoss: true,
      duration: 90,
      hoursLost: 2,
      hourlyRate: 150,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        isWorking: false,
        incomeLoss: true,
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work not confirmed + income loss explicitly confirmed + duration above 30 minutes",
        reason:
          "Risk level is HIGH + active work not confirmed + income loss explicitly confirmed + duration above 30 minutes",
        duration: 90,
        workingMinutes: 90,
        eligibility: {
          riskEligible: true,
          activeWorkConfirmed: false,
          incomeLossDetected: true,
          durationThresholdMet: true,
        },
      },
    });
  });

  it("sanitizes invalid hoursLost instead of failing", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      hoursLost: -1,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        claimTriggered: false,
        payout: 0,
        hoursLost: 0,
        hourlyRate: 150,
        riskReason: "Risk level is HIGH",
        claimReason:
          "active work not confirmed + income loss not detected + duration not above 30 minutes",
        reason:
          "Risk level is HIGH + active work not confirmed + income loss not detected + duration not above 30 minutes",
        duration: null,
        workingMinutes: null,
      },
      message: "Auto-claim decision generated successfully.",
    });
  });

  it("blocks repeated auto-claim triggering when the last claim is within five minutes", async () => {
    const response = await request(app).post("/api/auto-claim").send({
      risk: "HIGH",
      isWorking: true,
      ordersCompleted: 0,
      duration: 180,
      workingMinutes: 180,
      earnings: 0,
      hoursLost: 3,
      hourlyRate: 150,
      lastClaimTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    });

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      success: false,
      message: expect.stringContaining("Claim blocked by cooldown."),
      data: {
        blocked: true,
        claimTriggered: false,
        payout: 0,
        status: null,
        cooldown: {
          active: true,
          cooldownMs: 300000,
          lastClaimTime: expect.any(String),
          remainingMs: expect.any(Number),
          remainingSeconds: expect.any(Number),
          retryAfterAt: expect.any(String),
        },
      },
    });
    expect(response.body.data.cooldown.remainingMs).toBeGreaterThan(0);
  });
});
