import React, { useState } from 'react';
import UniversalSearch from '../../shared/UniversalSearch';
import Tooltip from '../../shared/Tooltip';
import mentorAILogo from '../../assets/images/mentorAILogo.png';
import MentorAIPanel from './MentorAIPanel';

/* ═══════════════════════════════════════════════════════════════════
   MentorAISearchBar — drop-in replacement for <UniversalSearch/> that
   adds the Mentor AI entry point beside it. Normal search behavior is
   completely untouched: UniversalSearch is rendered exactly as before
   and receives the same props it always did.

     <MentorAISearchBar
       onNavigate={...} canAccess={...} sessionId={...} toast={...}
       placeholder="..."
       ctx={{ role: 'admin' }}          // optional, forwarded to askMentorAI
       schoolName="The Oxford System…"  // optional, PDF letterhead only
     />

   Everything Mentor-AI-specific (trigger, drawer, response rendering)
   is additive and scoped under the `mai-*` class prefix so it can
   never collide with the rest of the dashboard's CSS.
   ═══════════════════════════════════════════════════════════════════ */

export default function MentorAISearchBar({ ctx, schoolName, ...searchProps }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mai-searchrow">
        <div className="mai-searchrow-input">
          <UniversalSearch {...searchProps} />
        </div>
        <div className="mai-divider" aria-hidden="true" />
        <Tooltip text="Ask Mentor AI">
          <button
            type="button"
            className="mai-trigger"
            onClick={() => setOpen(true)}
            aria-label="Ask Mentor AI — ERP Intelligence Assistant"
          >
            <img src={mentorAILogo} alt="" aria-hidden="true" className="mai-trigger-logo" />
          </button>
        </Tooltip>
      </div>

      <MentorAIPanel open={open} onClose={() => setOpen(false)} ctx={ctx} schoolName={schoolName} />
    </>
  );
}

/* ─── One-time stylesheet, mirrors UniversalSearch.jsx's own pattern.
       Covers the trigger, the drawer, and every MentorAIResponseParts
       class — this is the feature's single entry point so it's the
       one place guaranteed to mount before any child renders. ─── */
if (typeof document !== 'undefined') {
  let el = document.getElementById('mai-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'mai-style';
    document.head.appendChild(el);
  }
  el.textContent = `
/* ─── Search row trigger ─── */
.mai-searchrow { display: flex; align-items: center; gap: 10px; width: 100%; }
.mai-searchrow-input { flex: 1; min-width: 0; }
.mai-divider {
  width: 1.5px; height: 26px; flex-shrink: 0;
  background: var(--border-light, #BFDBFE);
}
.mai-trigger {
  position: relative;
  z-index: 0;
  flex-shrink: 0;
  height: 42px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-card, #FFFFFF);
  border: 1.5px solid var(--border-light, #BFDBFE);
  border-radius: 999px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.4,0,.2,1), border-color .2s, box-shadow .2s;
  padding: 0 16px;
  animation: maiTriggerPulse 2.4s ease-in-out infinite;
}
@keyframes maiTriggerPulse {
  0%   { box-shadow: 0 0 0 0 rgba(30, 64, 175, .45); }
  60%  { box-shadow: 0 0 0 9px rgba(30, 64, 175, 0); }
  100% { box-shadow: 0 0 0 0 rgba(30, 64, 175, 0); }
}
.mai-trigger:hover, .mai-trigger:focus-visible {
  border-color: var(--brand-primary, #1E40AF);
  box-shadow: 0 0 0 4px rgba(30, 64, 175, .12);
  transform: translateY(-1px) scale(1.03);
  animation-play-state: paused;
  outline: none;
}
.mai-trigger:active { transform: translateY(0) scale(.98); }
.mai-trigger-logo {
  height: 26px; width: auto; object-fit: contain; display: block;
  animation: maiLogoBreathe 2.4s ease-in-out infinite;
}
@keyframes maiLogoBreathe {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(30, 64, 175, 0)); transform: scale(1); }
  50%      { filter: drop-shadow(0 0 6px rgba(30, 64, 175, .5)); transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  .mai-trigger, .mai-trigger-logo { animation: none; }
}

/* ─── Backdrop + modal ───────────────────────────────────────────
   Centered, mirroring the app's own .modal-overlay/.modal pattern
   from App.js (same background/blur/entrance-curve) rather than a
   bespoke right-side drawer. ─── */
.mai-backdrop {
  position: fixed; inset: 0; z-index: 9200;
  background: rgba(10, 22, 40, .55);
  backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: maiFadeIn .15s ease-out;
}
@keyframes maiFadeIn { from { opacity: 0; } to { opacity: 1; } }
.mai-drawer {
  width: 100%; max-width: 840px; height: min(84vh, 820px);
  background: var(--bg-base, #F0F4FF);
  border-radius: var(--radius-xl, 20px);
  box-shadow: var(--shadow-xl, 0 20px 50px rgba(30,58,138,.2));
  border: 1px solid var(--border-light, #E2E8F0);
  overflow: hidden;
  display: flex; flex-direction: column;
  animation: maiModalIn .28s cubic-bezier(.34,1.26,.64,1) both;
  font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
}
@keyframes maiModalIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

.mai-head {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  background: var(--bg-card, #FFFFFF);
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  flex-shrink: 0;
}
.mai-head-logo { height: 26px; width: auto; object-fit: contain; display: block; }
.mai-head-txt { flex: 1; min-width: 0; }
.mai-head-name { font: 800 15px/1.2 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); letter-spacing: -.01em; }
.mai-head-sub { font: 600 11px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #64748B); margin-top: 2px; }
.mai-head-history, .mai-head-newchat, .mai-head-close {
  width: 32px; height: 32px; flex-shrink: 0;
  border: 1px solid var(--border-light, #E2E8F0);
  background: var(--bg-muted, #F8FAFC);
  color: var(--text-muted, #64748B);
  border-radius: 8px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.mai-head-history:hover, .mai-head-newchat:hover, .mai-head-close:hover { background: var(--bg-muted, #EFF6FF); color: var(--text-primary); }
.mai-head-history.active { background: var(--brand-light, #DBEAFE); border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); }

/* ─── Shell — history rail (optional) + main column ─── */
.mai-shell { flex: 1; min-height: 0; display: flex; }
.mai-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

/* ─── History rail ─── */
.mai-history {
  width: 240px; flex-shrink: 0;
  display: flex; flex-direction: column;
  background: var(--bg-card, #FFFFFF);
  border-right: 1px solid var(--border-light, #E2E8F0);
  animation: maiHistorySlide .18s ease-out;
}
@keyframes maiHistorySlide { from { width: 0; opacity: 0; } to { width: 240px; opacity: 1; } }
.mai-history-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 10px; flex-shrink: 0;
  font: 800 11px/1 var(--font-body, sans-serif); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
}
.mai-history-new {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 9px; border-radius: 999px; border: 1px solid var(--border-light, #E2E8F0);
  background: var(--bg-muted, #F8FAFC); color: var(--text-secondary, #475569);
  font: 700 10.5px/1 var(--font-body, sans-serif); cursor: pointer; transition: all .15s;
}
.mai-history-new:hover { background: var(--brand-light, #DBEAFE); border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); }
.mai-history-list { flex: 1; overflow-y: auto; padding: 2px 8px 10px; display: flex; flex-direction: column; gap: 3px; }
.mai-history-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  padding: 30px 14px; color: var(--text-muted, #64748B);
  font: 500 11.5px/1.5 var(--font-body, sans-serif);
}
.mai-history-empty i { font-size: 20px; opacity: .5; }
.mai-history-item {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background .15s;
}
.mai-history-item:hover { background: var(--bg-muted, #F1F5F9); }
.mai-history-item.active { background: var(--brand-light, #DBEAFE); }
.mai-history-item-txt { flex: 1; min-width: 0; }
.mai-history-item-t {
  font: 700 12px/1.35 var(--font-body, sans-serif); color: var(--text-primary, #0F172A);
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.mai-history-item.active .mai-history-item-t { color: var(--brand-primary, #1E40AF); }
.mai-history-item-d { font: 600 10px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #64748B); margin-top: 3px; }
.mai-history-del {
  flex-shrink: 0; width: 24px; height: 24px; border: none; background: transparent;
  color: var(--text-muted, #94A3B8); border-radius: 6px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0; transition: all .15s; font-size: 11px;
}
.mai-history-item:hover .mai-history-del { opacity: 1; }
.mai-history-del:hover { background: rgba(220,38,38,.1); color: #DC2626; }

.mai-body { flex: 1; overflow-y: auto; padding: 20px; }

/* ─── Logo chip — the Mentor AI logo's wordmark is a fixed dark
       charcoal, so it needs a light backdrop to stay legible; this
       chip is intentionally NOT theme-reactive (light in both modes)
       rather than filtering/recoloring the logo pixels themselves. ─── */
.mai-logo-chip {
  display: inline-flex; align-items: center; justify-content: center;
  background: #FFFFFF;
  border: 1px solid rgba(15, 23, 42, .08);
  border-radius: 10px;
  flex-shrink: 0;
}
.mai-logo-chip--sm { padding: 5px 9px; }
.mai-logo-chip--lg { padding: 10px 16px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(15, 23, 42, .08); }

/* ─── Empty state ─── */
.mai-empty { text-align: center; padding: 28px 8px 8px; }
.mai-empty-logo { height: 46px; width: auto; object-fit: contain; display: block; }
.mai-empty-t { font: 800 16px/1.3 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); margin-bottom: 6px; }
.mai-empty-s { font: 500 12.5px/1.5 var(--font-body, sans-serif); color: var(--text-muted, #64748B); max-width: 380px; margin: 0 auto; }

.mai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
.mai-suggestion-chip {
  display: inline-flex; align-items: center;
  padding: 8px 13px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  font: 600 11.5px/1.2 var(--font-body, sans-serif);
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: all .15s;
}
.mai-suggestion-chip:hover { background: var(--brand-light, #DBEAFE); border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); }

/* ─── Exchange thread ─── */
.mai-exchange { margin-bottom: 22px; }
.mai-exchange:last-child { margin-bottom: 0; }
.mai-query-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 14px; margin-bottom: 12px;
  background: var(--brand-light, #DBEAFE);
  color: var(--brand-primary, #1E40AF);
  border-radius: 999px;
  font: 700 12px/1.2 var(--font-body, sans-serif);
  max-width: 100%;
}
.mai-query-pill i { font-size: 11px; opacity: .8; }

.mai-response { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: var(--radius-lg, 14px); padding: 18px; }
.mai-print-head { display: none; }
.mai-response-title { font: 800 15px/1.3 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); margin-bottom: 6px; }
.mai-response-summary { font: 500 12.5px/1.55 var(--font-body, sans-serif); color: var(--text-secondary, #475569); margin: 0 0 16px; }

/* ─── Metrics ─── */
.mai-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
.mai-metric { background: var(--bg-muted, #F8FAFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 10px 12px; }
.mai-metric-label { font: 700 10px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 5px; }
.mai-metric-value { font: 800 16px/1.1 var(--font-body, sans-serif); display: flex; align-items: center; gap: 6px; }
.mai-metric-sub { font: 500 10.5px/1.3 var(--font-body, sans-serif); color: var(--text-muted, #64748B); margin-top: 3px; }

.mai-trend { display: inline-flex; align-items: center; gap: 3px; font: 700 10.5px/1 var(--font-body, sans-serif); }
.mai-trend i { font-size: 9px; }
.mai-trend--up   { color: var(--success, #16A34A); }
.mai-trend--down { color: var(--error, #DC2626); }
.mai-trend--flat { color: var(--text-muted, #64748B); }

/* ─── Sections ─── */
.mai-sec { margin-bottom: 16px; }
.mai-sec:last-child { margin-bottom: 0; }
.mai-sec-h { display: flex; align-items: center; gap: 7px; font: 800 11.5px/1 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 9px; }
.mai-sec-h i { color: var(--brand-primary, #1E40AF); font-size: 11px; }

.mai-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.mai-field { display: flex; flex-direction: column; gap: 2px; background: var(--bg-muted, #F8FAFF); border-radius: 8px; padding: 8px 10px; }
.mai-field-l { font: 600 10px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #64748B); }
.mai-field-v { font: 700 12.5px/1.3 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); }

.mai-table-wrap { overflow-x: auto; border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; }
.mai-table { width: 100%; border-collapse: collapse; font: 500 11.5px/1.3 var(--font-body, sans-serif); }
.mai-table th {
  text-align: left; padding: 8px 12px;
  background: var(--bg-muted, #F8FAFF);
  color: var(--text-muted, #64748B);
  font: 700 10px/1.2 var(--font-body, sans-serif);
  text-transform: uppercase; letter-spacing: .3px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  white-space: nowrap;
}
.mai-table td { padding: 8px 12px; color: var(--text-primary, #0F172A); border-bottom: 1px solid var(--border-light, #EFF3FA); white-space: nowrap; }
.mai-table tr:last-child td { border-bottom: none; }

.mai-list { list-style: none; margin: 0; padding: 10px 12px; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; }
.mai-list li { display: flex; align-items: flex-start; gap: 8px; font: 500 12px/1.5 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); }
.mai-list li i { margin-top: 2px; font-size: 11px; flex-shrink: 0; }

.mai-insight {
  display: flex; gap: 10px; align-items: flex-start;
  background: var(--brand-light, #DBEAFE); border-radius: 10px; padding: 12px 14px;
  margin-bottom: 16px;
}
.mai-insight-ic { color: var(--brand-primary, #1E40AF); font-size: 15px; margin-top: 1px; }
.mai-insight-t { font: 800 10.5px/1.2 var(--font-body, sans-serif); color: var(--brand-primary, #1E40AF); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 3px; }
.mai-insight-txt { font: 500 12.5px/1.5 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); }

.mai-chart-card { background: var(--bg-muted, #F8FAFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 10px; }
.mai-chart-legend { display: flex; flex-wrap: wrap; gap: 12px; padding: 6px 4px 0; }
.mai-chart-legend-i { display: inline-flex; align-items: center; gap: 5px; font: 600 10.5px/1 var(--font-body, sans-serif); color: var(--text-muted, #64748B); }
.mai-chart-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

/* ─── Response actions ─── */
.mai-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-light, #E2E8F0); }
.mai-action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  background: var(--bg-muted, #F8FAFC);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  font: 700 11px/1 var(--font-body, sans-serif);
  color: var(--text-secondary, #475569);
  cursor: pointer;
  transition: all .15s;
}
.mai-action-btn:hover { background: var(--brand-light, #DBEAFE); color: var(--brand-primary, #1E40AF); border-color: var(--brand-primary, #1E40AF); }
.mai-action-btn--primary { background: var(--brand-primary, #1E40AF); color: #fff; border-color: transparent; margin-left: auto; }
.mai-action-btn--primary:hover { background: var(--brand-dark, #1E40AF); color: #fff; opacity: .92; }

/* ─── Loading / error ─── */
.mai-loading { display: flex; align-items: center; gap: 10px; padding: 20px; color: var(--text-muted, #64748B); font: 600 12px/1 var(--font-body, sans-serif); }
.mai-loading-spin { color: var(--brand-primary, #1E40AF); font-size: 14px; }

.mai-error { text-align: center; padding: 22px 16px; background: rgba(220,38,38,.06); border: 1.5px solid rgba(220,38,38,.22); border-radius: 12px; }
.mai-error-ic { color: #DC2626; font-size: 20px; margin-bottom: 8px; }
.mai-error-t { font: 800 13px/1.3 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); }
.mai-error-s { font: 500 11.5px/1.4 var(--font-body, sans-serif); color: var(--text-muted, #64748B); margin-top: 3px; margin-bottom: 12px; }
.mai-error-retry {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; background: #DC2626; color: #fff; border: none; border-radius: 9px;
  font: 700 12px/1 var(--font-body, sans-serif); cursor: pointer;
}
.mai-error-retry:hover { background: #B91C1C; }

/* ─── Composer ─── */
.mai-composer {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px;
  background: var(--bg-card, #fff);
  border-top: 1px solid var(--border-light, #E2E8F0);
  flex-shrink: 0;
}
.mai-composer-input {
  flex: 1; min-width: 0; height: 42px;
  padding: 0 16px;
  background: var(--bg-muted, #F8FAFF);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  font: 600 12.5px/1 var(--font-body, sans-serif);
  color: var(--text-primary, #0F172A);
  outline: none;
  transition: all .15s;
}
.mai-composer-input:focus { border-color: var(--brand-primary, #1E40AF); box-shadow: 0 0 0 4px rgba(30,64,175,.12); }
.mai-composer-input::placeholder { color: var(--text-muted, #94A3B8); }
.mai-composer-send {
  flex-shrink: 0; width: 42px; height: 42px;
  border: none; border-radius: 50%;
  background: linear-gradient(135deg,#1E3A8A 0%,#1E40AF 50%,#2563EB 100%);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 10px rgba(37,99,235,.3);
  transition: all .15s;
}
.mai-composer-send:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .mai-history { position: absolute; inset: 0; z-index: 2; width: 100%; }
  @keyframes maiHistorySlide { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
}
@media (max-width: 720px) {
  .mai-backdrop { padding: 0; }
  .mai-drawer { max-width: 100%; height: 100%; border-radius: 0; }
  .mai-metrics { grid-template-columns: 1fr 1fr; }
  .mai-fields { grid-template-columns: 1fr; }
}
@media (max-width: 420px) {
  .mai-metrics { grid-template-columns: 1fr; }
}

/* ─── Print — only the current thread prints, matching the audit-log
       report convention (visibility toggling + isolated container). ─── */
@media print {
  body * { visibility: hidden !important; }
  .mai-print-area, .mai-print-area * { visibility: visible !important; }
  .mai-print-area { position: absolute; inset: 0; padding: 24px; background: #fff; overflow: visible !important; }
  .mai-print-head { display: block !important; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1E40AF; }
  .mai-print-school { font: 800 16px/1.3 sans-serif; color: #0F172A; }
  .mai-print-meta { display: flex; gap: 14px; font: 600 10.5px/1.4 sans-serif; color: #475569; margin-top: 4px; }
  .mai-response { border: none !important; box-shadow: none !important; padding: 0 !important; page-break-inside: avoid; margin-bottom: 24px; }
  .mai-query-pill { background: #EFF6FF !important; color: #1E40AF !important; }
  .mai-actions { display: none !important; }
}

/* ─── DARK MODE ─── */
/* Trigger stays light (not the dark chrome) — same reasoning as .mai-logo-chip: the logo's dark wordmark needs a light backdrop. */
[data-theme="dark"] .mai-trigger { background: #F1F5FB; border-color: #2A3E60; animation-name: maiTriggerPulseDark; }
@keyframes maiTriggerPulseDark {
  0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, .55); }
  60%  { box-shadow: 0 0 0 9px rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}
[data-theme="dark"] .mai-trigger-logo { animation-name: maiLogoBreatheDark; }
@keyframes maiLogoBreatheDark {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(59,130,246,0)); transform: scale(1); }
  50%      { filter: drop-shadow(0 0 6px rgba(59,130,246,.55)); transform: scale(1.06); }
}
[data-theme="dark"] .mai-trigger:hover, [data-theme="dark"] .mai-trigger:focus-visible { border-color: #3B82F6; box-shadow: 0 0 0 4px rgba(59,130,246,.22); }
[data-theme="dark"] .mai-divider { background: #1C2E50; }
[data-theme="dark"] .mai-drawer { background: #0A1120; color-scheme: dark; }
[data-theme="dark"] .mai-head, [data-theme="dark"] .mai-composer { background: #0E1628; border-color: #1C2E50; }
[data-theme="dark"] .mai-head-name { color: #E2E8F8; }
[data-theme="dark"] .mai-head-sub { color: #94A3B8; }
[data-theme="dark"] .mai-head-close,
[data-theme="dark"] .mai-head-history,
[data-theme="dark"] .mai-head-newchat { background: #131F38; border-color: #1C2E50; color: #94A3B8; }
[data-theme="dark"] .mai-head-history.active { background: rgba(59,130,246,.18); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-history { background: #0E1628; border-color: #1C2E50; }
[data-theme="dark"] .mai-history-new { background: #131F38; border-color: #1C2E50; color: #B8C8E8; }
[data-theme="dark"] .mai-history-new:hover { background: rgba(59,130,246,.18); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-history-item:hover { background: #131F38; }
[data-theme="dark"] .mai-history-item.active { background: rgba(59,130,246,.16); }
[data-theme="dark"] .mai-history-item-t { color: #E2E8F8; }
[data-theme="dark"] .mai-history-item.active .mai-history-item-t { color: #93C5FD; }
[data-theme="dark"] .mai-history-item-d, [data-theme="dark"] .mai-history-empty { color: #94A3B8; }
[data-theme="dark"] .mai-empty-t { color: #E2E8F8; }
[data-theme="dark"] .mai-empty-s { color: #94A3B8; }
[data-theme="dark"] .mai-suggestion-chip { background: #0E1628; border-color: #1C2E50; color: #B8C8E8; }
[data-theme="dark"] .mai-suggestion-chip:hover { background: rgba(59,130,246,.18); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-query-pill { background: rgba(59,130,246,.18); color: #93C5FD; }
[data-theme="dark"] .mai-response { background: #0E1628; border-color: #1C2E50; }
[data-theme="dark"] .mai-response-title { color: #E2E8F8; }
[data-theme="dark"] .mai-response-summary { color: #94A3B8; }
[data-theme="dark"] .mai-metric { background: #131F38; border-color: #1C2E50; }
[data-theme="dark"] .mai-metric-label { color: #94A3B8; }
[data-theme="dark"] .mai-metric-sub { color: #94A3B8; }
[data-theme="dark"] .mai-sec-h { color: #E2E8F8; }
[data-theme="dark"] .mai-field { background: #131F38; }
[data-theme="dark"] .mai-field-l { color: #94A3B8; }
[data-theme="dark"] .mai-field-v { color: #E2E8F8; }
[data-theme="dark"] .mai-table-wrap { border-color: #1C2E50; }
[data-theme="dark"] .mai-table th { background: #131F38; color: #94A3B8; border-bottom-color: #1C2E50; }
[data-theme="dark"] .mai-table td { color: #E2E8F8; border-bottom-color: #16223D; }
[data-theme="dark"] .mai-insight { background: rgba(59,130,246,.14); }
[data-theme="dark"] .mai-insight-txt { color: #E2E8F8; }
[data-theme="dark"] .mai-chart-card { background: #131F38; border-color: #1C2E50; }
[data-theme="dark"] .mai-chart-legend-i { color: #94A3B8; }
[data-theme="dark"] .mai-actions { border-top-color: #1C2E50; }
[data-theme="dark"] .mai-action-btn { background: #131F38; border-color: #1C2E50; color: #B8C8E8; }
[data-theme="dark"] .mai-action-btn:hover { background: rgba(59,130,246,.18); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-composer-input { background: #131F38; border-color: #1C2E50; color: #E2E8F8; }
[data-theme="dark"] .mai-composer-input::placeholder { color: #6B82A8; }
  `;
}
