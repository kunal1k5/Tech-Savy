import {
  DEMO_ACCOUNT,
  findStoredUserByPhone,
  getToken,
  getUserFromToken,
  isAuthenticated,
  saveAuthSession,
  signInWithDemoAccount,
} from "./auth";

describe("auth session helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears an old token when saving a cached worker session", () => {
    localStorage.setItem("gigpredict_ai_token", "stale-token");

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
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      name: "Offline Rider",
      fullName: "Offline Rider",
      full_name: "Offline Rider",
      workType: "",
      phone: "1234567890",
    });
    expect(isAuthenticated()).toBe(true);
  });

  it("keeps the latest active session while preserving separate cached user records", () => {
    saveAuthSession({
      user: {
        full_name: "First Rider",
        phone: "1111111111",
        city: "Delhi",
        work_type: "Delivery",
      },
    });

    saveAuthSession({
      user: {
        full_name: "Second Rider",
        phone: "2222222222",
        city: "Mumbai",
        work_type: "Driver",
      },
    });

    expect(getUserFromToken()).toMatchObject({
      full_name: "Second Rider",
      phone: "2222222222",
      city: "Mumbai",
      work_type: "Driver",
    });

    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      name: "Second Rider",
      full_name: "Second Rider",
      phone: "2222222222",
    });

    expect(JSON.parse(localStorage.getItem("gigpredict_ai_known_users"))).toMatchObject({
      "1111111111": expect.objectContaining({
        full_name: "First Rider",
        phone: "1111111111",
      }),
      "2222222222": expect.objectContaining({
        full_name: "Second Rider",
        phone: "2222222222",
      }),
    });
  });

  it("finds the saved user by phone for login recovery", () => {
    saveAuthSession({
      user: {
        full_name: "Stored Rider",
        phone: "9999999999",
        city: "Pune",
        work_type: "Delivery",
      },
    });

    expect(findStoredUserByPhone("9999999999")).toMatchObject({
      full_name: "Stored Rider",
      phone: "9999999999",
      city: "Pune",
      work_type: "Delivery",
    });
  });

  it("creates a working local demo session without a JWT", () => {
    const demoUser = signInWithDemoAccount();

    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(true);
    expect(demoUser).toMatchObject({
      full_name: DEMO_ACCOUNT.full_name,
      phone: DEMO_ACCOUNT.phone,
    });
    expect(getUserFromToken()).toMatchObject({
      full_name: DEMO_ACCOUNT.full_name,
      phone: DEMO_ACCOUNT.phone,
      platform: DEMO_ACCOUNT.platform,
    });
  });
});
