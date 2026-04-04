const request = require("supertest");

const app = require("../app");

describe("POST /api/fraud-check", () => {
  it("returns SAFE for a normal user", async () => {
    const response = await request(app).post("/api/fraud-check").send({
      risk: "LOW",
      locationMatch: true,
      claimsCount: 1,
      loginAttempts: 1,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Fraud check completed successfully.",
      data: {
        fraudScore: 0,
        fraud_score: 0,
        trustScore: 100,
        trust_score: 100,
        status: "SAFE",
        details: {
          behavior: "Normal",
          location: "Match",
          context: "Valid",
        },
      },
    });
  });

  it("returns WARNING for suspicious activity", async () => {
    const response = await request(app).post("/api/fraud-check").send({
      risk: "HIGH",
      locationMatch: true,
      claimsCount: 4,
      loginAttempts: 5,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Fraud check completed successfully.",
      data: {
        fraudScore: 40,
        fraud_score: 40,
        trustScore: 60,
        trust_score: 60,
        status: "WARNING",
        details: {
          behavior: "Abnormal",
          location: "Match",
          context: "Valid",
        },
      },
    });
  });

  it("returns FRAUD for stacked high-risk signals", async () => {
    const response = await request(app).post("/api/fraud-check").send({
      risk: "HIGH",
      locationMatch: false,
      claimsCount: 4,
      loginAttempts: 5,
      contextValid: false,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Fraud check completed successfully.",
      data: {
        fraudScore: 110,
        fraud_score: 110,
        trustScore: 0,
        trust_score: 0,
        status: "FRAUD",
        details: {
          behavior: "Abnormal",
          location: "Mismatch",
          context: "Invalid",
        },
        locationMatch: false,
        claimsCount: 4,
        loginAttempts: 5,
      },
    });
  });
});
