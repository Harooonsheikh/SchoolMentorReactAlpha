// AUTO-GENERATED from src/erp/index.css — do not edit by hand.
// ERP dark-mode + tutorial CSS as a string, rendered via a mounted <style>
// in the ERP shell so it applies ONLY while the ERP screen is shown (prevents
// the [data-theme="dark"] rules from bleeding onto the setup/login screen).
const erpExtraCss = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* ═══════════════════════════════════════════════════════════════════
   TUTORIAL BUTTON — global mobile consistency
   Every module's Tutorial button uses .tutorial-btn.page-tutorial-btn.
   Desktop styling lives in components/App.js (.tutorial-btn). Here we
   normalise the mobile size + behaviour so every module looks the same
   on phones — full-width, centered, same border-radius/padding/font.
   Individual module CSS files used to set their own mobile padding;
   this rule overrides them (loaded after App.js inline <style> sources).
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  .tutorial-btn.page-tutorial-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    padding: 8px 14px 8px 8px !important;
    gap: 10px !important;
    font-size: 12.5px !important;
    border-radius: 999px !important;
    border-width: 2px !important;
    box-sizing: border-box !important;
    flex-shrink: 0 !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
    overflow: hidden !important;
  }
  .tutorial-btn.page-tutorial-btn .play-dot {
    width: 26px !important;
    height: 26px !important;
    flex-shrink: 0 !important;
  }
  .tutorial-btn.page-tutorial-btn .tutorial-label {
    font-size: 12.5px !important;
    line-height: 1 !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE GLOBAL TEXT FIXES

   CSS-only — zero functional/layout changes.

   The codebase uses these vars (defined in components/App.js → const CSS):
     --text-primary    --text-secondary    --text-muted
     --bg-card         --bg-muted          --bg-base
     --border-light    --border-med        --brand-primary
     --input-bg

   Every rule below uses those names. No inline-style overrides are
   possible from CSS — those are handled by separate component fixes
   where needed.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── 1. ACTIVE TABS — white text on dark gradient backgrounds ────
   Active tabs across the ERP use a brand-blue gradient as their
   background. The text must always be white. The .active and .on
   modifiers are both supported because different modules use each. */
[data-theme="dark"] .l1-tab.active,
[data-theme="dark"] .l1-tab.active *,
[data-theme="dark"] .l2-tab.active,
[data-theme="dark"] .l2-tab.active *,
[data-theme="dark"] .l3-tab.active,
[data-theme="dark"] .l3-tab.active *,
[data-theme="dark"] .exam-tab.active,
[data-theme="dark"] .exam-tab.active *,
[data-theme="dark"] .res-sub-tab.active,
[data-theme="dark"] .res-sub-tab.active *,
[data-theme="dark"] .rs-l2-tab.active,
[data-theme="dark"] .rs-l2-tab.active *,
[data-theme="dark"] .ts-subtab.active,
[data-theme="dark"] .ts-subtab.active *,
[data-theme="dark"] .ds-edit-modal-tab.active,
[data-theme="dark"] .ds-edit-modal-tab.active *,
[data-theme="dark"] .lp-l2-tab.active,
[data-theme="dark"] .lp-l2-tab.active *,
[data-theme="dark"] .fee-subtab.active,
[data-theme="dark"] .fee-subtab.active *,
[data-theme="dark"] .fee-seg-btn.active,
[data-theme="dark"] .fee-seg-btn.active *,
[data-theme="dark"] .acc-tab.active,
[data-theme="dark"] .acc-tab.active *,
[data-theme="dark"] .hr-tab.active,
[data-theme="dark"] .hr-tab.active *,
[data-theme="dark"] .stu-l1-tab.active,
[data-theme="dark"] .stu-l1-tab.active *,
[data-theme="dark"] .stu-subtab.active,
[data-theme="dark"] .stu-subtab.active *,
[data-theme="dark"] .crm-tab.active,
[data-theme="dark"] .crm-tab.active *,
[data-theme="dark"] .inv-tab.active,
[data-theme="dark"] .inv-tab.active *,
[data-theme="dark"] .pg-tab.active,
[data-theme="dark"] .pg-tab.active *,
[data-theme="dark"] .att-tab.active,
[data-theme="dark"] .att-tab.active *,
[data-theme="dark"] .apr-subtab.on,
[data-theme="dark"] .apr-subtab.on *,
[data-theme="dark"] .up-tab.on,
[data-theme="dark"] .up-tab.on *,
[data-theme="dark"] .settings-tab.on,
[data-theme="dark"] .settings-tab.on *,
[data-theme="dark"] .al-rep-tab.on,
[data-theme="dark"] .al-rep-tab.on *,
[data-theme="dark"] .al-rep-tone-btn.on,
[data-theme="dark"] .al-rep-tone-btn.on *,
[data-theme="dark"] .al-quick-pill.on,
[data-theme="dark"] .al-quick-pill.on *,
[data-theme="dark"] .adm-seg-btn.on,
[data-theme="dark"] .adm-seg-btn.on *,
[data-theme="dark"] .ls-switch.on,
[data-theme="dark"] .nav-item.active,
[data-theme="dark"] .nav-item.active * {
  color: #FFFFFF !important;
}

/* ─── 2. CORE TEXT ELEMENTS ─── */
[data-theme="dark"] .page-title,
[data-theme="dark"] .card-title,
[data-theme="dark"] .section-title,
[data-theme="dark"] .modal-title,
[data-theme="dark"] .stat-val,
[data-theme="dark"] .empty-title,
[data-theme="dark"] .school-name {
  color: var(--text-primary) !important;
}

[data-theme="dark"] .page-sub,
[data-theme="dark"] .card-sub,
[data-theme="dark"] .modal-sub,
[data-theme="dark"] .stat-lbl,
[data-theme="dark"] .empty-sub,
[data-theme="dark"] .school-yr,
[data-theme="dark"] .bc-item,
[data-theme="dark"] .bc-sep {
  color: var(--text-muted) !important;
}

[data-theme="dark"] .bc-current {
  color: var(--text-primary) !important;
}

/* ─── 3. TABLES ─── */
[data-theme="dark"] table th,
[data-theme="dark"] .th,
[data-theme="dark"] .t-head .th,
[data-theme="dark"] .table-head .th,
[data-theme="dark"] thead th {
  color: var(--text-muted) !important;
}

[data-theme="dark"] table td,
[data-theme="dark"] .td,
[data-theme="dark"] tbody td {
  color: var(--text-secondary) !important;
}

[data-theme="dark"] .td-bold,
[data-theme="dark"] .td .td-bold {
  color: var(--text-primary) !important;
}

/* ─── 4. FORM INPUTS — color + placeholder ─── */
[data-theme="dark"] input[type="text"],
[data-theme="dark"] input[type="email"],
[data-theme="dark"] input[type="number"],
[data-theme="dark"] input[type="search"],
[data-theme="dark"] input[type="tel"],
[data-theme="dark"] input[type="url"],
[data-theme="dark"] input[type="password"],
[data-theme="dark"] input[type="date"],
[data-theme="dark"] input[type="datetime-local"],
[data-theme="dark"] input[type="month"],
[data-theme="dark"] input[type="time"],
[data-theme="dark"] input[type="week"],
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  color: var(--text-primary) !important;
  background-color: var(--bg-card) !important;
}

[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: var(--text-muted) !important;
  opacity: 1;
}

[data-theme="dark"] label,
[data-theme="dark"] .f-label {
  color: var(--text-secondary) !important;
}

/* ─── 5. NAV (sidebar) ─── */
[data-theme="dark"] .sidebar {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .nav-nm { color: var(--text-secondary) !important; }
[data-theme="dark"] .nav-item.active .nav-nm { color: #fff !important; }
[data-theme="dark"] .nav-st { color: var(--text-muted) !important; }
[data-theme="dark"] .nav-section-lbl,
[data-theme="dark"] .nav-section-label { color: var(--text-muted) !important; }
[data-theme="dark"] .nav-divider { border-color: var(--border-light) !important; }
[data-theme="dark"] .nav-item:hover:not(.active) { background: rgba(255, 255, 255, .04) !important; }

/* ─── 6. TOPBAR ─── */
[data-theme="dark"] .topbar {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .theme-btn,
[data-theme="dark"] .tb-btn {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
  color: var(--text-muted) !important;
}

/* ─── 7. SECTION CARDS + MODALS ─── */
[data-theme="dark"] .section-card,
[data-theme="dark"] .modal {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}

/* ─── 8. INFO BANNERS ─── */
[data-theme="dark"] .info-banner {
  background: linear-gradient(135deg, rgba(30, 58, 138, .2), rgba(30, 64, 175, .1)) !important;
  border-color: rgba(96, 165, 250, .3) !important;
}
[data-theme="dark"] .ib-title { color: #93C5FD !important; }
[data-theme="dark"] .ib-text  { color: var(--text-secondary) !important; }

/* ─── 9. TOASTS ─── */
[data-theme="dark"] .toast {
  background: var(--bg-card) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-light) !important;
}

/* ─── 10. GENERIC GHOST / SECONDARY BUTTONS ─── */
[data-theme="dark"] .btn-ghost,
[data-theme="dark"] .btn-secondary,
[data-theme="dark"] .btn-edit {
  background: var(--bg-card) !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .btn-ghost:hover,
[data-theme="dark"] .btn-edit:hover {
  border-color: var(--brand-primary) !important;
  color: var(--brand-primary) !important;
}

/* ─── 11. ROW HOVER BACKGROUNDS ─── */
[data-theme="dark"] .d-row:hover,
[data-theme="dark"] .run-row:hover,
[data-theme="dark"] .param-row:hover {
  background: rgba(255, 255, 255, .03) !important;
}

/* ─── 12. AVATARS ─── */
[data-theme="dark"] .avatar {
  border-color: var(--border-light) !important;
  color: var(--brand-primary) !important;
}

/* ─── 13. FILTER BAR + SEARCH BOX ─── */
[data-theme="dark"] .filter-bar { background: var(--bg-card) !important; }
[data-theme="dark"] .search-box,
[data-theme="dark"] .search-input {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
  color: var(--text-primary) !important;
}
[data-theme="dark"] .search-input::placeholder { color: var(--text-muted) !important; }
[data-theme="dark"] .f-select,
[data-theme="dark"] .f-input,
[data-theme="dark"] .f-textarea {
  background: var(--bg-card) !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-light) !important;
}

/* ─── 14. MODAL OVERLAY ─── */
[data-theme="dark"] .ov,
[data-theme="dark"] .modal-overlay { background: rgba(0, 0, 0, .7) !important; }

/* ─── 15. BADGE COLORS (light-text on dark-bg) ─── */
[data-theme="dark"] .b-green  { color: #4ADE80 !important; background: rgba(74, 222, 128, .12) !important; border-color: rgba(74, 222, 128, .26) !important; }
[data-theme="dark"] .b-blue   { color: #60A5FA !important; background: rgba(96, 165, 250, .12) !important; border-color: rgba(96, 165, 250, .26) !important; }
[data-theme="dark"] .b-gray   { color: #94A3B8 !important; background: rgba(148, 163, 184, .12) !important; border-color: rgba(148, 163, 184, .22) !important; }
[data-theme="dark"] .b-warn,
[data-theme="dark"] .b-amber  { color: #FCD34D !important; background: rgba(252, 211, 77, .12) !important; border-color: rgba(252, 211, 77, .26) !important; }
[data-theme="dark"] .b-red    { color: #F87171 !important; background: rgba(248, 113, 113, .12) !important; border-color: rgba(248, 113, 113, .26) !important; }
[data-theme="dark"] .b-purple { color: #C084FC !important; background: rgba(192, 132, 252, .12) !important; border-color: rgba(192, 132, 252, .26) !important; }

/* ─── 16. APPRAISAL-SPECIFIC ─── */
[data-theme="dark"] .weight-total {
  background: rgba(30, 58, 138, .15) !important;
  border-color: rgba(96, 165, 250, .3) !important;
}
[data-theme="dark"] .wt-label   { color: var(--text-secondary) !important; }
[data-theme="dark"] .sr-txt     { color: var(--text-primary) !important; }
[data-theme="dark"] .mini-bar   { background: var(--bg-muted) !important; }
[data-theme="dark"] .sp-name    { color: var(--text-primary) !important; }
[data-theme="dark"] .sp-meta    { color: var(--text-muted) !important; }
[data-theme="dark"] .weight-pill {
  background: var(--bg-muted) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .weight-pill input {
  color: var(--brand-primary) !important;
  background: transparent !important;
}
[data-theme="dark"] .weight-pill .pct { color: var(--text-muted) !important; }
[data-theme="dark"] .src-toggle { border-color: var(--border-light) !important; }
[data-theme="dark"] .src-opt:not(.active) {
  color: var(--text-muted) !important;
  background: transparent !important;
}
[data-theme="dark"] .scale-grid { border-color: var(--border-light) !important; }
[data-theme="dark"] .scale-head { background: var(--bg-muted) !important; color: var(--text-muted) !important; }
[data-theme="dark"] .tmpl-card {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .tmpl-name { color: var(--text-primary) !important; }
[data-theme="dark"] .tmpl-desc { color: var(--text-muted) !important; }
[data-theme="dark"] .param-name .pn { color: var(--text-primary) !important; }
[data-theme="dark"] .param-name .pd { color: var(--text-muted) !important; }

/* ─── 17. A4 REPORT PRINT SURFACES — ALWAYS WHITE bg / DARK text ──
   These containers represent printable A4 pages. They must remain
   light-on-white regardless of theme so the printed output looks
   correct. Covers Examination report cards, Audit Logs A4 viewer,
   Appraisal A4 report viewer. */
[data-theme="dark"] .a4,
[data-theme="dark"] .al-a4,
[data-theme="dark"] .apr-a4,
[data-theme="dark"] .rep-a4 {
  background: #FFFFFF !important;
  color: #0F172A !important;
}
[data-theme="dark"] .a4 *,
[data-theme="dark"] .al-a4 *,
[data-theme="dark"] .apr-a4 *,
[data-theme="dark"] .rep-a4 * {
  color: inherit;
}
/* Re-apply specific colors inside the A4 surfaces */
[data-theme="dark"] .a4 .rp-section-title,
[data-theme="dark"] .al-a4 .al-a4-section-h,
[data-theme="dark"] .al-a4 .al-a4-school,
[data-theme="dark"] .al-a4 .al-a4-title { color: #1E3A8A !important; }
[data-theme="dark"] .a4 .rp-remarks {
  color: #1E3A5F !important;
  background: #F8FAFF !important;
}
[data-theme="dark"] .a4 .rp-table th,
[data-theme="dark"] .al-a4 .al-a4-table thead th {
  background: #1E40AF !important;
  color: #fff !important;
}
[data-theme="dark"] .a4 .rp-table td,
[data-theme="dark"] .al-a4 .al-a4-table td { color: #0F172A !important; }
[data-theme="dark"] .a4 .rp-footer,
[data-theme="dark"] .al-a4 .al-a4-foot,
[data-theme="dark"] .al-a4 .al-a4-meta,
[data-theme="dark"] .al-a4 .al-a4-tagline { color: #64748B !important; }
[data-theme="dark"] .a4 .rp-sig .line {
  color: #0F172A !important;
  border-color: #0F172A !important;
}
/* Force form inputs inside A4 to render light (e.g. if the report
   accidentally inherits a form-input class). */
[data-theme="dark"] .a4 input,
[data-theme="dark"] .a4 select,
[data-theme="dark"] .a4 textarea,
[data-theme="dark"] .al-a4 input,
[data-theme="dark"] .al-a4 select,
[data-theme="dark"] .al-a4 textarea {
  background: #FFFFFF !important;
  color: #0F172A !important;
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — POLISH PASS

   Sharper card depth, brighter hover affordance, chart legibility,
   custom scrollbars, dropdown-option contrast, and divider visibility
   tuned for the #080D1A page background.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── 18. RECHARTS — axis text, grid lines, legend, tooltip ──── */
[data-theme="dark"] .recharts-cartesian-axis-tick text,
[data-theme="dark"] .recharts-cartesian-axis text,
[data-theme="dark"] .recharts-text { fill: #94A3B8 !important; }

[data-theme="dark"] .recharts-cartesian-axis-line,
[data-theme="dark"] .recharts-cartesian-axis-tick-line { stroke: #243858 !important; }

[data-theme="dark"] .recharts-cartesian-grid line,
[data-theme="dark"] .recharts-cartesian-grid-horizontal line,
[data-theme="dark"] .recharts-cartesian-grid-vertical line { stroke: #1C2E50 !important; }

[data-theme="dark"] .recharts-legend-item-text { color: #B8C8E8 !important; }

/* Recharts default tooltip — make sure it doesn't render white-on-white
   if a chart isn't using our custom ChartTooltip. */
[data-theme="dark"] .recharts-default-tooltip {
  background: #0E1628 !important;
  border-color: #1C2E50 !important;
  color: #E2E8F8 !important;
}
[data-theme="dark"] .recharts-tooltip-label,
[data-theme="dark"] .recharts-tooltip-item { color: #E2E8F8 !important; }

/* Reference line + bar default colour fallback */
[data-theme="dark"] .recharts-reference-line line { stroke: #475569 !important; }

/* ─── 19. CARD DEPTH — sharper border + subtle elevation ─────── */
[data-theme="dark"] .dash-tile,
[data-theme="dark"] .dash-panel,
[data-theme="dark"] .dash-card,
[data-theme="dark"] .dash-cls-card,
[data-theme="dark"] .dash-mobile-card,
[data-theme="dark"] .dash-sched-card,
[data-theme="dark"] .adm-fee-card,
[data-theme="dark"] .adm-chart-card,
[data-theme="dark"] .adm-side-card,
[data-theme="dark"] .adm-bday-card,
[data-theme="dark"] .adm-act-card,
[data-theme="dark"] .ls-mod,
[data-theme="dark"] .up-stat,
[data-theme="dark"] .up-table,
[data-theme="dark"] .ts-stat {
  background: #0E1628 !important;
  border-color: #1F3158 !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .03) inset !important;
}

/* Stronger hover lift — visible even on dark bg */
[data-theme="dark"] .dash-tile:hover,
[data-theme="dark"] .dash-cls-card:hover,
[data-theme="dark"] .adm-fee-card:hover,
[data-theme="dark"] .adm-bday-card:hover,
[data-theme="dark"] .adm-act-card.clickable:hover {
  border-color: #3B82F6 !important;
  box-shadow:
    0 0 0 1px rgba(59, 130, 246, .15),
    0 12px 26px rgba(0, 0, 0, .55) !important;
}

/* ─── 20. PRIORITY / ATTENTION CARDS — boost glow in dark mode ── */
[data-theme="dark"] .dash-pri,
[data-theme="dark"] .dash-att-card {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, .06) inset,
    0 12px 30px rgba(0, 0, 0, .45) !important;
}

/* ─── 21. ROW + LIST HOVER — visible affordance on dark bg ───── */
[data-theme="dark"] .dash-row:hover,
[data-theme="dark"] .dash-list-item:hover,
[data-theme="dark"] .al-table tbody tr:hover,
[data-theme="dark"] .up-table-row:hover,
[data-theme="dark"] .emp-row:hover,
[data-theme="dark"] .fee-row:hover {
  background: rgba(59, 130, 246, .06) !important;
}

[data-theme="dark"] .dash-row {
  border-top-color: #1C2E50 !important;
}

/* ─── 22. CUSTOM SCROLLBARS — match the dark palette ─────────── */
[data-theme="dark"] ::-webkit-scrollbar { width: 10px; height: 10px; }
[data-theme="dark"] ::-webkit-scrollbar-track {
  background: #080D1A;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #1C2E50;
  border-radius: 999px;
  border: 2px solid #080D1A;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background: #2B4173; }
[data-theme="dark"] ::-webkit-scrollbar-corner { background: #080D1A; }

[data-theme="dark"] * { scrollbar-color: #1C2E50 #080D1A; }

/* Compact in-card scrollbars (birthdays / activities lists) — slimmer */
[data-theme="dark"] .adm-bday-list::-webkit-scrollbar,
[data-theme="dark"] .adm-act-grid::-webkit-scrollbar { width: 6px; }
[data-theme="dark"] .adm-bday-list::-webkit-scrollbar-thumb,
[data-theme="dark"] .adm-act-grid::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, .35); border: none;
}

/* ─── 23. SELECT DROPDOWN OPTIONS — readable when opened ─────── */
[data-theme="dark"] select option {
  background: #0E1628 !important;
  color: #E2E8F8 !important;
}
[data-theme="dark"] select option:checked,
[data-theme="dark"] select option:hover {
  background: #1E3A6A !important;
  color: #fff !important;
}

/* Custom select chevron colour */
[data-theme="dark"] .up-select,
[data-theme="dark"] .al-search input,
[data-theme="dark"] .adm-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
}

/* ─── 24. DIVIDERS / RULES — bring out subtle separators ─────── */
[data-theme="dark"] hr,
[data-theme="dark"] .adm-divider {
  background: #1C2E50 !important;
  border-color: #1C2E50 !important;
}

/* Dashed dividers */
[data-theme="dark"] .dash-stat-row { border-bottom-color: #1C2E50 !important; }
[data-theme="dark"] .adm-legend { border-top-color: #1C2E50 !important; }
[data-theme="dark"] .up-edit-summary { border-top-color: #1C2E50 !important; }

/* ─── 25. TOOLTIP component (used everywhere) ────────────────── */
[data-theme="dark"] .tt-bubble,
[data-theme="dark"] .tooltip-bubble {
  background: #0E1628 !important;
  color: #E2E8F8 !important;
  border-color: #1C2E50 !important;
  box-shadow: 0 6px 14px rgba(0, 0, 0, .5) !important;
}
[data-theme="dark"] .tt-bubble::before { border-top-color: #0E1628 !important; }

/* ─── 26. INFO BANNERS (light blue across the ERP) ───────────── */
[data-theme="dark"] .adm-info-banner,
[data-theme="dark"] .up-banner,
[data-theme="dark"] .al-banner,
[data-theme="dark"] .ls-info,
[data-theme="dark"] .dash-priority + .dash-sec .dash-sec-sub {
  background: rgba(59, 130, 246, .08) !important;
  border-color: rgba(59, 130, 246, .22) !important;
  color: #B8C8E8 !important;
}
[data-theme="dark"] .ls-info-t { color: #BFDBFE !important; }
[data-theme="dark"] .ls-info-s { color: #B8C8E8 !important; }

/* ─── 27. KPI / TILE LABEL CONTRAST ──────────────────────────── */
[data-theme="dark"] .dash-tile-lbl,
[data-theme="dark"] .dash-mini-lbl,
[data-theme="dark"] .dash-bar-h,
[data-theme="dark"] .dash-bar-val,
[data-theme="dark"] .adm-fee-lbl,
[data-theme="dark"] .adm-side-tag,
[data-theme="dark"] .dash-sec-sub {
  color: #94A3B8 !important;
}

[data-theme="dark"] .dash-tile-val,
[data-theme="dark"] .dash-mini-val,
[data-theme="dark"] .adm-fee-val,
[data-theme="dark"] .dash-card-title,
[data-theme="dark"] .dash-list-title,
[data-theme="dark"] .dash-row-t,
[data-theme="dark"] .adm-act-title,
[data-theme="dark"] .adm-bday-name,
[data-theme="dark"] .dash-cls-name,
[data-theme="dark"] .dash-sched-cls,
[data-theme="dark"] .dash-panel-h-t,
[data-theme="dark"] .ls-card-title { color: #E2E8F8 !important; }

[data-theme="dark"] .dash-list-sub,
[data-theme="dark"] .dash-row-s,
[data-theme="dark"] .dash-card-sub,
[data-theme="dark"] .dash-panel-h-s,
[data-theme="dark"] .dash-mobile-sub,
[data-theme="dark"] .dash-sched-room,
[data-theme="dark"] .dash-sched-topic,
[data-theme="dark"] .dash-cls-meta,
[data-theme="dark"] .adm-act-desc,
[data-theme="dark"] .adm-bday-meta,
[data-theme="dark"] .ls-card-sub,
[data-theme="dark"] .ls-mod-meta { color: #8FA3C7 !important; }

/* ─── 28. PANEL HEADER chrome — visible boundary on dark bg ──── */
[data-theme="dark"] .dash-panel-h { border-bottom-color: #1F3158 !important; }
[data-theme="dark"] .dash-rows .dash-row { border-top-color: #1C2E50 !important; }

/* ─── 29. MINI / STAT TILES — dark surface variant ───────────── */
[data-theme="dark"] .dash-mini,
[data-theme="dark"] .ls-mod {
  background: #131F38 !important;
  border-color: #1F3158 !important;
}

/* ─── 30. BARS / PROGRESS TRACKS — visible on dark bg ────────── */
[data-theme="dark"] .dash-bar-track,
[data-theme="dark"] .adm-bar-track,
[data-theme="dark"] .up-bar-track,
[data-theme="dark"] .ts-bar-bg {
  background: #1C2E50 !important;
}

/* ─── 31. DASHBOARD SECTION LINK PILL ────────────────────────── */
[data-theme="dark"] .dash-sec-link {
  color: #60A5FA !important;
}
[data-theme="dark"] .dash-sec-link:hover {
  background: rgba(96, 165, 250, .12) !important;
}

/* ─── 32. AUDIT LOG MODULE CHROME ────────────────────────────── */
[data-theme="dark"] .al-stat,
[data-theme="dark"] .al-filter-card,
[data-theme="dark"] .al-table-card {
  background: #0E1628 !important;
  border-color: #1F3158 !important;
}
[data-theme="dark"] .al-table thead th {
  background: #131F38 !important;
  color: #94A3B8 !important;
  border-bottom-color: #1F3158 !important;
}
[data-theme="dark"] .al-table tbody tr {
  border-bottom-color: #1C2E50 !important;
}
[data-theme="dark"] .al-pager {
  background: #131F38 !important;
  border-top-color: #1F3158 !important;
}

/* ─── 33. USER PERMISSIONS — panel + table refinements ───────── */
[data-theme="dark"] .up-stat-val,
[data-theme="dark"] .up-emp-name,
[data-theme="dark"] .up-form-title { color: #E2E8F8 !important; }
[data-theme="dark"] .up-stat-lbl,
[data-theme="dark"] .up-emp-meta,
[data-theme="dark"] .up-empty-s { color: #8FA3C7 !important; }
[data-theme="dark"] .up-tab:not(.on) {
  color: #94A3B8 !important;
}
[data-theme="dark"] .up-tab:not(.on):hover {
  background: rgba(96, 165, 250, .08) !important;
  color: #60A5FA !important;
}

/* ─── 34. LAUNCH SETUP — match the rest of the dark surface ──── */
[data-theme="dark"] .ls-card { background: #0E1628 !important; border-color: #1F3158 !important; }
[data-theme="dark"] .ls-card-h {
  background: linear-gradient(135deg, rgba(59, 130, 246, .04), transparent) !important;
  border-bottom-color: #1F3158 !important;
}
[data-theme="dark"] .ls-group-h { color: #94A3B8 !important; border-bottom-color: #1F3158 !important; }
[data-theme="dark"] .ls-footnote {
  background: rgba(217, 119, 6, .08) !important;
  border-color: rgba(217, 119, 6, .26) !important;
  color: #FDE68A !important;
}

/* ─── 35. SCHEDULE / CLASS CARD ACCENT ──────────────────────── */
[data-theme="dark"] .dash-sched-card { background: #0E1628 !important; }
[data-theme="dark"] .dash-sched-card:hover {
  border-color: #7C3AED !important;
  box-shadow: 0 12px 24px rgba(124, 58, 237, .25) !important;
}

/* ─── 36. PAGE CONTENT BACKGROUND — slightly deeper than card ── */
[data-theme="dark"] .page-content { background: #050911 !important; }

/* ─── 37. SIDEBAR FOOTER + AVATAR ──────────────────────────── */
[data-theme="dark"] .sidebar-footer { border-top-color: #1F3158 !important; }
[data-theme="dark"] .user-av {
  background: linear-gradient(135deg, #1E40AF, #3B82F6) !important;
  color: #fff !important;
}
[data-theme="dark"] .qb-btn {
  background: #131F38 !important;
  color: #B8C8E8 !important;
  border-color: #1F3158 !important;
}
[data-theme="dark"] .qb-btn:hover { background: #1C2E50 !important; color: #60A5FA !important; }
[data-theme="dark"] .qb-btn.danger { color: #F87171 !important; }
[data-theme="dark"] .qb-btn.danger:hover { background: rgba(248, 113, 113, .12) !important; }

/* ─── 38. FOCUS RINGS — visible on dark bg ──────────────────── */
[data-theme="dark"] *:focus-visible {
  outline: 2px solid #60A5FA !important;
  outline-offset: 2px !important;
}
[data-theme="dark"] button:focus-visible,
[data-theme="dark"] a:focus-visible,
[data-theme="dark"] input:focus-visible,
[data-theme="dark"] select:focus-visible,
[data-theme="dark"] textarea:focus-visible {
  outline: 2px solid #60A5FA !important;
  outline-offset: 2px !important;
}

/* ─── 39. CHECKBOXES + RADIOS — bigger contrast ────────────── */
[data-theme="dark"] input[type="checkbox"],
[data-theme="dark"] input[type="radio"] {
  accent-color: #60A5FA !important;
}

/* ─── 40. DASHBOARD HERO STAT-VAL \`small\` (the /total suffix) ── */
[data-theme="dark"] .dash-hero-stat-val small,
[data-theme="dark"] .dash-tile-val small,
[data-theme="dark"] .dash-pri-val small { color: rgba(255, 255, 255, .55) !important; }

/* ─── 41. DASHBOARD TYPE PILL strip ────────────────────────── */
[data-theme="dark"] .db-type-strip,
[data-theme="dark"] .dash-type-strip {
  background: #0E1628 !important;
  border-color: #1F3158 !important;
}
[data-theme="dark"] .db-type-meta,
[data-theme="dark"] .dash-type-meta { color: #94A3B8 !important; }

/* ─── 42. SESSION PILL + IMPERSONATE PICKER (page head) ─────── */
[data-theme="dark"] .dash-session,
[data-theme="dark"] .db-session {
  background: rgba(96, 165, 250, .08) !important;
  border-color: rgba(96, 165, 250, .25) !important;
  color: #BFDBFE !important;
}
[data-theme="dark"] .dash-impersonate,
[data-theme="dark"] .db-impersonate {
  background: #131F38 !important;
  border-color: #1F3158 !important;
}

/* ─── 43. STRIP CARD ACCENT TOP-LINE (3px gradient bar) ─────── */
/* The ::before accent on dash-tile already uses the module's accent
   colour — keep it but slightly raise opacity so it pops on dark. */
[data-theme="dark"] .dash-tile::before { opacity: 1 !important; }

/* ─── 44. EMPTY-STATE CARDS ───────────────────────────────── */
[data-theme="dark"] .dash-empty,
[data-theme="dark"] .up-empty,
[data-theme="dark"] .al-empty {
  background: #0E1628 !important;
  border-color: #1F3158 !important;
  color: #8FA3C7 !important;
}
[data-theme="dark"] .dash-empty b,
[data-theme="dark"] .up-empty-t { color: #E2E8F8 !important; }
[data-theme="dark"] .dash-empty i,
[data-theme="dark"] .up-empty-ic { color: #60A5FA !important; }

/* ─── 45. NICER SHADOWS — deeper on dark surfaces ──────────── */
[data-theme="dark"] {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, .6) !important;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, .55), 0 1px 2px rgba(0, 0, 0, .4) !important;
  --shadow-md: 0 6px 18px rgba(0, 0, 0, .55), 0 2px 6px rgba(0, 0, 0, .4) !important;
  --shadow-lg: 0 14px 36px rgba(0, 0, 0, .6), 0 6px 12px rgba(0, 0, 0, .4) !important;
  --shadow-xl: 0 24px 60px rgba(0, 0, 0, .65), 0 10px 20px rgba(0, 0, 0, .5) !important;
}
`;
export default erpExtraCss;
