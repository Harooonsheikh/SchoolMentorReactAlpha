/* ═══════════════════════════════════════════════════════════════════
   TM_CSS — scoped CSS-in-JS for the Tech Module (module convention:
   each module owns its own stylesheet, consuming the shared .sa-root
   design tokens — see saStyles.js — never reusing another module's
   internally-scoped classes like AgentSupport.jsx's .ag-* set, whose
   own CSS vars only exist while that component is mounted).

   Tab bar reuses the app's own shared `.app-tabs`/`.app-tab`/`.tab-count`
   classes verbatim (already defined in saStyles.js) so the Tech Module
   reads as "the same app", not a bolted-on module with its own
   competing tab style.

   Injected once from TechModule.jsx.
   ═══════════════════════════════════════════════════════════════════ */
export const TM_CSS = `
/* ── Badge tone classes — referenced by techTicketsData.js's
   STATUS_BADGE/TYPE_BADGE/STAGE_BADGE/SOURCE_BADGE/PRIORITY_BADGE
   'cls' values. Colored so every badge in the module actually reads
   its status at a glance, matching the weight/shape of the app's own
   shared .badge/.b-* set (saStyles.js) exactly — just a wider palette. ── */
.sa-root .badge.tt-b-slate{background:rgba(71,85,105,.1);color:#475569;border:1px solid rgba(71,85,105,.22)}
.sa-root .badge.tt-b-blue{background:var(--brand-light);color:var(--brand);border:1px solid var(--bm)}
.sa-root .badge.tt-b-amber{background:rgba(217,119,6,.1);color:#D97706;border:1px solid rgba(217,119,6,.25)}
.sa-root .badge.tt-b-teal{background:rgba(13,148,136,.1);color:#0D9488;border:1px solid rgba(13,148,136,.25)}
.sa-root .badge.tt-b-purple{background:rgba(124,58,237,.1);color:#7C3AED;border:1px solid rgba(124,58,237,.22)}
.sa-root .badge.tt-b-green{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25)}
.sa-root .badge.tt-b-red{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.22)}
.sa-root .badge.tt-b-critical{background:rgba(190,24,93,.12);color:#BE185D;border:1px solid rgba(190,24,93,.28)}

/* ── Analytics cards — quick-glance stat row above the tab bar. ── */
.tm-stat-row{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}
.tm-stat-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:14px 15px;display:flex;align-items:center;gap:11px;box-shadow:var(--s-sm);transition:var(--tr)}
.tm-stat-card:hover{box-shadow:var(--s-md);transform:translateY(-1px)}
.tm-stat-ic{width:38px;height:38px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.tm-stat-tx{min-width:0}
.tm-stat-val{font-size:19px;font-weight:800;color:var(--t1);line-height:1.1}
.tm-stat-lbl{font-size:10.5px;color:var(--tm);font-weight:700;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-stat-sub{font-size:9.5px;color:var(--tm);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:1100px){ .tm-stat-row{grid-template-columns:repeat(3,1fr)} }
@media (max-width:560px){ .tm-stat-row{grid-template-columns:repeat(2,1fr)} }

/* ── Modals — same shell everywhere in this module. Each modal gets a
   vivid gradient header keyed to its action (create=indigo, dev
   report=amber, approve=green, reject=rose, release=teal, detail=
   violet) — colorful by design, per spec — with a translucent icon
   badge so the icon still pops against the gradient. ── */
.tm-ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(4px);z-index:1300;display:flex;align-items:center;justify-content:center;padding:18px}
.tm-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:460px;max-height:92vh;overflow-y:auto;box-shadow:var(--s-xl);display:flex;flex-direction:column;border:1px solid var(--bl);animation:saMIn .24s cubic-bezier(.34,1.22,.64,1) both}
.tm-modal-lg{max-width:660px}
.tm-modal-hd{display:flex;align-items:center;gap:13px;padding:18px 20px;position:sticky;top:0;z-index:5;color:#fff;border-radius:var(--r-xl) var(--r-xl) 0 0}
.tm-modal-hd-ic{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;backdrop-filter:blur(4px)}
.tm-modal-hd-tt{font-size:14.5px;font-weight:800;line-height:1.3}
.tm-modal-hd-sb{font-size:11.5px;font-weight:500;opacity:.88;margin-top:2px}
.tm-modal-hd .pm-close{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3);color:#fff}
.tm-modal-hd .pm-close:hover{background:rgba(255,255,255,.28)}
.tm-modal-body{padding:20px}
.tm-modal-ft{display:flex;gap:8px;justify-content:flex-end;padding:13px 20px;border-top:1px solid var(--bl)}
.tm-req{color:var(--err)}
.tm-form-section-lbl{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin:4px 0 12px;padding:5px 11px;border-radius:999px}
.tm-form-section-lbl.c-blue{background:var(--brand-light);color:var(--brand)}
.tm-form-section-lbl.c-purple{background:rgba(124,58,237,.1);color:#7C3AED}
.tm-form-section-lbl.c-teal{background:rgba(13,148,136,.1);color:#0D9488}
.tm-form-section-lbl.c-amber{background:rgba(217,119,6,.1);color:#D97706}
.tm-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.tm-fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 22px}
@media (max-width:640px){ .tm-grid{grid-template-columns:1fr} .tm-fields-grid{grid-template-columns:1fr} }

.tm-banner{display:flex;align-items:flex-start;gap:9px;border-radius:var(--r-md);padding:11px 14px;font-size:12.5px;line-height:1.5;margin-bottom:14px}
.tm-banner i{flex-shrink:0;margin-top:1px}
.tm-banner-info{background:rgba(30,58,138,.06);border:1.5px solid rgba(30,58,138,.16);color:var(--t2)}
.tm-banner-info i{color:var(--brand)}
.tm-banner-warn{background:rgba(217,119,6,.08);border:1.5px solid rgba(217,119,6,.25);color:#b45309}
.tm-banner-warn i{color:#D97706}
.tm-banner-danger{background:rgba(220,38,38,.06);border:1.5px solid rgba(220,38,38,.2);color:#B91C1C}
.tm-banner-danger i{color:var(--err)}

/* ── Tab body wrapper — every tab renders its list inside one of
   these so the module reads as a normal .section-card page, same as
   every other module in the app. ── */
.tm-body-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-xl);box-shadow:var(--s-sm)}
.tm-body-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid var(--bl);background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);border-radius:var(--r-xl) var(--r-xl) 0 0}
.tm-body-pad{padding:18px 20px}

/* ── Sub-category filters (Bug/New-Dev split inside QA, Developer
   Tasks / QA Returned split inside In Progress) — light segmented
   pills, not heavy boxes. ── */
.tm-subfilter-group{margin-bottom:16px}
.tm-subfilter-group-lbl{font-size:10.5px;font-weight:800;color:var(--tm);text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}
.tm-subfilter{display:flex;gap:6px;flex-wrap:wrap}
.tm-subfilter-btn{display:flex;align-items:center;gap:6px;padding:6px 13px;border-radius:999px;border:1.5px solid transparent;background:var(--muted);font-size:11.5px;font-weight:700;color:var(--t2);cursor:pointer;transition:var(--tr)}
.tm-subfilter-btn:hover{color:var(--t1);background:var(--bl)}
.tm-subfilter-btn.active{border-color:var(--brand);background:var(--brand-light);color:var(--brand)}

/* ── Ticket cards — left accent stripe by type for instant scanning,
   tighter type scale, subtle lift on hover. ── */
.tm-card-list{display:flex;flex-direction:column;gap:10px}
.tm-card{position:relative;background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:14px 16px 14px 18px;box-shadow:var(--s-xs);transition:var(--tr)}
.tm-card::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:2px;background:var(--brand)}
.tm-card.tm-card-bug::before{background:#DC2626}
.tm-card.tm-card-improvement::before{background:#7C3AED}
.tm-card:hover{box-shadow:var(--s-md);border-color:var(--bm);transform:translateY(-1px)}
.tm-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}
.tm-card-num{font-size:10.5px;font-weight:800;color:var(--brand);letter-spacing:.03em}
.tm-card-title{font-size:13.5px;font-weight:700;color:var(--t1);margin-top:2px;line-height:1.35}
.tm-card-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;font-size:11px;color:var(--tm);margin-bottom:10px}
.tm-card-meta i{color:var(--brand);margin-right:4px}
.tm-card-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;border-top:1px solid var(--bl);padding-top:11px;margin-top:2px}
/* Permission tooltips on right-edge buttons (card actions, header "Create New"):
   open leftward from the button's right edge so they stay inside the card. */
.sa-root .tm-card-actions [data-tip]::after,.sa-root .tm-body-hd [data-tip]::after{left:auto;right:0;transform:translateY(4px);width:max-content;max-width:240px;white-space:normal;text-align:left;line-height:1.35}
.sa-root .tm-card-actions [data-tip]:hover::after,.sa-root .tm-card-actions [data-tip]:focus-visible::after,.sa-root .tm-body-hd [data-tip]:hover::after,.sa-root .tm-body-hd [data-tip]:focus-visible::after{transform:translateY(0)}
.tm-empty{text-align:center;padding:52px 20px;color:var(--tm)}
.tm-empty i{font-size:28px;opacity:.18;display:block;margin-bottom:12px}
.tm-empty div:first-of-type{font-size:13px;font-weight:700;color:var(--t2);margin-bottom:3px}

/* ── Detail modal sections — last one drops its divider/spacing. ── */
.tm-modal-body .tm-detail-section:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}

/* TmDropdown — downward-only select (TmDropdown.jsx). */
.sa-root .tm-sel{display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer}
.sa-root .tm-sel:disabled{cursor:not-allowed;opacity:.6}
.sa-root .tm-sel.open{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .tm-sel-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sa-root .tm-sel-val.ph{color:var(--tm)}
.sa-root .tm-sel-chev{font-size:11px;color:var(--tm);transition:transform .15s ease}
.sa-root .tm-sel.open .tm-sel-chev{transform:rotate(180deg)}
.sa-root .tm-sel-menu{position:fixed;z-index:1400;overflow-y:auto;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-md);box-shadow:var(--s-lg);padding:4px;font-family:var(--font);animation:tmSelIn .12s ease-out both}
@keyframes tmSelIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.sa-root .tm-sel-opt{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:7px;font-size:13px;color:var(--t1);cursor:pointer}
.sa-root .tm-sel-opt.ph{color:var(--tm)}
.sa-root .tm-sel-opt.act{background:rgba(30,58,138,.07)}
.sa-root .tm-sel-opt.sel{font-weight:700;color:var(--brand)}
.sa-root .tm-sel-opt .fa-check{font-size:11px}
`;
