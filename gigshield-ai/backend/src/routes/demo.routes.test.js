const request = require("supertest");

const app = require("../app");
const DemoStoreService = require("../services/demoStore.service");

describe("POST /api/claim/trigger", () => {
  beforeEach(() => {
    DemoStoreService.resetDemoStore();
  });

  async function registerWorkerAndGetToken() {
    const response = await request(app).post("/api/auth/register").send({
      fullName: "Spam Safe Worker",
      phone: "9876543210",
      city: "Bengaluru",
      zone: "Koramangala",
      platform: "Swiggy",
      weeklyIncome: 18000,
    });

    return response.body.data.token;
  }

  it("blocks repeated claim triggers inside the five-minute cooldown window", async () => {
    const token = await registerWorkerAndGetToken();

    const firstResponse = await request(app)
      .post("/api/claim/trigger")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rainfall: 60,
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body).toMatchObject({
      success: true,
      data: {
        triggered: true,
      },
    });

    const secondResponse = await request(app)
      .post("/api/claim/trigger")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rainfall: 60,
      });

    expect(secondResponse.status).toBe(429);
    expect(secondResponse.body).toMatchObject({
      success: false,
      message: expect.stringContaining("Claim blocked by cooldown."),
      data: {
        triggered: false,
        blocked: true,
        cooldown: {
          active: true,
          cooldownMs: 300000,
          remainingMs: expect.any(Number),
          remainingSeconds: expect.any(Number),
        },
        claims: expect.any(Array),
      },
    });
    expect(secondResponse.body.data.cooldown.remainingMs).toBeGreaterThan(0);
    expect(secondResponse.body.data.claims).toHaveLength(1);
  });
});
