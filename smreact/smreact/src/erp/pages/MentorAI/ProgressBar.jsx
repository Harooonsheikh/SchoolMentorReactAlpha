import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   ProgressBar — the single progress indicator for every Mentor AI job
   (chat replies, lesson plans, worksheets, design studio, edits).

   Driven entirely by the `progress` object from useJobProgress()
   (services/aiProgress.js) — it renders what the job has actually
   reached and never animates on a timer of its own. When the current
   stage has no measurable size, the fill stays at the real percent and
   a shimmer shows that work is in flight.

   Props
     progress   { status, stages, stageIndex, fraction, percent, detail, error }
     title      optional heading (full variant only)
     compact    inline single-row variant (chat bubble, edit panel)
     onCancel   shows a Cancel button while running
     onRetry    shows a Retry button after error / timeout / cancel
     onDismiss  shows a Close/Back button after error / timeout / cancel
   Styling: .msai-pb-* rules in MentorAI.jsx's MENTORAI_CSS.
   ═══════════════════════════════════════════════════════════════════ */

const END_TEXT = {
  error: 'Something went wrong.',
  timeout: 'This is taking longer than expected and timed out.',
  cancelled: 'Cancelled.',
};

export default function ProgressBar({ progress, title, compact = false, onCancel, onRetry, onDismiss, dismissLabel = 'Back' }) {
  if (!progress || progress.status === 'idle') return null;
  const { status, stages = [], stageIndex, fraction, percent, detail, error } = progress;
  const running = status === 'running';
  const ended = status === 'error' || status === 'timeout' || status === 'cancelled';
  const current = stages[Math.max(0, stageIndex)] || null;
  const indeterminate = running && (fraction === null || fraction === undefined);
  const label = status === 'done' ? 'Done' : ended ? (error || END_TEXT[status]) : (current?.label || 'Working…');

  return (
    <div
      className={`msai-pb${compact ? ' msai-pb--compact' : ''} msai-pb--${status}`}
      role="status"
      aria-live="polite"
    >
      {!compact && title && <div className="msai-pb-title">{title}</div>}

      <div className="msai-pb-row">
        <div className="msai-pb-label">
          {running && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />}
          {status === 'done' && <i className="fa-solid fa-circle-check" aria-hidden="true" />}
          {ended && <i className={`fa-solid ${status === 'cancelled' ? 'fa-ban' : 'fa-triangle-exclamation'}`} aria-hidden="true" />}
          <span>{label}</span>
          {running && detail ? <span className="msai-pb-detail">· {detail}</span> : null}
        </div>
        {!ended && <span className="msai-pb-pct">{percent}%</span>}
      </div>

      <div
        className={`msai-pb-track${indeterminate ? ' is-indeterminate' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ended ? undefined : percent}
        aria-valuetext={label}
      >
        <div className="msai-pb-fill" style={{ width: `${ended ? percent : Math.max(percent, 2)}%` }} />
      </div>

      {!compact && stages.length > 0 && (
        <ol className="msai-pb-stages">
          {stages.map((s, i) => {
            const state = status === 'done' || i < stageIndex ? 'done' : i === stageIndex ? (ended ? 'failed' : 'active') : 'todo';
            return (
              <li key={s.key} className={`msai-pb-stage is-${state}`}>
                <span className="msai-pb-stage-dot" aria-hidden="true">
                  {state === 'done' && <i className="fa-solid fa-check" />}
                  {state === 'active' && <i className="fa-solid fa-spinner fa-spin" />}
                  {state === 'failed' && <i className="fa-solid fa-xmark" />}
                </span>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {(running && onCancel) || (ended && (onRetry || onDismiss)) ? (
        <div className="msai-pb-actions">
          {running && onCancel && (
            <button type="button" className="msai-btn-secondary msai-pb-btn" onClick={onCancel}>
              <i className="fa-solid fa-xmark" aria-hidden="true" /> Cancel
            </button>
          )}
          {ended && onDismiss && (
            <button type="button" className="msai-btn-secondary msai-pb-btn" onClick={onDismiss}>{dismissLabel}</button>
          )}
          {ended && onRetry && (
            <button type="button" className="msai-btn-primary msai-pb-btn" onClick={onRetry}>
              <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Retry
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
