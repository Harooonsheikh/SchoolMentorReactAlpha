/* ═══════════════════════════════════════════════════════════════════
   Voice note → MP3.

   Browser ka MediaRecorder MP3 record nahi karta (Chrome webm/opus, Safari
   mp4/aac deta hai), aur backend in extensions ko nahi pehchanta: "weba" bheji
   to file /ChatAssests/<guid>.dat ban kar save hui (messages 950/951), jo
   server serve hi nahi karta. Is liye recording ko bhejne se pehle MP3 me
   badalte hain:
     1. blob decode (AudioContext)
     2. OfflineAudioContext se mono 44.1 kHz (lame isi rate par sab se mehfooz)
     3. lamejs se 64 kbps MP3 — awaz ke liye kaafi, file choti.
   lamejs sirf yahan chahiye, is liye dynamic import — main bundle halka rehta hai.
   ═══════════════════════════════════════════════════════════════════ */

const SAMPLE_RATE = 44100;
const KBPS = 64;
const BLOCK = 1152;   // MP3 frame ka sample size

export async function encodeMp3(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || typeof window.OfflineAudioContext === 'undefined') {
    throw new Error('This browser cannot convert the voice message to MP3');
  }

  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close().catch(() => {});
  }

  /* Mono + 44.1 kHz — OfflineAudioContext channels khud mila deta hai. */
  const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
  const offline = new window.OfflineAudioContext(1, length, SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const floats = rendered.getChannelData(0);

  const pcm = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i += 1) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, KBPS);
  const chunks = [];
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));

  return new Blob(chunks, { type: 'audio/mpeg' });
}
