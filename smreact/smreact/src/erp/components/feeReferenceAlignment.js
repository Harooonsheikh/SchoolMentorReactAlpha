/*
 * ERP visual alignment layer — Fee module is the source of truth.
 * Rendered LAST by the ERP shell so equivalent controls across modules use
 * one hierarchy and one interaction language without changing business logic.
 *
 * L1  = Fee top tabs (.fee-subtabs / .fee-subtab)
 * L2  = Fee segmented pill (.fee-seg / .fee-seg-btn)
 * CTA = Fee action buttons (.fee-btn)
 */

const feeReferenceAlignment = `
/* ═══════════════════════════════════════════════════════════════════
   1) L1 MODULE NAVIGATION — Fee reference
   ═══════════════════════════════════════════════════════════════════ */
.l1-tabs,
.exam-tabs-row,
.pg-tabs-row,
.att-tabs-row,
.fee-subtabs,
.hr-tabs,
.apr-subtabs,
.settings-tabs,
.up-tabs,
.nt-tabs,
.sops-cats,
.tt-cats {
  display: flex;
  gap: 6px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 5px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
  flex-wrap: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.l1-tabs::-webkit-scrollbar,
.exam-tabs-row::-webkit-scrollbar,
.pg-tabs-row::-webkit-scrollbar,
.att-tabs-row::-webkit-scrollbar,
.fee-subtabs::-webkit-scrollbar,
.hr-tabs::-webkit-scrollbar,
.apr-subtabs::-webkit-scrollbar,
.settings-tabs::-webkit-scrollbar,
.up-tabs::-webkit-scrollbar,
.nt-tabs::-webkit-scrollbar,
.sops-cats::-webkit-scrollbar,
.tt-cats::-webkit-scrollbar { display: none; }

.l1-tab,
.exam-tab,
.pg-tab,
.att-tab,
.fee-subtab,
.hr-tab,
.apr-subtab,
.settings-tab,
.up-tab,
.nt-tab,
.sops-cat,
.tt-cat {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
  text-align: center;
}

.l1-tab:hover:not(.active),
.exam-tab:hover:not(.active),
.pg-tab:hover:not(.active),
.att-tab:hover:not(.active),
.fee-subtab:hover:not(.active),
.hr-tab:hover:not(.active),
.apr-subtab:hover:not(.on),
.settings-tab:hover:not(.on),
.up-tab:hover:not(.on),
.nt-tab:hover:not(.active),
.sops-cat:hover:not(.on),
.tt-cat:hover:not(.on) {
  background: var(--bg-muted);
  color: var(--text-primary);
}

.l1-tab.active,
.exam-tab.active,
.pg-tab.active,
.att-tab.active,
.fee-subtab.active,
.hr-tab.active,
.apr-subtab.on,
.settings-tab.on,
.up-tab.on,
.nt-tab.active,
.sops-cat.on,
.tt-cat.on {
  background: linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}

.l1-tab i,
.exam-tab i,
.pg-tab i,
.att-tab i,
.fee-subtab i,
.hr-tab i,
.apr-subtab i,
.settings-tab i,
.up-tab i,
.nt-tab i,
.sops-cat i,
.tt-cat i { font-size: 12px; }

.l1-tab:focus-visible,
.exam-tab:focus-visible,
.pg-tab:focus-visible,
.att-tab:focus-visible,
.fee-subtab:focus-visible,
.hr-tab:focus-visible,
.apr-subtab:focus-visible,
.settings-tab:focus-visible,
.up-tab:focus-visible,
.nt-tab:focus-visible,
.sops-cat:focus-visible,
.tt-cat:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.24);
}

/* Academics icon chip remains compact inside the shared L1 geometry. */
.l1-tab-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

/* ═══════════════════════════════════════════════════════════════════
   2) L2 / NESTED NAVIGATION — Fee segmented-pill hierarchy
   ═══════════════════════════════════════════════════════════════════ */
.l2-tabs,
.res-sub-tabs,
.pg-qtype-tabs,
.net-tabs-row {
  display: flex;
  width: 100%;
  gap: 0;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-full);
  padding: 5px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
  flex-wrap: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.l2-tabs::-webkit-scrollbar,
.res-sub-tabs::-webkit-scrollbar,
.pg-qtype-tabs::-webkit-scrollbar,
.net-tabs-row::-webkit-scrollbar { display: none; }

.l2-tab,
.res-sub-tab,
.pg-qtype-tab,
.net-tab {
  flex: 1 1 0;
  min-width: max-content;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
  box-shadow: none;
}

.l2-tab:hover:not(.active),
.res-sub-tab:hover:not(.active),
.pg-qtype-tab:hover:not(.active),
.net-tab:hover:not(.active) {
  background: transparent;
  color: var(--text-primary);
  border-color: transparent;
}

.l2-tab.active,
.res-sub-tab.active,
.pg-qtype-tab.active,
.net-tab.active {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30,58,138,.3);
  border-color: transparent;
}

.l2-tab::after,
.l2-tab.active::after,
.l2-tab-dot { display: none; }
.l2-tab:not(:last-child) { border-right: none; }

.l2-tab:focus-visible,
.res-sub-tab:focus-visible,
.pg-qtype-tab:focus-visible,
.net-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.22);
}

/* ═══════════════════════════════════════════════════════════════════
   3) ACTION BUTTONS — Fee button geometry + hover language
   ═══════════════════════════════════════════════════════════════════ */
.att-btn-primary,
.att-btn-secondary,
.att-btn-save-small,
.stu-btn-primary,
.stu-btn-ghost,
.apr-btn,
.emp-btn,
.settings-btn,
.up-btn,
.net-btn,
.sops-btn,
.tt-btn,
.hrb-root .btn-primary,
.hrb-root .btn-secondary {
  min-height: 0;
  height: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
  letter-spacing: 0;
}

.att-btn-primary,
.att-btn-save-small,
.stu-btn-primary,
.apr-btn-primary,
.emp-btn-primary,
.settings-btn-primary,
.up-btn-primary,
.net-btn-primary,
.sops-btn-primary,
.tt-btn-primary,
.tt-btn-purple,
.hrb-root .btn-primary {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(30,58,138,.28);
}

.att-btn-primary:hover:not(:disabled),
.att-btn-save-small:hover:not(:disabled),
.stu-btn-primary:hover:not(:disabled),
.apr-btn-primary:hover:not(.is-disabled):not(:disabled),
.emp-btn-primary:hover:not(:disabled),
.settings-btn-primary:hover:not(:disabled),
.up-btn-primary:hover:not(:disabled),
.net-btn-primary:hover:not(:disabled),
.sops-btn-primary:hover:not(:disabled),
.tt-btn-primary:hover:not(:disabled),
.tt-btn-purple:hover:not(:disabled),
.hrb-root .btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(30,58,138,.38);
}

.att-btn-secondary,
.stu-btn-ghost,
.apr-btn-ghost,
.emp-btn-ghost,
.settings-btn-ghost,
.up-btn-ghost,
.net-btn-ghost,
.sops-btn-ghost,
.tt-btn-ghost,
.hrb-root .btn-secondary {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-secondary);
}

.att-btn-secondary:hover:not(:disabled),
.stu-btn-ghost:hover:not(:disabled),
.apr-btn-ghost:hover:not(:disabled),
.emp-btn-ghost:hover:not(:disabled),
.settings-btn-ghost:hover:not(:disabled),
.up-btn-ghost:hover:not(:disabled),
.net-btn-ghost:hover:not(:disabled),
.sops-btn-ghost:hover:not(:disabled),
.tt-btn-ghost:hover:not(:disabled),
.hrb-root .btn-secondary:hover:not(:disabled) {
  transform: none;
  background: var(--bg-muted);
  border-color: var(--border-med);
  color: var(--text-primary);
  box-shadow: none;
}

/* Attendance-specific equivalent actions lose the one-off pill/scale treatment. */
.att-add-holiday-btn,
.att-btn-report,
.att-mark-btn-primary,
.grp-gen-btn {
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  transition: var(--tr);
}
.att-add-holiday-btn { padding: 8px 14px; font-size: 12px; }
.att-btn-report { padding: 8px 14px; font-size: 12px; }
.att-mark-btn-primary {
  padding: 8px 14px;
  font-size: 12px;
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  box-shadow: 0 2px 8px rgba(30,58,138,.28);
}
.att-mark-btn-primary::after { display: none; }
.att-mark-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(30,58,138,.38);
}
.att-mark-btn-primary.update-mode {
  background: linear-gradient(135deg,#065F46,#047857);
}
.grp-gen-btn { border-radius: var(--radius-md); }
.grp-gen-btn:hover { transform: translateY(-1px); }

/* Compact variants remain compact but use the same proportions. */
.up-btn-sm,
.tt-btn-sm,
.sops-btn-sm { padding: 7px 13px; font-size: 12px; height: auto; }

/* Semantic destructive buttons keep red, but match Fee's motion/shape. */
.apr-btn-danger,
.settings-btn-danger,
.up-btn-danger,
.net-btn-danger,
.tt-btn-red,
.tt-btn-pdf {
  border-radius: var(--radius-md);
  background: linear-gradient(135deg,#DC2626,#B91C1C);
  color: #fff;
}
.apr-btn-danger:hover:not(:disabled),
.settings-btn-danger:hover:not(:disabled),
.up-btn-danger:hover:not(:disabled),
.net-btn-danger:hover:not(:disabled),
.tt-btn-red:hover:not(:disabled),
.tt-btn-pdf:hover:not(:disabled) {
  transform: translateY(-1px);
}

/* ═══════════════════════════════════════════════════════════════════
   4) FOCUS + DISABLED CONSISTENCY
   ═══════════════════════════════════════════════════════════════════ */
.att-btn-primary:focus-visible,
.att-btn-secondary:focus-visible,
.att-btn-save-small:focus-visible,
.stu-btn-primary:focus-visible,
.stu-btn-ghost:focus-visible,
.apr-btn:focus-visible,
.emp-btn:focus-visible,
.settings-btn:focus-visible,
.up-btn:focus-visible,
.net-btn:focus-visible,
.sops-btn:focus-visible,
.tt-btn:focus-visible,
.hrb-root .btn-primary:focus-visible,
.hrb-root .btn-secondary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.24);
}

.att-btn-primary:disabled,
.att-btn-secondary:disabled,
.att-btn-save-small:disabled,
.stu-btn-primary:disabled,
.stu-btn-ghost:disabled,
.apr-btn:disabled,
.emp-btn:disabled,
.settings-btn:disabled,
.up-btn:disabled,
.net-btn:disabled,
.sops-btn:disabled,
.tt-btn:disabled,
.hrb-root .btn-primary:disabled,
.hrb-root .btn-secondary:disabled {
  opacity: .55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ═══════════════════════════════════════════════════════════════════
   5) DARK MODE — same surfaces as Fee
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="dark"] .l1-tabs,
[data-theme="dark"] .exam-tabs-row,
[data-theme="dark"] .pg-tabs-row,
[data-theme="dark"] .att-tabs-row,
[data-theme="dark"] .fee-subtabs,
[data-theme="dark"] .hr-tabs,
[data-theme="dark"] .apr-subtabs,
[data-theme="dark"] .settings-tabs,
[data-theme="dark"] .up-tabs,
[data-theme="dark"] .nt-tabs,
[data-theme="dark"] .sops-cats,
[data-theme="dark"] .tt-cats,
[data-theme="dark"] .l2-tabs,
[data-theme="dark"] .res-sub-tabs,
[data-theme="dark"] .pg-qtype-tabs,
[data-theme="dark"] .net-tabs-row {
  background: var(--bg-card);
  border-color: var(--border-light);
  box-shadow: var(--shadow-sm);
}

[data-theme="dark"] .l1-tab:hover:not(.active),
[data-theme="dark"] .exam-tab:hover:not(.active),
[data-theme="dark"] .pg-tab:hover:not(.active),
[data-theme="dark"] .att-tab:hover:not(.active),
[data-theme="dark"] .fee-subtab:hover:not(.active),
[data-theme="dark"] .hr-tab:hover:not(.active),
[data-theme="dark"] .apr-subtab:hover:not(.on),
[data-theme="dark"] .settings-tab:hover:not(.on),
[data-theme="dark"] .up-tab:hover:not(.on),
[data-theme="dark"] .nt-tab:hover:not(.active),
[data-theme="dark"] .sops-cat:hover:not(.on),
[data-theme="dark"] .tt-cat:hover:not(.on) {
  background: var(--bg-muted);
  color: var(--text-primary);
}

[data-theme="dark"] .l2-tab.active,
[data-theme="dark"] .res-sub-tab.active,
[data-theme="dark"] .pg-qtype-tab.active,
[data-theme="dark"] .net-tab.active {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30,58,138,.3);
}

[data-theme="dark"] .l2-tab:hover:not(.active),
[data-theme="dark"] .res-sub-tab:hover:not(.active),
[data-theme="dark"] .pg-qtype-tab:hover:not(.active),
[data-theme="dark"] .net-tab:hover:not(.active) {
  background: transparent;
  color: var(--text-primary);
}

/* ═══════════════════════════════════════════════════════════════════
   6) RESPONSIVE — Fee behaviour, horizontal scroll for L1
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .l1-tabs,
  .exam-tabs-row,
  .pg-tabs-row,
  .att-tabs-row,
  .fee-subtabs,
  .hr-tabs,
  .apr-subtabs,
  .settings-tabs,
  .up-tabs,
  .nt-tabs,
  .sops-cats,
  .tt-cats {
    padding: 4px;
    gap: 4px;
    margin-bottom: 14px;
  }

  .l1-tab,
  .exam-tab,
  .pg-tab,
  .att-tab,
  .fee-subtab,
  .hr-tab,
  .apr-subtab,
  .settings-tab,
  .up-tab,
  .nt-tab,
  .sops-cat,
  .tt-cat {
    flex: 0 0 auto;
    min-width: max-content;
    padding: 10px 14px;
    font-size: 12px;
  }

  .l2-tabs,
  .res-sub-tabs,
  .pg-qtype-tabs,
  .net-tabs-row {
    border-radius: var(--radius-lg);
    padding: 5px;
    gap: 4px;
    margin-bottom: 14px;
  }

  .l2-tab,
  .res-sub-tab,
  .pg-qtype-tab,
  .net-tab {
    padding: 9px 13px;
    border-radius: var(--radius-md);
    font-size: 12px;
  }
}
`;

export default feeReferenceAlignment;
