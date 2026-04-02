import { getToken, getUserFromToken, saveAuthSession } from "./auth";

describe("auth session helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears an old token when saving an offline demo session", () => {
    localStorage.setItem("gigshield_token", "stale-token");

    saveAuthSession({
      user: {
        full_name: "Offline Rider",
        phone: "1234567890",
        city: "Bengaluru",
        zone: "Koramangala",
        platform: "Swiggy",
        weekly_income: 18000,
      },
    });

    expect(getToken()).toBeNull();
    expect(getUserFromToken()).toMatchObject({
      full_name: "Offline Rider",
      phone: "1234567890",
    });
  });
});
