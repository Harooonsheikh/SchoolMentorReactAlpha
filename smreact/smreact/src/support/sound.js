/* ════════════════════════════════════════════════════════════════════
   Subtle incoming-message notification chime, generated with the Web Audio
   API (no asset to bundle). Throttled so a burst of messages doesn't turn
   into noise. Only call this for messages the current user did NOT send.

   Browser autoplay policy: an AudioContext created without a user gesture
   starts "suspended", and resume() outside a gesture is ignored — so a
   chime fired from a SignalR callback would be silent. We therefore unlock
   the context on the FIRST real user interaction (pointer / key / touch)
   and keep it warm for every later notification.
   ════════════════════════════════════════════════════════════════════ */

let _ctx = null;
let _unlocked = false;
let _lastPlayed = 0;
const THROTTLE_MS = 1200;

function ctx() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  return _ctx;
}

/* Resume the context from within a genuine user gesture. After the first
   successful unlock the listeners detach themselves. Safe to call many
   times. */
function unlock() {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  if (ac.state === 'running') {
    _unlocked = true;
    detachUnlockListeners();
  }
}

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click'];
function attachUnlockListeners() {
  UNLOCK_EVENTS.forEach((e) =>
    window.addEventListener(e, unlock, { capture: true, passive: true }));
}
function detachUnlockListeners() {
  UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock, { capture: true }));
}

/* Arm the unlock the moment this module is imported (the support UI mounts
   well before any message arrives, so the user has surely clicked once). */
if (typeof window !== 'undefined') attachUnlockListeners();

/** Call once from a click handler (e.g. opening the chat) to pre-warm audio. */
export function primeChime() { unlock(); }

/** Play a soft two-note "ding". No-op if throttled or audio unavailable. */
export function playIncomingChime() {
  const now = Date.now();
  if (now - _lastPlayed < THROTTLE_MS) return;
  _lastPlayed = now;

  const ac = ctx();
  if (!ac) return;
  // Best-effort resume; if the user has never interacted yet the browser
  // keeps it suspended and the chime is silently skipped (then unlocked on
  // their next click for all subsequent messages).
  if (ac.state === 'suspended') { ac.resume().catch(() => {}); }
  if (ac.state !== 'running' && !_unlocked) return;

  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);

  // Gentle bell: two quick descending sine tones with a soft envelope.
  [[880, 0.0], [1320, 0.09]].forEach(([freq, offset]) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t0 + offset;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + 0.3);
  });
  master.gain.setValueAtTime(0.9, t0);
}
