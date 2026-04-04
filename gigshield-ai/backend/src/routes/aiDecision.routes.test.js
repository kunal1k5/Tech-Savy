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
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason: "no fraud signals detected",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + no fraud signals detected",
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
        riskReason: "AQI above 150",
        fraudReason: "high claim frequency + excessive login attempts",
        reason:
          "AQI above 150 + high claim frequency + excessive login attempts",
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
        riskReason: "AQI above 300 + rain above 20 mm + wind above 30 km/h",
        fraudReason:
          "high claim frequency + excessive login attempts + location mismatch + invalid context",
        reason:
          "AQI above 300 + rain above 20 mm + wind above 30 km/h + high claim frequency + excessive login attempts + location mismatch + invalid context",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("flags a low-risk triggered claim for verification", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 90,
      rain: 2,
      wind: 10,
      claimTriggered: true,
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
        fraudScore: 50,
        trustScore: 50,
        trust_score: 50,
        status: "WARNING",
        decision: "VERIFY",
        nextAction: "UPLOAD_PROOF",
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason: "claim triggered during low risk",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + claim triggered during low risk",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("rejects claims with too many claims and a suspicious pattern", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 90,
      rain: 2,
      wind: 10,
      suspiciousPattern: true,
      claimsCount: 6,
      loginAttempts: 1,
      locationMatch: true,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "LOW",
        fraudScore: 75,
        trustScore: 25,
        trust_score: 25,
        status: "FRAUD",
        decision: "FRAUD",
        nextAction: "REJECT_CLAIM",
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason:
          "high claim frequency + too many claims + suspicious claim pattern",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + high claim frequency + too many claims + suspicious claim pattern",
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
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason: "location mismatch",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + location mismatch",
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
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason: "high claim frequency + invalid context",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + high claim frequency + invalid context",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("sanitizes invalid payloads instead of rejecting them", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: "bad",
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
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        fraudReason: "no fraud signals detected",
        reason:
          "AQI, rain, and wind stayed within safe thresholds + no fraud signals detected",
      },
      message: "AI decision generated successfully.",
    });
  });

  it("clamps extreme AQI, rain, and wind values", async () => {
    const response = await request(app).post("/api/ai-decision").send({
      aqi: 9999,
      rain: -15,
      wind: 999,
      claimsCount: -1,
      loginAttempts: "bad",
      locationMatch: true,
      contextValid: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        fraudScore: 0,
        trustScore: 100,
        trust_score: 100,
        status: "SAFE",
        decision: "SAFE",
        nextAction: "AUTO_APPROVE_CLAIM",
        riskReason: "AQI above 300 + wind above 30 km/h",
        fraudReason: "no fraud signals detected",
        reason:
          "AQI above 300 + wind above 30 km/h + no fraud signals detected",
      },
      message: "AI decision generated successfully.",
    });
  });
});
