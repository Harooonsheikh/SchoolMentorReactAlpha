/* ════════════════════════════════════════════════════════════════════
   useVoiceRecorder — real microphone capture via MediaRecorder.
   - start(): request mic, begin recording, tick seconds
   - cancel(): stop + discard
   - stop(): stop + resolve { blob, durationSec, mimeType }
   - auto-stops at MAX_SECONDS (5 minutes) and fires onAutoStop
   Produces audio/webm (Opus) where supported, falling back to the browser
   default. localhost is a secure context so getUserMedia works in dev.
   ════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 300; // 5 minutes

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export function useVoiceRecorder({ onAutoStop } = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const resolveRef = useRef(null);
  const mimeRef = useRef('');
  const secondsRef = useRef(0);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      mimeRef.current = mimeType;
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = mimeRef.current || rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const dur = secondsRef.current;
        cleanup();
        setSeconds(0);
        if (resolveRef.current) { resolveRef.current({ blob, durationSec: dur, mimeType: type }); resolveRef.current = null; }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_VOICE_SECONDS) {
          // Auto-stop at the 5-minute cap.
          stop().then((res) => onAutoStop?.(res)).catch(() => {});
        }
      }, 1000);
      return true;
    } catch (err) {
      setError(err);
      cleanup();
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);

  const stop = useCallback(() => new Promise((resolve) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') { resolve(null); return; }
    resolveRef.current = resolve;
    rec.stop();
  }), []);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    resolveRef.current = null;
    if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
    cleanup();
    setSeconds(0);
    secondsRef.current = 0;
  }, [cleanup]);

  useEffect(() => () => cancel(), [cancel]);

  return { recording, seconds, error, start, stop, cancel };
}
