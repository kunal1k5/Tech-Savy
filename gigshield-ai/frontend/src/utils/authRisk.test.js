import {
  evaluateAuthRisk,
  getLoginAttemptCount,
  recordLoginAttempt,
} from "./authRisk";

describe("authRisk", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a safe profile for a normal onboarding flow", () => {
    expect(
      evaluateAuthRisk({
        formFillTime: 4200,
        loginAttempts: 1,
        sameDeviceUsers: 0,
        locationChange: false,
      })
    ).toMatchObject({
      riskScore: 0,
      riskLevel: "low",
      riskStatus: "Safe",
      trustLevel: "high",
    });
  });

  it("returns a flagged profile when multiple risk signals stack up", () => {
    expect(
      evaluateAuthRisk({
        formFillTime: 900,
        loginAttempts: 4,
        sameDeviceUsers: 3,
        locationChange: true,
      })
    ).toMatchObject({
      riskScore: 100,
      riskLevel: "high",
      riskStatus: "Flag",
      trustLevel: "low",
    });
  });

  it("tracks repeated login attempts per mobile number", () => {
    recordLoginAttempt("9876543210");
    recordLoginAttempt("9876543210");

    expect(getLoginAttemptCount("9876543210")).toBe(2);
  });
});
