function calculateTrustScore(fraudScore = 0) {
  const normalizedScore = Number(fraudScore);

  if (!Number.isFinite(normalizedScore)) {
    return 100;
  }

  return Math.max(0, Math.min(100, 100 - Math.max(0, normalizedScore)));
}

module.exports = {
  calculateTrustScore,
};
