/* Incoming-message chime (Web Audio). Ek notification par 3 baar bajti hai.
   Browser autoplay policy: AudioContext ko pehle user click/key ki zaroorat
   hoti hai, is liye pehli interaction par unlock karte hain. */

console.log('[chime] sound.js v4 loaded');

let _ctx = null;
let _lastPlayed = 0;

const REPEAT_COUNT = 4;     // ek notification par kitni baar awaz
const REPEAT_GAP = 1.0;     // do awaazon ke darmiyan seconds
const THROTTLE_MS = 5000;   // 3 ring ka set khatam hone tak dobara nahi

function ctx() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  return _ctx;
}

function unlock() {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
}

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click'];
if (typeof window !== 'undefined') {
  UNLOCK_EVENTS.forEach((e) =>
    window.addEventListener(e, unlock, { capture: true, passive: true }));
}

/** Call once from a click handler (e.g. opening the chat) to pre-warm audio. */
export function primeChime() { unlock(); }

export async function playIncomingChime() {
  const now = Date.now();
  if (now - _lastPlayed < THROTTLE_MS) {
    console.log('[chime] skipped (throttled)');
    return;
  }
  _lastPlayed = now;

  const ac = ctx();
  if (!ac) { console.log('[chime] no AudioContext'); return; }

  /* resume() async hai: state foran nahi badalti, is liye uska intezar karo. */
  if (ac.state === 'suspended') {
    try { await ac.resume(); } catch (e) { /* ignore */ }
  }
  console.log('[chime] state:', ac.state);
  if (ac.state !== 'running') {
    console.log('[chime] BLOCKED: page par pehle ek click/key press karein');
    return;
  }

  const t0 = ac.currentTime + 0.05;
  const master = ac.createGain();
  master.gain.value = 0.8;
  master.connect(ac.destination);

  for (let n = 0; n < REPEAT_COUNT; n += 1) {
    [[880, 0.0], [1320, 0.09]].forEach(([freq, baseOffset]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const start = t0 + n * REPEAT_GAP + baseOffset;
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.4, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }
  console.log(`[chime] scheduled ${REPEAT_COUNT} rings`);
}

/* TEST: browser console me  __testChime()  likhein. */
if (typeof window !== 'undefined') {
  window.__testChime = () => { _lastPlayed = 0; return playIncomingChime(); };
}