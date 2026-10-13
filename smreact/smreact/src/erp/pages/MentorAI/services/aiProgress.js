import { useCallback, useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   aiProgress — real (not timer-driven) progress for Mentor AI jobs.

   A job moves through an ordered list of stages. Services report
   progress by calling `onProgress({ stage, fraction, detail })`:
     • stage     — key of the stage the job has actually reached
     • fraction  — 0..1 real progress *within* that stage when known
                   (upload bytes, download bytes, server-reported %),
                   or undefined when the stage has no measurable size
     • detail    — optional short text ("Uploading 2 files", "Queued")

   Percent = (completed stages + fraction of current stage) / total.
   It never moves backwards and is capped at 99 until `complete()` is
   called — i.e. 100% only once the result is actually in hand.
   ═══════════════════════════════════════════════════════════════════ */

export const STAGE_SETS = {
  chat: [
    { key: 'sending', label: 'Sending request' },
    { key: 'analyzing', label: 'Analyzing request' },
    { key: 'generating', label: 'Generating content' },
    { key: 'formatting', label: 'Formatting' },
    { key: 'finalizing', label: 'Finalizing' },
  ],
  lessonPlan: [
    { key: 'sending', label: 'Uploading pages' },
    { key: 'analyzing', label: 'Analyzing request' },
    { key: 'generating', label: 'Generating content' },
    { key: 'formatting', label: 'Formatting' },
    { key: 'finalizing', label: 'Finalizing' },
  ],
  worksheet: [
    { key: 'sending', label: 'Sending request' },
    { key: 'queued', label: 'Analyzing request' },
    { key: 'generating', label: 'Generating content' },
    { key: 'formatting', label: 'Formatting' },
    { key: 'finalizing', label: 'Finalizing' },
  ],
  design: [
    { key: 'sending', label: 'Sending request' },
    { key: 'queued', label: 'Analyzing request' },
    { key: 'generating', label: 'Generating design' },
    { key: 'finalizing', label: 'Finalizing' },
  ],
  edit: [
    { key: 'sending', label: 'Sending instruction' },
    { key: 'generating', label: 'Applying your changes' },
    { key: 'formatting', label: 'Formatting' },
    { key: 'finalizing', label: 'Finalizing' },
  ],
};

export const IDLE_PROGRESS = Object.freeze({
  status: 'idle', stages: [], stageIndex: -1, fraction: null, percent: 0, detail: '', error: null,
});

function computePercent(stages, stageIndex, fraction) {
  if (!stages.length || stageIndex < 0) return 0;
  const f = typeof fraction === 'number' && Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Math.min(99, Math.floor(((stageIndex + f) / stages.length) * 100));
}

/* Pure reducer — exported for tests. */
export function advanceProgress(prev, { stage, fraction, detail } = {}) {
  if (prev.status !== 'running') return prev;
  let stageIndex = prev.stageIndex;
  let nextFraction = prev.fraction;
  if (stage) {
    const idx = prev.stages.findIndex(s => s.key === stage);
    if (idx === -1) return prev;             // unknown stage — ignore
    if (idx < prev.stageIndex) return prev;   // never go backwards
    if (idx > prev.stageIndex) { stageIndex = idx; nextFraction = null; }
  }
  if (fraction !== undefined) {
    // Within a stage fraction only increases.
    nextFraction = fraction === null ? null : Math.max(prev.stageIndex === stageIndex ? (prev.fraction || 0) : 0, fraction);
  }
  const percent = Math.max(prev.percent, computePercent(prev.stages, stageIndex, nextFraction));
  return { ...prev, stageIndex, fraction: nextFraction, percent, detail: detail !== undefined ? detail : (stageIndex !== prev.stageIndex ? '' : prev.detail) };
}

export function startProgress(stages) {
  return { ...IDLE_PROGRESS, status: 'running', stages, stageIndex: 0, percent: 0 };
}

export function creepProgress(prev) {
  if (prev.status !== 'running' || !prev.stages.length) return prev;
  const n = prev.stages.length;
  const base = typeof prev.creep === 'number' ? Math.max(prev.creep, prev.percent) : prev.percent;
  const step = Math.max(0.05, (95 - base) * 0.02);
  const creep = Math.min(95, base + step);
  const percent = Math.max(prev.percent, Math.floor(creep));
  const visualStage = Math.min(n - 2, Math.floor((percent / 100) * n));
  const stageIndex = Math.max(prev.stageIndex, visualStage);
  if (percent === prev.percent && stageIndex === prev.stageIndex) return { ...prev, creep };
  return {
    ...prev, creep, percent, stageIndex,
    fraction: stageIndex !== prev.stageIndex ? null : prev.fraction,
    detail: stageIndex !== prev.stageIndex ? '' : prev.detail,
  };
}
export const EXPECTED_MS = 3 * 60 * 1000;
const PACE_TICK_MS = 1000;

export function timePercent(elapsedMs) {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs <= EXPECTED_MS) return (elapsedMs / EXPECTED_MS) * 95;
  const over = elapsedMs - EXPECTED_MS;
  return 95 + 4 * (1 - Math.exp(-over / (2 * 60 * 1000)));
}

export function paceProgress(prev, elapsedMs) {
  if (prev.status !== 'running' || !prev.stages.length) return prev;
  const percent = Math.min(99, Math.max(prev.percent, Math.floor(timePercent(elapsedMs))));
  const timeStage = Math.min(prev.stages.length - 1, Math.floor((percent / 100) * prev.stages.length));
  const stageIndex = Math.max(prev.stageIndex, timeStage);
  if (percent === prev.percent && stageIndex === prev.stageIndex) return prev;
  const movedStage = stageIndex !== prev.stageIndex;
  return { ...prev, percent, stageIndex,
    fraction: movedStage ? null : prev.fraction,
    detail: movedStage ? '' : prev.detail };
}

export function isCancelError(err) {
  return !!err && (
    err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError'
    || err.kind === 'cancelled' || err.__CANCEL__ === true
  );
}

export function isTimeoutError(err) {
  return !!err && (
    err.kind === 'timeout' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT'
    || /timed? ?out/i.test(err.message || '')
  );
}

/* Promise-based delay that rejects immediately when the signal aborts
   (used by the status-polling loops so Cancel stops polling at once). */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(makeCancelError()); return; }
    const t = setTimeout(() => { signal?.removeEventListener?.('abort', onAbort); resolve(); }, ms);
    function onAbort() { clearTimeout(t); reject(makeCancelError()); }
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

export function makeCancelError() {
  const e = new Error('Cancelled');
  e.name = 'CanceledError';
  e.code = 'ERR_CANCELED';
  return e;
}

/* axios config fragment that maps real upload/download byte progress
   onto stages. `total` is unknown for many responses, in which case
   the stage is still advanced but its fraction stays indeterminate. */
export function axiosProgressConfig(onProgress, { uploadStage = 'sending', waitStage = 'analyzing', downloadStage = 'generating' } = {}) {
  if (!onProgress) return {};
  let uploadDone = false;
  return {
    onUploadProgress: (e) => {
      const total = e?.total || e?.event?.total;
      const loaded = e?.loaded ?? e?.event?.loaded ?? 0;
      if (total) {
        onProgress({ stage: uploadStage, fraction: loaded / total });
        if (loaded >= total && !uploadDone) { uploadDone = true; onProgress({ stage: waitStage }); }
      }
    },
    onDownloadProgress: (e) => {
      const total = e?.total || e?.event?.total;
      const loaded = e?.loaded ?? e?.event?.loaded ?? 0;
      onProgress({ stage: downloadStage, fraction: total ? loaded / total : undefined });
    },
  };
}

/* Maps a server job-status payload to a stage + fraction. Uses the
   server's own percentage/stage fields when present. */
export function stageFromJobStatus(result) {
  const status = String(result?.status || result?.state || '').toLowerCase();
  const rawPct = result?.progress ?? result?.percent ?? result?.percentage ?? result?.progress_percent;
  let fraction;
  if (typeof rawPct === 'number' && Number.isFinite(rawPct)) fraction = rawPct > 1 ? rawPct / 100 : rawPct;
  const detail = result?.stage_label || result?.stage || result?.message || '';
  if (['pending', 'queued', 'waiting', 'created', 'submitted'].includes(status)) {
    return { stage: 'queued', fraction: undefined, detail: typeof detail === 'string' ? detail : '' };
  }
  return { stage: 'generating', fraction, detail: typeof detail === 'string' ? detail : '' };
}

/* ─── React hook ───────────────────────────────────────────────── */
export function useJobProgress() {
  const [progress, setProgress] = useState(IDLE_PROGRESS);
  const abortRef = useRef(null);
  const startedAtRef = useRef(0);
  const running = progress.status === 'running';

  // Leaving the screen aborts whatever it was still running.
  useEffect(() => () => abortRef.current?.abort(), []);

  const isRunning = progress.status === 'running';
  useEffect(() => {
    if (!isRunning) return undefined;
    const t = setInterval(() => setProgress(prev => creepProgress(prev)), 500);
    return () => clearInterval(t);
  }, [isRunning]);

  // Move the bar every second over 3 minutes.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setProgress(prev => paceProgress(prev, Date.now() - startedAtRef.current));
    }, PACE_TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback((stages) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = Date.now();
    setProgress(startProgress(stages));
    return controller.signal;
  }, []);

  const report = useCallback((update) => {
    setProgress(prev => advanceProgress(prev, update));
  }, []);

  const complete = useCallback(() => {
    abortRef.current = null;
    setProgress(prev => (prev.status === 'running'
      ? { ...prev, status: 'done', stageIndex: prev.stages.length - 1, fraction: 1, percent: 100, detail: '' }
      : prev));
  }, []);

  const fail = useCallback((err, message) => {
    abortRef.current = null;
    const status = isCancelError(err) ? 'cancelled' : isTimeoutError(err) ? 'timeout' : 'error';
    setProgress(prev => ({ ...prev, status, error: message || err?.message || 'Something went wrong.' }));
    return status;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(IDLE_PROGRESS);
  }, []);

  return {
    progress, start, report, complete, fail, cancel, reset,
    running,
  };
}
