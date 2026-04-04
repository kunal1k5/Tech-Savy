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
        riskReason: "Risk level remained LOW",
        fraudReason: "no fraud signals detected",
        reason: "Risk level remained LOW + no fraud signals detected",
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
        riskReason: "Risk level is HIGH",
        fraudReason: "high claim frequency + excessive login attempts",
        reason: "Risk level is HIGH + high claim frequency + excessive login attempts",
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
        riskReason: "Risk level is HIGH",
        fraudReason:
          "high claim frequency + excessive login attempts + location mismatch + invalid context",
        reason:
          "Risk level is HIGH + high claim frequency + excessive login attempts + location mismatch + invalid context",
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

  it("flags a low-risk claim trigger as an anomaly", async () => {
    const response = await request(app).post("/api/fraud-check").send({
      risk: "LOW",
      claimTriggered: true,
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
        fraudScore: 50,
        fraud_score: 50,
        trustScore: 50,
        trust_score: 50,
        status: "WARNING",
        claimTriggered: true,
        anomalyScore: 50,
        anomaly_score: 50,
        riskReason: "Risk level remained LOW",
        fraudReason: "claim triggered during low risk",
        reason: "Risk level remained LOW + claim triggered during low risk",
        details: {
          behavior: "Normal",
          location: "Match",
          context: "Valid",
          anomaly: "Detected",
        },
        issues: expect.arrayContaining(["low_risk_claim_triggered"]),
      },
    });
  });

  it("returns FRAUD when too many claims and a suspicious pattern are detected", async () => {
    const response = await request(app).post("/api/fraud-check").send({
      risk: "LOW",
      claimTriggered: false,
      suspiciousPattern: true,
      locationMatch: true,
      claimsCount: 6,
      loginAttempts: 1,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Fraud check completed successfully.",
      data: {
        fraudScore: 75,
        fraud_score: 75,
        trustScore: 25,
        trust_score: 25,
        status: "FRAUD",
        claimsCount: 6,
        suspiciousPattern: true,
        anomalyScore: 55,
        anomaly_score: 55,
        riskReason: "Risk level remained LOW",
        fraudReason:
          "high claim frequency + too many claims + suspicious claim pattern",
        reason:
          "Risk level remained LOW + high claim frequency + too many claims + suspicious claim pattern",
        details: {
          behavior: "Warning",
          location: "Match",
          context: "Valid",
          anomaly: "Detected",
        },
        issues: expect.arrayContaining([
          "high_claim_frequency",
          "too_many_claims",
          "suspicious_pattern",
        ]),
      },
    });
  });
});
