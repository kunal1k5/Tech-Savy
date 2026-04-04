jest.mock("./api", () => ({
  __esModule: true,
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  unwrapApiPayload: (payload) => payload?.data ?? payload,
}));

import { apiPost } from "./api";
import { registerWorker, requestOtp, verifyOtp } from "./demoFlow";

describe("demoFlow auth fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("uses the backend response when the API is available", async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        sessionId: "backend-session",
        phone: "1234567890",
      },
    });

    await expect(requestOtp("1234567890")).resolves.toEqual({
      sessionId: "backend-session",
      phone: "1234567890",
    });
  });

  it("falls back to offline OTP mode when login is unreachable", async () => {
    apiPost.mockRejectedValueOnce(new Error("Network Error"));

    const response = await requestOtp("1234567890", { allowOfflineFallback: true });

    expect(response.fallbackMode).toBe("offline_demo");
    expect(response.sessionId).toMatch(/^offline-/);
    expect(response.otp).toBe("1234");
  });

  it("verifies an offline OTP and returns a demo user", async () => {
    apiPost.mockRejectedValueOnce(new Error("Network Error"));
    const otpSession = await requestOtp("1234567890", { allowOfflineFallback: true });

    apiPost.mockRejectedValueOnce(new Error("Network Error"));
    const response = await verifyOtp({
      sessionId: otpSession.sessionId,
      phone: "1234567890",
      otp: "1234",
      allowOfflineFallback: true,
      profile: {
        fullName: "Test Rider",
        city: "Bengaluru",
      },
    });

    expect(response.fallbackMode).toBe("offline_demo");
    expect(response.user).toMatchObject({
      full_name: "Test Rider",
      phone: "1234567890",
      city: "Bengaluru",
    });
  });

  it("shows the correct OTP error in offline mode", async () => {
    apiPost.mockRejectedValueOnce(new Error("Network Error"));
    const otpSession = await requestOtp("1234567890", { allowOfflineFallback: true });

    apiPost.mockRejectedValueOnce(new Error("Network Error"));

    await expect(
      verifyOtp({
        sessionId: otpSession.sessionId,
        phone: "1234567890",
        otp: "0000",
        allowOfflineFallback: true,
      })
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          error: "Invalid OTP. Use 1234 for the demo.",
        },
      },
    });
  });

  it("registers a demo user locally when the API is unreachable", async () => {
    apiPost.mockRejectedValueOnce(new Error("Network Error"));

    const response = await registerWorker({
      fullName: "Offline Worker",
      phone: "9876543210",
      city: "Bengaluru",
      zone: "Koramangala",
      platform: "Swiggy",
      weeklyIncome: 18000,
    }, { allowOfflineFallback: true });

    expect(response.fallbackMode).toBe("offline_demo");
    expect(response.user).toMatchObject({
      full_name: "Offline Worker",
      phone: "9876543210",
      weekly_income: 18000,
    });
  });
});
