// Ring for incoming support chats, synthesised with Web Audio (no asset to ship).
// Browsers only allow audio after a user gesture, so the context is unlocked on the first
// click or key press anywhere on the page, or by the explicit "Enable sound" button.

const RING_EVERY_MS = 2000;
// Rising E-major chime (E5, G#5, B5), like a phone notification.
const CHIME_NOTES = [659.25, 830.61, 987.77];
const NOTE_GAP_S = 0.16;
const NOTE_DECAY_S = 1.2;
const NOTE_PEAK = 0.9;

let ctx = null;
let output = null;
let ringTimer = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

const getContext = () => {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    ctx.onstatechange = notify;
    // Overlapping note tails would clip; the compressor keeps the chime loud without distortion.
    output = ctx.createDynamicsCompressor();
    output.connect(ctx.destination);
  }
  return ctx;
};

// Bell-like note: sine fundamental plus a quieter octave, quick attack, long natural decay.
const bell = (at, frequency) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(NOTE_PEAK, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_DECAY_S);
  gain.connect(output);
  [[frequency, 1], [frequency * 2, 0.3]].forEach(([freq, level]) => {
    const osc = ctx.createOscillator();
    const partial = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    partial.gain.value = level;
    osc.connect(partial).connect(gain);
    osc.start(at);
    osc.stop(at + NOTE_DECAY_S + 0.05);
  });
};

const ringOnce = () => {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  CHIME_NOTES.forEach((frequency, i) => bell(now + i * NOTE_GAP_S, frequency));
};

export const isSoundReady = () => Boolean(ctx && ctx.state === 'running');

export const subscribeSound = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Must be called from a user gesture.
export const unlockSound = async () => {
  const context = getContext();
  if (!context) return false;
  if (context.state !== 'running') await context.resume();
  notify();
  return context.state === 'running';
};

export const startRinging = () => {
  if (ringTimer) return;
  ringOnce();
  ringTimer = setInterval(ringOnce, RING_EVERY_MS);
};

export const stopRinging = () => {
  clearInterval(ringTimer);
  ringTimer = null;
};

// On 'click', not 'pointerdown': unlocking hides the "Enable sound" row, and doing that between
// pointerdown and click would shift the button under the cursor and swallow the click.
if (typeof window !== 'undefined') {
  const unlockOnFirstGesture = () => {
    // Still locked if this fails; the "Enable sound" button stays visible.
    unlockSound().catch((error) => console.warn('Support ring sound is still locked:', error.message));
    window.removeEventListener('click', unlockOnFirstGesture);
    window.removeEventListener('keydown', unlockOnFirstGesture);
  };
  window.addEventListener('click', unlockOnFirstGesture);
  window.addEventListener('keydown', unlockOnFirstGesture);
}
