/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI — DESIGN LAYER
   Reference: "Mentor-AI-Web" HTML prototype (rounded 20px surfaces, pill
   buttons and chips, segmented tabs, soft lift-on-hover, letterhead
   documents, step bars, sticky action rails).

   Sirf shape / spacing / typography badalte hain. Colours ERP ke apne
   tokens se aate hain (--brand-primary, --brand-light, --bg-card,
   --bg-muted, --border-light, --text-*), is liye ERP ka theme aur dark
   mode jaisa tha waisa hi rahta hai. Ye string MentorAI.jsx ke
   MENTORAI_CSS ke BAAD inject hoti hai, is liye isi module ke
   .msai-root ke andar override karti hai — baqi ERP par koi asar nahi.
   ═══════════════════════════════════════════════════════════════════ */

export const MENTORAI_DESIGN_CSS = `
.msai-root { --msai-r:20px; --msai-r-sm:12px; --msai-lift:0 10px 26px rgba(15,23,42,.10); }
.msai-root, .msai-root button, .msai-root input, .msai-root select, .msai-root textarea { letter-spacing:-.005em; }

/* ───────── Top tab bar → segmented pill control ───────── */
.msai-root .msai-tabs {
  gap:3px; padding:4px; border:0; border-radius:999px;
  background:var(--bg-muted); box-shadow:none; scrollbar-width:none;
}
.msai-root .msai-tabs::-webkit-scrollbar { display:none; }
.msai-root .msai-tab {
  border-radius:999px; padding:10px 16px; font-weight:600; flex:1 1 auto;
}
.msai-root .msai-tab:hover:not(.active) { background:color-mix(in srgb,var(--bg-card) 60%,transparent); color:var(--brand-primary); }
.msai-root .msai-tab.active {
  background:var(--brand-primary); color:#fff; font-weight:800;
  box-shadow:0 4px 12px rgba(30,58,138,.28);
}
.msai-root .msai-tab.active * { color:#fff; }

/* ───────── Surfaces ───────── */
.msai-root .msai-card {
  border:1px solid var(--border-light); border-radius:var(--msai-r);
  box-shadow:0 1px 2px rgba(15,23,42,.04); padding:24px;
}
.msai-root .msai-step-title { font:800 19px/1.25 var(--font-body); letter-spacing:-.02em; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.msai-root .msai-step-sub { font:500 13.5px/1.5 var(--font-body); color:var(--text-muted); margin-top:-2px; }
.msai-root .msai-step-pill {
  margin-left:0; padding:5px 11px; background:var(--brand-light); color:var(--brand-primary); letter-spacing:.02em;
}

/* ───────── Buttons: pill, soft shadow ───────── */
.msai-root .msai-btn-primary, .msai-root .msai-btn-secondary {
  border-radius:999px; padding:0 22px; min-height:44px; font-weight:700;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
}
.msai-root .msai-btn-primary {
  background:var(--brand-primary); background-image:none; color:#fff;
  box-shadow:inset 0 1px 1px rgba(255,255,255,.28), 0 5px 14px color-mix(in srgb,var(--brand-primary) 30%,transparent);
}
.msai-root .msai-btn-primary:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.28), 0 9px 22px color-mix(in srgb,var(--brand-primary) 38%,transparent); }
.msai-root .msai-btn-primary:active:not(:disabled) { transform:scale(.97); }
.msai-root .msai-btn-primary:disabled { background:var(--bg-muted); color:var(--text-muted); box-shadow:none; opacity:1; }
.msai-root .msai-btn-secondary { background:var(--bg-card); border:1.5px solid var(--border-light); color:var(--text-primary); }
.msai-root .msai-btn-secondary:hover:not(:disabled) { background:var(--brand-light); border-color:var(--brand-primary); color:var(--brand-primary); transform:translateY(-1px); }
.msai-root .msai-icon-btn { border-radius:50%; }

/* ───────── Form controls ───────── */
.msai-root .msai-field > label { font:700 12.5px/1.2 var(--font-body); color:var(--text-secondary); letter-spacing:0; }
.msai-root .msai-field select, .msai-root .msai-field input, .msai-root .msai-field textarea {
  border-radius:var(--msai-r-sm); min-height:46px; font-size:14px;
}
.msai-root .msai-field textarea { min-height:110px; line-height:1.55; padding:12px 14px; }
.msai-root .msai-field select:focus, .msai-root .msai-field input:focus, .msai-root .msai-field textarea:focus {
  border-color:var(--brand-primary); box-shadow:0 0 0 3px var(--brand-light);
}
.msai-root .msai-form-grid { gap:16px; }
.msai-root .msai-stepper { border:0; border-radius:var(--msai-r-sm); background:var(--bg-muted); padding:3px; }
.msai-root .msai-stepper button { border-radius:9px; background:var(--bg-card); color:var(--brand-primary); height:38px; }
.msai-root .msai-stepper button:hover { background:var(--brand-primary); color:#fff; }
.msai-root .msai-stepper span { font-size:14px; }

/* chips → rounded pills */
.msai-root .msai-chip-row { gap:8px; }
.msai-root .msai-chip { border-radius:999px; padding:8px 15px; font-weight:600; border:1.5px solid var(--border-light); background:var(--bg-card); }
.msai-root .msai-chip--active, .msai-root .msai-chip.active { background:var(--brand-primary); border-color:var(--brand-primary); color:#fff; }
.msai-root .msai-chip--active:hover { color:#fff; background:var(--brand-primary); }

/* toggle rows → cards with an iOS-style switch */
.msai-root .msai-toggle-row { border-radius:var(--msai-r-sm); padding:14px 16px; border:1px solid var(--border-light); background:var(--bg-card); }
.msai-root .msai-toggle-row:hover { border-color:var(--brand-primary); }

/* selectable big cards (content type, design platforms, notebook types) */
.msai-root .msai-content-type-card, .msai-root .msai-ds-platform-card, .msai-root .msai-nb-type-card {
  border-radius:var(--msai-r); border:2px solid transparent; background:var(--bg-card);
  box-shadow:inset 0 0 0 1px var(--border-light); transition:var(--tr);
}
.msai-root .msai-content-type-card:hover, .msai-root .msai-ds-platform-card:hover, .msai-root .msai-nb-type-card:hover {
  transform:translateY(-2px); box-shadow:inset 0 0 0 1px var(--brand-primary), var(--msai-lift);
}
.msai-root .msai-content-type-card.selected, .msai-root .msai-ds-platform-card.selected, .msai-root .msai-nb-type-card.selected {
  border-color:var(--brand-primary); background:var(--brand-light); box-shadow:none;
}

/* ───────── Home (Chat empty state) ───────── */
.msai-root .msai-chat-empty { padding:34px 20px 8px; }
.msai-root .msai-chat-empty-t { font:800 26px/1.2 var(--font-body); letter-spacing:-.025em; }
.msai-root .msai-chat-empty-s { font:500 14.5px/1.55 var(--font-body); max-width:520px; margin:6px auto 0; }
.msai-root .msai-chat-explore-lbl { font:800 12px/1 var(--font-body); letter-spacing:.07em; text-transform:uppercase; color:var(--text-muted); margin:6px 2px 12px; }
.msai-root .msai-chat-explore-grid { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
.msai-root .msai-feature-card {
  position:relative; overflow:hidden; flex-direction:column; align-items:flex-start; gap:14px; padding:20px 18px 18px;
  border-radius:22px; border:1.5px solid color-mix(in srgb,var(--brand-primary) 18%,var(--border-light));
  background:color-mix(in srgb,var(--brand-primary) 6%,var(--bg-card)); box-shadow:none; min-height:150px;
}
.msai-root .msai-feature-card::after {
  content:""; position:absolute; width:96px; height:96px; border-radius:50%; right:-24px; bottom:-30px;
  background:var(--brand-primary); opacity:.09; pointer-events:none;
}
.msai-root .msai-feature-card:hover { transform:translateY(-3px); box-shadow:var(--msai-lift); border-color:var(--brand-primary); }
.msai-root .msai-feature-ic { width:46px; height:46px; border-radius:14px; background:var(--bg-card); color:var(--brand-primary); box-shadow:0 2px 8px rgba(15,23,42,.08); }
.msai-root .msai-feature-title { font-size:15.5px; letter-spacing:-.01em; }
.msai-root .msai-feature-chev { position:absolute; right:16px; top:18px; color:var(--brand-primary); opacity:.7; }

/* chat composer + bubbles */
.msai-root .msai-composer { border-radius:22px; }
.msai-root .msai-composer-send { border-radius:50%; }
.msai-root .msai-msg-bubble { border-radius:18px; }

/* ───────── Result pages: letterhead document + sticky action rail ───────── */
.msai-root .msai-ws-pages { gap:22px; }
.msai-root .msai-ws-page {
  border:0; border-top:5px solid var(--brand-primary); border-radius:6px; padding:32px 36px;
  background:#fff; color:#1F2433; box-shadow:0 1px 3px rgba(15,23,42,.08), 0 14px 38px rgba(15,23,42,.10);
}
.msai-root .msai-ws-page-title { font:800 22px/1.25 var(--font-body); letter-spacing:-.02em; color:#141826; text-align:left; }
.msai-root .msai-ws-page-subtitle { font:500 13px/1.4 var(--font-body); color:#6A7086; margin-bottom:14px; }
.msai-root .msai-ws-section-h {
  background:var(--brand-light); color:var(--brand-primary); border-left:4px solid var(--brand-primary);
  padding:7px 12px; border-radius:0 6px 6px 0; font:800 14px/1.3 var(--font-body);
}
.msai-root .msai-ws-page-footer { color:#8A90A6; font:600 11px/1 var(--font-body); border-top:1px solid #E6E8EF; padding-top:8px; }
.msai-root .msai-lp-plan-tabs { gap:6px; }
.msai-root .msai-lp-plan-tabs .msai-chip { border-radius:999px; }
.msai-root .msai-lp-section {
  border:1px solid var(--border-light); border-radius:14px; padding:16px 18px; background:var(--bg-card); margin-bottom:12px;
}
.msai-root .msai-lp-section-h { font:800 15px/1.3 var(--font-body); }
.msai-root .msai-duration-pill { border-radius:999px; background:var(--bg-muted); }
.msai-root .msai-result-actions {
  border-top:0; padding:14px; border-radius:var(--msai-r); background:var(--bg-muted); gap:10px; align-items:center;
}
@media (min-width:1100px) {
  .msai-root .msai-ws-result, .msai-root .msai-lp-result { position:relative; }
  .msai-root .msai-ws-result .msai-result-actions, .msai-root .msai-lp-result .msai-result-actions {
    position:sticky; bottom:12px; z-index:5; box-shadow:0 10px 30px rgba(15,23,42,.14);
    background:color-mix(in srgb,var(--bg-card) 92%,transparent); backdrop-filter:blur(14px);
    border:1px solid var(--border-light);
  }
}
.msai-root .msai-lp-result-head { padding-bottom:12px; border-bottom:1px solid var(--border-light); }
.msai-root .msai-version-pill { border-radius:999px; }

/* ───────── Generating screen ───────── */
.msai-root .msai-generating { border-radius:var(--msai-r); }
.msai-root .msai-gen-title { font:800 22px/1.2 var(--font-body); letter-spacing:-.02em; }
.msai-root .msai-gen-bar { border-radius:999px; height:8px; }
.msai-root .msai-gen-bar-fill { border-radius:999px; }

/* ───────── Edit via AI panel ───────── */
.msai-root .msai-editai { border-radius:var(--msai-r); }
.msai-root .msai-editai-chips .msai-chip { border-radius:999px; }
.msai-root .msai-editai-msg { border-radius:16px; }

/* ───────── Library ───────── */
.msai-root .msai-library .msai-lib-toolbar { gap:10px; }
.msai-root .msai-lib-card {
  border:1px solid var(--border-light); border-radius:18px; padding:14px 16px; box-shadow:none; transition:var(--tr);
}
.msai-root .msai-lib-card:hover { border-color:var(--brand-primary); transform:translateY(-2px); box-shadow:var(--msai-lift); }
.msai-root .msai-lib-thumb { border-radius:14px; background:var(--brand-light); color:var(--brand-primary); }
.msai-root .msai-lib-title { font:700 14.5px/1.3 var(--font-body); letter-spacing:-.01em; }
.msai-root .msai-lib-meta .msai-resp-pill, .msai-root .msai-lib-meta span { border-radius:999px; }
.msai-root .msai-lib-viewer { border-radius:24px; }
.msai-root .msai-lib-empty { border-radius:var(--msai-r); }

/* ───────── Wallet ───────── */
.msai-root .mwallet-plan-tabs { background:var(--bg-muted); }
.msai-root .mwallet-plan-tab { border-radius:999px; }
.msai-root .mwallet-hero { border-radius:26px; box-shadow:0 14px 34px color-mix(in srgb,var(--brand-primary) 24%,transparent); }
.msai-root .mwallet-card {
  border:1px solid var(--border-light); border-radius:22px; box-shadow:none; padding:20px 22px; transition:var(--tr);
}
.msai-root .mwallet-card:hover { transform:translateY(-2px); box-shadow:var(--msai-lift); border-color:var(--brand-primary); }
.msai-root .mwallet-bar { background:var(--brand-light); height:8px; }
.msai-root .mwallet-bar-fill { background:linear-gradient(90deg,var(--brand-primary),color-mix(in srgb,var(--brand-primary) 55%,#38bdf8)); }
.msai-root .mwallet-bar-caption { color:var(--brand-primary); }
.msai-root .mwallet-info-btn { background:var(--brand-light); color:var(--brand-primary); }
.msai-root .mwallet-modal-plan { background:var(--brand-light); color:var(--brand-primary); border-radius:14px; }
.msai-root .mwallet-upgrade-btn { border-radius:999px; }
.msai-root .mwallet-back { border-radius:50%; }

/* ───────── Header chip ───────── */
.msai-root .msai-wallet-chip { border-radius:999px; background:var(--brand-light); border-color:transparent; }
.msai-root .msai-wallet-chip:hover { background:var(--bg-card); border-color:var(--brand-primary); }
.msai-root .msai-wallet-chip i { color:var(--brand-primary); }

/* ───────── Progress & misc ───────── */
.msai-root .msai-pb-track, .msai-root .msai-pb-fill { border-radius:999px; }
.msai-root .msai-hint-text { font-size:12px; }
.msai-root .msai-icon-badge { border-radius:12px; }

/* press feedback + reduced motion */
.msai-root .msai-feature-card:active, .msai-root .msai-lib-card:active, .msai-root .msai-content-type-card:active { transform:scale(.985); }
@media (prefers-reduced-motion: reduce) {
  .msai-root *, .msai-root *::before, .msai-root *::after { transition-duration:.01ms !important; animation-duration:.01ms !important; }
}
@media (max-width:640px) {
  .msai-root .msai-card { padding:18px; }
  .msai-root .msai-ws-page { padding:22px 18px; }
  .msai-root .msai-tab { padding:9px 13px; font-size:12.5px; }
}
`;
