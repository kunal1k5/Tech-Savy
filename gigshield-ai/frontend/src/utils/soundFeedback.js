let audioContext = null;

function isSoundEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const preference = window.localStorage.getItem("gigshield-ui-sound");
  return preference !== "off";
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function playTone({
  frequency,
  durationMs,
  type = "sine",
  startGain = 0.03,
  endGain = 0.0001,
  startDelayMs = 0,
}) {
  if (!isSoundEnabled()) {
    return;
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startAt = context.currentTime + startDelayMs / 1000;
  const endAt = startAt + durationMs / 1000;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gainNode.gain.setValueAtTime(startGain, startAt);
  gainNode.gain.exponentialRampToValueAtTime(endGain, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(endAt);
}

export function playUiClick() {
  try {
    playTone({
      frequency: 580,
      durationMs: 38,
      type: "triangle",
      startGain: 0.02,
      endGain: 0.0001,
    });
  } catch {
    // Silently ignore audio failures.
  }
}

export function playUiSuccess() {
  try {
    playTone({
      frequency: 660,
      durationMs: 90,
      type: "sine",
      startGain: 0.03,
      endGain: 0.0001,
    });
    playTone({
      frequency: 920,
      durationMs: 120,
      type: "sine",
      startGain: 0.028,
      endGain: 0.0001,
      startDelayMs: 70,
    });
  } catch {
    // Silently ignore audio failures.
  }
}

export function playUiAlert() {
  try {
    playTone({
      frequency: 320,
      durationMs: 120,
      type: "sawtooth",
      startGain: 0.03,
      endGain: 0.0001,
    });
  } catch {
    // Silently ignore audio failures.
  }
}
