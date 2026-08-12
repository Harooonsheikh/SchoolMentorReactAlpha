/* ════════════════════════════════════════════════════════════════════
   Voice note ko us shakl me lana jo Support API qubool karti hai.

   MediaRecorder Chrome/Edge par sirf WebM (Opus) deta hai, aur upload route
   voice ke liye WebM leti hi nahi:
     POST /api/support/messages/attachment  (category=voice, file=x.webm)
     → { success:false, message:"File type '.webm' is not allowed for voice" }
   Live check par voice ke liye .mp3 / .wav / .m4a / .ogg chalti hain (.webm aur
   .aac nahi). Is liye jab browser koi qabil-e-qubool container na de, recording
   ko yahin WAV me badal kar bhejte hain — koi library nahi, sirf Web Audio:
   decode → mono → 16 kHz → 16-bit PCM.

   16 kHz mono guftagu ke liye kaafi hai aur file chhoti rakhta hai
   (~32 KB fi second ke bajaye ~32 KB fi second ka aadha se bhi kam:
    16000 × 2 bytes = 32 KB/sec, yani 30 second ka voice note ~1 MB).
   ════════════════════════════════════════════════════════════════════ */

/** Voice ke liye API par allowed extensions (live tasdeeq shuda). */
export const VOICE_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg'];

const TARGET_SAMPLE_RATE = 16000;

/** MediaRecorder ke mime se file extension. */
export function voiceExtForMime(mime) {
  const t = String(mime || '').toLowerCase();
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  if (t.includes('webm')) return 'webm';
  return 'webm';
}

/**
 * Recording ko upload ke qabil bana kar do.
 * @returns {Promise<{ blob: Blob, ext: string, converted: boolean }>}
 * Container pehle se allowed ho to blob waisa ka waisa; warna WAV.
 */
export async function toUploadableVoice(blob, mimeType) {
  const ext = voiceExtForMime(mimeType || blob?.type);
  if (VOICE_EXTENSIONS.includes(ext)) return { blob, ext, converted: false };
  const wav = await blobToWav(blob);
  return { blob: wav, ext: 'wav', converted: true };
}

/** Kisi bhi decode-able audio blob ko 16 kHz mono WAV me. */
export async function blobToWav(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx || !Offline) throw new Error('Web Audio not available');

  const bytes = await blob.arrayBuffer();
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(bytes);
  } finally {
    /* Safari me close() promise deta hai, kahin nahi hota — dono soorat me
       chhorr do, decode ho chuka hai. */
    try { ctx.close(); } catch (e) { /* ignore */ }
  }

  /* Rendering hi resample bhi kar deti hai. Stereo source mono destination se
     jurne par khud downmix ho jata hai. */
  const rate = Math.min(TARGET_SAMPLE_RATE, decoded.sampleRate);
  const frames = Math.max(1, Math.ceil(decoded.duration * rate));
  const offline = new Offline(1, frames, rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), rate);
}

/** Float32 samples → 16-bit PCM WAV blob. */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);        // PCM header ki lambai
  view.setUint16(20, 1, true);         // format: PCM
  view.setUint16(22, 1, true);         // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);  // byte rate (mono × 2 bytes)
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    /* Clip karo warna overflow par shor aata hai. */
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}
