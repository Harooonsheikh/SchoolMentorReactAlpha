/* ═══════════════════════════════════════════════════════════════════
   EXAM — design layer ported from School-Mentor-Front-end (Examination
   tab only). EVERY rule is scoped under `.exam-root` (the wrapper
   Examination.jsx renders around its page), so nothing here can change
   another ERP module. Not imported globally — Examination injects it in
   its own <style> tag next to EXAM_CSS.

   Contents:
     1. Tab system (src/styles/tabs.css in the reference):
          .ds-tabs      section tabs (Results sub-tabs)
          .ds-switcher  switcher bar (Grade 1-12 / Preschool)
          .ds-underline innermost view tabs (Grading Setup / Card Options)
     2. Grading Setup — default-comment field (view + pencil, ✓ / ✕ edit),
        brand-token buttons (Edit / Add / Delete).
     3. Light-mode fix: brand-coloured confirm buttons (.primary-style) were
        falling back to the red destructive gradient.
     4. Result History detail — paired cards share a height, Exam History
        list scrolls, downloads in a 4-up grid.

   Tokens: the ERP does not define --brand-primary-rgb / --brand-gradient /
   --brand-solid / --shadow-flatten globally, so every use carries a fallback.
   ═══════════════════════════════════════════════════════════════════ */

export const EXAM_DESIGN_CSS = `
/* ── 1. Section tabs ── */
.exam-root .ds-tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg, 14px);
  overflow: hidden;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
}
.exam-root .ds-tab {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 14px;
  background: transparent; color: var(--text-muted);
  border: none; border-right: 1.5px solid var(--border-light);
  font-family: var(--font-body, inherit); font-size: 13px; font-weight: 700;
  text-align: center; white-space: nowrap; cursor: pointer;
  transition: var(--tr, all .2s ease);
}
.exam-root .ds-tab:last-child { border-right: none; }
.exam-root .ds-tab i { font-size: 11.5px; }
.exam-root .ds-tab:hover:not(.active) { background: var(--bg-muted); color: var(--brand-primary, #1E40AF); }
.exam-root .ds-tab.active {
  background: var(--brand-gradient, linear-gradient(135deg, #1E3A8A, #1E40AF));
  color: #fff;
  box-shadow: inset 0 -3px 0 rgba(255, 255, 255, .18);
}
.exam-root .ds-tab:focus-visible,
.exam-root .ds-switcher-tab:focus-visible,
.exam-root .ds-underline-tab:focus-visible { outline: 2px solid var(--brand-primary, #1E40AF); outline-offset: -2px; }

/* ── 2. Switcher bar ── */
.exam-root .ds-switcher {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}
.exam-root .ds-switcher-group { display: flex; gap: 4px; min-width: 0; }
.exam-root .ds-switcher-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 16px;
  background: transparent; color: var(--text-muted);
  border: none; border-radius: 8px;
  font-family: var(--font-body, inherit); font-size: 12.5px; font-weight: 700;
  white-space: nowrap; cursor: pointer;
  transition: var(--tr, all .2s ease);
}
.exam-root .ds-switcher-tab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
.exam-root .ds-switcher-tab.active {
  background: var(--brand-gradient, linear-gradient(135deg, #1E3A8A, #1E40AF));
  color: #fff;
}
.exam-root .ds-switcher-actions { display: flex; align-items: center; gap: 8px; padding-right: 2px; }
.exam-root .ds-switcher-actions button { height: 36px; border-radius: 8px; }

/* ── 3. Underline tabs ── */
.exam-root .ds-underline {
  display: flex; gap: 26px;
  border-bottom: 1.5px solid var(--border-light);
  margin-bottom: 18px;
  overflow-x: auto; scrollbar-width: none;
}
.exam-root .ds-underline::-webkit-scrollbar { display: none; }
.exam-root .ds-underline-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 2px;
  margin-bottom: -1.5px;
  background: transparent; color: var(--text-muted);
  border: none; border-bottom: 2.5px solid transparent;
  font-family: var(--font-body, inherit); font-size: 13px; font-weight: 700;
  white-space: nowrap; cursor: pointer;
  transition: var(--tr, all .2s ease);
}
.exam-root .ds-underline-tab:hover:not(.active) { color: var(--text-primary); }
.exam-root .ds-underline-tab.active { color: var(--brand-primary, #1E40AF); border-bottom-color: var(--brand-primary, #1E40AF); }

@media (max-width: 900px) {
  .exam-root .ds-tabs { display: flex; overflow-x: auto; scrollbar-width: none; }
  .exam-root .ds-tabs::-webkit-scrollbar { display: none; }
  .exam-root .ds-tab { flex: 1 0 auto; min-width: 150px; font-size: 12.5px; padding: 12px 14px; }
}
@media (max-width: 768px) {
  .exam-root .ds-switcher { flex-direction: column; align-items: stretch; gap: 8px; }
  .exam-root .ds-switcher-group { overflow-x: auto; scrollbar-width: none; }
  .exam-root .ds-switcher-group::-webkit-scrollbar { display: none; }
  .exam-root .ds-switcher-tab { flex: 1 0 auto; justify-content: center; font-size: 12px; padding: 9px 14px; }
  .exam-root .ds-switcher-actions { padding: 0; }
  .exam-root .ds-switcher-actions > * { flex: 1; }
  .exam-root .ds-switcher-actions button { width: 100%; justify-content: center; }
  .exam-root .ds-underline { gap: 20px; }
  .exam-root .ds-underline-tab { font-size: 12.5px; }
}

/* ── Grading Setup — buttons on brand tokens ── */
.exam-root .rs-edit-btn { color: var(--brand-solid, #1E40AF); }
.exam-root .rs-edit-btn:hover:not(:disabled) {
  background: var(--brand-solid, #1E40AF); color: #fff; border-color: var(--brand-solid, #1E40AF);
  box-shadow: var(--shadow-flatten, 0 4px 12px rgba(var(--brand-primary-rgb, 30,58,138), .25));
}
.exam-root .rs-add {
  background: linear-gradient(135deg, rgba(var(--brand-primary-rgb, 30,58,138), .04), rgba(var(--brand-primary-rgb, 30,58,138), .08));
  color: var(--brand-solid, #1E40AF);
}
.exam-root .rs-add:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(var(--brand-primary-rgb, 30,58,138), .08), rgba(var(--brand-primary-rgb, 30,58,138), .14));
  border-color: var(--brand-solid, #1E40AF);
  box-shadow: var(--shadow-flatten, 0 6px 16px rgba(var(--brand-primary-rgb, 30,58,138), .16));
}
/* Active pill ka background blue gradient hai — text white rakho, warna
   blue-on-blue label ("Grade") nazar nahi aata. */
.exam-root .rs-modal-tab.active { color: #fff; }

/* ── Grading Setup — default comment / final remark field ──
   View: text + "Auto" chip + pencil.  Edit: field + ✓ (keep) / ✕ (revert). */
.exam-root .rs-at {
  display: flex; align-items: center; gap: 8px;
  min-height: 36px; padding: 5px 5px 5px 11px;
  border: 1.5px solid var(--border-light); border-radius: 8px;
  background: var(--bg-muted);
  cursor: text; min-width: 0;
}
.exam-root .rs-at--multi { align-items: flex-start; padding-top: 8px; padding-bottom: 8px; }
.exam-root .rs-at--disabled { cursor: not-allowed; opacity: .7; }
.exam-root .rs-at-text {
  flex: 1; min-width: 0;
  font-size: 12.5px; line-height: 1.5; color: var(--text-primary);
  overflow-wrap: anywhere;
}
.exam-root .rs-at-text--empty { color: var(--text-muted); font-style: italic; }
.exam-root .rs-at-chip {
  flex-shrink: 0;
  font-size: 9.5px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase;
  padding: 2px 7px; border-radius: 999px;
  background: rgba(var(--brand-primary-rgb, 30,64,175), .1); color: var(--brand-primary, #1E40AF);
}
.exam-root .rs-at-chip--custom { background: rgba(22,163,74,.1); color: #15803D; }
.exam-root .rs-at-btn {
  width: 28px; height: 28px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1.5px solid transparent;
  font-size: 11.5px; cursor: pointer; transition: all .18s ease;
}
.exam-root .rs-at-btn:disabled { opacity: .45; cursor: not-allowed; }
.exam-root .rs-at-btn--edit { background: var(--bg-card); color: var(--brand-primary, #1E40AF); border-color: var(--border-light); }
.exam-root .rs-at-btn--edit:hover:not(:disabled) { background: var(--brand-primary, #1E40AF); color: #fff; border-color: var(--brand-primary, #1E40AF); }
.exam-root .rs-at-btn--ok { background: #16A34A; color: #fff; }
.exam-root .rs-at-btn--ok:hover { background: #15803D; box-shadow: 0 4px 10px rgba(22,163,74,.3); }
.exam-root .rs-at-btn--cancel { background: var(--bg-card); color: var(--text-muted); border-color: var(--border-light); }
.exam-root .rs-at-btn--cancel:hover { color: #DC2626; border-color: rgba(220,38,38,.35); }
.exam-root .rs-at--editing { align-items: flex-start; padding: 0; border: none; background: transparent; cursor: auto; }
.exam-root .rs-at-field { flex: 1; min-width: 0; }
.exam-root .rs-at-actions { display: flex; gap: 6px; padding-top: 3px; }
.exam-root .rs-pct-err { font-size: 10.5px; color: #DC2626; font-weight: 600; margin-top: 3px; }
.exam-root .rs-input.rs-input--err { border-color: #DC2626 !important; }

/* ── Light-mode fix: brand confirm buttons (Publish / Copy / Release) ──
   .confirm-btn--confirm is the red destructive style; .primary-style must
   override it (only the dark theme had that override before). */
.exam-root .confirm-btn--confirm.primary-style {
  background: var(--brand-gradient, linear-gradient(135deg, #1D4ED8, #1E3A8A));
  box-shadow: var(--shadow-flatten, 0 4px 14px rgba(var(--brand-primary-rgb, 30,58,138), .35), inset 0 1px 0 rgba(255,255,255,.2));
}
.exam-root .confirm-btn--confirm.primary-style:hover {
  box-shadow: var(--shadow-flatten, 0 8px 24px rgba(var(--brand-primary-rgb, 30,58,138), .5));
}

/* ── Result History detail — 3 rows of paired cards that share a height:
   Exam History ↔ Subject Performance, Trends ↔ Insights, then Downloads. ── */
.exam-root .rh-detail-grid {
  display: grid;
  grid-template-columns: minmax(0,1fr) minmax(300px,380px);
  grid-template-areas: "hist subj" "trend ins" "dl dl";
  gap: 16px; align-items: stretch;
}
/* ERP: Subject Performance / Insights only render when the live rows carry
   per-subject marks — when one is missing its partner spans both columns. */
.exam-root .rh-detail-grid--no-subj { grid-template-areas: "hist hist" "trend ins" "dl dl"; }
.exam-root .rh-detail-grid--no-ins { grid-template-areas: "hist subj" "trend trend" "dl dl"; }
.exam-root .rh-detail-grid--no-subj.rh-detail-grid--no-ins { grid-template-areas: "hist hist" "trend trend" "dl dl"; }
.exam-root .rh-detail-grid > * { margin: 0 !important; min-width: 0; }
.exam-root .rh-detail-grid .rh-history-card { display: flex; flex-direction: column; }
.exam-root .rh-history-list { max-height: 190px; overflow-y: auto; scrollbar-width: thin; }
.exam-root .rh-dl-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }
.exam-root .rh-dl-grid .rh-report-card { display: flex; flex-direction: column; justify-content: space-between; }
.exam-root .rh-all-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 32px; padding: 0 12px; border-radius: 9px; border: none; cursor: pointer;
  background: var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color: #fff;
  font-family: inherit; font-size: 12px; font-weight: 700; white-space: nowrap;
  transition: all .18s ease;
}
.exam-root .rh-all-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(var(--brand-primary-rgb, 30,58,138), .3); }
.exam-root .rh-all-btn:disabled { opacity: .6; cursor: progress; }
.exam-root .rh-all-count {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.22); font-size: 10.5px; font-weight: 800;
}
@media (max-width: 1200px) {
  .exam-root .rh-dl-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 980px) {
  .exam-root .rh-detail-grid,
  .exam-root .rh-detail-grid.rh-detail-grid--no-subj,
  .exam-root .rh-detail-grid.rh-detail-grid--no-ins,
  .exam-root .rh-detail-grid.rh-detail-grid--no-subj.rh-detail-grid--no-ins {
    grid-template-columns: minmax(0,1fr); grid-template-areas: "hist" "subj" "trend" "ins" "dl";
  }
  .exam-root .rh-history-list { max-height: none; }
}
@media (max-width: 560px) {
  .exam-root .rh-dl-grid { grid-template-columns: minmax(0,1fr); }
}
`;

/* Print-window <head> for result-card PDFs: Plus Jakarta Sans (the cards'
   font) + Font Awesome (the cards' icons). The ERP print windows only
   linked Font Awesome, so the PDF fell back to Segoe UI / Arial. */
export const EXAM_RC_PRINT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">`;
