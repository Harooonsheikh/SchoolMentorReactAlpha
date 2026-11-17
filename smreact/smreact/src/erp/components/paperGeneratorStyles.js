/* ═══════════════════════════════════════════════════════════════════
   PAPER GENERATOR — design port from School-Mentor-Front-end commit
   141f4ef (Board Pattern template + Make Paper modal redesign).

   Rendered by PaperGenerator.jsx in its own <style> tag next to PG_CSS
   (same mechanism the page already uses — nothing imported globally).
   Every selector is prefixed `pgx` or scoped under `.pg-modal.pgx` /
   `.pgx`, so nothing outside the Paper Generator is affected.
   Brand tokens: the ERP has no global --brand-primary-rgb, so rgba() uses
   the `var(--brand-primary-rgb, 30,58,138)` fallback.
   ═══════════════════════════════════════════════════════════════════ */
export const PAPER_PGX_CSS = `
/* ── Board Pattern (Template 4) — paper-style "ink" headers; they represent a
   printed exam paper so they stay white/black regardless of app theme. ── */
.pgx-bd { --bd:#0B5D3B; font-family:'Plus Jakarta Sans',sans-serif; color:#111827; font-size:11px; line-height:1.35; margin-bottom:10px; }
.pgx-bd * { box-sizing:border-box; }
.pgx-bd-boxes { display:inline-flex; gap:2px; vertical-align:middle; }
.pgx-bd-boxes i { display:inline-block; width:15px; height:19px; border:1.2px solid #111827; background:#fff; }
.pgx-bd .note { font-size:9.5px; color:#374151; border-top:1px dashed #9CA3AF; padding-top:5px; margin-top:8px; }
.pgx-bd .bn { font-weight:800; letter-spacing:.01em; }
/* Punjab family */
.pgx-bd-pj .r1 { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.pgx-bd-pj .roll b, .pgx-bd-pj .code b { display:block; font-size:9px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px; color:var(--bd); }
.pgx-bd-pj .mid { flex:1; text-align:center; }
.pgx-bd-pj .crest { width:42px; height:42px; border-radius:50%; border:2px solid var(--bd); color:var(--bd); margin:0 auto 4px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:10px; }
.pgx-bd-pj .bn { font-size:12px; color:var(--bd); }
.pgx-bd-pj .code span { display:block; border:1.5px solid #111827; padding:4px 10px; font-weight:800; font-size:13px; text-align:center; }
.pgx-bd-pj .exam { text-align:center; font-weight:800; font-size:10.5px; background:var(--bd); color:#fff; padding:4px 8px; margin:8px 0 6px; letter-spacing:.02em; }
.pgx-bd-pj .r3 { display:flex; justify-content:space-between; gap:8px; margin-bottom:6px; font-size:10.5px; }
.pgx-bd-tb { width:100%; border-collapse:collapse; font-size:10.5px; }
.pgx-bd-tb th, .pgx-bd-tb td { border:1px solid #111827; padding:3px 8px; text-align:left; }
.pgx-bd-tb th { background:#F3F4F6; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; }
.pgx-bd-tb tr.tt td { font-weight:800; }
.pgx-bd .sig { display:flex; justify-content:space-between; gap:10px; margin-top:10px; font-size:10px; }
/* Sindh family */
.pgx-bd-sd { font-family:'Times New Roman',Georgia,serif; font-size:12px; }
.pgx-bd-sd .top { display:flex; justify-content:space-between; align-items:center; }
.pgx-bd-sd .seat b { margin-right:6px; font-size:11px; }
.pgx-bd-sd .pg { font-size:10px; color:#6B7280; }
.pgx-bd-sd .bn { text-align:center; font-size:15px; color:var(--bd); margin-top:6px; }
.pgx-bd-sd .ex { text-align:center; font-weight:700; font-size:11.5px; margin-top:2px; }
.pgx-bd-sd .rule2 { border-top:3px double var(--bd); margin:7px 0 8px; }
.pgx-bd-sd .grid { width:100%; border-collapse:collapse; font-size:11px; }
.pgx-bd-sd .grid th, .pgx-bd-sd .grid td { border:1px solid #111827; padding:4px 8px; text-align:left; }
.pgx-bd-sd .grid th { width:18%; background:#F9FAFB; font-weight:700; }
/* Federal */
.pgx-bd-fb .r1 { display:flex; align-items:center; gap:12px; }
.pgx-bd-fb .seal { width:48px; height:48px; border-radius:50%; background:var(--bd); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:9px; flex-shrink:0; box-shadow:0 0 0 3px #fff,0 0 0 4.5px var(--bd); }
.pgx-bd-fb .tt { flex:1; }
.pgx-bd-fb .bn { font-size:11.5px; color:var(--bd); }
.pgx-bd-fb .ex { font-size:9.5px; font-weight:700; color:#4B5563; margin-top:2px; }
.pgx-bd-fb .rbox { text-align:right; }
.pgx-bd-fb .rbox b { display:block; font-size:9px; text-transform:uppercase; margin-bottom:3px; }
.pgx-bd-fb .rbox small { display:block; font-size:9.5px; font-weight:700; margin-top:3px; }
.pgx-bd-fb .band { display:grid; grid-template-columns:repeat(4,1fr); background:var(--bd); color:#fff; margin:9px 0 6px; border-radius:3px; }
.pgx-bd-fb .band span { padding:5px 9px; font-weight:700; font-size:10.5px; border-right:1px solid rgba(255,255,255,.25); }
.pgx-bd-fb .band span:last-child { border:0; }
.pgx-bd-fb .band b { display:block; font-size:8px; opacity:.75; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
.pgx-bd-fb .inst { font-size:9.5px; border:1px solid #D1D5DB; padding:5px 8px; border-radius:3px; }
/* KP / Balochistan */
.pgx-bd-kp .frame { border:3px double var(--bd); padding:10px 14px; text-align:center; }
.pgx-bd-kp .r1 { display:flex; justify-content:space-between; align-items:center; text-align:left; }
.pgx-bd-kp .r1 b { font-size:9px; text-transform:uppercase; margin-right:5px; }
.pgx-bd-kp .pn { font-weight:800; font-size:10px; border:1.2px solid #111827; padding:3px 8px; }
.pgx-bd-kp .crest { width:38px; height:38px; border-radius:50%; background:var(--bd); color:#fff; margin:6px auto 4px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:9px; }
.pgx-bd-kp .bn { font-size:12px; color:var(--bd); }
.pgx-bd-kp .ex { font-size:10px; font-weight:700; margin-top:2px; }
.pgx-bd-kp .orn { display:flex; align-items:center; gap:6px; margin:6px 0; }
.pgx-bd-kp .orn i { flex:1; border-top:1px solid var(--bd); }
.pgx-bd-kp .orn em { color:var(--bd); font-style:normal; font-size:10px; }
.pgx-bd-kp .meta { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #111827; text-align:left; }
.pgx-bd-kp .meta div { padding:4px 8px; border-right:1px solid #111827; }
.pgx-bd-kp .meta div:last-child { border:0; }
.pgx-bd-kp .meta b { display:block; font-size:8px; text-transform:uppercase; color:var(--bd); letter-spacing:.05em; }
.pgx-bd-kp .meta span { font-weight:700; font-size:10.5px; }
.pgx-bd-kp .note { text-align:left; }
/* AKU-EB */
.pgx-bd-aku .top { display:flex; align-items:center; gap:12px; padding-bottom:8px; border-bottom:3px solid var(--bd); }
.pgx-bd-aku .mk { font-weight:900; font-size:19px; color:var(--bd); letter-spacing:-.02em; }
.pgx-bd-aku .mk em { font-style:normal; color:#111827; margin-left:3px; }
.pgx-bd-aku .bn { font-size:11.5px; }
.pgx-bd-aku .ex { font-size:9.5px; color:#6B7280; margin-top:1px; }
.pgx-bd-aku .subjrow { display:flex; align-items:center; gap:8px; margin:9px 0 6px; }
.pgx-bd-aku .sj { flex:1; font-size:16px; font-weight:800; }
.pgx-bd-aku .sj small { display:block; font-size:10px; color:#6B7280; font-weight:600; }
.pgx-bd-aku .pill { background:#F0F9FF; border:1px solid var(--bd); color:var(--bd); border-radius:999px; padding:4px 12px; font-weight:800; font-size:11px; text-align:center; }
.pgx-bd-aku .pill b { display:block; font-size:7.5px; text-transform:uppercase; letter-spacing:.07em; opacity:.8; }
.pgx-bd-aku .cand { display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:end; background:#F9FAFB; border-radius:6px; padding:7px 10px; font-size:10px; }
.pgx-bd-aku .cand b { display:block; font-size:8px; text-transform:uppercase; color:#6B7280; margin-bottom:3px; }
.pgx-bd-aku .ln { display:block; border-bottom:1px solid #111827; height:16px; }
/* Setup UI — mini thumbnail (scaled live header) + board/level/group picker panel */
.pg-tmpl-static.pgx-bd-thumb { overflow:hidden; background:#fff; position:relative; padding:0 !important; }
.pgx-bd-thumb-in { width:520px; transform-origin:top left; transform:scale(.36); padding:12px; pointer-events:none; position:absolute; top:0; left:0; }
.pgx-bp { margin:16px 0 0; border:1.5px solid var(--brand-solid, #1E40AF); border-radius:12px; background:rgba(var(--brand-primary-rgb, 30,58,138), .03); padding:16px 18px; }
.pgx-bp-h b { display:block; font-size:14px; color:var(--text-primary); }
.pgx-bp-h small { color:var(--text-muted); font-size:12px; }
.pgx-bp-row { display:grid; grid-template-columns:1.2fr 1.4fr 1fr auto; gap:12px; align-items:end; margin:12px 0; }
.pgx-bp label, .pgx-bp-pick label { display:block; font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
.pgx-bp-btns { display:flex; gap:8px; }
.pgx-bp-sample { background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:16px 20px; max-width:760px; overflow:auto; }
.pgx-bp-pick { display:grid; grid-template-columns:1.2fr 1.4fr 1fr; gap:12px; margin-bottom:14px; }
@media (max-width:820px) {
  .pgx-bp-row, .pgx-bp-pick { grid-template-columns:1fr; }
  .pgx-bd-fb .band, .pgx-bd-kp .meta { grid-template-columns:1fr 1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   MAKE PAPER MODAL — "Build" steps (left) + live paper preview (right).
   ═══════════════════════════════════════════════════════════════════ */
.pg-modal.pgx { max-width:min(1640px,96vw); display:flex; flex-direction:column; height:min(880px,calc(100vh - 48px)); overflow:hidden; }
.pgx .pg-modal-header { flex-shrink:0; padding:16px 22px 14px; }
.pgx-head-actions { display:flex; align-items:center; gap:12px; }
.pgx-pane-toggle { display:none; background:var(--bg-muted); border-radius:999px; padding:3px; }
.pgx-pane-toggle button { border:0; background:none; padding:6px 14px; border-radius:999px; font-family:inherit; font-size:12px; font-weight:600; color:var(--text-muted); cursor:pointer; }
.pgx-pane-toggle button.active { background:var(--brand-solid,#1E40AF); color:#fff; }

.pgx-body { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); }
.pgx-left { overflow-y:auto; padding:18px 22px 28px; scroll-behavior:smooth; background:var(--bg-card); }
.pgx-right { display:flex; flex-direction:column; min-height:0; background:var(--bg-muted); border-left:1px solid var(--border-light); }

/* steps */
.pgx-step { margin-bottom:22px; }
.pgx-step-h { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.pgx-n { width:26px; height:26px; border-radius:50%; background:var(--brand-solid,#1E40AF); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }
.pgx-step-t { flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.25; }
.pgx-step-t b { font-size:15px; color:var(--text-primary); }
.pgx-step-t small { font-size:12px; color:var(--text-muted); }
.pgx-link { border:0; background:none; color:var(--brand-solid,#1E40AF); font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; padding:4px 6px; border-radius:6px; white-space:nowrap; }
.pgx-link:hover { background:var(--bg-muted); }
.pgx-link:disabled { opacity:.5; cursor:not-allowed; }
.pgx-help { background:var(--bg-muted); border:1px solid var(--border-light); border-radius:12px; padding:12px 16px; margin-bottom:12px; font-size:13px; line-height:1.6; color:var(--text-secondary); }
.pgx-help ol { margin:0 0 6px 18px; padding:0; }
.pgx-help p { margin:0; color:var(--text-muted); font-size:12px; }

.pgx-grid { display:grid; grid-template-columns:1fr 1.4fr; gap:14px 16px; }
.pgx-f { min-width:0; }
.pgx-f--wide { grid-column:1 / -1; }
.pgx-l { display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; }
.pgx .pg-input, .pgx .pg-select { font-size:14px; padding:10px 12px; border-radius:10px; }
.pgx-hint { display:block; margin-top:5px; font-size:11.5px; color:var(--text-muted); }
.pgx-seg { display:flex; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:10px; padding:3px; gap:3px; }
.pgx-seg button { flex:1; border:0; background:none; padding:8px 6px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:.15s; white-space:nowrap; }
.pgx-seg button:hover { background:var(--bg-card); }
.pgx-seg button.on { background:var(--brand-solid,#1E40AF); color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.08); }
.pgx-seg > span, .pgx-seg > div { flex:1; display:flex; }
.pgx-seg > span > button, .pgx-seg > div > button { flex:1; }
.pgx-marks { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:14px; padding:14px; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:12px; }
.pgx-marks .pgx-l { font-size:11.5px; }
.pgx-fetch-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; flex-wrap:wrap; }
.pgx-fetch-row .pgx-hint { margin:0; flex:1; min-width:200px; }

.pgx-empty { display:flex; gap:14px; align-items:center; padding:22px; border:1.5px dashed var(--border-med); border-radius:14px; color:var(--text-muted); font-size:13px; line-height:1.5; }
.pgx-empty i { font-size:28px; color:var(--border-med); }
.pgx-empty b { color:var(--text-secondary); }

/* marks tracker — Objective/Subjective bars side by side */
.pgx-marks-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; margin-bottom:6px; }
.pgx .pg-marks-bar { display:grid; grid-template-columns:1fr auto; gap:6px 10px; align-items:center; padding:10px 14px; margin:0; border-radius:12px; background:var(--bg-card); }
.pgx .pg-marks-bar.ok { background:rgba(22,163,74,.06); }
.pgx .pg-marks-bar.over { background:rgba(220,38,38,.05); }
.pgx-track { grid-column:1/-1; height:6px; background:var(--border-light); border-radius:6px; overflow:hidden; }
.pgx-track i { display:block; height:100%; width:0; background:var(--brand-solid,#1E40AF); border-radius:6px; transition:width .25s; }
.pgx .pg-marks-bar.ok .pgx-track i { background:#16A34A; }
.pgx .pg-marks-bar.over .pgx-track i { background:#DC2626; }

.pgx .pg-qtype-tabs { margin:6px 0 12px; }
.pgx .pg-section-label { display:none; }

/* question-type accordion — only the type picked from the dropdown renders */
.pgx .pg-qblock { display:none; border:0; background:none; margin:0; }
.pgx .pg-qblock.pgx-cur { display:block; }
.pgx .pg-qblock.pgx-cur > .pg-qblock-header { display:none; }
.pgx .pg-qblock-body { padding:14px 16px 16px; background:var(--bg-card); border-radius:12px; }
.pgx .pg-qtab-nav { background:none; padding:0; border:0; box-shadow:none; margin-bottom:12px; gap:8px; }

/* workspace: one flat column instead of unit-select | configure panes */
.pgx .pg-qworkspace, .pgx .pg-qws-panel, .pgx .pg-qws-inner, .pgx .pg-qws-left, .pgx .pg-qws-right {
  border:0; background:none; box-shadow:none; padding-left:0; padding-right:0; border-radius:0;
}
.pgx .pg-qws-inner { display:block; min-height:0; }
.pgx .pg-qws-left { padding-top:4px; padding-bottom:4px; max-height:none; }
.pgx .pg-qws-right { margin-top:10px; padding-top:16px; border-top:1.5px solid var(--border-light); max-height:none; }
.pgx .pg-qws-right-empty { display:none; }
.pgx .pg-qws-section-label {
  display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800;
  color:var(--text-primary); text-transform:none; letter-spacing:0; margin:6px 0 10px;
}
.pgx .pg-qws-section-label span { display:none; }
.pgx-selall { margin-left:auto; }
.pgx .pg-unit-rows-container { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.pgx .pg-unit-row-wrap { border:1.5px solid var(--border-light); border-radius:10px; }
.pgx .pg-unit-row { padding:11px 14px; background:var(--bg-card); }
.pgx .pg-unit-row.active { background:transparent; }
.pgx .pg-instr-card { background:var(--bg-card); }
.pgx .pg-eligible-bar { background:none; border:0; padding:6px 2px; margin-top:8px; }
.pgx .pg-qws-fields { grid-template-columns:1fr 1fr; max-width:460px; gap:14px; }
.pgx .pg-q-field-label { min-height:0; margin-bottom:5px; }
.pgx .pg-q-calc { background:var(--bg-muted); color:var(--text-secondary); font-size:13px; border-radius:10px; padding:10px 14px; margin-top:4px; }
@media (max-width:980px) {
  .pgx .pg-unit-rows-container { grid-template-columns:1fr; }
  .pgx .pg-qws-fields { max-width:none; }
}

/* optional "Let students choose some questions" (Choices field) toggle */
.pgx-adv-link { display:block; margin:2px 0 6px; border:0; background:none; font-family:inherit; color:var(--brand-solid,#1E40AF); font-size:12.5px; font-weight:600; cursor:pointer; padding:4px 0; }

/* question-type dropdown bar: dropdown + "added so far" chips + hint */
.pgx-typebar { margin:0 0 14px; }
.pgx-added { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:10px; }
.pgx-added > span { font-size:11.5px; font-weight:600; color:var(--text-muted); }
.pgx-chip { border:1px solid var(--border-med); background:var(--bg-muted); color:var(--brand-solid,#1E40AF); border-radius:999px; padding:4px 11px; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.pgx-chip:hover { background:var(--bg-card); }
.pgx-pick-hint { margin-top:12px; padding:22px; border:1.5px dashed var(--border-med); border-radius:12px; text-align:center; color:var(--text-muted); font-size:13px; }
.pgx-pick-hint i { display:block; font-size:22px; margin-bottom:6px; color:var(--border-med); }

.pgx-dd { position:relative; }
.pgx-dd-btn { width:100%; display:flex; align-items:center; gap:10px; text-align:left; border:1.5px solid var(--border-med); background:var(--bg-card); border-radius:12px; padding:13px 16px; font-family:inherit; font-size:15px; font-weight:700; color:var(--text-primary); cursor:pointer; }
.pgx-dd-btn.empty .l { color:var(--text-muted); font-weight:600; }
.pgx-dd-btn .l { flex:1; }
.pgx-dd-btn:hover, .pgx-dd.open .pgx-dd-btn { border-color:var(--brand-solid,#1E40AF); }
.pgx-caret { width:8px; height:8px; border-right:2px solid var(--text-muted); border-bottom:2px solid var(--text-muted); transform:rotate(45deg) translateY(-2px); transition:.15s; }
.pgx-dd.open .pgx-caret { transform:rotate(-135deg); }
.pgx-dd-list { display:none; position:absolute; left:0; right:0; top:calc(100% + 6px); z-index:30; background:var(--bg-card); border:1.5px solid var(--border-med); border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,.18); max-height:340px; overflow-y:auto; padding:6px; }
.pgx-dd.open .pgx-dd-list { display:block; }
.pgx-dd-opt { width:100%; display:flex; align-items:center; gap:10px; border:0; background:none; border-radius:8px; padding:10px 12px; cursor:pointer; font-family:inherit; font-size:14px; font-weight:600; color:var(--text-primary); text-align:left; }
.pgx-dd-opt:hover:not([disabled]) { background:var(--bg-muted); }
.pgx-dd-opt.sel { background:rgba(var(--brand-primary-rgb, 30,58,138), .08); }
.pgx-dd-opt .l { flex:1; min-width:0; }
.pgx-dd-opt em { font-size:11px; font-weight:700; font-style:normal; color:#16A34A; white-space:nowrap; }
.pgx-dd-opt .r { font-size:12px; font-weight:600; color:var(--text-muted); background:var(--bg-muted); border-radius:999px; padding:3px 10px; white-space:nowrap; min-width:150px; text-align:center; }
.pgx-dd-opt .r.none { background:none; font-weight:500; }
.pgx-dd-opt[disabled] { opacity:.45; cursor:not-allowed; }
@media (max-width:980px) { .pgx-dd-opt .r { min-width:0; font-size:11px; } }

/* live preview */
.pgx-prev-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px 10px; flex-shrink:0; }
.pgx-prev-head b { display:block; font-size:14px; color:var(--text-primary); }
.pgx-prev-head small { font-size:11.5px; color:var(--text-muted); }
.pgx-prev-head small b { display:inline; font-size:inherit; color:var(--brand-solid,#1E40AF); }
.pgx-total { background:var(--brand-solid,#1E40AF); color:#fff; font-size:12px; font-weight:700; padding:5px 12px; border-radius:999px; white-space:nowrap; }
.pgx-prev-scroll { flex:1; min-height:0; overflow-y:auto; padding:0 20px 22px; }
.pgx-paper { background:#fff; color:#0F172A; border-radius:6px; box-shadow:0 6px 24px rgba(15,23,42,.14); padding:28px 30px 30px; font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif; min-height:420px; }
.pgx-p-sec { display:flex; justify-content:space-between; align-items:baseline; margin:16px 0 8px; padding-bottom:3px; border-bottom:1px solid #D1D5DB; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#374151; }
.pgx-p-sec span:last-child { font-weight:600; letter-spacing:0; text-transform:none; }
.pgx-p-q { padding:8px 10px; margin:0 -10px 4px; border-radius:8px; border:1.5px solid transparent; transition:.15s; }
.pgx-p-q:hover { background:#F3F4F6; }
.pgx-p-qh { display:flex; gap:8px; align-items:baseline; font-size:13px; font-weight:700; line-height:1.4; }
.pgx-p-qh em { font-style:normal; flex:1; font-weight:600; color:#374151; }
.pgx-p-qh em.ph { color:#9CA3AF; font-weight:400; font-style:italic; }
.pgx-p-qh span { font-size:11px; font-weight:600; color:#374151; white-space:nowrap; }
.pgx-p-qh span.pgx-mvs { display:inline-flex; gap:3px; margin-left:4px; opacity:.35; transition:.15s; }
.pgx-p-q:hover .pgx-mvs { opacity:1; }
@media (hover:none) { .pgx-p-qh span.pgx-mvs { opacity:1; } }
.pgx-mv { border:1px solid #D1D5DB; background:#fff; color:#374151; width:26px; height:24px; border-radius:6px; font-size:10px; line-height:1; cursor:pointer; padding:0; }
.pgx-mv:hover:not([disabled]) { background:var(--brand-solid,#1E40AF); border-color:var(--brand-solid,#1E40AF); color:#fff; }
.pgx-mv[disabled] { opacity:.3; cursor:default; }
.pgx-p-body { margin:6px 0 2px 22px; display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:#374151; }
.pgx-p-line { display:flex; gap:8px; align-items:center; height:auto; background:none; margin:0; }
.pgx-p-line:before { content:attr(data-n)"."; width:16px; color:#6B7280; font-size:11.5px; }
.pgx-p-line i { flex:1; height:7px; border-radius:4px; background:#E5E7EB; }
.pgx-p-line.blank i { background:none; border-bottom:1.5px solid #9CA3AF; border-radius:0; height:10px; }
.pgx-p-opts { display:flex; gap:6px; margin-left:24px; }
.pgx-p-opts u { width:34px; height:6px; background:#E5E7EB; border-radius:4px; }
.pgx-p-tf { margin-left:24px; font-size:11px; font-weight:600; color:#6B7280; }
.pgx-p-more { font-size:11px; font-weight:600; color:#6B7280; margin-left:24px; }
.pgx-p-note { display:inline-block; margin-top:4px; font-size:10.5px; font-weight:600; background:#FEF3C7; color:#92400E; border-radius:999px; padding:2px 9px; }
.pgx-p-empty { text-align:center; color:#9CA3AF; font-size:13px; padding:46px 18px; line-height:1.6; }
.pgx-p-empty i { display:block; font-size:30px; margin-bottom:10px; color:#D1D5DB; }
.pgx-p-foot { margin-top:18px; padding-top:8px; border-top:1.5px solid #111; display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#374151; }

/* footer */
.pgx-foot { flex-shrink:0; align-items:center; justify-content:space-between; gap:14px; }
.pgx-status { flex:1; text-align:right; font-size:12.5px; font-weight:600; color:var(--text-muted); }
.pgx-status.ok { color:#16A34A; }
.pgx-status.warn { color:#B45309; }

/* narrower screens: one pane at a time, via the Build/Preview toggle */
@media (max-width: 980px) {
  .pgx-pane-toggle { display:flex; }
  .pgx-body { grid-template-columns:1fr; }
  .pgx-right { display:none; border-left:0; }
  .pg-modal.pgx.show-preview .pgx-left { display:none; }
  .pg-modal.pgx.show-preview .pgx-right { display:flex; }
  .pgx-grid { grid-template-columns:1fr; }
  .pgx-marks { grid-template-columns:1fr 1fr; }
  .pg-modal.pgx { height:94vh; }
  .pgx-left { padding:14px 14px 24px; }
  .pgx-foot { flex-wrap:wrap; }
  .pgx-foot .pgx-status { order:-1; flex-basis:100%; text-align:left; }
}

[data-theme="dark"] .pgx-help { background:rgba(59,130,246,.12); border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pgx-empty { background:var(--bg-card); }
[data-theme="dark"] .pgx-right { background:var(--bg-muted); }
[data-theme="dark"] .pgx-prev-head { background:var(--bg-card); }
[data-theme="dark"] .pgx .pg-marks-bar.ok { background:rgba(22,163,74,.12); }
[data-theme="dark"] .pgx-paper { background:#fff; color:#0F172A; }
[data-theme="dark"] .pgx-dd-opt.sel { background:rgba(59,130,246,.15); }
[data-theme="dark"] .pgx-bp { background:var(--bg-muted); }
[data-theme="dark"] .pgx-bp-sample { background:#fff; }
`;
