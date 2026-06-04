import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_LINKS } from './tutorialLinks';

/* ═══════════════════════════════════════════════════════════════════
   TUTORIAL MODAL — shared, reusable across every module.
   Reads its option list from src/components/tutorialLinks.js by
   `moduleKey`. Empty URLs open a "coming soon" toast (when a toast
   function is provided) — otherwise the option is just disabled.
   ═══════════════════════════════════════════════════════════════════ */
export default function TutorialModal({ open, moduleKey, onClose, toast }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const mod = TUTORIAL_LINKS[moduleKey] || { title: 'Tutorials', items: [] };

  const handleClick = (item) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else if (typeof toast === 'function') {
      toast('Tutorial video coming soon.', 'info');
    }
  };

  return createPortal(
    <div
      className="tut-back"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tut-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="tut-modal">
        <div className="tut-head">
          <div className="tut-head-l">
            <div className="tut-icn"><i className="fa-solid fa-circle-play" aria-hidden="true"></i></div>
            <div className="tut-head-text">
              <div className="tut-title" id="tut-title">{mod.title}</div>
              <div className="tut-sub">Tap a topic to play the tutorial</div>
            </div>
          </div>
          <button type="button" className="tut-close" onClick={onClose} aria-label="Close tutorials">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="tut-body">
          {mod.items.length === 0 ? (
            <div className="tut-empty">
              <i className="fa-solid fa-film tut-empty-ic" aria-hidden="true"></i>
              <div className="tut-empty-title">No tutorials yet</div>
              <div className="tut-empty-sub">Tutorial videos for this module are being prepared.</div>
            </div>
          ) : mod.items.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              type="button"
              className={`tut-item${!item.url ? ' tut-item--soon' : ''}`}
              onClick={() => handleClick(item)}
            >
              <span className="tut-item-ic" aria-hidden="true">
                <i className="fa-solid fa-play"></i>
              </span>
              <span className="tut-item-label">{item.label}</span>
              {item.url ? (
                <i className="fa-solid fa-arrow-up-right-from-square tut-item-arrow" aria-hidden="true"></i>
              ) : (
                <span className="tut-item-badge">Coming Soon</span>
              )}
            </button>
          ))}
        </div>

        <div className="tut-foot">
          <button type="button" className="tut-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{TUT_CSS}</style>
    </div>,
    document.body,
  );
}

const TUT_CSS = `
.tut-back {
  position: fixed; inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: tutFade .15s ease-out;
}
@keyframes tutFade { from { opacity: 0; } to { opacity: 1; } }

.tut-modal {
  width: min(520px, 100%);
  max-height: calc(100dvh - 32px);
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: tutPop .18s cubic-bezier(.2, .8, .2, 1);
  font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
}
@keyframes tutPop {
  from { transform: translateY(10px) scale(.98); opacity: 0; }
  to   { transform: translateY(0)   scale(1);    opacity: 1; }
}

.tut-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 18px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.tut-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.tut-icn {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .18);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}
.tut-head-text { min-width: 0; }
.tut-title { font-size: 15.5px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; }
.tut-sub   { font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,.85); margin-top: 2px; }
.tut-close {
  width: 32px; height: 32px;
  border: none;
  background: rgba(255, 255, 255, .15);
  color: #fff;
  border-radius: 9px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  transition: background .15s ease;
}
.tut-close:hover { background: rgba(255, 255, 255, .25); }

.tut-body {
  padding: 14px 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all .15s ease;
  width: 100%;
  color: var(--text-primary, #0F172A);
}
.tut-item:hover {
  border-color: #1E40AF;
  background: rgba(30, 64, 175, .04);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30, 64, 175, .08);
}
.tut-item:active { transform: translateY(0); }
.tut-item-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.tut-item-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 700;
  word-break: normal;
  overflow-wrap: break-word;
  line-height: 1.3;
}
.tut-item-arrow {
  color: var(--text-muted, #94A3B8);
  font-size: 11px;
  flex-shrink: 0;
}
.tut-item-badge {
  background: rgba(217, 119, 6, .12);
  color: #92400E;
  border: 1px solid rgba(217, 119, 6, .25);
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
  flex-shrink: 0;
}
.tut-item--soon { opacity: .8; }
.tut-item--soon:hover {
  border-color: rgba(217, 119, 6, .35);
  background: rgba(217, 119, 6, .04);
}
.tut-item--soon .tut-item-ic {
  background: rgba(217, 119, 6, .12);
  color: #92400E;
}

.tut-empty {
  text-align: center;
  padding: 28px 14px;
  color: var(--text-muted, #64748B);
}
.tut-empty-ic { font-size: 30px; color: var(--border-med, #CBD5E1); display: block; margin-bottom: 10px; }
.tut-empty-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary, #0F172A); }
.tut-empty-sub   { font-size: 11.5px; margin-top: 4px; }

.tut-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light, #E2E8F0);
  display: flex;
  justify-content: flex-end;
  background: var(--bg-muted, #F8FAFF);
  flex-shrink: 0;
}
.tut-btn-ghost {
  padding: 9px 18px;
  border: 1.5px solid var(--border-light, #E2E8F0);
  background: var(--bg-card, #fff);
  border-radius: 10px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: all .15s ease;
}
.tut-btn-ghost:hover { border-color: var(--border-med, #94A3B8); color: var(--text-primary, #0F172A); }

/* Dark mode */
[data-theme="dark"] .tut-modal { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .tut-item {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .tut-item:hover {
  background: rgba(59, 130, 246, .08);
  border-color: #3B82F6;
}
[data-theme="dark"] .tut-item-ic { background: rgba(59, 130, 246, .15); color: #93C5FD; }
[data-theme="dark"] .tut-item-badge { background: rgba(217, 119, 6, .18); color: #FCD34D; border-color: rgba(217, 119, 6, .35); }
[data-theme="dark"] .tut-empty-title { color: var(--text-primary); }
[data-theme="dark"] .tut-foot { background: var(--bg-muted); border-top-color: var(--border-light); }
[data-theme="dark"] .tut-btn-ghost { background: var(--bg-card); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .tut-btn-ghost:hover { border-color: var(--border-med); color: var(--text-primary); }

/* Mobile */
@media (max-width: 600px) {
  .tut-back { padding: 8px; }
  .tut-modal { max-height: calc(100dvh - 16px); border-radius: 14px; }
  .tut-head { padding: 14px 14px; gap: 10px; }
  .tut-icn { width: 36px; height: 36px; font-size: 15px; }
  .tut-title { font-size: 14.5px; }
  .tut-sub { font-size: 11px; }
  .tut-close { width: 30px; height: 30px; font-size: 12px; }
  .tut-body { padding: 12px 12px; gap: 7px; }
  .tut-item { padding: 11px 12px; gap: 10px; }
  .tut-item-ic { width: 30px; height: 30px; font-size: 11px; border-radius: 9px; }
  .tut-item-label { font-size: 12.5px; }
  .tut-item-badge { font-size: 9.5px; padding: 2px 7px; }
  .tut-foot { padding: 10px 12px; }
  .tut-btn-ghost { width: 100%; justify-content: center; padding: 10px 14px; font-size: 12.5px; }
}
`;
