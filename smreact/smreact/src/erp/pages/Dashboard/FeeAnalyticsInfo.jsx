import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DASH_MODAL_CSS } from './dashModalCss';
import { feeAnalyticsHelpContent, FEE_ANALYTICS_FLOW } from './feeAnalyticsHelpData';

/* ═══════════════════════════════════════════════════════════════════
   FeeAnalyticsInfoButton / FeeAnalyticsInfoModal

   A single small "i" info affordance for each of the 5 Fee Analytics
   cards, explaining how that card's numbers are calculated — purely
   informational, reads from feeAnalyticsHelpContent, never touches
   the live figures rendered on the cards themselves. One reusable
   pair instead of 5 duplicated modals; content varies by `cardKey`.
   ═══════════════════════════════════════════════════════════════════ */
export function FeeAnalyticsInfoButton({ cardKey }) {
  const [open, setOpen] = useState(false);
  const content = feeAnalyticsHelpContent[cardKey];
  if (!content) return null;

  return (
    <>
      <button
        type="button"
        className="fa-info-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`How is "${content.title}" calculated?`}
        title="How is this calculated?"
      >
        <i className="fa-solid fa-info" aria-hidden="true"></i>
      </button>
      {open && <FeeAnalyticsInfoModal cardKey={cardKey} onClose={() => setOpen(false)} />}
      {/* Portalled to <head> — rendering this inline inside .fc-header
          (a flex row) made each instance an extra flex item, showing up
          as a small empty box next to the button. */}
      {createPortal(<style>{FAI_CSS}</style>, document.head)}
    </>
  );
}

export function FeeAnalyticsInfoModal({ cardKey, onClose }) {
  const content = feeAnalyticsHelpContent[cardKey];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!content) return null;

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="fai-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--sm fai-modal">
        {/* ─── Head ─── */}
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className={`fa-solid ${content.icon}`} aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="fai-modal-title">{content.title}</div>
              <div className="up-modal-sub">How is this calculated?</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="up-modal-body fai-body">
          <div className="fai-scope">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>{content.scope}</span>
          </div>

          <p className="fai-desc">{content.description}</p>

          <div className="fai-section-h">Data used</div>
          <ul className="fai-list">
            {content.dataPoints.map((d, i) => <li key={i}>{d}</li>)}
          </ul>

          {content.formula && (
            <>
              <div className="fai-section-h">Formula</div>
              <div className="fai-formula">
                {content.formula.parts.map((p, i) => (
                  p.op
                    ? <span key={i} className="fai-formula-op">{p.op}</span>
                    : (
                      <div key={i} className="fai-formula-part">
                        <span className="fai-formula-lbl">{p.label}</span>
                        <span className="fai-formula-val">{p.value}</span>
                      </div>
                    )
                ))}
                <span className="fai-formula-op fai-formula-op--eq">=</span>
                <div className="fai-formula-part fai-formula-part--result">
                  <span className="fai-formula-lbl">{content.formula.result.label}</span>
                  <span className="fai-formula-val">{content.formula.result.value}</span>
                </div>
              </div>
              <div className="fai-example-note">{content.formula.note}</div>
            </>
          )}

          {content.example && (
            <>
              <div className="fai-section-h">Example</div>
              <div className="fai-example">
                {content.example.rows.map(([k, v], i) => (
                  <div key={i} className="fai-example-row">
                    <span>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
              <div className="fai-example-note">{content.example.note}</div>
            </>
          )}

          {content.showRelationship && (
            <>
              <div className="fai-section-h">How the 5 cards relate</div>
              <div className="fai-flow">
                {FEE_ANALYTICS_FLOW.map((f) => (
                  <React.Fragment key={f.key}>
                    <div className={`fai-flow-node${f.key === cardKey ? ' fai-flow-node--active' : ''}`}>{f.label}</div>
                    {f.op && <div className="fai-flow-op">{f.op}</div>}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── Foot ─── */}
        <div className="up-modal-foot up-modal-foot--center">
          <button type="button" className="up-btn up-btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
    </div>
  ), document.body);
}

const FAI_CSS = `
.fa-info-btn {
  width: 22px; height: 22px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  margin-left: auto;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10.5px;
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
  animation: faiPulse 2.6s ease-in-out infinite;
  transition: transform .15s ease, background .15s ease;
}
.fa-info-btn:hover {
  background: rgba(30, 64, 175, .2);
  transform: scale(1.12);
  animation-play-state: paused;
}
/* Fee Received / Pending Fee use the 2-column .fa-large-row layout, so
   an inline .fc-header button only reaches the edge of the left
   column, not the card's actual corner. Pin it to the real card
   corner instead (.fee-card already has position:relative). */
.fa-large .fa-info-btn {
  position: absolute;
  top: 18px; right: 18px;
  margin-left: 0;
  z-index: 1;
}
.fc-tone--red .fa-info-btn { background: rgba(220, 38, 38, .12); color: #DC2626; }
.fc-tone--red .fa-info-btn:hover { background: rgba(220, 38, 38, .2); }
.fc-tone--green .fa-info-btn { background: rgba(22, 163, 74, .12); color: #16A34A; }
.fc-tone--green .fa-info-btn:hover { background: rgba(22, 163, 74, .2); }
.fc-tone--slate .fa-info-btn { background: rgba(71, 85, 105, .12); color: #475569; }
.fc-tone--slate .fa-info-btn:hover { background: rgba(71, 85, 105, .2); }

[data-theme="dark"] .fa-info-btn { background: rgba(96, 165, 250, .16); color: #93C5FD; }
[data-theme="dark"] .fc-tone--red .fa-info-btn { background: rgba(248, 113, 113, .16); color: #FCA5A5; }
[data-theme="dark"] .fc-tone--green .fa-info-btn { background: rgba(74, 222, 128, .16); color: #86EFAC; }
[data-theme="dark"] .fc-tone--slate .fa-info-btn { background: rgba(148, 163, 184, .16); color: #CBD5E1; }

@keyframes faiPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(30, 64, 175, .28); }
  50% { box-shadow: 0 0 0 5px rgba(30, 64, 175, 0); }
}
.fc-tone--red .fa-info-btn { animation-name: faiPulseRed; }
.fc-tone--green .fa-info-btn { animation-name: faiPulseGreen; }
.fc-tone--slate .fa-info-btn { animation-name: faiPulseSlate; }
@keyframes faiPulseRed {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, .28); }
  50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0); }
}
@keyframes faiPulseGreen {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, .28); }
  50% { box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
}
@keyframes faiPulseSlate {
  0%, 100% { box-shadow: 0 0 0 0 rgba(71, 85, 105, .28); }
  50% { box-shadow: 0 0 0 5px rgba(71, 85, 105, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .fa-info-btn { animation: none; }
}

.fai-body { display: flex; flex-direction: column; gap: 14px; }
.fai-scope {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(30, 64, 175, .08);
  color: #1E40AF;
  font: 600 12px/1.5 var(--dm-font);
}
.fai-scope i { font-size: 12px; margin-top: 2px; flex-shrink: 0; }
[data-theme="dark"] .fai-scope { background: rgba(96, 165, 250, .1); color: #93C5FD; }

.fai-desc {
  font: 500 13px/1.65 var(--dm-font);
  color: var(--text-secondary, #334155);
  margin: 0;
}

.fai-section-h {
  font: 800 11px/1 var(--dm-font);
  text-transform: uppercase; letter-spacing: .5px;
  color: var(--text-muted, #64748B);
}

.fai-list { margin: -6px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.fai-list li { font: 500 12.5px/1.5 var(--dm-font); color: var(--text-secondary, #334155); }

.fai-example {
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 10px; overflow: hidden;
}
.fai-example-row {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 8px 12px;
  font: 600 12.5px/1.3 var(--dm-font);
  color: var(--text-primary);
  background: var(--bg-card, #fff);
}
.fai-example-row:not(:last-child) { border-bottom: 1px solid var(--border-light, #E2E8F0); }
.fai-example-row span:last-child { font-weight: 800; }
[data-theme="dark"] .fai-example { border-color: #1F3158; }
[data-theme="dark"] .fai-example-row { background: #0E1628; border-color: #1F3158; }

.fai-example-note {
  font: 500 11px/1.4 var(--dm-font);
  color: var(--text-muted, #94A3B8);
  font-style: italic;
  margin-top: -6px;
}

.fai-formula {
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 8px; padding: 14px 12px;
  border-radius: 10px;
  background: var(--bg-muted, #F8FAFF);
}
[data-theme="dark"] .fai-formula { background: rgba(96, 165, 250, .05); }
.fai-formula-part {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 12px; border-radius: 8px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  min-width: 96px;
}
[data-theme="dark"] .fai-formula-part { background: #0E1628; border-color: #1F3158; }
.fai-formula-part--result { border-color: rgba(30, 64, 175, .35); background: rgba(30, 64, 175, .06); }
[data-theme="dark"] .fai-formula-part--result { background: rgba(96, 165, 250, .1); }
.fai-formula-lbl { font: 600 10.5px/1.2 var(--dm-font); color: var(--text-muted, #64748B); text-align: center; }
.fai-formula-val { font: 800 13px/1.2 var(--dm-font); color: var(--text-primary); }
.fai-formula-op { font: 800 16px/1 var(--dm-font); color: var(--text-muted, #94A3B8); }
.fai-formula-op--eq { color: #1E40AF; }
[data-theme="dark"] .fai-formula-op--eq { color: #93C5FD; }

.fai-flow {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.fai-flow-node {
  width: 100%; text-align: center;
  padding: 8px 10px; border-radius: 8px;
  font: 700 11.5px/1.3 var(--dm-font);
  background: var(--bg-muted, #F8FAFF);
  color: var(--text-secondary, #334155);
  border: 1px solid var(--border-light, #E2E8F0);
}
.fai-flow-node--active {
  background: rgba(30, 64, 175, .1);
  border-color: rgba(30, 64, 175, .35);
  color: #1E40AF;
}
[data-theme="dark"] .fai-flow-node { background: rgba(96, 165, 250, .05); border-color: #1F3158; color: var(--text-secondary); }
[data-theme="dark"] .fai-flow-node--active { background: rgba(96, 165, 250, .14); border-color: rgba(96, 165, 250, .4); color: #93C5FD; }
.fai-flow-op { font: 800 13px/1 var(--dm-font); color: var(--text-muted, #94A3B8); }

@media (max-width: 480px) {
  .fai-formula { flex-direction: column; }
  .fai-formula-part { width: 100%; }
}
`;
