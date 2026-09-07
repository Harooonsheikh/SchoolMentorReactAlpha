import React, { useCallback, useEffect, useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';
import * as mentorAIWalletService from '../../services/mentorAIWalletService';
import ChatAssistant from './ChatAssistant';
import LessonPlans from './LessonPlans';
import Worksheets from './Worksheets';
import DesignStudio from './DesignStudio';
import Wallet from './Wallet';
import Library from './Library';

/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI STUDIO — root module shell.

   Ported from "Mentor Ai UX .html" (mobile prototype). This is the
   content-generation suite (AI Chat Assistant, Lesson Plans, Worksheet
   Generator, Design Studio, Wallet, Library) — NOT the same product as
   the Dashboard's existing "Mentor AI — ERP Intelligence Assistant"
   (src/pages/Dashboard/MentorAIPanel.jsx), which is left untouched.

   Frontend-only: every generation flow goes through
   src/services/mentorAiStudioService.js, which is mock/localStorage
   backed today and swaps to real HTTP calls later without any UI
   change (see that file's header comment).

   Single module-scoped <style> block (MENTORAI_CSS) reused by every
   screen below — same convention as UP_CSS in UserPermissions.jsx —
   because all of these only ever render while this root is mounted.
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'chat',         label: 'AI Chat Assistant', icon: 'fa-comments' },
  { id: 'lessonplans',  label: 'Lesson Plans',   icon: 'fa-chalkboard-user' },
  { id: 'worksheets',   label: 'Worksheets',     icon: 'fa-file-pen' },
  { id: 'designstudio', label: 'Design Studio',  icon: 'fa-palette' },
  { id: 'library',      label: 'Library',        icon: 'fa-folder-open' },
  { id: 'wallet',       label: 'Wallet',         icon: 'fa-wallet' },
];

export default function MentorAI({ toast, schoolName = 'Your School' }) {
  const [tab, setTab] = useState('chat');
  const [wallet, setWallet] = useState(null);
  /* walletData drives the header chip, the Home teaser and the Wallet
     screen itself — sourced from the dedicated mentorAIWalletService
     (see Wallet.jsx header comment). `wallet`/`refreshWallet` above
     stay wired exactly as before so Chat/Lesson Plans/Worksheets/
     Design Studio's onConsumed callbacks are untouched. */
  const [walletData, setWalletData] = useState(null);

  const refreshWallet = useCallback(() => {
    mentorAiStudioService.getWalletUsage().then(setWallet).catch(() => {});
  }, []);
  const refreshWalletData = useCallback(() => {
    mentorAIWalletService.getWalletData().then(setWalletData).catch(() => {});
  }, []);

  useEffect(() => { refreshWallet(); }, [refreshWallet]);
  useEffect(() => { refreshWalletData(); }, [refreshWalletData]);

  const goTo = (id) => setTab(id);

  return (
    <div className="msai-root">
      <style>{MENTORAI_CSS}</style>

      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          </div>
          <div>
            <div className="page-title">Mentor AI</div>
            <div className="page-sub" style={{ marginTop: 2 }}>Your AI teaching assistant — chat, lesson plans, worksheets &amp; designs.</div>
          </div>
        </div>
        {walletData && (() => {
          const activePlan = walletData.plans.find(p => p.isCurrent);
          const left = Math.max(0, activePlan.totals.chatTokens - activePlan.used.chatTokens);
          return (
            <button type="button" className="msai-wallet-chip" onClick={() => goTo('wallet')}>
              <i className="fa-solid fa-bolt" aria-hidden="true" />
              {left.toLocaleString()} tokens left
            </button>
          );
        })()}
      </div>

      <div className="msai-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`msai-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => goTo(t.id)}
          >
            <i className={`fa-solid ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div className="msai-screen">
        {tab === 'chat' && <ChatAssistant toast={toast} onConsumed={refreshWallet} goTo={goTo} schoolName={schoolName} />}
        {tab === 'lessonplans' && <LessonPlans toast={toast} onConsumed={refreshWallet} />}
        {tab === 'worksheets' && <Worksheets toast={toast} onConsumed={refreshWallet} />}
        {tab === 'designstudio' && <DesignStudio toast={toast} onConsumed={refreshWallet} />}
        {tab === 'library' && <Library toast={toast} />}
        {tab === 'wallet' && <Wallet goTo={goTo} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MENTORAI_CSS — shared across every screen in this module.

   Uses the ERP's own design tokens directly — var(--brand-primary),
   var(--brand-light), var(--border-light), var(--border-med),
   var(--bg-muted), var(--shadow-*) — with no per-module override, so
   Mentor AI matches the rest of the ERP's dark-blue theme exactly
   (same brand color, same shades, same light/dark mode behavior)
   rather than carrying its own distinct accent.
   ═══════════════════════════════════════════════════════════════════ */
const MENTORAI_CSS = `
.msai-root {
  display:flex; flex-direction:column; gap:16px;
}

/* Logo chip — the Mentor AI wordmark is fixed dark charcoal, so it
   needs a light backdrop to stay legible regardless of theme (same
   reasoning as the Dashboard assistant's own .mai-logo-chip). */
.msai-logo-chip {
  display:inline-flex; align-items:center; justify-content:center;
  background:#FFFFFF; border:1px solid rgba(15,23,42,.08);
  border-radius:var(--radius-md); flex-shrink:0;
}
.msai-logo-chip--empty { padding:14px 22px; margin-bottom:6px; box-shadow:var(--shadow-sm); }
.msai-empty-logo { height:38px; width:auto; object-fit:contain; display:block; }

.msai-wallet-chip {
  display:inline-flex; align-items:center; gap:7px; padding:8px 14px;
  border-radius:var(--radius-full); border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--brand-primary); font:700 12.5px/1 var(--font-body);
  cursor:pointer; transition:var(--tr); white-space:nowrap;
}
.msai-wallet-chip:hover { border-color:var(--brand-primary); background:var(--brand-light); }
.msai-wallet-chip i { color:#1E40AF; }

/* In-module tab strip — matches Examination's .exam-tabs-row/.exam-tab
   theme exactly, so every module's main tab bar reads the same way. */
.msai-tabs {
  display:flex; gap:4px;
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); padding:5px; box-shadow:var(--shadow-sm);
  overflow-x:auto; flex-wrap:nowrap;
}
.msai-tab {
  flex:1 1 0;
  display:flex; align-items:center; justify-content:center; gap:7px;
  padding:11px 18px; border-radius:var(--radius-md); border:none;
  background:transparent; font-family:var(--font-body);
  font-size:13px; font-weight:600; color:var(--text-muted);
  cursor:pointer; transition:var(--tr); white-space:nowrap;
}
.msai-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.msai-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;
  box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.msai-tab i { font-size:12px; }

[data-theme="dark"] .msai-tabs { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-sm); }
[data-theme="dark"] .msai-tab { color:var(--text-muted); }
[data-theme="dark"] .msai-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }

@media (max-width:600px) {
  .msai-tabs { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; -ms-overflow-style:none; gap:4px; padding:4px; }
  .msai-tabs::-webkit-scrollbar { display:none; }
  .msai-tabs > * { flex:0 0 auto; white-space:nowrap; font-size:12px; padding:8px 12px; }
}
@media (max-width:767px) {
  .msai-tabs {
    overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
    flex-wrap:nowrap !important; white-space:nowrap; padding-bottom:4px;
  }
  .msai-tabs::-webkit-scrollbar { display:none; }
  .msai-tab { flex:0 0 auto; min-width:130px; padding:10px 14px; font-size:12.5px; }
}

.msai-screen { min-height:320px; }

/* Generic card used across screens */
.msai-card {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); box-shadow:var(--shadow-xs); padding:20px;
}

.msai-btn-primary, .msai-btn-secondary {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  padding:11px 20px; border-radius:var(--radius-md); font:700 13px/1 var(--font-body);
  cursor:pointer; transition:var(--tr); border:none;
}
.msai-btn-primary { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; box-shadow:var(--shadow-sm); }
.msai-btn-primary:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px); }
.msai-btn-primary:disabled { opacity:.55; cursor:not-allowed; transform:none; }
.msai-btn-secondary { background:var(--bg-muted); color:var(--text-secondary); border:1.5px solid var(--border-light); }
.msai-btn-secondary:hover:not(:disabled) { background:var(--brand-light); color:var(--brand-primary); }

.msai-chip {
  padding:8px 13px; border-radius:var(--radius-full); border:1.5px solid var(--border-light);
  background:var(--bg-muted); color:var(--text-secondary); font:600 12px/1 var(--font-body);
  cursor:pointer; transition:var(--tr); white-space:nowrap;
}
.msai-chip:hover:not(:disabled) { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.msai-chip:disabled { opacity:.5; cursor:not-allowed; }

/* ── GeneratingProgress ── */
.msai-generating { display:flex; flex-direction:column; align-items:center; text-align:center; gap:14px; padding:40px 20px; }
.msai-gen-spinner {
  width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; font-size:24px;
  animation: msaiSpin 2.2s linear infinite;
}
@keyframes msaiSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
.msai-gen-title { font:800 16px/1.3 var(--font-body); color:var(--text-primary); }
.msai-gen-bar { width:100%; max-width:360px; height:6px; border-radius:var(--radius-full); background:var(--bg-muted); overflow:hidden; }
.msai-gen-bar-fill { height:100%; background:linear-gradient(90deg,#1E3A8A,#2563EB); transition:width .4s ease; }
.msai-gen-steps { display:flex; flex-direction:column; gap:8px; width:100%; max-width:360px; text-align:left; }
.msai-gen-step { display:flex; align-items:center; gap:10px; font:600 12.5px/1.2 var(--font-body); color:var(--text-muted); }
.msai-gen-step.active { color:var(--brand-primary); }
.msai-gen-step.done { color:#16A34A; }
.msai-gen-step-dot { width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; background:var(--bg-muted); flex-shrink:0; }
.msai-gen-step.done .msai-gen-step-dot { background:#16A34A; color:#fff; }
.msai-gen-step.active .msai-gen-step-dot { background:var(--brand-light); color:var(--brand-primary); }
.msai-gen-fact { display:flex; align-items:center; gap:8px; font:600 12px/1.4 var(--font-body); color:var(--text-muted); max-width:400px; }
.msai-gen-fact i { color:#D97706; }

/* ── EditViaAIPanel ── */
.msai-editai { display:flex; flex-direction:column; gap:12px; }
.msai-editai-ctx { font:700 12.5px/1.3 var(--font-body); color:var(--text-secondary); background:var(--bg-muted); border-radius:var(--radius-md); padding:9px 12px; }
.msai-editai-chips { display:flex; flex-wrap:wrap; gap:7px; }
.msai-editai-thread { display:flex; flex-direction:column; gap:8px; min-height:60px; max-height:220px; overflow-y:auto; padding:4px 2px; }
.msai-editai-empty { font:600 12.5px/1.4 var(--font-body); color:var(--text-muted); padding:10px 0; }
.msai-editai-msg { max-width:85%; padding:9px 13px; border-radius:var(--radius-md); font:600 12.5px/1.4 var(--font-body); }
.msai-editai-msg.user { align-self:flex-end; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; }
.msai-editai-msg.ai { align-self:flex-start; background:var(--bg-muted); color:var(--text-secondary); }
.msai-proposed { background:var(--brand-light); border:1.5px solid var(--border-med); border-radius:var(--radius-md); padding:12px 14px; }
.msai-proposed-h { font:800 12.5px/1 var(--font-body); color:var(--brand-primary); margin-bottom:8px; display:flex; align-items:center; gap:7px; }
.msai-proposed-list { margin:0; padding-left:18px; font:600 12.5px/1.6 var(--font-body); color:var(--text-secondary); }
.msai-editai-composer { display:flex; gap:8px; }
.msai-editai-composer input { flex:1; height:40px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); padding:0 13px; font:600 13px/1 var(--font-body); background:var(--input-bg); color:var(--text-primary); outline:none; }
.msai-editai-composer input:focus { border-color:var(--brand-primary); }
.msai-editai-composer button { width:40px; height:40px; border-radius:var(--radius-md); border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; cursor:pointer; flex-shrink:0; }
.msai-editai-composer button:disabled { opacity:.5; cursor:not-allowed; }

/* ── VoiceDictationButton — reusable mic for any prompt/instruction
   field (Chat's composer, EditViaAIPanel, and every Lesson Plans /
   Notebook Plans / Worksheets / Design Studio prompt field below). ── */
.msai-voice-mic {
  width:32px; height:32px; border-radius:50%; border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-muted); cursor:pointer; flex-shrink:0;
  display:inline-flex; align-items:center; justify-content:center; gap:5px; font-size:13px; transition:var(--tr);
}
.msai-voice-mic:hover:not(:disabled) { border-color:var(--brand-primary); color:var(--brand-primary); }
.msai-voice-mic:disabled { opacity:.5; cursor:not-allowed; }
.msai-voice-mic.recording { width:auto; padding:0 12px; background:#DC2626; border-color:#DC2626; color:#fff; font:800 11px/1 var(--font-body); animation:msaiVoiceRecPulse 1.2s ease-in-out infinite; }
.msai-voice-mic.converting { color:var(--brand-primary); border-color:var(--brand-primary); }
.msai-voice-mic-time { font:800 11px/1 var(--font-body); }
@keyframes msaiVoiceRecPulse { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,.4); } 50% { box-shadow:0 0 0 6px rgba(220,38,38,0); } }
.msai-editai-composer .msai-voice-mic { width:40px; height:40px; border-radius:var(--radius-md); }
.msai-editai-composer .msai-voice-mic.recording { width:auto; }

/* Wraps a single field + its mic button. Textareas can grow tall, so
   the mic anchors to the bottom-right corner; single-line inputs have
   a fixed height, so the mic is vertically centered instead (bottom
   anchoring on a short input left it hugging the top edge). */
.msai-field-voice-wrap { position:relative; width:100%; }
.msai-field-voice-wrap .msai-voice-mic { position:absolute; right:8px; bottom:8px; }
.msai-field-voice-wrap input ~ .msai-voice-mic { bottom:auto; top:50%; transform:translateY(-50%); }
.msai-field-voice-wrap textarea, .msai-field-voice-wrap input { width:100%; box-sizing:border-box; padding-right:44px; }
.msai-editai-actions { display:flex; justify-content:flex-end; gap:10px; }

.msai-version-pill { display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:var(--radius-full); background:rgba(22,163,74,.12); color:#15803D; font:800 11.5px/1 var(--font-body); }
[data-theme="dark"] .msai-version-pill { background:rgba(74,222,128,.16); color:#86EFAC; }
.msai-version-dot { width:7px; height:7px; border-radius:50%; background:#16A34A; animation:msaiPulse 1.4s ease-in-out infinite; }
@keyframes msaiPulse { 0%,100%{opacity:1;} 50%{opacity:.35;} }

/* ── Feature cards — reused by AI Chat Assistant's "More to Explore"
   section on the empty state (this module has no separate Home hub
   screen; Chat itself is the entry point). ── */
.msai-feature-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
.msai-feature-card {
  display:flex; align-items:center; gap:14px; text-align:left; padding:18px 20px;
  background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg);
  cursor:pointer; transition:var(--tr); box-shadow:var(--shadow-xs);
}
.msai-feature-card:hover { border-color:var(--brand-primary); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.msai-feature-ic {
  width:48px; height:48px; border-radius:var(--radius-md); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  font-size:19px; background:linear-gradient(135deg,rgba(21,101,192,.14),rgba(0,191,165,.14)); color:#1E3A8A;
}
[data-theme="dark"] .msai-feature-ic { background:linear-gradient(135deg,rgba(21,101,192,.28),rgba(0,191,165,.24)); color:#93C5FD; }
.msai-feature-txt { flex:1; min-width:0; }
.msai-feature-title { font:800 14.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-feature-desc { font:600 12px/1.4 var(--font-body); color:var(--text-muted); margin-top:3px; }
.msai-feature-chev { color:var(--text-muted); font-size:12px; flex-shrink:0; }

/* ── AI Chat Assistant ── */
.msai-chat { display:flex; flex-direction:column; gap:12px; }
.msai-chat-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.msai-chat-head-l { display:flex; align-items:center; }
.msai-chat-online { display:flex; align-items:center; gap:7px; font:700 12px/1 var(--font-body); color:var(--text-muted); }
.msai-chat-online-dot { width:7px; height:7px; border-radius:50%; background:#16A34A; animation:msaiPulse 1.6s ease-in-out infinite; }
.msai-chat-head-r { display:flex; align-items:center; gap:8px; }
.msai-icon-btn { position:relative; width:36px; height:36px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-secondary); cursor:pointer; transition:var(--tr); }
.msai-icon-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); }
.msai-icon-badge { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px; padding:0 3px; border-radius:999px; background:#DC2626; color:#fff; font:800 9px/16px var(--font-body); }

/* Height is capped to the viewport (not just min-height) so the body
   below scrolls INTERNALLY once its content (empty-state + "More to
   Explore") grows — the composer stays pinned and visible without the
   user ever having to scroll the page to find it. */
.msai-chat-shell { display:flex; flex-direction:column; gap:12px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); box-shadow:var(--shadow-xs); padding:16px; height:calc(100vh - 320px); min-height:400px; max-height:700px; }
.msai-chat-body { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:14px; padding:4px; }
.msai-chat-empty { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:36px 16px; margin:auto; width:100%; max-width:760px; }
.msai-chat-empty-t { font:800 16px/1.3 var(--font-body); color:var(--text-primary); }
.msai-chat-empty-s { font:600 12.5px/1.5 var(--font-body); color:var(--text-muted); max-width:420px; }
.msai-chat-chips { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; margin-top:6px; }

.msai-chat-explore { width:100%; margin-top:20px; padding-top:20px; border-top:1.5px dashed var(--border-light); text-align:left; }
.msai-chat-explore-lbl { font:800 11px/1 var(--font-body); letter-spacing:1px; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px; }
.msai-chat-explore-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
.msai-chat-explore-grid .msai-feature-card { padding:14px 16px; }
.msai-chat-explore-grid .msai-feature-ic { width:40px; height:40px; font-size:16px; }
/* Subtle, staggered breathing glow — a light touch so the "explore"
   cards feel alive/premium without being distracting. Disabled for
   reduced-motion users, same convention as the sidebar nav glow. */
@media (prefers-reduced-motion: no-preference) {
  .msai-chat-explore-grid .msai-feature-ic { animation: msaiExploreGlow 3.2s ease-in-out infinite; }
  .msai-chat-explore-grid .msai-feature-card:nth-child(2) .msai-feature-ic { animation-delay: .5s; }
  .msai-chat-explore-grid .msai-feature-card:nth-child(3) .msai-feature-ic { animation-delay: 1s; }
}
@keyframes msaiExploreGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,191,165,0), 0 0 0 0 rgba(0,191,165,0); transform: scale(1); }
  50%      { box-shadow: 0 0 0 5px rgba(0,191,165,.45), 0 0 14px 6px rgba(0,191,165,.35); transform: scale(1.08); }
}

.msai-chat-exchange { display:flex; flex-direction:column; gap:8px; }
.msai-msg-row { display:flex; }
.msai-msg-row.user { justify-content:flex-end; }
.msai-msg-row.ai { justify-content:flex-start; }
.msai-msg-bubble { max-width:78%; padding:12px 15px; border-radius:var(--radius-lg); font:600 13px/1.55 var(--font-body); }
.msai-msg-bubble.user { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; border-bottom-right-radius:4px; }
.msai-msg-bubble.ai { background:var(--bg-muted); color:var(--text-primary); border-bottom-left-radius:4px; }
.msai-typing { display:flex; gap:4px; align-items:center; padding:14px 16px; }
.msai-typing span { width:6px; height:6px; border-radius:50%; background:var(--text-muted); animation:msaiTyping 1.2s ease-in-out infinite; }
.msai-typing span:nth-child(2) { animation-delay:.15s; } .msai-typing span:nth-child(3) { animation-delay:.3s; }
@keyframes msaiTyping { 0%,60%,100%{transform:translateY(0);opacity:.4;} 30%{transform:translateY(-4px);opacity:1;} }
.msai-retry { border:none; background:none; color:var(--brand-primary); font-weight:800; cursor:pointer; padding:0; margin-left:4px; }

.msai-resp-heading { font:800 12px/1.2 var(--font-body); letter-spacing:.4px; text-transform:uppercase; color:#1E40AF; margin:10px 0 4px; }
.msai-resp-heading:first-child { margin-top:0; }
.msai-resp-text { margin:0 0 8px; }
.msai-resp-bullets, .msai-resp-numbered { margin:0 0 8px; padding-left:18px; }
.msai-resp-bullets li, .msai-resp-numbered li { margin-bottom:4px; }
.msai-resp-actions { display:flex; gap:8px; margin-top:8px; }
.msai-resp-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:var(--radius-full); border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); font:700 11px/1 var(--font-body); cursor:pointer; }
.msai-resp-pill:hover { color:var(--brand-primary); border-color:var(--brand-primary); }

/* Grammar mode — Original / Issue / Corrected / Rule */
.msai-resp-correction { display:flex; flex-direction:column; gap:8px; margin:4px 0 10px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:12px 14px; background:var(--bg-muted); }
.msai-resp-correction-row { display:grid; grid-template-columns:82px 1fr; gap:10px; align-items:start; }
.msai-resp-correction-row span { font:800 10.5px/1.4 var(--font-body); letter-spacing:.4px; text-transform:uppercase; color:var(--text-muted); padding-top:1px; }
.msai-resp-correction-row p { margin:0; font:600 12.5px/1.5 var(--font-body); color:var(--text-primary); }
.msai-resp-correction-row--fixed span { color:#16A34A; }
.msai-resp-correction-row--fixed p { color:#16A34A; font-weight:700; }

/* STEAM mode — fixed schema fields */
.msai-resp-fields { display:flex; flex-direction:column; gap:7px; margin:4px 0 10px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:12px 14px; background:var(--bg-muted); }
.msai-resp-fields-row { display:grid; grid-template-columns:150px 1fr; gap:10px; align-items:start; }
.msai-resp-fields-row span { font:800 11px/1.4 var(--font-body); color:var(--brand-primary); }
.msai-resp-fields-row p { margin:0; font:600 12.5px/1.5 var(--font-body); color:var(--text-primary); }

/* Marketing mode — unfilled [bracket] placeholders */
.msai-placeholder { background:rgba(217,119,6,.15); color:#92400E; border-radius:4px; padding:0 4px; font-weight:700; }
[data-theme="dark"] .msai-placeholder { background:rgba(245,158,11,.2); color:#FCD34D; }

.msai-composer { display:flex; align-items:center; gap:8px; border-top:1.5px solid var(--border-light); padding-top:12px; }
.msai-composer input { flex:1; height:42px; border-radius:var(--radius-full); border:1.5px solid var(--border-light); padding:0 16px; font:600 13px/1 var(--font-body); background:var(--input-bg); color:var(--text-primary); outline:none; }
.msai-composer input:focus { border-color:var(--brand-primary); }
.msai-composer-icon { width:38px; height:38px; border-radius:50%; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); cursor:pointer; flex-shrink:0; }
.msai-composer-icon:hover { color:var(--brand-primary); border-color:var(--brand-primary); }
.msai-composer-send { width:42px; height:42px; border-radius:50%; border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; cursor:pointer; flex-shrink:0; box-shadow:var(--shadow-sm); }
.msai-composer-send:disabled { opacity:.5; cursor:not-allowed; }

/* Attach menu — Photo / PDF */
.msai-attach-wrap { position:relative; flex-shrink:0; }
.msai-attach-menu-backdrop { position:fixed; inset:0; z-index:1150; }
.msai-attach-menu {
  position:absolute; bottom:46px; left:0; z-index:1151;
  display:flex; flex-direction:column; min-width:140px; padding:6px;
  background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  box-shadow:var(--shadow-lg);
}
.msai-attach-menu button { display:flex; align-items:center; gap:9px; padding:9px 11px; border:none; background:none; border-radius:var(--radius-sm); cursor:pointer; font:700 12.5px/1 var(--font-body); color:var(--text-primary); text-align:left; }
.msai-attach-menu button:hover { background:var(--bg-muted); color:var(--brand-primary); }
.msai-attach-menu button i { width:16px; color:var(--brand-primary); }

/* Staged attachment previews above the composer, before sending */
.msai-attach-preview { display:flex; flex-wrap:wrap; gap:8px; padding-bottom:2px; }
.msai-attach-preview-item { position:relative; display:flex; align-items:center; gap:7px; padding:6px 26px 6px 6px; border-radius:var(--radius-md); background:var(--bg-muted); border:1.5px solid var(--border-light); max-width:200px; }
.msai-attach-preview-thumb { width:28px; height:28px; border-radius:6px; object-fit:cover; flex-shrink:0; }
.msai-attach-preview-icon { width:28px; height:28px; border-radius:6px; background:rgba(220,38,38,.12); color:#DC2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px; }
.msai-attach-preview-name { font:600 11.5px/1.3 var(--font-body); color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.msai-attach-preview-item button { position:absolute; right:4px; top:4px; width:16px; height:16px; border:none; border-radius:50%; background:rgba(15,23,42,.12); color:var(--text-muted); font-size:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.msai-attach-preview-item button:hover { background:#DC2626; color:#fff; }

/* Attachment chips shown inside a sent message bubble */
.msai-msg-attachments { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:6px; }
.msai-msg-attachment { display:flex; align-items:center; gap:6px; padding:5px 10px 5px 5px; border-radius:var(--radius-md); background:rgba(255,255,255,.16); max-width:180px; }
.msai-msg-bubble.ai .msai-msg-attachment { background:var(--bg-muted); }
.msai-msg-attachment-thumb { width:24px; height:24px; border-radius:5px; object-fit:cover; flex-shrink:0; }
.msai-msg-attachment-icon { width:24px; height:24px; border-radius:5px; background:rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px; }
.msai-msg-attachment-name { font:600 11px/1.3 var(--font-body); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.msai-voicebar { display:flex; align-items:center; gap:12px; border-top:1.5px solid var(--border-light); padding-top:12px; font:700 13px/1 var(--font-body); color:var(--text-primary); }
.msai-voice-dot { width:9px; height:9px; border-radius:50%; background:#DC2626; animation:msaiPulse 1s ease-in-out infinite; }
.msai-voicebar-actions { display:flex; gap:8px; margin-left:auto; }
.msai-voicebar--transcript { flex-direction:column; align-items:stretch; }
.msai-voicebar--transcript textarea { width:100%; border-radius:var(--radius-md); border:1.5px solid var(--border-light); padding:10px 12px; font:600 13px/1.5 var(--font-body); background:var(--input-bg); color:var(--text-primary); resize:vertical; }

/* Side panels (mode selector / chat history) — reuse-style modal pattern */
.msai-panel-overlay { position:fixed; inset:0; background:rgba(15,23,42,.4); z-index:1200; display:flex; justify-content:flex-end; }
.msai-panel { width:360px; max-width:92vw; background:var(--bg-card); height:100%; box-shadow:var(--shadow-xl); display:flex; flex-direction:column; animation:msaiSlideIn .25s ease; }
@keyframes msaiSlideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
.msai-panel-head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1.5px solid var(--border-light); font:800 14px/1 var(--font-body); color:var(--text-primary); }
.msai-panel-body { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:12px; }

.msai-hist-group-lbl { font:800 10.5px/1 var(--font-body); letter-spacing:.6px; text-transform:uppercase; color:var(--text-muted); margin:10px 0 8px; }
.msai-hist-item { position:relative; padding:11px 34px 11px 12px; border-radius:var(--radius-md); cursor:pointer; margin-bottom:6px; transition:var(--tr); }
.msai-hist-item:hover { background:var(--bg-muted); }
.msai-hist-item.active { background:var(--brand-light); }
.msai-hist-item-t { font:700 12.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-hist-item-m { display:flex; gap:8px; margin-top:3px; font:600 11px/1 var(--font-body); color:var(--text-muted); }
.msai-hist-item-mode { padding:2px 7px; border-radius:999px; background:var(--bg-muted); }
.msai-hist-del { position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:none; color:var(--text-muted); cursor:pointer; padding:4px; }
.msai-hist-del:hover { color:#DC2626; }

/* ── Select Mentor Mode — sliding side panel (same interaction as
   Chat History), but noticeably wider than the module's default
   360px panel width, with roomier padding/type throughout, so
   browsing 10 specialist modes plus their preview doesn't feel
   cramped. Explanation preview (tag + description + example) stays
   above the list, in one column, as in the original design. ── */
.msai-panel--wide { width:540px; }
.msai-panel--wide .msai-panel-body { padding:18px 20px; gap:16px; }

.msai-mode-search { width:100%; height:42px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); padding:0 14px; font:600 13.5px/1 var(--font-body); background:var(--input-bg); color:var(--text-primary); outline:none; flex-shrink:0; }
.msai-mode-search:focus { border-color:var(--brand-primary); }

.msai-mode-preview { border:1.5px solid; border-radius:var(--radius-lg); padding:16px 18px; background:var(--bg-muted); }
.msai-mode-tag { display:inline-block; padding:5px 12px; border-radius:999px; font:800 11.5px/1 var(--font-body); margin-bottom:10px; }
.msai-mode-preview-desc { font:600 13.5px/1.6 var(--font-body); color:var(--text-secondary); margin-bottom:10px; }
.msai-mode-preview-ex { font:600 italic 12.5px/1.5 var(--font-body); color:var(--text-muted); }

.msai-mode-list { display:flex; flex-direction:column; gap:3px; }
.msai-mode-item { display:flex; align-items:center; gap:12px; padding:12px 12px; border:none; background:none; border-radius:var(--radius-md); cursor:pointer; text-align:left; transition:var(--tr); }
.msai-mode-item:hover, .msai-mode-item.highlighted { background:var(--bg-muted); }
.msai-mode-item.current { background:var(--brand-light); }
.msai-mode-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.msai-mode-item-txt { flex:1; display:flex; flex-direction:column; }
.msai-mode-item-name { font:700 13.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-mode-item-cat { font:600 11px/1.3 var(--font-body); color:var(--text-muted); }
.msai-mode-item.current i { color:var(--brand-primary); }

/* ── Shared step/wizard scaffolding (Lesson Plans, Worksheets, Design Studio) ── */
.msai-back-link { display:inline-flex; align-items:center; gap:7px; border:none; background:none; color:var(--text-muted); font:700 12.5px/1 var(--font-body); cursor:pointer; padding:4px 0; margin-bottom:2px; }
.msai-back-link:hover { color:var(--brand-primary); }
.msai-lp-step, .msai-ws-step, .msai-ds-step { display:flex; flex-direction:column; gap:16px; }
.msai-step-title { font:800 17px/1.3 var(--font-body); color:var(--text-primary); }
.msai-step-sub { font:600 12.5px/1.5 var(--font-body); color:var(--text-muted); margin-top:-8px; }
.msai-form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
.msai-field { display:flex; flex-direction:column; gap:6px; }
.msai-field label { font:800 11.5px/1 var(--font-body); color:var(--text-secondary); }
.msai-field select, .msai-field input, .msai-field textarea {
  height:40px; border-radius:var(--radius-md); border:1.5px solid var(--border-light);
  padding:0 13px; font:600 13px/1 var(--font-body); background:var(--input-bg); color:var(--text-primary); outline:none;
}
.msai-field textarea { height:auto; padding:10px 13px; font-size:12.5px; line-height:1.5; resize:vertical; }
.msai-field select:focus, .msai-field input:focus, .msai-field textarea:focus { border-color:var(--brand-primary); }

.msai-scan-frame { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; height:180px; border:2px dashed var(--border-med); border-radius:var(--radius-lg); color:var(--text-muted); font:700 12.5px/1 var(--font-body); background:var(--bg-muted); }
.msai-scan-frame i { font-size:28px; color:var(--brand-primary); }
.msai-scan-actions { display:flex; gap:10px; }
.msai-tip-card { display:flex; align-items:center; gap:9px; padding:11px 14px; border-radius:var(--radius-md); background:rgba(217,119,6,.1); color:#92400E; font:600 12px/1.4 var(--font-body); }
[data-theme="dark"] .msai-tip-card { background:rgba(245,158,11,.14); color:#FCD34D; }

.msai-content-type-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
.msai-content-type-card { display:flex; flex-direction:column; align-items:flex-start; gap:8px; text-align:left; padding:20px; border-radius:var(--radius-lg); border:1.5px solid var(--border-light); background:var(--bg-card); cursor:pointer; transition:var(--tr); }
.msai-content-type-card:hover { border-color:var(--brand-primary); box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.msai-content-type-card i { font-size:22px; color:#1E3A8A; }
.msai-ctc-title { font:800 14.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-ctc-desc { font:600 12px/1.5 var(--font-body); color:var(--text-muted); }

.msai-lp-result-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.msai-lp-meta { font:600 12px/1.4 var(--font-body); color:var(--text-muted); margin-top:3px; }
.msai-lp-result-badges { display:flex; align-items:center; gap:8px; }
.msai-duration-pill { display:inline-flex; align-items:center; padding:6px 12px; border-radius:999px; background:var(--brand-light); color:var(--brand-primary); font:800 11.5px/1 var(--font-body); white-space:nowrap; }
.msai-duration-pill--sm { padding:3px 9px; font-size:10.5px; }
.msai-lp-plan-tabs { display:flex; flex-wrap:wrap; gap:7px; }
.msai-chip--active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; border-color:transparent; }
.msai-lp-section { border-top:1.5px solid var(--border-light); padding-top:14px; }
.msai-lp-section-h { display:flex; align-items:center; justify-content:space-between; font:800 13px/1.3 var(--font-body); color:var(--text-primary); margin-bottom:8px; }
.msai-result-actions { display:flex; gap:10px; flex-wrap:wrap; border-top:1.5px solid var(--border-light); padding-top:16px; }

.msai-nb-type-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:12px; }
.msai-nb-type-card {
  display:flex; flex-direction:column; align-items:flex-start; gap:12px;
  padding:16px; border-radius:var(--radius-lg); border:1.5px solid var(--border-light);
  background:var(--bg-card); cursor:pointer; text-align:left; transition:var(--tr);
}
.msai-nb-type-card:hover { border-color:var(--nb-color, var(--brand-primary)); box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.msai-nb-type-card-ic { width:36px; height:36px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.msai-nb-type-card-name { font:800 13px/1.35 var(--font-body); color:var(--text-primary); }
.msai-nb-instruction { font:700 italic 12.5px/1.5 var(--font-body); color:var(--text-secondary); background:var(--bg-muted); border-radius:var(--radius-md); padding:10px 13px; }
.msai-nb-table { width:100%; border-collapse:collapse; font:600 12.5px/1.4 var(--font-body); }
.msai-nb-table th { text-align:left; padding:9px 10px; border-bottom:1.5px solid var(--border-light); color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:.4px; }
.msai-nb-table td { padding:9px 10px; border-bottom:1px solid var(--border-light); color:var(--text-primary); }
.msai-nb-blank { color:var(--text-muted); font-style:italic; }
.msai-nb-mcq-list { display:flex; flex-direction:column; gap:10px; }
.msai-nb-mcq-q { font:700 12.5px/1.4 var(--font-body); color:var(--text-primary); margin-bottom:4px; }
.msai-nb-mcq-opts { display:flex; flex-wrap:wrap; gap:10px; font:600 12px/1.4 var(--font-body); color:var(--text-muted); }

/* ── Worksheets ── */
.msai-step-pill { display:inline-block; margin-left:10px; padding:4px 10px; border-radius:999px; background:var(--bg-muted); color:var(--text-muted); font:800 10.5px/1 var(--font-body); vertical-align:middle; }
.msai-chip-row { display:flex; flex-wrap:wrap; gap:7px; }
.msai-content-type-card--sm { padding:14px 16px; }
.msai-content-type-card.selected { border-color:var(--brand-primary); background:var(--brand-light); box-shadow:var(--shadow-sm); }
.msai-stepper { display:flex; align-items:center; gap:0; border:1.5px solid var(--border-light); border-radius:var(--radius-md); overflow:hidden; width:fit-content; }
.msai-stepper button { width:36px; height:38px; border:none; background:var(--bg-muted); color:var(--text-secondary); font:800 16px/1 var(--font-body); cursor:pointer; }
.msai-stepper button:hover { background:var(--brand-light); color:var(--brand-primary); }
.msai-stepper span { width:44px; text-align:center; font:800 13px/1 var(--font-body); color:var(--text-primary); }
.msai-toggle-row { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-radius:var(--radius-md); background:var(--bg-muted); font:700 12.5px/1 var(--font-body); color:var(--text-primary); cursor:pointer; }
/* ─── Toggle switch — real track/knob elements (not a checkbox
   pseudo-element), so vertical centering is a plain box-model
   calculation with no replaced-element quirks to fight. ─── */
.msai-toggle-wrap { position:relative; display:inline-flex; width:40px; height:22px; flex-shrink:0; cursor:pointer; }
.msai-toggle-input { position:absolute; inset:0; margin:0; opacity:0; cursor:pointer; z-index:1; }
.msai-toggle-track {
  position:absolute; inset:0; border-radius:999px;
  background:var(--border-med); transition:background .2s ease; pointer-events:none;
}
.msai-toggle-knob {
  position:absolute; top:50%; left:2px;
  width:18px; height:18px; border-radius:50%;
  background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25);
  transform:translateY(-50%);
  transition:transform .2s ease;
}
.msai-toggle-input:checked ~ .msai-toggle-track { background:var(--brand-primary); }
.msai-toggle-input:checked ~ .msai-toggle-track .msai-toggle-knob { transform:translateY(-50%) translateX(18px); }
.msai-hint-text { font:600 11.5px/1.4 var(--font-body); color:var(--text-muted); text-align:right; margin-top:-8px; }

.msai-ws-pages { display:flex; flex-direction:column; gap:16px; max-height:520px; overflow-y:auto; padding:2px; }
.msai-ws-page { border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:18px; background:var(--bg-card); }
.msai-ws-page-title { font:800 15px/1.3 var(--font-body); color:var(--text-primary); text-align:center; }
.msai-ws-page-subtitle { font:600 11.5px/1.3 var(--font-body); color:var(--text-muted); text-align:center; margin-bottom:12px; }
.msai-ws-section { margin-bottom:12px; }
.msai-ws-section-h { font:800 12px/1.2 var(--font-body); letter-spacing:.4px; text-transform:uppercase; color:#1E40AF; margin-bottom:6px; }
.msai-ws-page-footer { text-align:center; font:600 10.5px/1 var(--font-body); color:var(--text-muted); border-top:1px dashed var(--border-light); padding-top:10px; margin-top:8px; }
.msai-ws-q-new { background:rgba(22,163,74,.08); border:1px dashed #16A34A; border-radius:6px; padding:4px 8px; margin:-4px -8px 4px; list-style-position:inside; }
[data-theme="dark"] .msai-ws-q-new { background:rgba(74,222,128,.1); }
.msai-new-tag { display:inline-block; margin-left:6px; padding:1px 6px; border-radius:999px; background:#16A34A; color:#fff; font:800 9px/1.6 var(--font-body); }

/* ── Design Studio ── */
.msai-ds-hero { display:flex; flex-direction:column; gap:10px; }
.msai-ds-pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
.msai-ds-pills span { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:var(--brand-light); color:var(--brand-primary); font:700 11.5px/1 var(--font-body); }
.msai-ds-platform-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
.msai-ds-platform-card { padding:14px 16px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-card); cursor:pointer; transition:var(--tr); text-align:left; }
.msai-ds-platform-card:hover { border-color:var(--brand-primary); }
.msai-ds-platform-card.selected { border-color:var(--brand-primary); background:var(--brand-light); box-shadow:var(--shadow-sm); }
.msai-ds-platform-name { font:800 12.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-ds-platform-size { font:600 11px/1.4 var(--font-body); color:var(--text-muted); margin-top:2px; }
.msai-ds-stats { display:flex; gap:20px; padding:14px 0; border-top:1.5px solid var(--border-light); border-bottom:1.5px solid var(--border-light); }
.msai-ds-stats div { display:flex; flex-direction:column; gap:2px; }
.msai-ds-stats b { font:800 16px/1 var(--font-body); color:var(--brand-primary); }
.msai-ds-stats span { font:600 11px/1 var(--font-body); color:var(--text-muted); }


.msai-branding-toggles { display:flex; flex-wrap:wrap; gap:10px; }

/* ─── Brand Color Theme (Design Studio, Content & Branding step) ─── */
.msai-brandcolor-card {
  display:flex; flex-direction:column; gap:14px;
  padding:16px 18px; border-radius:var(--radius-lg);
  border:1.5px solid var(--border-light); background:var(--bg-muted);
}
.msai-brandcolor-head { display:flex; align-items:flex-start; gap:12px; }
.msai-brandcolor-ic {
  width:34px; height:34px; border-radius:var(--radius-md); flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:14px;
  background:var(--brand-light); color:var(--brand-primary);
}
.msai-brandcolor-title { font:800 14px/1.3 var(--font-body); color:var(--text-primary); }
.msai-brandcolor-desc { font:600 12px/1.5 var(--font-body); color:var(--text-muted); margin-top:2px; }

.msai-brandcolor-row {
  position:relative;
  display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  padding:12px 14px; border-radius:var(--radius-md);
  background:var(--bg-card); border:1.5px solid var(--border-light);
}
.msai-brandcolor-lbl { font:800 12.5px/1 var(--font-body); color:var(--text-primary); }
.msai-brandcolor-val { font:700 12.5px/1 var(--font-body); color:var(--text-muted); margin-right:auto; }
.msai-brandcolor-swatch {
  width:28px; height:28px; border-radius:var(--radius-full);
  border:1.5px solid var(--border-light); flex-shrink:0;
}
.msai-brandcolor-btn {
  width:34px; height:34px; border-radius:var(--radius-md); flex-shrink:0;
  border:1.5px solid var(--border-light); background:var(--bg-card);
  color:var(--text-secondary); cursor:pointer; transition:var(--tr);
  display:flex; align-items:center; justify-content:center; font-size:13px;
}
.msai-brandcolor-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); }

/* Floats right below the picker icon (anchored to .msai-brandcolor-row,
   which the icon lives in) instead of a full-width block in the flow. */
.msai-brandcolor-popover {
  position:absolute; top:calc(100% + 8px); right:0; z-index:20;
  width:300px; max-width:calc(100vw - 32px);
  display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  padding:14px; border-radius:var(--radius-md);
  background:var(--bg-card); border:1.5px solid var(--border-med);
  box-shadow:var(--shadow-lg);
  animation:msaiBrandPopIn .15s ease;
}
@keyframes msaiBrandPopIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
.msai-brandcolor-native {
  width:44px; height:40px; padding:2px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light); background:var(--input-bg); cursor:pointer; flex-shrink:0;
}
.msai-brandcolor-hexfield {
  display:flex; align-items:center; gap:2px;
  height:40px; padding:0 12px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light); background:var(--input-bg);
  font:700 13px/1 var(--font-body); color:var(--text-primary);
}
.msai-brandcolor-hexfield span { color:var(--text-muted); }
.msai-brandcolor-hexfield input {
  border:none; outline:none; background:transparent; width:80px;
  font:700 13px/1 var(--font-body); color:var(--text-primary); text-transform:uppercase;
}
.msai-brandcolor-done { margin-left:auto; }

.msai-brandcolor-prompt {
  padding:12px 14px; border-radius:var(--radius-md);
  background:var(--brand-light); border:1.5px dashed var(--border-med);
}
.msai-brandcolor-prompt-h {
  font:800 10.5px/1 var(--font-body); text-transform:uppercase; letter-spacing:.5px;
  color:var(--brand-primary); margin-bottom:5px;
}
.msai-brandcolor-prompt-txt { font:600 12.5px/1.5 var(--font-body); color:var(--text-secondary); }

@media (max-width:640px) {
  .msai-brandcolor-val { margin-right:0; flex:1 1 auto; }
  .msai-brandcolor-popover { left:0; right:0; width:auto; flex-direction:column; align-items:stretch; }
  .msai-brandcolor-hexfield { width:100%; box-sizing:border-box; }
  .msai-brandcolor-hexfield input { width:100%; }
  .msai-brandcolor-done { margin-left:0; }
}

.msai-ds-mockup { border-radius:var(--radius-lg); padding:32px 26px; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; min-height:220px; justify-content:center; }
.msai-ds-mockup-badge { width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; font-size:18px; margin-bottom:4px; }
.msai-ds-mockup-headline { font:800 22px/1.3 var(--font-body); }
.msai-ds-mockup-sub { font:600 13px/1.5 var(--font-body); opacity:.92; max-width:420px; }
.msai-ds-mockup-bar { display:flex; flex-wrap:wrap; gap:14px; margin-top:10px; padding-top:12px; border-top:1px solid rgba(255,255,255,.3); font:700 11.5px/1 var(--font-body); opacity:.95; }
.msai-ds-mockup-bar span { display:inline-flex; align-items:center; gap:5px; }

.modal-sm .msai-panel-body { gap:14px; }

/* ── Wallet — dedicated purple "premium AI product" palette, per the
   mobile app's Wallet screens. Scoped entirely to .mwallet-* classes
   so it never bleeds into (or fights with) the module's teal theme
   used everywhere else. ── */
.mwallet { display:flex; flex-direction:column; gap:18px; }
.mwallet-header { display:flex; align-items:center; gap:12px; }
.mwallet-back { width:36px; height:36px; border-radius:50%; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-secondary); cursor:pointer; flex-shrink:0; transition:var(--tr); }
.mwallet-back:hover { border-color:#7C3AED; color:#7C3AED; }
.mwallet-title { font:800 19px/1.2 var(--font-body); color:var(--text-primary); }

.mwallet-plan-tabs { display:flex; gap:6px; padding:5px; background:var(--bg-muted); border-radius:var(--radius-full); width:fit-content; }
.mwallet-plan-tab { padding:9px 22px; border-radius:var(--radius-full); border:none; background:transparent; color:var(--text-muted); font:800 12.5px/1 var(--font-body); cursor:pointer; transition:var(--tr); }
.mwallet-plan-tab:hover:not(.active) { color:#7C3AED; }
.mwallet-plan-tab.active { background:linear-gradient(135deg,#7C3AED,#A855F7); color:#fff; box-shadow:0 4px 14px rgba(124,58,237,.35); }

.mwallet-hero {
  border-radius:var(--radius-xl); padding:24px 26px; color:#fff;
  background:linear-gradient(135deg,#6D28D9,#9333EA 55%,#C026D3);
  box-shadow:0 10px 32px rgba(124,58,237,.3), 0 4px 8px rgba(0,0,0,.07);
  display:flex; flex-direction:column; gap:14px;
}
.mwallet-hero-top { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; }
.mwallet-hero-name { font:800 20px/1.3 var(--font-body); }
.mwallet-hero-tagline { font:600 12.5px/1.5 var(--font-body); opacity:.88; margin-top:3px; }
.mwallet-hero-badge { display:inline-flex; align-items:center; gap:7px; padding:7px 14px; border-radius:999px; background:rgba(255,255,255,.2); font:800 11px/1 var(--font-body); white-space:nowrap; }
.mwallet-hero-badge-dot { width:7px; height:7px; border-radius:50%; background:#4ADE80; animation:msaiPulse 1.6s ease-in-out infinite; }
.mwallet-hero-price { font:800 26px/1 var(--font-body); }
.mwallet-hero-price span { font:600 13px/1 var(--font-body); opacity:.8; margin-left:4px; }

.mwallet-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:14px; }
.mwallet-card { background:var(--bg-card); border:1.5px solid rgba(124,58,237,.16); border-radius:var(--radius-lg); padding:17px 19px; display:flex; flex-direction:column; gap:11px; box-shadow:0 2px 10px rgba(124,58,237,.08); }
[data-theme="dark"] .mwallet-card { border-color:rgba(168,85,247,.28); box-shadow:0 2px 12px rgba(0,0,0,.3); }
.mwallet-card-h { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.mwallet-card-title { display:flex; align-items:center; gap:8px; font:800 13.5px/1.3 var(--font-body); color:var(--text-primary); }
.mwallet-card-title i { color:#9333EA; }

.mwallet-info-wrap { position:relative; }
.mwallet-info-btn { width:24px; height:24px; border:none; border-radius:50%; background:rgba(147,51,234,.1); color:#9333EA; cursor:pointer; font-size:13px; flex-shrink:0; }
.mwallet-info-btn:hover { background:rgba(147,51,234,.2); }
.mwallet-tooltip-backdrop { position:fixed; inset:0; z-index:1150; }
.mwallet-tooltip {
  position:absolute; top:30px; right:0; z-index:1151; width:250px;
  background:#1E1033; color:#F3E8FF; font:600 11.5px/1.6 var(--font-body);
  padding:12px 14px; border-radius:var(--radius-md); box-shadow:0 10px 30px rgba(0,0,0,.35);
}
.mwallet-tooltip::after { content:''; position:absolute; top:-5px; right:9px; width:10px; height:10px; background:#1E1033; transform:rotate(45deg); }

.mwallet-rows { display:flex; flex-direction:column; gap:5px; }
.mwallet-rows > div { display:flex; justify-content:space-between; font:600 12px/1.4 var(--font-body); color:var(--text-muted); }
.mwallet-rows > div b { color:var(--text-primary); font-weight:800; }
.mwallet-bar { height:7px; border-radius:999px; background:rgba(147,51,234,.12); overflow:hidden; }
[data-theme="dark"] .mwallet-bar { background:rgba(168,85,247,.18); }
.mwallet-bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,#7C3AED,#C026D3); transition:width .5s ease; }
.mwallet-bar-caption { display:flex; justify-content:space-between; font:700 11px/1 var(--font-body); color:#9333EA; }

.mwallet-upgrade-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:9px;
  padding:15px 24px; border:none; border-radius:var(--radius-full);
  background:linear-gradient(135deg,#7C3AED,#C026D3); color:#fff;
  font:800 14px/1 var(--font-body); cursor:pointer; transition:var(--tr);
  box-shadow:0 8px 24px rgba(124,58,237,.35);
}
.mwallet-upgrade-btn:hover { filter:brightness(1.08); transform:translateY(-1px); box-shadow:0 10px 28px rgba(124,58,237,.42); }

.mwallet-modal-head { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 0; font:800 15px/1 var(--font-body); color:var(--text-primary); }
.mwallet-modal-body { padding:18px 24px 24px; display:flex; flex-direction:column; gap:14px; }
.mwallet-modal-plan { display:flex; align-items:center; gap:8px; padding:12px 14px; border-radius:var(--radius-md); background:rgba(147,51,234,.1); color:#9333EA; font:800 13.5px/1.3 var(--font-body); }
.mwallet-modal-steps-h { font:800 12.5px/1 var(--font-body); color:var(--text-secondary); }
.mwallet-modal-steps { margin:0; padding-left:18px; font:600 12.5px/1.6 var(--font-body); color:var(--text-secondary); }
.mwallet-bank-card { display:flex; flex-direction:column; gap:8px; background:var(--bg-muted); border-radius:var(--radius-md); padding:14px 16px; }
.mwallet-bank-card > div { display:flex; justify-content:space-between; gap:10px; font:600 12px/1.4 var(--font-body); color:var(--text-muted); }
.mwallet-bank-card > div b { color:var(--text-primary); font-weight:800; text-align:right; }

@media (max-width: 640px) {
  .mwallet-cards { grid-template-columns:1fr; }
  .mwallet-plan-tabs { width:100%; }
  .mwallet-plan-tab { flex:1; }
}

/* ── Library ── */
.msai-library { display:flex; flex-direction:column; gap:14px; }
.msai-lib-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.msai-lib-toolbar span { font:700 12px/1 var(--font-body); color:var(--text-muted); }
.msai-lib-toolbar input { width:240px; max-width:100%; height:38px; border-radius:var(--radius-full); border:1.5px solid var(--border-light); padding:0 15px; font:600 12.5px/1 var(--font-body); background:var(--input-bg); color:var(--text-primary); outline:none; }
.msai-lib-toolbar input:focus { border-color:var(--brand-primary); }
.msai-lib-empty { display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; padding:40px 20px; color:var(--text-muted); }
.msai-lib-empty i { font-size:30px; }
.msai-lib-list { display:flex; flex-direction:column; gap:10px; }
.msai-lib-card { display:flex; align-items:center; gap:14px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); padding:12px 14px; box-shadow:var(--shadow-xs); }
.msai-lib-thumb { position:relative; width:52px; height:52px; border-radius:var(--radius-md); background:linear-gradient(135deg,rgba(21,101,192,.14),rgba(0,191,165,.14)); color:#1E3A8A; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.msai-lib-thumb-badge { position:absolute; bottom:-4px; right:-4px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:999px; padding:1px 5px; font:800 9px/1.4 var(--font-body); color:var(--text-muted); }
.msai-lib-info { flex:1; min-width:0; }
.msai-lib-title { font:800 13px/1.3 var(--font-body); color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.msai-lib-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
.msai-lib-meta span { font:600 11px/1 var(--font-body); color:var(--text-muted); background:var(--bg-muted); padding:3px 8px; border-radius:999px; }
.msai-lib-actions { display:flex; gap:6px; flex-shrink:0; }
.msai-icon-btn--danger:hover { color:#DC2626; border-color:#DC2626; }

/* ── How It Works — the pulsing "i" button + its guide modal ── */
.msai-hiw-btn {
  position:relative; width:26px; height:26px; border-radius:50%; border:none;
  background:var(--brand-light); color:var(--brand-primary); cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; font-size:13px;
  flex-shrink:0; transition:var(--tr); margin-left:8px;
}
.msai-hiw-btn:hover { background:var(--brand-primary); color:#fff; }
@media (prefers-reduced-motion: no-preference) {
  .msai-hiw-btn { animation: msaiHiwPulse 2.6s ease-in-out infinite; }
}
@keyframes msaiHiwPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,137,123,0); }
  50%      { box-shadow: 0 0 0 5px rgba(0,137,123,.22); }
}

.msai-hiw-modal { width:100%; max-width:640px; }
.msai-hiw-head { display:flex; align-items:flex-start; gap:14px; padding:22px 24px 18px; }
.msai-hiw-head-ic {
  width:44px; height:44px; border-radius:var(--radius-md); flex-shrink:0; display:flex; align-items:center; justify-content:center;
  font-size:19px; background:linear-gradient(135deg,rgba(21,101,192,.14),rgba(0,191,165,.14)); color:#1E3A8A;
}
[data-theme="dark"] .msai-hiw-head-ic { background:linear-gradient(135deg,rgba(21,101,192,.28),rgba(0,191,165,.24)); color:#93C5FD; }
.msai-hiw-head-txt { flex:1; min-width:0; }
.msai-hiw-head-t { font:800 16.5px/1.3 var(--font-body); color:var(--text-primary); }
.msai-hiw-head-s { font:600 12.5px/1.5 var(--font-body); color:var(--text-muted); margin-top:4px; }

.msai-hiw-tabs { display:flex; gap:6px; padding:0 24px 16px; flex-wrap:wrap; }
.msai-hiw-tab { padding:8px 16px; border-radius:var(--radius-full); border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); font:700 12px/1 var(--font-body); cursor:pointer; transition:var(--tr); }
.msai-hiw-tab:hover:not(.active) { border-color:var(--brand-primary); }
.msai-hiw-tab.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; border-color:transparent; }

.msai-hiw-body { padding:4px 24px 8px; display:flex; flex-direction:column; }
.msai-hiw-step { display:flex; gap:14px; padding:14px 0; border-bottom:1px solid var(--border-light); }
.msai-hiw-step:last-child { border-bottom:none; }
.msai-hiw-step-num { width:26px; height:26px; border-radius:50%; background:var(--brand-light); color:var(--brand-primary); font:800 12px/26px var(--font-body); text-align:center; flex-shrink:0; }
.msai-hiw-step-body { flex:1; min-width:0; }
.msai-hiw-step-h { display:flex; align-items:center; gap:8px; font:800 13px/1.3 var(--font-body); color:var(--text-primary); margin-bottom:4px; }
.msai-hiw-step-h i { color:#1E40AF; font-size:12px; }
.msai-hiw-step-s { font:600 12.5px/1.55 var(--font-body); color:var(--text-secondary); }

.msai-hiw-foot { display:flex; justify-content:flex-end; padding:16px 24px 22px; }

@media (max-width: 560px) {
  .msai-hiw-head, .msai-hiw-tabs, .msai-hiw-body, .msai-hiw-foot { padding-left:16px; padding-right:16px; }
}
`;

export { MENTORAI_CSS };
