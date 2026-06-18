// ---- Tiny synth audio ----

let audioCtx: AudioContext | null = null;

/** Ensure the AudioContext is created and running. */
export function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
}

/**
 * Play a short synthesised beep.
 */
export function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume = 0.06,
  slide = 0,
) {
  const ctx = audioCtx;
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide !== 0) {
    osc.frequency.linearRampToValueAtTime(freq + slide, now + duration);
  }
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/** Play game sound effects. */
export function playSound(kind: 'start' | 'move' | 'hit' | 'score') {
  ensureAudioContext();
  if (kind === 'start') {
    playTone(280, 0.08, 'square', 0.05, 120);
    setTimeout(() => playTone(420, 0.08, 'square', 0.05, 80), 80);
    return;
  }
  if (kind === 'move') {
    playTone(520, 0.04, 'square', 0.025, -80);
    return;
  }
  if (kind === 'hit') {
    playTone(150, 0.12, 'sawtooth', 0.055, -120);
    setTimeout(() => playTone(90, 0.15, 'triangle', 0.04, -80), 60);
    return;
  }
  playTone(640, 0.06, 'triangle', 0.04, 160);
  setTimeout(() => playTone(860, 0.05, 'square', 0.03, 90), 55);
}
