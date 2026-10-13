import React, { useEffect, useRef, useState } from 'react';
import ProgressBar from './ProgressBar';
import { STAGE_SETS, useJobProgress } from './services/aiProgress';
import { saveLibraryItem } from './services/mentorAILibraryService';
import { usePermissions } from '../../context/PermissionsContext';

/* ═══════════════════════════════════════════════════════════════════
   MentorAIShared — reusable pieces used across 3+ Mentor AI Studio
   screens (Lesson Plans, Notebook Work, Worksheets, Design Studio).

   Styling lives entirely in MentorAI.jsx's MENTORAI_CSS block (single
   style block for the whole module, same convention as UP_CSS in
   UserPermissions.jsx — these components only ever render while the
   root MentorAI module is mounted, so no per-file <style> here.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── GeneratingProgress ───
   Full-card progress for a generation job. Progress comes from the
   real job state (`progress` from useJobProgress) and is rendered by
   the shared <ProgressBar>; the rotating tip below it is only a
   "did you know" line and has no bearing on the percentage. */
export function GeneratingProgress({ title = 'Working on it…', progress, facts = [], onCancel, onRetry, onDismiss, dismissLabel }) {
  const [factIdx, setFactIdx] = useState(0);
  const running = progress?.status === 'running';

  useEffect(() => {
    if (!running || facts.length < 2) return undefined;
    const t = setInterval(() => setFactIdx(i => (i + 1) % facts.length), 4000);
    return () => clearInterval(t);
  }, [running, facts.length]);

  return (
    <div className="msai-generating">
      <div className="msai-gen-spinner"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /></div>
      <ProgressBar
        progress={progress}
        title={title}
        onCancel={onCancel}
        onRetry={onRetry}
        onDismiss={onDismiss}
        dismissLabel={dismissLabel}
      />
      {running && facts.length > 0 && (
        <div className="msai-gen-fact"><i className="fa-solid fa-lightbulb" aria-hidden="true" /> {facts[factIdx % facts.length]}</div>
      )}
    </div>
  );
}

/* ─── EditViaAIPanel ───
   Quick-edit chips + conversation thread + "Proposed Changes" card +
   Apply/Discard bar.

   onSubmitInstruction(instruction, { base, signal, onProgress })
     Must call the AI and resolve { result, changes }:
       • base      — the draft from the previous instruction in this
                     thread (null for the first one); edit THAT, so
                     follow-up instructions refine the same draft
       • signal    — AbortSignal wired to the panel's Cancel button
       • onProgress— real progress reporter for the shared ProgressBar
     Throw on failure; the panel shows the error and keeps Apply off.
   onApply(proposal)
     Receives { result, changes, instructions } — exactly the draft the
     user reviewed. Nothing is re-requested on Apply.
   onDiscard()  close without changing anything. */
export function EditViaAIPanel({ quickChips = [], contextLabel, onSubmitInstruction, onApply, onDiscard, applying = false }) {
  const [text, setText] = useState('');
  const [thread, setThread] = useState([]);
  const [proposal, setProposal] = useState(null);
  const job = useJobProgress();
  const pending = job.running;
  const threadRef = useRef(null);

  useEffect(() => () => job.cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [thread, pending]);

  const send = async (raw) => {
    const instruction = (raw ?? text).trim();
    if (!instruction || pending || applying) return;
    setThread(t => [...t, { role: 'user', text: instruction }]);
    setText('');
    const signal = job.start(STAGE_SETS.edit);
    try {
      const res = await onSubmitInstruction(instruction, { base: proposal?.result ?? null, signal, onProgress: job.report });
      if (!res || res.result == null) throw new Error('Mentor AI returned no usable content for this edit. Please try rephrasing.');
      job.complete();
      const changes = res.changes?.length ? res.changes : ['Content updated based on your request.'];
      setProposal(prev => ({ result: res.result, changes, instructions: [...(prev?.instructions || []), instruction] }));
      setThread(t => [...t, { role: 'ai', text: proposal ? 'Updated the draft — here\'s what changed:' : 'Here\'s what I\'ll change:' }]);
    } catch (e) {
      const status = job.fail(e, e?.message);
      setThread(t => [...t, status === 'cancelled'
        ? { role: 'ai', text: 'Cancelled — nothing was changed.' }
        : { role: 'error', text: status === 'timeout' ? 'The edit timed out. Please try again.' : (e?.message || 'Edit failed. Please try again.') }]);
    }
  };

  const discard = () => { job.cancel(); onDiscard?.(); };

  return (
    <div className="msai-editai">
      {contextLabel && <div className="msai-editai-ctx">{contextLabel}</div>}
      <div className="msai-editai-chips">
        {quickChips.map(c => (
          <button key={c} type="button" className="msai-chip" onClick={() => send(c)} disabled={pending || applying}>{c}</button>
        ))}
      </div>
      <div className="msai-editai-thread" ref={threadRef}>
        {thread.length === 0 && !pending && (
          <div className="msai-editai-empty">Describe what you'd like to change, or tap a quick option above.</div>
        )}
        {thread.map((m, i) => (
          <div key={i} className={`msai-editai-msg ${m.role}`}>
            {m.role === 'error' && <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />} {m.text}
          </div>
        ))}
        {pending && <ProgressBar progress={job.progress} compact onCancel={job.cancel} />}
      </div>
      {proposal && proposal.changes.length > 0 && (
        <div className="msai-proposed">
          <div className="msai-proposed-h"><i className="fa-solid fa-list-check" aria-hidden="true" /> Proposed Changes ({proposal.changes.length})</div>
          <ul className="msai-proposed-list">
            {proposal.changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      <form className="msai-editai-composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={proposal ? 'Refine further, or Apply…' : 'Describe the change you want…'}
          disabled={pending || applying}
        />
        <VoiceDictationButton
          disabled={pending || applying}
          onResult={t => setText(v => (v.trim() ? `${v.trim()} ${t}` : t))}
        />
        <button type="submit" disabled={!text.trim() || pending || applying} aria-label="Send"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></button>
      </form>
      <div className="msai-editai-actions">
        <button type="button" className="msai-btn-secondary" onClick={discard} disabled={applying}>Discard</button>
        <button
          type="button"
          className="msai-btn-primary"
          onClick={() => proposal && onApply(proposal)}
          disabled={!proposal || pending || applying}
        >
          {applying ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Applying…</> : 'Apply Changes'}
        </button>
      </div>
    </div>
  );
}

/* ─── SaveToLibraryButton ───
   Persists an item via mentorAILibraryService. `build()` returns
   { type, title, content, sourceKey } (throw to show a message instead).
   Guards against double-clicks, toasts success / "already saved" /
   errors, and resets when `resetKey` changes (e.g. after an AI edit). */
export function SaveToLibraryButton({ toast, build, resetKey, className = 'msai-btn-secondary', label = 'Save to Library', iconOnly = false, perm }) {
  const { can } = usePermissions();  const [state, setState] = useState('idle'); // idle | saving | saved
  useEffect(() => { setState('idle'); }, [resetKey]);

  const click = async () => {
    if (state === 'saving') return;
    let payload;
    try { payload = build(); } catch (e) { toast?.(e?.message || 'Nothing to save yet.'); return; }
    setState('saving');
    try {
      const { duplicate } = await saveLibraryItem(payload);
      setState('saved');
      toast?.(duplicate ? 'Already saved in your Library' : 'Saved to Library');
    } catch (e) {
      setState('idle');
      toast?.(e?.message || 'Could not save to Library. Please try again.');
    }
  };

  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : label;
  const icon = state === 'saving' ? 'fa-solid fa-spinner fa-spin' : state === 'saved' ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
  if (perm && !can('Mentor AI', perm, 'download')) return null;  return (
    <button type="button" className={className} onClick={click} disabled={state === 'saving'} aria-label={iconOnly ? text : undefined} aria-busy={state === 'saving'}>
      <i className={icon} aria-hidden="true" /> {iconOnly ? null : text}
    </button>
  );
}

/* ─── downloadFile ───
   Saves a file (e.g. a worksheet PDF) straight to the user's Downloads
   instead of opening it in a tab. Needs the file host to allow CORS;
   if it doesn't, falls back to opening the file in a new tab. */


/* ─── VersionBadge — small "Version N — Updated" pulsing pill ─── */
/* ─── downloadFile ───
   Saves a file straight to the user's Downloads folder on click.
   Falls back to opening in a new tab if the file host blocks CORS. */
function safeName(name, fallback) {
  return String(name || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 120) || fallback;
}

function extFromType(type) {
  if (!type) return '';
  if (type.includes('pdf')) return '.pdf';
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  if (type.includes('webp')) return '.webp';
  return '';
}

function clickDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadFile(url, filename = 'download.pdf') {
  if (!url) return false;
  let name = safeName(filename, 'download');
  let absolute;
  try { absolute = new URL(url, window.location.href); } catch { return false; }

  try {
    const res = await fetch(absolute.href, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += extFromType(blob.type);
    const href = URL.createObjectURL(blob);
    clickDownload(href, name);
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    return 'saved';
  } catch (e) {
    if (absolute.origin === window.location.origin) {
      clickDownload(absolute.href, name);
      return 'saved';
    }
    console.warn('Direct download blocked (file host has no CORS). Opening instead:', e);
    window.open(absolute.href, '_blank', 'noopener');
    return 'opened';
  }
}

/* ─── VersionBadge — small "Version N — Updated" pulsing pill ─── */
export function VersionBadge({ version }) {
  if (!version || version <= 1) return null;
  return (
    <span className="msai-version-pill">
      <span className="msai-version-dot" /> Version {version} — Updated
    </span>
  );
}
/* Revoke every object URL in an attachment list — call this from a
   screen's reset()/unmount so blob: URLs don't leak once the images
   are no longer shown. */
export function revokeAttachments(list) {
  (list || []).forEach(it => { if (it.url) URL.revokeObjectURL(it.url); });
}

/* ─── AttachmentPicker ───
   "Upload Photo" / "Upload PDF" buttons + a preview strip of what's
   been added so far, each item removable. Used by Lesson Plans'
   scan step, Worksheets' reference pictures, and Design Studio's
   reference images — parent owns the `items` array (controlled),
   this component only handles picking files and rendering previews.
   `formatName(item, index)` lets a caller customize the label (e.g.
   Lesson Plans shows "Page 1 — file.png"). */
export function AttachmentPicker({ items, onAdd, onRemove, formatName }) {
  const photoRef = useRef(null);
  const pdfRef = useRef(null);
  const idRef = useRef(0);

  const handleFiles = (kind) => (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const id = ++idRef.current;
      const url = kind === 'image' ? URL.createObjectURL(file) : null;
onAdd({ 
    id, 
    kind, 
    name: file.name, 
    url,
    file
});    });
    e.target.value = '';
  };

  return (
    <>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={handleFiles('image')} />
      {/* <input ref={pdfRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={handleFiles('pdf')} /> */}
      {items.length > 0 && (
        <div className="msai-attach-preview">
          {items.map((it, i) => (
            <div key={it.id} className="msai-attach-preview-item">
              {it.kind === 'image'
                ? <img src={it.url} alt="" className="msai-attach-preview-thumb" />
                : <span className="msai-attach-preview-icon"><i className="fa-regular fa-file-pdf" aria-hidden="true" /></span>}
              <span className="msai-attach-preview-name" title={it.name}>{formatName ? formatName(it, i) : it.name}</span>
              <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name}`}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="msai-scan-actions">
        <button type="button" className="msai-btn-secondary" onClick={() => photoRef.current?.click()}><i className="fa-regular fa-image" aria-hidden="true" /> Upload Photo</button>
        {/* Upload PDF hidden */}
      </div>
    </>
  );
}

/* ─── VoiceDictationButton ───
   Mic button for any prompt / instruction field (Edit via AI, Lesson
   Plans, Notebook, Worksheets, Design Studio). Uses the browser's
   speech recognition — the same engine as the AI Chat Assistant mic —
   and shows a running mm:ss timer while recording. Tap again to stop;
   `onResult(text)` receives what was said and the caller decides
   whether to append or replace. Recording also stops by itself after a
   long silence. (Previously this button never started recording and
   only inserted a "simulated transcript" placeholder.) */
export function VoiceDictationButton({ onResult, disabled, className = 'msai-voice-mic', lang = 'en-US' }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const finalRef = useRef('');
  const activeRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; try { rec.abort(); } catch { /* ignore */ } }
  }, []);

  const finish = () => {
    clearInterval(timerRef.current);
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
    const text = finalRef.current.replace(/\s+/g, ' ').trim();
    finalRef.current = '';
    if (text) onResultRef.current?.(text);
  };

  // Har dafa NAYA recognition object banta hai — Chrome purane ko restart nahi karne deta
  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalRef.current += `${event.results[i][0].transcript} `;
      }
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        activeRef.current = false;
        alert('Microphone access is blocked. Allow microphone permission for this site and try again.');
      }
    };
    rec.onend = () => {
      // Chup hone pe browser khud band kare to dobara sunna shuru karo
      if (activeRef.current) {
        setTimeout(() => { if (activeRef.current) listen(); }, 250);
      } else {
        finish();
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch (e) { console.warn('Voice input could not start:', e); }
  };

  const start = () => {
    if (disabled || recording) return;
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      alert('Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }
    finalRef.current = '';
    activeRef.current = true;
    listen();
    setRecording(true);
    setSeconds(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  // Sirf Stop dabane pe band ho
  const stop = () => {
    activeRef.current = false;
    const rec = recRef.current;
    if (rec) {
      rec.onend = null;
      try { rec.stop(); } catch { /* ignore */ }
    }
    setTimeout(finish, 800); // aakhri lafz aane ka waqt
  };

  if (recording) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return (
      <button type="button" className={`${className} recording`} onClick={stop} aria-label={`Stop recording, ${mm}:${ss} elapsed`} title="Tap to stop">
        <i className="fa-solid fa-stop" aria-hidden="true" />
        <span className="msai-voice-mic-time">{mm}:{ss}</span>
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={() => start()} disabled={disabled} aria-label="Voice input" title="Voice input">
      <i className="fa-solid fa-microphone" aria-hidden="true" />
    </button>
  );
}