jest.mock("./api", () => ({
  __esModule: true,
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  unwrapApiPayload: (payload) => payload?.data ?? payload,
}));

import { apiPost } from "./api";
import { registerWorker, requestOtp, verifyOtp } from "./workerFlow";

describe("workerFlow", () => {
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

  it("forwards login failures from the backend", async () => {
    const requestError = new Error("Network Error");
    apiPost.mockRejectedValueOnce(requestError);

    await expect(requestOtp("1234567890")).rejects.toBe(requestError);
  });

  it("verifies OTP using the backend response", async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        user: {
          full_name: "Test Rider",
          phone: "1234567890",
          city: "Bengaluru",
        },
      },
    });

    const response = await verifyOtp({
      sessionId: "backend-session",
      phone: "1234567890",
      otp: "1234",
      profile: {
        fullName: "Test Rider",
        city: "Bengaluru",
      },
    });
    expect(response.user).toMatchObject({
      full_name: "Test Rider",
      phone: "1234567890",
      city: "Bengaluru",
    });
  });

  it("keeps backend OTP validation errors intact", async () => {
    const requestError = Object.assign(new Error("Invalid OTP"), {
      response: {
        status: 401,
        data: {
          error: "Invalid OTP.",
        },
      },
    });
    apiPost.mockRejectedValueOnce(requestError);

    await expect(
      verifyOtp({
        sessionId: "backend-session",
        phone: "1234567890",
        otp: "0000",
      })
    ).rejects.toBe(requestError);
  });

  it("registers a worker using the backend response", async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        user: {
          full_name: "Registered Worker",
          phone: "9876543210",
          weekly_income: 18000,
        },
      },
    });

    const response = await registerWorker({
      fullName: "Registered Worker",
      phone: "9876543210",
      city: "Bengaluru",
      zone: "Koramangala",
      platform: "Swiggy",
      weeklyIncome: 18000,
    });

    expect(response.user).toMatchObject({
      full_name: "Registered Worker",
      phone: "9876543210",
      weekly_income: 18000,
    });
  });
});
