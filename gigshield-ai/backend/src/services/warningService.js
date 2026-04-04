const WARNING_MESSAGE = "⚠️ AI scam or suspicious activity detected";

function dedupe(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildWarnings({
  imageValidation = {},
  locationValidation = {},
  activityValidation = {},
  weatherValidation = {},
  workValidation = {},
  fraudScore = 0,
} = {}) {
  const reasons = [];
  const explanation = [];

  if (imageValidation.ai_generated_probability > 70) {
    reasons.push("AI-generated image suspected");
    explanation.push(
      `Image forensics scored the upload at ${imageValidation.ai_generated_probability}% AI-generated probability.`
    );
  }

  if (imageValidation.tampering_detected) {
    reasons.push("AI generated or tampered image detected");
    explanation.push("Tampering heuristics found metadata or visual inconsistencies.");
  }

  if (imageValidation.duplicate_found) {
    reasons.push("Repeated proof image detected");
    explanation.push("The same image hash has already been used in another proof upload.");
  }

  if (imageValidation.is_live_capture === false) {
    reasons.push("Proof was not captured live");
    explanation.push("Capture metadata does not look like a recent live camera capture.");
  }

  if (locationValidation.match === false) {
    reasons.push("Proof location mismatch");
    explanation.push(
      locationValidation.reason || "Uploaded proof location does not match the expected claim area."
    );
  }

  if (activityValidation.was_active === false) {
    reasons.push("User inactive during claim");
    explanation.push("Movement logs do not show active work near the claim timestamp.");
  }

  if (activityValidation.within_working_hours === false) {
    reasons.push("Claim outside active work hours");
    explanation.push("The claim timestamp does not overlap with a recorded work session.");
  }

  if (weatherValidation.mismatch) {
    reasons.push("Weather mismatch");
    explanation.push("Outdoor image signals do not match the expected weather conditions.");
  }

  if (workValidation.checked && workValidation.valid === false) {
    reasons.push("Work screen validation failed");
    explanation.push("The uploaded work screen did not look like an active delivery app session.");
  }

  const dedupedReasons = dedupe(reasons);
  const dedupedExplanation = dedupe(explanation);

  return {
    warning: dedupedReasons.length > 0 || Number(fraudScore) >= 35,
    message:
      dedupedReasons.length > 0 || Number(fraudScore) >= 35
        ? WARNING_MESSAGE
        : "No suspicious proof signals detected",
    reasons: dedupedReasons,
    warnings: dedupedReasons,
    explanation: dedupedExplanation,
  };
}

module.exports = {
  WARNING_MESSAGE,
  buildWarnings,
};
