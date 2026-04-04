const request = require("supertest");

const app = require("../app");

describe("POST /api/risk-premium", () => {
  it("returns low risk and the lowest premium for safe inputs", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 90,
      rain: 2,
      wind: 12,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "LOW",
        premium: 10,
        riskReason: "AQI, rain, and wind stayed within safe thresholds",
        reason: "AQI, rain, and wind stayed within safe thresholds",
      },
      message: "Risk and premium calculated successfully.",
    });
  });

  it("returns medium risk when AQI or rain crosses the medium threshold", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 180,
      rain: 3,
      wind: 12,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "MEDIUM",
        premium: 20,
        riskReason: "AQI above 150",
        reason: "AQI above 150",
      },
      message: "Risk and premium calculated successfully.",
    });
  });

  it("returns high risk when any high threshold is exceeded", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 140,
      rain: 24,
      wind: 12,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        premium: 30,
        riskReason: "rain above 20 mm",
        reason: "rain above 20 mm",
      },
      message: "Risk and premium calculated successfully.",
    });
  });

  it("defaults missing fields to safe zero values", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 140,
      rain: 24,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        premium: 30,
        riskReason: "rain above 20 mm",
        reason: "rain above 20 mm",
      },
      message: "Risk and premium calculated successfully.",
    });
  });

  it("clamps invalid and extreme weather inputs safely", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 9999,
      rain: -10,
      wind: 1000,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        risk: "HIGH",
        premium: 30,
        riskReason: "AQI above 300 + wind above 30 km/h",
        reason: "AQI above 300 + wind above 30 km/h",
      },
      message: "Risk and premium calculated successfully.",
    });
  });
});
