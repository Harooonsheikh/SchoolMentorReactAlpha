import React, { useEffect, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import SessionManagement from './SessionManagement';
import SignatureManagement from './SignatureManagement';
import Networks from '../../components/Networks.jsx';
import { usePermissions } from '../../context/PermissionsContext';

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS MODULE — top-level page

   Layout:
     • Page header (gear icon + title + subtitle + Tutorial button)
     • Two-column shell: left vertical sub-tabs / right content panel
     • Sub-tabs: Academic Sessions, Signature Management, Networks
     • Default opens to Academic Sessions

   Networks pehle sidebar par apna module tha; ab wo yahin se chalta hai
   (dekhein App.js ka RETIRED_NAV). Screen wahi hai, sirf `embedded` mode
   me — apna page header nahi dikhati.

   Styling is fully self-contained via the SETTINGS_CSS template at the
   bottom of this file. Mirrors the brand-blue / Plus Jakarta Sans
   design system already used by HR / Staff Appraisals / Reports.
   ═══════════════════════════════════════════════════════════════════ */

const SETTINGS_SUBTABS = [
  { id: 'sessions',   label: 'Academic Sessions',    icon: 'fa-calendar-alt',
    desc: 'Manage academic years that drive data visibility across the ERP.' },
  { id: 'signatures', label: 'Signature Management', icon: 'fa-signature',
    desc: 'Upload authorised signatures used across reports, certificates and letters.' },
  { id: 'networks',   label: 'Networks',             icon: 'fa-circle-nodes',
    desc: 'Join school networks and manage your memberships & requests.' },
];

export default function SettingsModule({ toast = () => {} }) {
  const { can } = usePermissions();
  const [sub, setSub] = useState('sessions');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Layer 1 — only show sub-tabs the user can View. Tab labels map 1:1
     to the `can()` submenu strings ('Academic Sessions' / 'Signature Management'). */
  const visibleSubtabs = SETTINGS_SUBTABS.filter(t => can('Settings', t.label, 'View'));

  /* Snap to first visible tab if the active one is now hidden. */
  useEffect(() => {
    if (visibleSubtabs.length && !visibleSubtabs.some(t => t.id === sub)) {
      setSub(visibleSubtabs[0].id);
    }
  }, [visibleSubtabs, sub]);

  return (
    <>
      <style>{SETTINGS_CSS}</style>

      {/* Page header — same shape as HR / Staff Appraisals */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-gear"></i>
          </div>
          <div>
            <div className="page-title">Settings</div>
            <div className="page-sub">Manage global ERP configurations</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Settings module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open Settings tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* Horizontal tab bar — same shape as hr-tabs / apr-subtabs */}
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {visibleSubtabs.map(t => (
          <Tooltip key={t.id} text={t.desc} placement="bottom">
            <button
              type="button"
              className={`settings-tab${sub === t.id ? ' on' : ''}`}
              role="tab"
              aria-selected={sub === t.id}
              tabIndex={sub === t.id ? 0 : -1}
              onClick={() => setSub(t.id)}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Tab content — full width below */}
      <div role="tabpanel">
        {sub === 'sessions'   && <SessionManagement   toast={toast} />}
        {sub === 'signatures' && <SignatureManagement toast={toast} />}
        {sub === 'networks'   && <Networks            toast={toast} embedded />}
      </div>

      <TutorialModal
        open={tutorialOpen}
        moduleKey="settings"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — covers shell, banners, stats, filters, tables,
   modals, forms, badges. Settings prefix to avoid leakage.
   ═══════════════════════════════════════════════════════════════════ */
const SETTINGS_CSS = `
:root {
  --st-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
}

/* ─── Top horizontal tab bar — mirrors hr-tabs / apr-subtabs ─── */
.settings-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  margin-bottom: 18px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, .04));
}
.settings-tab {
  flex: 1; min-width: 160px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 14px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md, 12px);
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #64748B);
  cursor: pointer;
  transition: all .2s ease;
}
.settings-tab:hover:not(.on) {
  background: var(--bg-muted, #F8FAFF);
  color: var(--brand-primary, #1E40AF);
}
.settings-tab.on {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .4), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.settings-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .25);
}
.settings-tab i { font-size: 12px; }
[data-theme="dark"] .settings-tabs { background: var(--bg-card, #0F172A); }
[data-theme="dark"] .settings-tab:focus-visible { box-shadow: 0 0 0 3px rgba(59, 130, 246, .32); }

/* ─── Info banner ─── */
.settings-banner {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.settings-banner-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.settings-banner-body {
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.55;
}
.settings-banner-body b { font-weight: 700; color: #0F172A; }

/* ─── Stat cards ─── */
.settings-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.settings-stat {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .2s ease;
}
[data-theme="dark"] .settings-stat {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.settings-stat:hover {
  border-color: #CBD5E1;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, .06);
}
.settings-stat-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  margin-bottom: 6px;
}
.settings-stat--blue   .settings-stat-ic { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.settings-stat--green  .settings-stat-ic { background: rgba(21, 128, 61, .12); color: #15803D; }
.settings-stat--gray   .settings-stat-ic { background: rgba(100, 116, 139, .12); color: #475569; }
.settings-stat--amber  .settings-stat-ic { background: rgba(217, 119, 6, .12); color: #92400E; }
.settings-stat-lbl {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.settings-stat-val {
  font-family: var(--st-font);
  font-size: 22px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin: 2px 0;
}
[data-theme="dark"] .settings-stat-val { color: var(--text-primary, #E2E8F0); }
.settings-stat-sub {
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.3;
}

/* ─── Filter bar ─── */
.settings-filters {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.settings-search {
  position: relative;
  display: flex;
  align-items: center;
}
.settings-search-ic {
  position: absolute;
  left: 13px;
  color: #94A3B8;
  font-size: 12px;
  pointer-events: none;
}
.settings-search-input {
  width: 100%;
  height: 38px;
  padding: 0 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background: #fff;
  color: #0F172A;
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 500;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-search-input { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.settings-search-input::placeholder { color: #94A3B8; }
.settings-search-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .12);
}
.settings-search-clear {
  position: absolute;
  right: 7px;
  width: 24px; height: 24px;
  border: none;
  background: #F1F5F9;
  border-radius: 6px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all .15s ease;
}
.settings-search-clear:hover { background: #E2E8F0; color: #0F172A; }
.settings-select {
  height: 38px;
  padding: 0 30px 0 12px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  color: #0F172A;
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-select { background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.settings-select:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }

/* ─── Buttons ─── */
.settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -.005em;
  cursor: pointer;
  transition: all .18s ease;
  white-space: nowrap;
}
.settings-btn i { font-size: 11px; }
.settings-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.settings-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}
.settings-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 58, 138, .38);
}
.settings-btn-primary:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; box-shadow: none; }
.settings-btn-ghost {
  background: #fff;
  color: #1E293B;
  border-color: #E2E8F0;
}
[data-theme="dark"] .settings-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.settings-btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }
.settings-btn-danger {
  background: linear-gradient(135deg, #B91C1C, #DC2626);
  color: #fff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, .28);
}
.settings-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(220, 38, 38, .38); }

/* ─── Table ─── */
.settings-table {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
[data-theme="dark"] .settings-table { background: var(--bg-card); border-color: var(--border-light); }
.settings-table-head {
  display: grid;
  gap: 12px;
  padding: 12px 16px;
  background: #F8FAFF;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--st-font);
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
[data-theme="dark"] .settings-table-head { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.settings-table-head .th.c { text-align: center; }
.settings-table-head .th.r { text-align: right; }
.settings-table-row {
  display: grid;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #F1F5F9;
  min-height: 60px;
  transition: background .15s ease;
}
[data-theme="dark"] .settings-table-row { border-color: var(--border-light); }
.settings-table-row:last-child { border-bottom: none; }
.settings-table-row:hover { background: #FAFBFF; }
[data-theme="dark"] .settings-table-row:hover { background: rgba(255,255,255,.03); }
.settings-table-row .td.c { text-align: center; display: flex; align-items: center; justify-content: center; }
.settings-table-row .td.r { text-align: right; }

/* Avatar + name cell */
.settings-emp { display: flex; align-items: center; gap: 11px; min-width: 0; }
.settings-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .02em;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(30, 64, 175, .2);
}
.settings-emp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.settings-emp-name {
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-theme="dark"] .settings-emp-name { color: var(--text-primary, #E2E8F0); }
.settings-emp-meta {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.2;
}

/* ─── Badges ─── */
.settings-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .02em;
  line-height: 1;
  white-space: nowrap;
}
.settings-badge i { font-size: 9px; }
.settings-badge--green { background: rgba(21, 128, 61, .12); color: #15803D; }
.settings-badge--blue  { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.settings-badge--gray  { background: rgba(100, 116, 139, .12); color: #475569; }
.settings-badge--amber { background: rgba(217, 119, 6, .12); color: #92400E; }
.settings-badge--red   { background: rgba(220, 38, 38, .12); color: #B91C1C; }
[data-theme="dark"] .settings-badge--green { background: rgba(34, 197, 94, .18);  color: #4ADE80; }
[data-theme="dark"] .settings-badge--blue  { background: rgba(59, 130, 246, .2);  color: #93C5FD; }
[data-theme="dark"] .settings-badge--gray  { background: rgba(148, 163, 184, .18); color: #CBD5E1; }
[data-theme="dark"] .settings-badge--amber { background: rgba(217, 119, 6, .22);  color: #FCD34D; }
[data-theme="dark"] .settings-badge--red   { background: rgba(248, 113, 113, .2); color: #FCA5A5; }

/* ─── Action icon buttons ─── */
.settings-actions { display: inline-flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.settings-act {
  width: 30px; height: 30px;
  border: 1px solid #E2E8F0;
  background: #fff;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all .15s ease;
  font-size: 12px;
}
[data-theme="dark"] .settings-act { background: var(--bg-card); border-color: var(--border-light); }
.settings-act:hover { border-color: #1E40AF; color: #1E40AF; background: rgba(30, 64, 175, .04); }
.settings-act:disabled { opacity: .4; cursor: not-allowed; }
.settings-act:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }
.settings-act--danger:hover { border-color: #DC2626; color: #DC2626; background: rgba(220, 38, 38, .04); }
.settings-act--danger:focus-visible { box-shadow: 0 0 0 3px rgba(220, 38, 38, .25); }

/* ─── Empty state ─── */
.settings-empty {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border: 1.5px dashed #CBD5E1;
  border-radius: 14px;
}
[data-theme="dark"] .settings-empty { background: var(--bg-card); border-color: var(--border-light); }
.settings-empty-ic {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .04));
  color: #1E40AF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.settings-empty-title {
  font-family: var(--st-font);
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
[data-theme="dark"] .settings-empty-title { color: var(--text-primary); }
.settings-empty-sub {
  font-family: var(--st-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.5;
  margin: 6px auto 0;
  max-width: 460px;
}

/* ─── Modal ─── */
.settings-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: stFade .14s ease-out;
}
@keyframes stFade { from { opacity: 0; } to { opacity: 1; } }
.settings-modal {
  width: min(680px, 100%);
  max-height: 92vh;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--st-font);
  animation: stPop .18s cubic-bezier(.2, .8, .2, 1);
}
[data-theme="dark"] .settings-modal { background: var(--bg-card, #0F172A); }
.settings-modal--lg { width: min(820px, 100%); }
.settings-modal--sm { width: min(460px, 100%); border-radius: 18px; }
@keyframes stPop {
  from { transform: translateY(8px) scale(.985); opacity: 0; }
  to   { transform: translateY(0)   scale(1);    opacity: 1; }
}
.settings-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.settings-modal-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.settings-modal-icn {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.settings-modal-title {
  font-family: var(--st-font);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.01em;
  line-height: 1.2;
}
.settings-modal-sub {
  font-family: var(--st-font);
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, .8);
  margin-top: 3px;
}
.settings-modal-x {
  width: 34px; height: 34px;
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: background .15s ease;
  flex-shrink: 0;
}
.settings-modal-x:hover { background: rgba(255, 255, 255, .22); }
.settings-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}
[data-theme="dark"] .settings-modal-body { background: rgba(255,255,255,.03); }
.settings-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0;
}
[data-theme="dark"] .settings-modal-foot { background: var(--bg-card); border-color: var(--border-light); }
.settings-modal-foot--split { justify-content: space-between; align-items: center; }
.settings-modal-foot--center { justify-content: center; gap: 12px; }

/* ─── Form fields ─── */
.settings-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.settings-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.settings-field.span2 { grid-column: span 2; }
.settings-field > label {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
  line-height: 1;
}
.settings-field-req { color: #DC2626; margin-left: 3px; }
.settings-field-helper {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.4;
  margin-top: -2px;
}
.settings-input,
select.settings-input {
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 500;
  color: #0F172A;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-input,
[data-theme="dark"] select.settings-input { background: var(--bg-card); color: var(--text-primary); }
select.settings-input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}
.settings-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .1);
}
.settings-input.has-error { border-color: #DC2626; }
.settings-input.has-error:focus { box-shadow: 0 0 0 3px rgba(220, 38, 38, .14); }
.settings-textarea {
  min-height: 76px;
  padding: 10px 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 500;
  color: #0F172A;
  line-height: 1.5;
  resize: vertical;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-textarea { background: var(--bg-card); color: var(--text-primary); }
.settings-textarea:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .1);
}
.settings-field-err {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 700;
  color: #DC2626;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.settings-field-err i { font-size: 10px; }

/* ─── Checkbox grid ─── */
.settings-checks-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.settings-checks-toggle {
  background: none;
  border: none;
  color: #1E40AF;
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background .15s ease;
}
.settings-checks-toggle:hover { background: rgba(30, 64, 175, .08); }
.settings-checks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
}
[data-theme="dark"] .settings-checks { background: var(--bg-card); border-color: var(--border-light); }
.settings-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  font-family: var(--st-font);
  font-size: 12.5px;
  font-weight: 600;
  color: #1E3A5F;
  line-height: 1.3;
  user-select: none;
}
[data-theme="dark"] .settings-check { color: var(--text-secondary, #BFDBFE); }
.settings-check input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border: 2px solid #CBD5E1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-check input[type="checkbox"] { background: var(--bg-card); border-color: var(--border-light); }
.settings-check input[type="checkbox"]:checked {
  background: #1E40AF;
  border-color: #1E40AF;
}
.settings-check input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px; top: 0;
  width: 5px; height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* ─── Footer helper note ─── */
.settings-foot-note {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #EFF6FF;
  border-radius: 8px;
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #1E40AF;
  line-height: 1.4;
}
.settings-foot-note i { font-size: 11px; }

/* ─── Helper alert in form (amber) ─── */
.settings-alert {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 13px;
  background: #FFF7ED;
  border: 1px solid #FED7AA;
  border-radius: 10px;
  font-family: var(--st-font);
  font-size: 12px;
  font-weight: 600;
  color: #92400E;
  line-height: 1.5;
}
.settings-alert i { color: #D97706; font-size: 13px; margin-top: 1px; flex-shrink: 0; }
[data-theme="dark"] .settings-alert { background: rgba(217, 119, 6, .12); border-color: rgba(217, 119, 6, .35); color: #FCD34D; }
[data-theme="dark"] .settings-alert i { color: #FCD34D; }
[data-theme="dark"] .settings-foot-note { background: rgba(59, 130, 246, .14); color: #93C5FD; }
[data-theme="dark"] .settings-banner { background: linear-gradient(135deg, rgba(30, 64, 175, .25) 0%, rgba(30, 58, 138, .35) 100%); border-color: rgba(59, 130, 246, .3); }
[data-theme="dark"] .settings-banner-body { color: #DBEAFE; }
[data-theme="dark"] .settings-banner-body b { color: #fff; }
[data-theme="dark"] .settings-search-clear { background: rgba(255,255,255,.06); color: var(--text-secondary, #CBD5E1); }
[data-theme="dark"] .settings-search-clear:hover { background: rgba(255,255,255,.12); color: var(--text-primary, #fff); }
[data-theme="dark"] .settings-emp-meta { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-empty-sub { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-stat-sub { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-stat-lbl { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .settings-btn-ghost:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.18); color: #93C5FD; }
[data-theme="dark"] .settings-act:hover { background: rgba(30,64,175,.18); color: #93C5FD; border-color: rgba(30,64,175,.5); }
[data-theme="dark"] .settings-act--danger:hover { background: rgba(220,38,38,.16); color: #FCA5A5; border-color: rgba(220,38,38,.5); }
[data-theme="dark"] .settings-checks-toggle { color: #93C5FD; }
[data-theme="dark"] .settings-checks-toggle:hover { background: rgba(30,64,175,.18); }
[data-theme="dark"] .settings-confirm-text { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-confirm-text b { color: var(--text-primary, #E2E8F0); }
[data-theme="dark"] .settings-upload-meta { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-upload-sub { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-upload-title { color: #BFDBFE; }
[data-theme="dark"] .settings-upload:hover { background: rgba(59,130,246,.08); border-color: rgba(59,130,246,.45); }
[data-theme="dark"] .settings-upload-remove { color: #FCA5A5; }
[data-theme="dark"] .settings-upload-remove:hover { background: rgba(220,38,38,.16); }
[data-theme="dark"] .settings-field-helper { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-field > label { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-meta-lbl { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .settings-meta-val em { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .settings-details-sub { color: var(--text-secondary, #94A3B8); }
[data-theme="dark"] .settings-timeline-h { color: var(--text-muted, #94A3B8); }
[data-theme="dark"] .settings-timeline-labels { color: var(--text-secondary, #CBD5E1); }
[data-theme="dark"] .settings-timeline-labels span:nth-child(2) { color: #93C5FD; }
[data-theme="dark"] .settings-search-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(96,130,246,.18); }
[data-theme="dark"] .settings-select:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(96,130,246,.18); }
[data-theme="dark"] .settings-input:focus,
[data-theme="dark"] .settings-textarea:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(96,130,246,.18); }

/* ─── Module / Document chips ─── */
.settings-chip-list { display: flex; flex-wrap: wrap; gap: 5px; }
.settings-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(30, 64, 175, .1);
  color: #1E40AF;
  border-radius: 999px;
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
}
.settings-chip i { font-size: 9px; opacity: .85; }
[data-theme="dark"] .settings-chip { background: rgba(59, 130, 246, .2); color: #93C5FD; }

/* ─── Image preview (signatures) ─── */
.settings-sig-preview {
  width: 80px; height: 30px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--st-font);
  font-size: 9px;
  font-weight: 600;
  color: #94A3B8;
}
.settings-sig-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }

/* ─── Upload zone (signatures) ─── */
.settings-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 2px dashed #BFDBFE;
  border-radius: 12px;
  background: #F8FAFF;
  cursor: pointer;
  transition: all .15s ease;
}
[data-theme="dark"] .settings-upload { background: rgba(255,255,255,.02); }
.settings-upload:hover { border-color: #1E40AF; background: #EFF6FF; }
.settings-upload-ic {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .25);
}
.settings-upload-title {
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 800;
  color: #1E3A8A;
}
.settings-upload-sub {
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
}
.settings-upload-result {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
}
[data-theme="dark"] .settings-upload-result { background: var(--bg-card); border-color: var(--border-light); }
.settings-upload-thumb {
  width: 120px;
  height: 50px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.settings-upload-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
[data-theme="dark"] .settings-upload-thumb { background: var(--bg-card); border-color: var(--border-light); }
.settings-upload-info { flex: 1; min-width: 0; }
.settings-upload-name {
  font-family: var(--st-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
}
[data-theme="dark"] .settings-upload-name { color: var(--text-primary); }
.settings-upload-meta {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  margin-top: 2px;
}
.settings-upload-remove {
  background: none;
  border: none;
  color: #DC2626;
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background .15s ease;
}
.settings-upload-remove:hover { background: #FEF2F2; }

/* ─── Confirm dialog ─── */
.settings-confirm-ic {
  width: 64px; height: 64px;
  margin: 0 auto 14px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.settings-confirm-ic--blue { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.settings-confirm-ic--red  { background: rgba(220, 38, 38, .12); color: #DC2626; }
.settings-confirm-body {
  text-align: center;
  padding: 28px 28px 16px;
  background: #fff;
}
[data-theme="dark"] .settings-confirm-body { background: var(--bg-card); }
.settings-confirm-title {
  font-family: var(--st-font);
  font-size: 17px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  margin-bottom: 10px;
}
[data-theme="dark"] .settings-confirm-title { color: var(--text-primary); }
.settings-confirm-text {
  font-family: var(--st-font);
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  line-height: 1.55;
}
.settings-confirm-text b { color: #0F172A; font-weight: 700; }

/* ─── Session details modal — timeline ─── */
.settings-details-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
[data-theme="dark"] .settings-details-head { background: linear-gradient(135deg, rgba(30, 64, 175, .25), rgba(30, 58, 138, .35)); border-color: rgba(59, 130, 246, .3); }
.settings-details-title {
  font-family: var(--st-font);
  font-size: 18px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
[data-theme="dark"] .settings-details-title { color: var(--text-primary); }
.settings-details-sub {
  font-family: var(--st-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  margin-top: 3px;
}
.settings-timeline {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 18px 18px 14px;
  margin-bottom: 14px;
}
[data-theme="dark"] .settings-timeline { background: var(--bg-card); border-color: var(--border-light); }
.settings-timeline-h {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #64748B;
  margin-bottom: 12px;
}
.settings-timeline-bar {
  position: relative;
  height: 10px;
  background: #F1F5F9;
  border-radius: 999px;
  margin: 0 0 8px;
}
[data-theme="dark"] .settings-timeline-bar { background: rgba(255,255,255,.06); }
.settings-timeline-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1E3A8A, #2563EB);
  transition: width .3s ease;
}
.settings-timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  background: #fff;
  border: 3px solid #1E40AF;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(30, 64, 175, .35);
}
.settings-timeline-labels {
  display: flex;
  justify-content: space-between;
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  margin-top: 6px;
}
.settings-timeline-labels span:nth-child(2) { color: #1E40AF; }
.settings-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 16px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
[data-theme="dark"] .settings-meta-grid { background: var(--bg-card); border-color: var(--border-light); }
.settings-meta-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.settings-meta-item.span2 { grid-column: span 2; }
.settings-meta-lbl {
  font-family: var(--st-font);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #94A3B8;
  line-height: 1;
}
.settings-meta-val {
  font-family: var(--st-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
  word-break: break-word;
  line-height: 1.4;
}
[data-theme="dark"] .settings-meta-val { color: var(--text-primary); }
.settings-meta-val em { color: #64748B; font-style: italic; font-weight: 500; }

/* ─── Signature preview modal ─── */
.settings-sig-large {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  padding: 24px 40px;
  min-height: 120px;
  max-height: 200px;
  margin-bottom: 14px;
}
.settings-sig-large img { max-width: 100%; max-height: 160px; object-fit: contain; }
[data-theme="dark"] .settings-sig-large { background: var(--bg-card); border-color: var(--border-light); }
.settings-sig-large.is-empty {
  border-style: dashed;
  color: #94A3B8;
  font-family: var(--st-font);
  font-size: 12px;
  font-weight: 500;
}
.settings-sig-usage {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 14px;
}
[data-theme="dark"] .settings-sig-usage { background: rgba(59, 130, 246, .12); border-color: rgba(59, 130, 246, .3); }
[data-theme="dark"] .settings-sig-usage-h { color: #93C5FD; }
[data-theme="dark"] .settings-sig-usage-body { color: #DBEAFE; }
[data-theme="dark"] .settings-sig-preview { background: var(--bg-card); border-color: var(--border-light); }
.settings-sig-usage-h {
  font-family: var(--st-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #1E40AF;
  margin-bottom: 8px;
}
.settings-sig-usage-body {
  font-family: var(--st-font);
  font-size: 12px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.5;
}

/* ─── Responsive ─── */
@media (max-width: 1180px) {
  .settings-stats { grid-template-columns: repeat(2, 1fr); }
  .settings-filters { grid-template-columns: 1fr 160px; }
  .settings-filters > .settings-btn-primary { grid-column: span 2; justify-self: stretch; justify-content: center; }
  .settings-checks { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .page-header { flex-wrap: wrap; gap: 10px; }
  .settings-tabs { gap: 2px; }
  .settings-tab { min-width: 140px; padding: 10px 12px; font-size: 12.5px; }
  .settings-filters { grid-template-columns: 1fr; }
  .settings-filters > .settings-btn-primary { grid-column: auto; }
  .settings-table { overflow-x: auto; }
  .settings-table-head,
  .settings-table-row { min-width: 760px; }
  .settings-modal-foot { flex-wrap: wrap; }
  .settings-modal-foot--split { flex-direction: column; align-items: stretch; }
  .settings-modal-foot--split > div { justify-content: flex-end; }
  .settings-details-head { flex-wrap: wrap; gap: 10px; }
}
@media (max-width: 720px) {
  .settings-stats { grid-template-columns: 1fr; }
  .settings-form-grid { grid-template-columns: 1fr; }
  .settings-field.span2 { grid-column: span 1; }
  .settings-meta-grid { grid-template-columns: 1fr; }
  .settings-meta-item.span2 { grid-column: span 1; }
  .settings-checks { grid-template-columns: 1fr; }
  .settings-tab { min-width: 100%; flex-basis: 100%; }
  .settings-modal-back { padding: 0; }
  .settings-modal { max-height: 100vh; border-radius: 0; }
  .settings-modal--sm { border-radius: 0; }
}
@media (max-width: 600px) {
  .settings-modal { max-width: 96vw; }
  .settings-modal-head { padding: 14px 16px; gap: 10px; }
  .settings-modal-body { padding: 14px 16px; }
  .settings-modal-foot { padding: 12px 16px; flex-wrap: wrap; }
  .settings-modal-foot .settings-btn-primary,
  .settings-modal-foot .settings-btn-ghost { flex: 1 1 100%; justify-content: center; }
  .settings-modal-title { font-size: 15px; }
  .settings-modal-icn { width: 36px; height: 36px; font-size: 14px; }
  .settings-banner { grid-template-columns: 36px 1fr; padding: 12px 14px; }
  .settings-banner-ic { width: 36px; height: 36px; font-size: 13px; }
  .settings-actions { gap: 3px; flex-wrap: wrap; }
  .settings-act { width: 28px; height: 28px; font-size: 11px; }
  .settings-confirm-body { padding: 22px 18px 12px; }
  .settings-sig-large { padding: 16px 18px; min-height: 100px; }
  .settings-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .settings-tabs::-webkit-scrollbar { display: none; }
  .settings-tab {
    min-width: max-content;
    flex-basis: auto;
    flex-shrink: 0;
    white-space: nowrap;
    padding: 9px 12px;
    font-size: 12px;
  }
  .settings-stats { grid-template-columns: 1fr; gap: 10px; }
  .settings-details-head { flex-direction: column; align-items: stretch; gap: 8px; }

  /* ═══════════════════════════════════════════════════════════════════
     SETTINGS tables → compact mobile cards (Sessions + Signatures)
     The 900px rule sets .settings-table { overflow-x: auto } and forces
     .settings-table-row to min-width 760px so the desktop grid keeps
     working with horizontal scroll. We cancel both on phones and reflow
     each row into a flex-wrap card.

     Cell maps:
       Academic Sessions  (6 cells): inline grid '1.6fr 1fr 1fr 110px 130px 170px'
          1 Name+badge · 2 Start · 3 End · 4 Modules · 5 Status · 6 Actions
       Signature Mgmt    (7 cells): inline grid '1.5fr 1fr 1fr 100px 100px 100px 170px'
          1 Avatar+name · 2 Designation · 3 Title · 4 Preview ·
          5 Docs · 6 Status · 7 Actions
     ═══════════════════════════════════════════════════════════════════ */

  /* Cancel horizontal scroll + min-width */
  .settings-table { overflow-x: visible !important; }
  .settings-table-head { display: none !important; }
  .settings-table-row { min-width: 0 !important; }

  /* Card foundation — flex-wrap; cancel both CSS-grid + inline grid */
  .settings-table-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 12px 14px !important;
    min-height: 0 !important;
  }
  .settings-table-row > .td {
    padding: 0 !important;
    min-width: 0 !important;
    text-align: left !important;
  }
  .settings-table-row > .td.c { justify-content: flex-start !important; }

  /* ── Academic Sessions row (6 cells via inline '170px') ──
     Row 1: Session name + Current badge          [Status badge]
     Row 2: Start Date · End Date · Modules badge
     Row 3: 5 icon action buttons, right-aligned */
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(1) {
    order: 1; flex: 1 1 auto !important; font-weight: 700;
  }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(5) {
    order: 2; flex: 0 0 auto !important; margin-left: auto !important;
  }
  .settings-table-row[style*="170px"]:not([style*="100px"])::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(2),
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(3),
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(4) {
    order: 3; flex: 0 0 auto !important;
    font-size: 11.5px; color: var(--text-muted, #64748B);
    white-space: nowrap;
  }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(2)::before { content: "Start: "; color: var(--text-muted); margin-right: 3px; }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(3)::before { content: "End: "; color: var(--text-muted); margin-right: 3px; }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(6) {
    order: 4; flex: 1 1 100% !important; margin-top: 4px;
  }
  .settings-table-row[style*="170px"]:not([style*="100px"]) > .td:nth-of-type(6).settings-actions {
    justify-content: flex-end !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  /* ── Signature Management row (7 cells, has both '100px' AND '170px') ──
     Row 1: Avatar + Staff name + Designation                  [Status]
     Row 2: Title · Preview thumb · Docs badge
     Row 3: 4 icon action buttons, right-aligned */
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(1) {
    order: 1; flex: 1 1 auto !important;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(2) { display: none !important; }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(6) {
    order: 2; flex: 0 0 auto !important; margin-left: auto !important;
  }
  .settings-table-row[style*="100px"][style*="170px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(3) {
    order: 3; flex: 1 1 auto !important;
    font-size: 11.5px; color: var(--text-muted, #64748B);
    word-break: normal; overflow-wrap: break-word;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(4) {
    order: 4; flex: 0 0 auto !important;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(5) {
    order: 5; flex: 0 0 auto !important;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(7) {
    order: 6; flex: 1 1 100% !important; margin-top: 4px;
  }
  .settings-table-row[style*="100px"][style*="170px"] > .td:nth-of-type(7).settings-actions {
    justify-content: flex-end !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  /* Tighten inner pieces so both cards fit on phones */
  .settings-emp { gap: 9px; }
  .settings-avatar { width: 34px; height: 34px; font-size: 11px; }
  .settings-emp-name {
    font-size: 12.5px; line-height: 1.3;
    white-space: normal;             /* allow wrapping */
    word-break: normal;
    overflow-wrap: break-word;
  }
  .settings-emp-meta { font-size: 10.5px; }
  .settings-badge { font-size: 10.5px; padding: 3px 8px; }
  .settings-sig-preview {
    max-width: 80px !important;
    height: 26px !important;
    padding: 2px 6px !important;
    font-size: 10px !important;
  }
}
`;
