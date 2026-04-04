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
      },
      message: "Risk and premium calculated successfully.",
    });
  });

  it("validates missing fields", async () => {
    const response = await request(app).post("/api/risk-premium").send({
      aqi: 140,
      rain: 24,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Missing required fields: wind",
    });
  });
});
