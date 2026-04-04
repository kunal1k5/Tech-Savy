const {
  calculateTrustScore,
  DECISION_LEVELS,
  NEXT_ACTIONS,
  getDecision,
  getNextAction,
} = require("./aiDecision.service");

describe("aiDecision.service smart decision layer", () => {
  it("returns SAFE through the 30-point boundary", () => {
    expect(getDecision(0)).toBe(DECISION_LEVELS.SAFE);
    expect(getDecision(30)).toBe(DECISION_LEVELS.SAFE);
    expect(getNextAction(DECISION_LEVELS.SAFE)).toBe(
      NEXT_ACTIONS.AUTO_APPROVE_CLAIM
    );
  });

  it("returns VERIFY from 31 through 60", () => {
    expect(getDecision(31)).toBe(DECISION_LEVELS.VERIFY);
    expect(getDecision(60)).toBe(DECISION_LEVELS.VERIFY);
    expect(getNextAction(DECISION_LEVELS.VERIFY)).toBe(
      NEXT_ACTIONS.UPLOAD_PROOF
    );
  });

  it("returns FRAUD above 60", () => {
    expect(getDecision(61)).toBe(DECISION_LEVELS.FRAUD);
    expect(getDecision(65)).toBe(DECISION_LEVELS.FRAUD);
    expect(getNextAction(DECISION_LEVELS.FRAUD)).toBe(
      NEXT_ACTIONS.REJECT_CLAIM
    );
  });

  it("derives trust score directly from fraud score", () => {
    expect(calculateTrustScore(0)).toBe(100);
    expect(calculateTrustScore(18)).toBe(82);
    expect(calculateTrustScore(40)).toBe(60);
    expect(calculateTrustScore(110)).toBe(0);
  });
});
