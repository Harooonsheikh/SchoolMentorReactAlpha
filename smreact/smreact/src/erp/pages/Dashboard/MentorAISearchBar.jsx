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

/* ─── School Mentor AI gradient spectrum — used only for the new
       premium identity touches below (logo glow/sparks, rotating intro
       accent, stagger chip ring, animated-counter highlight) so it
       layers on top of the existing brand tokens without replacing
       them anywhere else in the popup. ─── */
.mai-drawer {
  --mai-c1: #087BE0; --mai-c2: #0A8CD6; --mai-c3: #0D9DCC; --mai-c4: #0FB1C0; --mai-c5: #12C1B6;
  --mai-grad: linear-gradient(135deg, var(--mai-c1) 0%, var(--mai-c3) 50%, var(--mai-c5) 100%);
}

/* ─── AI identity animation — soft float + breathing glow + occasional
       sparks, wraps the logo wherever it appears (header chip, empty
       state) without altering the <img> markup consumers already
       render; just an extra positioning wrapper + a couple of spark
       spans. Deliberately subtle: small scale/blur deltas, no spin or
       bounce, so it reads as "quietly intelligent" not decorative. ─── */
.mai-logo-orb { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.mai-logo-orb::before {
  content: ''; position: absolute; inset: -9px; border-radius: 50%;
  background: radial-gradient(circle, rgba(8,123,224,.30), rgba(18,193,182,.14) 58%, transparent 72%);
  animation: maiGlowPulse 3.4s ease-in-out infinite;
  pointer-events: none; z-index: 0;
}
.mai-logo-orb--lg::before { inset: -18px; }
@keyframes maiGlowPulse {
  0%, 100% { opacity: .5; transform: scale(.92); }
  50%      { opacity: 1;  transform: scale(1.1); }
}
.mai-logo-orb .mai-logo-chip { position: relative; z-index: 1; }
.mai-logo-float {
  display: block;
  animation: maiLogoFloat 4.8s ease-in-out infinite, maiLogoGlow 3.4s ease-in-out infinite;
}
@keyframes maiLogoFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes maiLogoGlow {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(8,123,224,0)); }
  50%      { filter: drop-shadow(0 0 7px rgba(15,177,192,.55)); }
}
.mai-spark {
  position: absolute; z-index: 2; width: 5px; height: 5px; border-radius: 50%;
  background: var(--mai-c4, #0FB1C0);
  box-shadow: 0 0 7px 1.5px rgba(15,177,192,.8);
  opacity: 0; pointer-events: none;
  animation: maiSpark 3.2s ease-in-out infinite;
}
.mai-spark:nth-child(1) { top: -2px; right: 4px; animation-delay: 0s; }
.mai-spark:nth-child(2) { bottom: 6px; left: -6px; width: 4px; height: 4px; animation-delay: 1.1s; }
.mai-spark:nth-child(3) { top: 46%; right: -8px; width: 3.5px; height: 3.5px; animation-delay: 2.15s; }
@keyframes maiSpark {
  0%, 100% { opacity: 0; transform: scale(.3); }
  10%      { opacity: 1; transform: scale(1.15); }
  28%      { opacity: 0; transform: scale(.4); }
}
@media (prefers-reduced-motion: reduce) {
  .mai-logo-orb::before, .mai-logo-float, .mai-spark { animation: none; }
}

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

/* ─── Rotating AI intro message — the SINGLE line of text in the empty
       state (see MentorAIPanel's introMsgIndex), re-picked and re-faded
       in every time the popup opens. Everything below it is chips, not
       prose, and each group reveals one after another (mai-reveal-N)
       rather than landing all at once — see the group-cascade system
       further down. ─── */
.mai-rotate-msg { min-height: 22px; margin-top: 10px; }
.mai-rotate-msg-text {
  display: inline-flex; align-items: center; gap: 7px;
  font: 700 12px/1.4 var(--font-body, sans-serif);
  background: var(--mai-grad, linear-gradient(135deg,#087BE0,#12C1B6));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: maiMsgIn .5s cubic-bezier(.22,1,.36,1) both;
}
.mai-rotate-msg-text i { color: var(--mai-c3, #0D9DCC); -webkit-text-fill-color: var(--mai-c3, #0D9DCC); font-size: 11px; }
@keyframes maiMsgIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: none; }
}
/* Hero variant — the single-line centerpiece of the (now text-light)
   empty state, sized up so it reads as the headline instead of a
   caption under a title that no longer exists. */
.mai-rotate-msg--hero { margin-top: 16px; min-height: 30px; }
.mai-rotate-msg--hero .mai-rotate-msg-text { font-size: 17px; font-weight: 800; letter-spacing: -.01em; gap: 9px; }
.mai-rotate-msg--hero .mai-rotate-msg-text i { font-size: 15px; }

/* ─── Sequential group cascade — each block below the hero line (category
       chips, then suggestion chips, then the trending ticker) reveals
       one after another instead of appearing together. Implemented as a
       CSS variable per group so the existing per-chip stagger (below)
       layers ON TOP of its group's own start time via calc(), instead
       of every group's chips racing to appear at t=0 simultaneously. ─── */
.mai-reveal { --mai-group-base: 0s; }
.mai-reveal-1 { --mai-group-base: .5s; }
.mai-reveal-2 { --mai-group-base: 1.05s; }
.mai-reveal-3 { --mai-group-base: 1.6s; }

/* ─── Trending — now the SOLE suggested-question showcase in the empty
       state (the category tabs + per-category chips that used to sit
       between the hero line and this were removed and folded into
       MAI_TRENDING_POOL). Sized up and animated more richly since it
       carries the whole "what can I ask" job on its own now. ─── */
.mai-trending { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; min-height: 30px; }
.mai-trending--hero { flex-direction: column; gap: 14px; margin-top: 28px; }
.mai-trending-label {
  display: inline-flex; align-items: center; gap: 5px;
  font: 800 10px/1 var(--font-body, sans-serif); color: var(--text-muted, #94A3B8);
  text-transform: uppercase; letter-spacing: .5px; flex-shrink: 0;
  opacity: 0; animation: maiMsgIn .4s ease-out both; animation-delay: var(--mai-group-base, 0s);
}
.mai-trending--hero .mai-trending-label { font-size: 11.5px; letter-spacing: 1px; }
.mai-trending-label i { color: var(--mai-c4, #0FB1C0); animation: maiTrendPulse 1.8s ease-in-out infinite; }
@keyframes maiTrendPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.mai-trending-chip {
  display: inline-flex; align-items: center;
  padding: 7px 14px;
  background: var(--bg-card, #fff);
  border: 1px dashed rgba(13,157,204,.35);
  border-radius: 999px;
  font: 600 11px/1.2 var(--font-body, sans-serif);
  color: var(--text-secondary, #475569);
  cursor: pointer;
  max-width: min(360px, 70vw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  opacity: 0; animation: maiMsgIn .4s cubic-bezier(.22,1,.36,1) both;
  animation-delay: calc(var(--mai-group-base, 0s) + .08s);
  transition: border-color .15s, color .15s, background .15s;
}
.mai-trending-chip:hover { border-style: solid; border-color: var(--mai-c3, #0D9DCC); color: var(--mai-c2, #0A8CD6); background: rgba(8,123,224,.05); }

/* Hero variant — a big, glowing, gradient-bordered card with a shimmer
   sweep, instead of a small dashed pill. */
.mai-trending--hero .mai-trending-chip {
  position: relative; overflow: hidden;
  max-width: min(480px, 86vw); white-space: normal; text-align: center; line-height: 1.4;
  padding: 15px 26px; border-radius: 18px;
  font-size: 15px; font-weight: 700; color: var(--text-primary, #0F172A);
  border: 1.5px solid transparent;
  background: linear-gradient(var(--bg-card, #fff), var(--bg-card, #fff)) padding-box,
              var(--mai-grad, linear-gradient(135deg,#087BE0,#12C1B6)) border-box;
  box-shadow: 0 8px 24px rgba(13,157,204,.16);
  animation: maiTrendHeroIn .55s cubic-bezier(.22,1,.36,1) both, maiTrendHeroGlow 2.6s ease-in-out infinite;
  animation-delay: calc(var(--mai-group-base, 0s) + .08s), calc(var(--mai-group-base, 0s) + .6s);
}
.mai-trending--hero .mai-trending-chip i {
  margin-right: 9px; color: var(--mai-c4, #0FB1C0); font-size: 14px;
  animation: maiTrendIconFloat 2s ease-in-out infinite;
}
.mai-trending--hero .mai-trending-chip::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(100deg, transparent 35%, rgba(255,255,255,.5) 50%, transparent 65%);
  transform: translateX(-120%);
  animation: maiTrendShimmer 3.2s ease-in-out infinite;
}
.mai-trending--hero .mai-trending-chip:hover { transform: translateY(-2px) scale(1.015); box-shadow: 0 14px 34px rgba(13,157,204,.3); }
@keyframes maiTrendHeroIn {
  from { opacity: 0; transform: translateY(10px) scale(.92); }
  to   { opacity: 1; transform: none; }
}
@keyframes maiTrendHeroGlow {
  0%, 100% { box-shadow: 0 8px 24px rgba(13,157,204,.14); }
  50%      { box-shadow: 0 12px 34px rgba(15,177,192,.28); }
}
@keyframes maiTrendIconFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes maiTrendShimmer { 0%, 20% { transform: translateX(-120%); } 55%, 100% { transform: translateX(120%); } }

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
  opacity: 0; animation: maiChipIn .38s cubic-bezier(.34,1.26,.64,1) both;
}
.mai-suggestion-chip:hover { background: var(--brand-light, #DBEAFE); border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13,157,204,.18); }
@keyframes maiChipIn { from { opacity: 0; transform: translateY(8px) scale(.94); } to { opacity: 1; transform: none; } }
.mai-suggestions .mai-suggestion-chip:nth-child(1) { animation-delay: calc(var(--mai-group-base, 0s) + .04s); }
.mai-suggestions .mai-suggestion-chip:nth-child(2) { animation-delay: calc(var(--mai-group-base, 0s) + .09s); }
.mai-suggestions .mai-suggestion-chip:nth-child(3) { animation-delay: calc(var(--mai-group-base, 0s) + .14s); }
.mai-suggestions .mai-suggestion-chip:nth-child(4) { animation-delay: calc(var(--mai-group-base, 0s) + .19s); }
.mai-suggestions .mai-suggestion-chip:nth-child(5) { animation-delay: calc(var(--mai-group-base, 0s) + .24s); }
.mai-cat-tabs .mai-cat-tab { opacity: 0; animation: maiChipIn .38s cubic-bezier(.34,1.26,.64,1) both; }
.mai-cat-tabs .mai-cat-tab:nth-child(1) { animation-delay: calc(var(--mai-group-base, 0s) + .02s); }
.mai-cat-tabs .mai-cat-tab:nth-child(2) { animation-delay: calc(var(--mai-group-base, 0s) + .06s); }
.mai-cat-tabs .mai-cat-tab:nth-child(3) { animation-delay: calc(var(--mai-group-base, 0s) + .10s); }
.mai-cat-tabs .mai-cat-tab:nth-child(4) { animation-delay: calc(var(--mai-group-base, 0s) + .14s); }
.mai-cat-tabs .mai-cat-tab:nth-child(5) { animation-delay: calc(var(--mai-group-base, 0s) + .18s); }
.mai-cat-tabs .mai-cat-tab:nth-child(6) { animation-delay: calc(var(--mai-group-base, 0s) + .22s); }
.mai-cat-tabs .mai-cat-tab:nth-child(7) { animation-delay: calc(var(--mai-group-base, 0s) + .26s); }
.mai-cat-tabs .mai-cat-tab:nth-child(8) { animation-delay: calc(var(--mai-group-base, 0s) + .30s); }
.mai-cat-tab:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13,157,204,.15); }
@media (prefers-reduced-motion: reduce) {
  .mai-rotate-msg-text, .mai-suggestion-chip, .mai-cat-tabs .mai-cat-tab, .mai-trending-chip, .mai-trending-label,
  .mai-trending--hero .mai-trending-chip, .mai-trending--hero .mai-trending-chip::before, .mai-trending--hero .mai-trending-chip i {
    animation: none; opacity: 1;
  }
}

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

.mai-response {
  background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0); border-radius: var(--radius-lg, 14px); padding: 18px;
  animation: maiCardUp .46s cubic-bezier(.22,1,.36,1) both;
}
@keyframes maiCardUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .mai-response, .mai-sec, .mai-metric { animation: none !important; } }
.mai-print-head { display: none; }
.mai-response-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.mai-response-title { font: 800 15px/1.3 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); }
.mai-response-summary { font: 500 12.5px/1.55 var(--font-body, sans-serif); color: var(--text-secondary, #475569); margin: 0 0 16px; }

/* ─── Metrics ─── */
.mai-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
.mai-metric {
  background: var(--bg-muted, #F8FAFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 10px 12px;
  animation: maiCardUp .4s cubic-bezier(.22,1,.36,1) both;
}
.mai-metrics .mai-metric:nth-child(1) { animation-delay: .04s; }
.mai-metrics .mai-metric:nth-child(2) { animation-delay: .09s; }
.mai-metrics .mai-metric:nth-child(3) { animation-delay: .14s; }
.mai-metrics .mai-metric:nth-child(4) { animation-delay: .19s; }
.mai-metric-label { font: 700 10px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 5px; }
.mai-metric-value { font: 800 16px/1.1 var(--font-body, sans-serif); display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.mai-metric-sub { font: 500 10.5px/1.3 var(--font-body, sans-serif); color: var(--text-muted, #64748B); margin-top: 3px; }

.mai-trend { display: inline-flex; align-items: center; gap: 3px; font: 700 10.5px/1 var(--font-body, sans-serif); }
.mai-trend i { font-size: 9px; }
.mai-trend--up   { color: var(--success, #16A34A); }
.mai-trend--down { color: var(--error, #DC2626); }
.mai-trend--flat { color: var(--text-muted, #64748B); }

/* ─── Sections ─── */
.mai-sec { margin-bottom: 16px; animation: maiCardUp .44s cubic-bezier(.22,1,.36,1) both; animation-delay: .08s; }
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

/* ─── Voice command (mic) ─── */
.mai-mic {
  flex-shrink: 0; width: 42px; height: 42px;
  border: 1.5px solid var(--border-light, #E2E8F0); border-radius: 50%;
  background: var(--bg-muted, #F8FAFF); color: var(--text-secondary, #475569);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.mai-mic:hover:not(:disabled) { background: var(--brand-light, #DBEAFE); border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); }
.mai-mic:disabled { opacity: .5; cursor: not-allowed; }
.mai-mic.recording {
  position: relative;
  background: #DC2626; border-color: #DC2626; color: #fff;
  animation: maiMicPulse 1.4s ease-in-out infinite;
}
@keyframes maiMicPulse {
  0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.45); }
  70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
  100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
}
/* Extra glowing ring, layered behind the pulse box-shadow above for a
   softer, more premium "actively listening" halo. */
.mai-mic.recording::after {
  content: ''; position: absolute; inset: -6px; border-radius: 50%;
  border: 1.5px solid rgba(220,38,38,.35);
  animation: maiMicRing 1.8s ease-out infinite;
  pointer-events: none;
}
@keyframes maiMicRing {
  0%   { transform: scale(.85); opacity: .9; }
  100% { transform: scale(1.5); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .mai-mic.recording, .mai-mic.recording::after { animation: none; } }
.mai-voice-banner {
  display: flex; align-items: center; gap: 10px;
  margin: 0 20px 10px; padding: 9px 14px;
  background: rgba(220,38,38,.06); border: 1.5px solid rgba(220,38,38,.2); border-radius: 999px;
  font: 700 12px/1 var(--font-body, sans-serif); color: #B91C1C;
}
.mai-voice-banner--transcribing { background: rgba(8,123,224,.08); border-color: var(--mai-c2, #0A8CD6); color: var(--mai-c1, #087BE0); }
.mai-voice-banner--transcribing .mai-voice-substate { animation: maiMsgIn .3s ease-out both; }
.mai-voice-banner--transcribing i { color: var(--mai-c2, #0A8CD6); }
.mai-voice-dot { width: 9px; height: 9px; border-radius: 50%; background: #DC2626; flex-shrink: 0; animation: maiMicPulse 1.4s ease-in-out infinite; }
.mai-voice-wave { display: inline-flex; align-items: center; gap: 2px; height: 14px; }
.mai-voice-wave span { width: 3px; height: 100%; background: #DC2626; border-radius: 2px; animation: maiWave .9s ease-in-out infinite; }
@keyframes maiWave { 0%, 100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
.mai-voice-stop {
  margin-left: auto; display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; background: #DC2626; color: #fff; border: none; border-radius: 999px;
  font: 700 11px/1 var(--font-body, sans-serif); cursor: pointer;
}
.mai-voice-stop:hover { background: #B91C1C; }

/* ─── Agentic "AI is working" step animation ─── */
.mai-agent { padding: 16px 4px; animation: maiCardUp .3s ease-out both; }
.mai-agent-h { display: flex; align-items: center; gap: 8px; font: 800 12.5px/1 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); margin-bottom: 6px; }
.mai-agent-h-ic {
  color: var(--mai-c2, #087BE0); font-size: 14px;
  display: inline-flex; animation: maiAgentIcPulse 1.6s ease-in-out infinite;
}
@keyframes maiAgentIcPulse {
  0%, 100% { opacity: .7; filter: drop-shadow(0 0 0 rgba(13,157,204,0)); }
  50%      { opacity: 1;  filter: drop-shadow(0 0 5px rgba(13,157,204,.6)); }
}
/* Ambient "what the agent is doing" line — rotates through generic
   intelligence phrases (see MentorAIResponseParts' AGENT_AMBIENT_PHRASES),
   purely cosmetic and additive to the real, category-specific steps
   list below it (unchanged — still driven by mentorAiService.stepsForQuery). */
.mai-agent-ambient {
  display: flex; align-items: center; gap: 8px; margin: 0 0 14px;
  font: 600 11.5px/1.3 var(--font-body, sans-serif); color: var(--text-muted, #64748B);
  min-height: 16px;
}
.mai-agent-ambient-txt { animation: maiMsgIn .35s ease-out both; }
.mai-agent-dots { display: inline-flex; gap: 3px; flex-shrink: 0; }
.mai-agent-dots span {
  width: 4px; height: 4px; border-radius: 50%; background: var(--mai-c3, #0D9DCC);
  animation: maiDotBounce 1.1s ease-in-out infinite;
}
.mai-agent-dots span:nth-child(2) { animation-delay: .15s; }
.mai-agent-dots span:nth-child(3) { animation-delay: .3s; }
@keyframes maiDotBounce { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2.5px); } }
.mai-agent-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mai-agent-step { display: flex; align-items: center; gap: 10px; font: 600 12px/1.3 var(--font-body, sans-serif); color: var(--text-muted, #94A3B8); transition: color .2s; }
.mai-agent-step-ic {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; font-size: 10px;
  border: 1.5px solid var(--border-light, #E2E8F0); color: var(--text-muted, #94A3B8);
  transition: border-color .2s, color .2s, box-shadow .2s;
}
.mai-agent-step--active { color: var(--text-primary, #0F172A); }
.mai-agent-step--active .mai-agent-step-ic { border-color: var(--mai-c2, #087BE0); color: var(--mai-c2, #087BE0); box-shadow: 0 0 0 3px rgba(13,157,204,.14); }
.mai-agent-step--done { color: var(--text-secondary, #475569); }
.mai-agent-step--done .mai-agent-step-ic { background: var(--mai-grad, linear-gradient(135deg,#087BE0,#12C1B6)); border-color: transparent; color: #fff; }
@media (prefers-reduced-motion: reduce) {
  .mai-agent-h-ic, .mai-agent-dots span, .mai-agent-ambient-txt { animation: none; }
}

/* ─── Category browser (empty-state) ─── */
.mai-cat-tabs { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 18px; }
.mai-cat-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; background: var(--bg-muted, #F8FAFF);
  border: 1.5px solid var(--border-light, #E2E8F0); border-radius: 999px;
  font: 700 11px/1 var(--font-body, sans-serif); color: var(--text-secondary, #475569);
  cursor: pointer; transition: all .15s;
}
.mai-cat-tab i { font-size: 10.5px; }
.mai-cat-tab:hover { border-color: var(--brand-primary, #1E40AF); color: var(--brand-primary, #1E40AF); }
.mai-cat-tab.active { background: var(--brand-primary, #1E40AF); border-color: var(--brand-primary, #1E40AF); color: #fff; }

/* ─── Chat history — day-group labels + task status line ─── */
.mai-history-daylabel { font: 800 10px/1.2 var(--font-body, sans-serif); color: var(--text-muted, #94A3B8); text-transform: uppercase; letter-spacing: .5px; padding: 10px 10px 4px; }
.mai-history-item-status { color: var(--success, #16A34A); font-size: 9px; margin-right: 2px; }

/* ─── Export menu (replaces the old flat Download-PDF/Print buttons) ─── */
.mai-export { position: relative; flex-shrink: 0; }
.mai-export-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px;
  background: var(--brand-primary, #1E40AF); color: #fff; border: none;
  border-radius: 999px; font: 700 11px/1 var(--font-body, sans-serif); cursor: pointer;
  transition: all .15s; white-space: nowrap;
}
.mai-export-btn:hover:not(:disabled) { background: var(--brand-dark, #1E40AF); opacity: .92; }
.mai-export-btn:disabled { opacity: .7; cursor: not-allowed; }
.mai-export-caret { font-size: 8px; margin-left: 2px; }
.mai-export-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 5;
  background: var(--bg-card, #fff); border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.12);
  display: flex; flex-direction: column; min-width: 140px; overflow: hidden;
}
.mai-export-menu button {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 13px; background: none; border: none; text-align: left;
  font: 600 12px/1 var(--font-body, sans-serif); color: var(--text-primary, #0F172A); cursor: pointer;
}
.mai-export-menu button:hover { background: var(--bg-muted, #F1F5F9); }
.mai-export-menu button .fa-file-pdf { color: #DC2626; }
.mai-export-menu button .fa-file-excel { color: #16A34A; }
.mai-export-menu button .fa-file-word { color: #1E40AF; }

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
  .mai-actions, .mai-export { display: none !important; }
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

/* ─── DARK MODE — voice, agent steps, category browser, export, history groups ─── */
[data-theme="dark"] .mai-mic { background: #131F38; border-color: #1C2E50; color: #B8C8E8; }
[data-theme="dark"] .mai-mic:hover:not(:disabled) { background: rgba(59,130,246,.18); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-voice-banner { background: rgba(220,38,38,.14); }
[data-theme="dark"] .mai-voice-banner--transcribing { background: rgba(59,130,246,.18); color: #93C5FD; }
[data-theme="dark"] .mai-agent-h { color: #E2E8F8; }
[data-theme="dark"] .mai-agent-step { color: #6B82A8; }
[data-theme="dark"] .mai-agent-step-ic { border-color: #1C2E50; color: #6B82A8; }
[data-theme="dark"] .mai-agent-step--active { color: #E2E8F8; }
[data-theme="dark"] .mai-agent-step--active .mai-agent-step-ic { border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-agent-step--done { color: #B8C8E8; }
[data-theme="dark"] .mai-cat-tab { background: #131F38; border-color: #1C2E50; color: #B8C8E8; }
[data-theme="dark"] .mai-cat-tab:hover { border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-cat-tab.active { background: #3B82F6; border-color: #3B82F6; color: #0A1120; }
[data-theme="dark"] .mai-history-daylabel { color: #6B82A8; }
[data-theme="dark"] .mai-export-menu { background: #0E1628; border-color: #1C2E50; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
[data-theme="dark"] .mai-export-menu button { color: #E2E8F8; }
[data-theme="dark"] .mai-export-menu button:hover { background: #131F38; }

/* ─── DARK MODE — premium AI-identity additions ─── */
[data-theme="dark"] .mai-trending-label { color: #6B82A8; }
[data-theme="dark"] .mai-trending-chip { background: #0E1628; border-color: rgba(59,130,246,.32); color: #B8C8E8; }
[data-theme="dark"] .mai-trending-chip:hover { border-color: #3B82F6; color: #93C5FD; background: rgba(59,130,246,.12); }
[data-theme="dark"] .mai-agent-ambient { color: #6B82A8; }
[data-theme="dark"] .mai-agent-h-ic { color: #5EEAD4; }
[data-theme="dark"] .mai-agent-step--done .mai-agent-step-ic { background: linear-gradient(135deg,#3B82F6,#5EEAD4); }
[data-theme="dark"] .mai-agent-step--active .mai-agent-step-ic { border-color: #3B82F6; color: #93C5FD; box-shadow: 0 0 0 3px rgba(59,130,246,.18); }
[data-theme="dark"] .mai-voice-banner--transcribing { background: rgba(59,130,246,.14); border-color: #3B82F6; color: #93C5FD; }
[data-theme="dark"] .mai-voice-banner--transcribing i { color: #93C5FD; }
  `;
}
