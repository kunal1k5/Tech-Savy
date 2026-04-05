const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  postForm: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
};

jest.mock("axios", () => ({
  create: jest.fn(() => mockApiClient),
}));

describe("api service configuration", () => {
  const originalApiUrl = process.env.REACT_APP_API_URL;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    delete process.env.REACT_APP_API_URL;
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.postForm.mockReset();
  });

  afterAll(() => {
    if (originalApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
      return;
    }

    process.env.REACT_APP_API_URL = originalApiUrl;
  });

  it("defaults to the local API in localhost development", () => {
    const { resolveApiBaseUrl } = require("./api");

    expect(resolveApiBaseUrl({ hostname: "localhost" })).toBe("http://localhost:5000/api");
  });

  it("defaults to same-origin /api on deployed hosts", () => {
    const { resolveApiBaseUrl } = require("./api");

    expect(resolveApiBaseUrl({ hostname: "gigpredict-ai.vercel.app" })).toBe("/api");
  });

  it("respects an explicit REACT_APP_API_URL value", () => {
    process.env.REACT_APP_API_URL = "https://api.example.com/api/";

    const { resolveApiBaseUrl, buildApiUrl } = require("./api");

    expect(resolveApiBaseUrl({ hostname: "gigpredict-ai.vercel.app" })).toBe("https://api.example.com/api");
    expect(buildApiUrl("auth/login")).toBe("https://api.example.com/api/auth/login");
  });

  it("sends relative request paths to axios so baseURL is not duplicated", async () => {
    process.env.REACT_APP_API_URL = "https://api.example.com/api/";
    mockApiClient.get.mockResolvedValueOnce({});
    mockApiClient.post.mockResolvedValueOnce({});

    const { apiGet, apiPost } = require("./api");

    await apiGet("/auth/login");
    await apiPost("/auth/register", { phone: "1234567890" });

    expect(mockApiClient.get).toHaveBeenCalledWith("/auth/login", undefined);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/auth/register",
      { phone: "1234567890" },
      undefined
    );
  });
});
