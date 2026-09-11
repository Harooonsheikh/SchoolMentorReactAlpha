import React, { useEffect, useMemo, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import * as approvalsService from '../../services/approvalsService';
import { APPROVAL_ACTION_META } from '../../mock/approvals';

/* Per-action explanations shown via the info icon next to each toggle
   below — kept local to this screen (UI copy, not shared metadata) so
   APPROVAL_ACTION_META stays a small label/icon/module lookup used
   elsewhere too. */
const ACTION_DESCRIPTIONS = {
  fee_discount: 'A discount applied to a student’s fee head (flat or percentage) won’t reduce what they owe until a Super Admin approves it.',
  fee_delete_challan: 'Deleting an already-generated fee challan — for one student or a whole class — removes it only after approval, preventing accidental loss of billing records.',
  fee_heads_update: 'Adding, editing or removing a class’s fee heads (via Update Fee Structure or Copy to All Classes) needs approval before the new structure applies to future challans.',
  accounts_edit_entry: 'Editing an existing Accounts ledger entry — amount, date, detail, etc. — requires approval before the change is saved.',
  accounts_delete_entry: 'Deleting an Accounts ledger entry requires approval before it’s removed from the books.',
  hr_deduction_waiver: 'Waiving a payroll fine or deduction for an employee needs approval before the deduction is cleared.',
  hr_bonus_award: 'Awarding a payroll bonus to an employee needs approval before it’s added to their payroll record.',
  hr_salary_update: 'Changing an employee’s Salary Details — basic salary, bank info, or any allowance/deduction head — needs approval before it takes effect. Other edits made in the same form (personal info, employment details, etc.) still save immediately.',
  hr_leave_update: 'Changing an employee’s Leave Details — entitlements, current balance, policy, or the deduction rules — needs approval before it takes effect. Other edits made in the same form still save immediately.',
  hr_loan_approval: 'Setting up a new advance/loan for an employee needs approval before it’s created and disbursed. Repaying an existing loan is not affected — that still applies immediately.',
  inventory_price_edit: 'Changing a product’s selling price in Inventory / POS needs approval before the new price takes effect.',
  inventory_delete_product: 'Deleting a product from Inventory needs approval before it’s removed from the catalogue.',
  students_mark_inactive: 'Marking an active student as Inactive needs approval before they’re removed from the active rolls.',
  students_discount: 'Changing a student’s per-fee-head discount (from the Edit Student form) needs approval before it applies.',
  students_dues_discount: 'Waiving part of an inactive student’s outstanding dues during settlement needs approval before the balance is reduced — any cash actually received still applies immediately.',
};

/* ═══════════════════════════════════════════════════════════════════
   APPROVAL SETTINGS — Settings sub-tab that configures the Approvals
   engine (src/erp/mock/approvals.js → mockApprovalSettings):
     • Master on/off switch for the whole gating mechanism
     • Per-action-type toggles, grouped by module, driven entirely by
       APPROVAL_ACTION_META so a new action type just needs an entry
       there — nothing here is hardcoded.
   Uses the shared SETTINGS_CSS classes mounted by SettingsModule.jsx
   (.settings-banner / .settings-alert / .settings-checks / .settings-
   check / .settings-btn-primary / .settings-empty) plus a small local
   stylesheet for the master toggle switch and module grouping.
   ═══════════════════════════════════════════════════════════════════ */
export default function ApprovalSettings({ toast = () => {} }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [enabled, setEnabled]   = useState(true);
  const [actionTypeEnabled, setActionTypeEnabled] = useState({});
  const [saved, setSaved]       = useState({ enabled: true, actionTypeEnabled: {} });

  const load = async () => {
    setLoading(true);
    try {
      const settings = await approvalsService.getApprovalSettings();
      setEnabled(settings.enabled);
      setActionTypeEnabled(settings.actionTypeEnabled);
      setSaved({ enabled: settings.enabled, actionTypeEnabled: settings.actionTypeEnabled });
    } catch (e) {
      toast(e.message || 'Failed to load approval settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = enabled !== saved.enabled
    || JSON.stringify(actionTypeEnabled) !== JSON.stringify(saved.actionTypeEnabled);

  /* Group the action types by module without hardcoding the list. */
  const groups = useMemo(() => {
    const byModule = {};
    Object.keys(APPROVAL_ACTION_META).forEach((key) => {
      const meta = APPROVAL_ACTION_META[key];
      if (!byModule[meta.module]) byModule[meta.module] = [];
      byModule[meta.module].push({ key, ...meta });
    });
    return byModule;
  }, []);

  const toggleAction = (key) => {
    setActionTypeEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await approvalsService.saveApprovalSettings({ enabled, actionTypeEnabled });
      setEnabled(result.enabled);
      setActionTypeEnabled(result.actionTypeEnabled);
      setSaved({ enabled: result.enabled, actionTypeEnabled: result.actionTypeEnabled });
      toast('Approval settings saved', 'success');
    } catch (e) {
      toast(e.message || 'Failed to save approval settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-empty">
        <div className="settings-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
        <div className="settings-empty-title">Loading approval settings…</div>
      </div>
    );
  }

  return (
    <>
      <style>{AS_CSS}</style>

      {/* ── Info banner ── */}
      <div className="settings-banner">
        <div className="settings-banner-ic"><i className="fa-solid fa-square-check" aria-hidden="true"></i></div>
        <div className="settings-banner-body">
          <b>Approvals</b> lets you require Super Admin sign-off before certain sensitive changes take effect —
          a Fee discount, a deleted challan, an inventory price cut, a payroll bonus, and so on don&rsquo;t apply
          immediately; they&rsquo;re queued here first, and only take effect once approved. Requesters can also{' '}
          <b>withdraw (revoke)</b> their own request any time before it&rsquo;s reviewed. Requests raised across
          the ERP are reviewed from the <b>Approvals</b> module in the sidebar.
        </div>
      </div>

      {/* ── Master toggle ── */}
      <div className="as-card">
        <div className="as-card-row">
          <div className="as-card-text">
            <div className="as-card-title">
              Approvals Active
              <Tooltip text="Master switch for the whole Approvals mechanism. Turn this off to pause approval requirements everywhere at once, without changing the per-action choices below.">
                <i className="fa-solid fa-circle-info as-info" aria-hidden="true"></i>
              </Tooltip>
            </div>
            <div className="as-card-sub">
              {enabled
                ? 'Sensitive changes across Fee, Accounts, Human Resource, Inventory and Students are queued for Super Admin review before they apply.'
                : 'When off, every module applies these changes immediately again, exactly as if Approvals didn’t exist — nothing is deleted, this only pauses the review requirement.'}
            </div>
          </div>
          <label className="as-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Approvals Active"
            />
            <span className="as-toggle-track"><span className="as-toggle-thumb"></span></span>
          </label>
        </div>
      </div>

      {!enabled && (
        <div className="settings-alert as-alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          Approvals are currently off overall. You can still pre-configure the checklist below, but none of these
          actions will require review until Approvals is switched back on.
        </div>
      )}

      {/* ── Per-action checklist, grouped by module ── */}
      <div className={`as-groups${!enabled ? ' is-disabled' : ''}`}>
        {Object.keys(groups).map(moduleName => (
          <div className="as-group" key={moduleName}>
            <div className="as-group-h">{moduleName}</div>
            <div className="settings-checks as-checks">
              {groups[moduleName].map(item => (
                <label className="settings-check" key={item.key}>
                  <input
                    type="checkbox"
                    checked={!!actionTypeEnabled[item.key]}
                    disabled={!enabled}
                    onChange={() => toggleAction(item.key)}
                  />
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i> {item.label}
                  {ACTION_DESCRIPTIONS[item.key] && (
                    <Tooltip text={ACTION_DESCRIPTIONS[item.key]}>
                      <i className="fa-solid fa-circle-info as-info" aria-hidden="true" onClick={(e) => e.preventDefault()}></i>
                    </Tooltip>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="as-footer">
        <button
          type="button"
          className="settings-btn settings-btn-primary"
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          {saving
            ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving…</>
            : <><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Changes</>}
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Local CSS — only the bits SETTINGS_CSS doesn't already cover
   (master toggle switch + module grouping).
   ═══════════════════════════════════════════════════════════════════ */
const AS_CSS = `
.as-card {
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.as-card-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.as-card-text { flex: 1; min-width: 0; }
.as-card-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--st-font);
  font-size: 14.5px;
  font-weight: 800;
  color: var(--text-primary, #0F172A);
  letter-spacing: -.01em;
}

/* Info icon — sits next to a toggle/checkbox label, shows details on hover via Tooltip */
.as-info {
  font-size: 12px;
  color: var(--text-muted, #94A3B8);
  cursor: help;
  transition: color .15s ease;
}
.as-info:hover { color: #1E40AF; }
[data-theme="dark"] .as-info:hover { color: #93C5FD; }
.as-card-sub {
  font-family: var(--st-font);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #64748B);
  line-height: 1.5;
  margin-top: 4px;
  max-width: 640px;
}

/* Toggle switch */
.as-toggle { position: relative; display: inline-flex; flex-shrink: 0; cursor: pointer; }
.as-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.as-toggle-track {
  width: 46px; height: 26px;
  background: #CBD5E1;
  border-radius: 999px;
  display: inline-block;
  position: relative;
  transition: background .2s ease;
}
[data-theme="dark"] .as-toggle-track { background: rgba(255,255,255,.16); }
.as-toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 20px; height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .3);
  transition: transform .2s ease;
}
.as-toggle input:checked + .as-toggle-track { background: linear-gradient(135deg, #1E3A8A, #2563EB); }
.as-toggle input:checked + .as-toggle-track .as-toggle-thumb { transform: translateX(20px); }
.as-toggle input:focus-visible + .as-toggle-track { box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }

.as-alert { margin-bottom: 14px; }

.as-groups { display: flex; flex-direction: column; gap: 14px; transition: opacity .15s ease; }
.as-groups.is-disabled { opacity: .55; }
.as-group-h {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted, #64748B);
  margin-bottom: 8px;
}
.as-checks .settings-check i { color: #1E40AF; width: 13px; text-align: center; }
[data-theme="dark"] .as-checks .settings-check i { color: #93C5FD; }

.as-footer { display: flex; justify-content: flex-end; margin-top: 18px; }
`;
