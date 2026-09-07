import React, { useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   MentorAIShared — reusable pieces used across 3+ Mentor AI Studio
   screens (Lesson Plans, Notebook Work, Worksheets, Design Studio).

   Styling lives entirely in MentorAI.jsx's MENTORAI_CSS block (single
   style block for the whole module, same convention as UP_CSS in
   UserPermissions.jsx — these components only ever render while the
   root MentorAI module is mounted, so no per-file <style> here.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── GeneratingProgress ───
   Cosmetic step tracker + rotating fact shown while a generation
   service call is in flight. `active` controls whether it's animating;
   the parent flips it false once the real service promise resolves. */
export function GeneratingProgress({ title = 'Working on it…', steps, facts, active }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const stepTimer = useRef(null);
  const factTimer = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    setStepIdx(0);
    stepTimer.current = setInterval(() => {
      setStepIdx(i => (i < steps.length - 1 ? i + 1 : i));
    }, Math.max(500, Math.round(2600 / steps.length)));
    factTimer.current = setInterval(() => setFactIdx(i => (i + 1) % facts.length), 2600);
    return () => { clearInterval(stepTimer.current); clearInterval(factTimer.current); };
  }, [active, steps.length, facts.length]);

  const progressPct = Math.round(((stepIdx + 1) / steps.length) * 100);

  return (
    <div className="msai-generating">
      <div className="msai-gen-spinner"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /></div>
      <div className="msai-gen-title">{title}</div>
      <div className="msai-gen-bar"><div className="msai-gen-bar-fill" style={{ width: `${progressPct}%` }} /></div>
      <div className="msai-gen-steps">
        {steps.map((s, i) => (
          <div key={s} className={`msai-gen-step${i < stepIdx ? ' done' : i === stepIdx ? ' active' : ''}`}>
            <span className="msai-gen-step-dot">
              {i < stepIdx ? <i className="fa-solid fa-check" aria-hidden="true" /> : i === stepIdx ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> : null}
            </span>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div className="msai-gen-fact"><i className="fa-solid fa-lightbulb" aria-hidden="true" /> {facts[factIdx]}</div>
    </div>
  );
}

/* ─── EditViaAIPanel ───
   Quick-edit chips + conversation thread + "Proposed Changes" card +
   Apply/Discard bar. `onSubmitInstruction` is called with the free-text
   instruction and must return { changes: string[] }; the panel shows
   those as the proposed-changes list and enables Apply. */
export function EditViaAIPanel({ quickChips = [], contextLabel, onSubmitInstruction, onApply, onDiscard, applying }) {
  const [text, setText] = useState('');
  const [thread, setThread] = useState([]);
  const [pending, setPending] = useState(false);
  const [proposed, setProposed] = useState(null);
  const [lastInstruction, setLastInstruction] = useState('');

  const send = async (raw) => {
    const instruction = (raw ?? text).trim();
    if (!instruction || pending) return;
    setThread(t => [...t, { role: 'user', text: instruction }]);
    setText('');
    setPending(true);
    try {
      const result = await onSubmitInstruction(instruction);
      setThread(t => [...t, { role: 'ai', text: 'Here\'s what I\'ll change:' }]);
      setProposed(result?.changes || []);
      setLastInstruction(instruction);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="msai-editai">
      {contextLabel && <div className="msai-editai-ctx">{contextLabel}</div>}
      <div className="msai-editai-chips">
        {quickChips.map(c => (
          <button key={c} type="button" className="msai-chip" onClick={() => send(c)} disabled={pending}>{c}</button>
        ))}
      </div>
      <div className="msai-editai-thread">
        {thread.length === 0 && !pending && (
          <div className="msai-editai-empty">Describe what you'd like to change, or tap a quick option above.</div>
        )}
        {thread.map((m, i) => (
          <div key={i} className={`msai-editai-msg ${m.role}`}>{m.text}</div>
        ))}
        {pending && <div className="msai-editai-msg ai"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Thinking…</div>}
      </div>
      {proposed && proposed.length > 0 && (
        <div className="msai-proposed">
          <div className="msai-proposed-h"><i className="fa-solid fa-list-check" aria-hidden="true" /> Proposed Changes ({proposed.length})</div>
          <ul className="msai-proposed-list">
            {proposed.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      <form className="msai-editai-composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe the change you want…"
          disabled={pending}
        />
        <VoiceDictationButton
          disabled={pending}
          onResult={t => setText(v => (v.trim() ? `${v.trim()} ${t}` : t))}
        />
        <button type="submit" disabled={!text.trim() || pending} aria-label="Send"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></button>
      </form>
      <div className="msai-editai-actions">
        <button type="button" className="msai-btn-secondary" onClick={onDiscard} disabled={applying}>Discard &amp; Try Again</button>
        <button
          type="button"
          className="msai-btn-primary"
          onClick={() => onApply(lastInstruction)}
          disabled={!proposed || applying}
        >
          {applying ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Applying…</> : 'Apply Changes & Regenerate'}
        </button>
      </div>
    </div>
  );
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
      onAdd({ id, kind, name: file.name, url });
    });
    e.target.value = '';
  };

  return (
    <>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={handleFiles('image')} />
      <input ref={pdfRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={handleFiles('pdf')} />
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
        <button type="button" className="msai-btn-secondary" onClick={() => pdfRef.current?.click()}><i className="fa-regular fa-file-pdf" aria-hidden="true" /> Upload PDF</button>
      </div>
    </>
  );
}

/* ─── VoiceDictationButton ───
   Drop-in mic button for any prompt/instruction field (single-line
   input or textarea) — same simulated recording → converting → result
   flow as the AI Chat Assistant composer's voice input, packaged so it
   doesn't need to be rebuilt at every call site. `onResult(text)` is
   called once "conversion" finishes; the caller decides whether to
   append or replace the field's current value. */
export function VoiceDictationButton({ onResult, disabled, className = 'msai-voice-mic' }) {
  const [state, setState] = useState(null); // null | 'recording' | 'converting'
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const start = () => {
    if (disabled) return;
    setState('recording'); setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };
  const stop = () => {
    clearInterval(timerRef.current);
    setState('converting');
    setTimeout(() => {
      onResult('This is a simulated voice transcript — connect a speech-to-text API to enable real transcription.');
      setState(null); setSeconds(0);
    }, 900);
  };

  if (state === 'recording') {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return (
      <button type="button" className={`${className} recording`} onClick={stop} aria-label={`Stop recording, ${mm}:${ss} elapsed`} title="Tap to stop">
        <i className="fa-solid fa-stop" aria-hidden="true" />
        <span className="msai-voice-mic-time">{mm}:{ss}</span>
      </button>
    );
  }
  if (state === 'converting') {
    return (
      <button type="button" className={`${className} converting`} disabled aria-label="Converting voice to text">
        <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={start} disabled={disabled} aria-label="Voice input" title="Voice input">
      <i className="fa-solid fa-microphone" aria-hidden="true" />
    </button>
  );
}
