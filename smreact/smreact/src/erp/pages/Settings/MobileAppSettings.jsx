import React, { useEffect, useState } from 'react';
import * as parentAppSettingsService from '../../services/parentAppSettingsService';
import { PARENT_APP_FEATURE_META } from './parentAppFeatures';

/* ═══════════════════════════════════════════════════════════════════
   PARENTS APP SETTINGS — Settings sub-tab.

   School-level (not per-user) configuration of what parents see on the
   School Mentor mobile app. The Parent app itself has no master on/off
   switch — it is always available to parents; this screen only controls
   which individual features are visible, via a per-feature checklist.
   Deliberately kept OUT of User Permissions — User Permissions governs
   staff/admin/teacher accounts, this governs what the school exposes to
   parent accounts as a whole. Ported from School-Mentor-Front-end.

   Save Changes → POST /manage-parent-app-permission (action SAVE) via
   parentAppSettingsService; checkbox keys wahi hain jo API bhejti hai.

   Uses the shared .settings-banner / .settings-checks / .settings-check
   / .settings-btn classes mounted by SettingsModule.jsx, plus a small
   local stylesheet for the feature grouping.
   ═══════════════════════════════════════════════════════════════════ */
export default function MobileAppSettings({ toast = () => {} }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState({});
  const [saved, setSaved]     = useState({});
  /* GET se aaya row id — 0 ho to pehla SAVE naya row insert karta hai. */
  const [recordId, setRecordId] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const settings = await parentAppSettingsService.getParentAppSettings();
      setRecordId(settings.id);
      setFeatureEnabled(settings.featureEnabled);
      setSaved(settings.featureEnabled);
    } catch (e) {
      toast(e.message || 'Failed to load parents app settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(featureEnabled) !== JSON.stringify(saved);

  const toggleFeature = (key) => {
    setFeatureEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await parentAppSettingsService.saveParentAppSettings({ id: recordId, featureEnabled });
      setRecordId(result.id);
      setFeatureEnabled(result.featureEnabled);
      setSaved(result.featureEnabled);
      toast('Parents app settings saved', 'success');
    } catch (e) {
      toast(e.message || 'Failed to save parents app settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-empty">
        <div className="settings-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
        <div className="settings-empty-title">Loading parents app settings…</div>
      </div>
    );
  }

  return (
    <>
      <style>{MAS_CSS}</style>

      {/* ── Info banner ── */}
      <div className="settings-banner">
        <div className="settings-banner-ic"><i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i></div>
        <div className="settings-banner-body">
          <b>Parents App Settings</b> control what parents see on the School Mentor mobile app for this school.
          The Parent app is always available to parents — use the checklist below to manage which individual
          features they can access. This is a school-wide setting, separate from staff/teacher access managed in{' '}
          <b>User Permissions</b>.
        </div>
      </div>

      {/* ── Feature checklist ── */}
      <div className="mas-group">
        <div className="mas-group-h">Visible Features</div>
        <div className="settings-checks mas-checks">
          {Object.entries(PARENT_APP_FEATURE_META).map(([key, meta]) => (
            <label className="settings-check" key={key}>
              <input
                type="checkbox"
                checked={!!featureEnabled[key]}
                onChange={() => toggleFeature(key)}
              />
              <i className={`fa-solid ${meta.icon}`} aria-hidden="true"></i> {meta.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mas-footer">
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
   (feature grouping).
   ═══════════════════════════════════════════════════════════════════ */
const MAS_CSS = `
.mas-group-h {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted, #64748B);
  margin-bottom: 8px;
}
.mas-checks .settings-check i { color: #1E40AF; width: 13px; text-align: center; }
[data-theme="dark"] .mas-checks .settings-check i { color: #93C5FD; }

.mas-footer { display: flex; justify-content: flex-end; margin-top: 18px; }
`;
