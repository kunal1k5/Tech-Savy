const {
  calculateTrustScore,
  DECISION_LEVELS,
  NEXT_ACTIONS,
  CLAIM_DECISIONS,
  createClaimDecision,
  getDecision,
  getNextAction,
  hasCriticalProofValidationFailure,
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

  it("treats location or activity proof failures as critical rejection signals", () => {
    expect(
      hasCriticalProofValidationFailure({
        locationMatch: false,
        activityValid: true,
      })
    ).toBe(true);

    expect(
      hasCriticalProofValidationFailure({
        locationMatch: true,
        activityValid: false,
      })
    ).toBe(true);

    expect(
      hasCriticalProofValidationFailure({
        locationMatch: true,
        activityValid: true,
      })
    ).toBe(false);
  });

  it("rejects a proof decision when location or activity validation fails", () => {
    expect(
      createClaimDecision({
        fraud_score: 10,
        locationMatch: false,
        activityValid: true,
        warnings: [],
        explanation: [],
      }).decision
    ).toBe(CLAIM_DECISIONS.REJECTED);

    expect(
      createClaimDecision({
        fraud_score: 10,
        locationMatch: true,
        activityValid: false,
        warnings: [],
        explanation: [],
      }).decision
    ).toBe(CLAIM_DECISIONS.REJECTED);
  });
});
