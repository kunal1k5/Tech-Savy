const request = require("supertest");

const app = require("../app");

describe("POST /api/ai-decision", () => {
  it("returns LOW and SAFE for normal inputs", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 90,
      rain: 2,
      wind: 10,
      claimsCount: 1,
      loginAttempts: 1,
      locationMatch: true,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "LOW",
        fraudScore: 0,
        trustScore: 100,
        trust_score: 100,
        status: "SAFE",
        decision: "SAFE",
        nextAction: "AUTO_APPROVE_CLAIM",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("returns MEDIUM, WARNING, and VERIFY when threshold and fraud signals are moderate", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 180,
      rain: 3,
      wind: 10,
      claimsCount: 4,
      loginAttempts: 5,
      locationMatch: true,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "MEDIUM",
        fraudScore: 40,
        trustScore: 60,
        trust_score: 60,
        status: "WARNING",
        decision: "VERIFY",
        nextAction: "UPLOAD_PROOF",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("returns HIGH and FRAUD for stacked severe signals", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 350,
      rain: 25,
      wind: 40,
      claimsCount: 4,
      loginAttempts: 5,
      locationMatch: false,
      contextValid: false,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        fraudScore: 110,
        trustScore: 0,
        trust_score: 0,
        status: "FRAUD",
        decision: "FRAUD",
        nextAction: "REJECT_CLAIM",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("treats a score of 30 as SAFE", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 100,
      rain: 1,
      wind: 5,
      claimsCount: 0,
      loginAttempts: 0,
      locationMatch: false,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "LOW",
        fraudScore: 30,
        trustScore: 70,
        trust_score: 70,
        status: "SAFE",
        decision: "SAFE",
        nextAction: "AUTO_APPROVE_CLAIM",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("treats a score of 60 as VERIFY with proof upload", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 100,
      rain: 1,
      wind: 5,
      claimsCount: 4,
      loginAttempts: 0,
      locationMatch: true,
      contextValid: false,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "LOW",
        fraudScore: 60,
        trustScore: 40,
        trust_score: 40,
        status: "WARNING",
        decision: "VERIFY",
        nextAction: "UPLOAD_PROOF",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: "bad",
      rain: 2,
      wind: 10,
      claimsCount: 1,
      loginAttempts: 1,
      locationMatch: true,
      contextValid: true,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Validation failed",
    });
  });
});
