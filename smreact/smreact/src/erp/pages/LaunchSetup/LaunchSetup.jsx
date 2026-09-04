import React, { useState } from 'react';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import { useModules } from '../../context/ModuleContext';
import { MODULE_REGISTRY } from '../../config/moduleConfig';
import { activeSessionId, NO_SESSION_MSG } from '../../../utils/apiConfig';
import { usePermissions } from '../../context/PermissionsContext';
import { LAUNCH_MENU, ACTIVATED_MODULES_SCREEN } from '../../../utils/setupPermissions';

/* ═══════════════════════════════════════════════════════════════════
   LAUNCH SETUP — first stop for a new school onboarding into the ERP.

   The page currently exposes ONE section — Activated Modules — which
   wires up the runtime module activation engine. Future onboarding
   steps (branding, classes seed, term setup, etc.) will be appended
   above this section in subsequent sprints.

   Behaviour:
     • Toggle any non-core module on/off.
     • Core-locked modules (Audit Logs / User Permissions / Settings /
       Launch Setup) render with a lock icon and cannot be disabled.
     • Enable All button resets every module to active.
     • Live summary chips show the active / inactive / core-locked
       counts in real time.
   ═══════════════════════════════════════════════════════════════════ */

const DISPLAY_GROUPS = [
  { label: 'Academics',      ids: ['academics', 'examination', 'paper_generator', 'attendance', 'timetable'] },
  { label: 'Accounts',       ids: ['fee', 'accounts', 'inventory'] },
  { label: 'Administration', ids: ['admission_crm', 'students', 'hr', 'appraisals'] },
  { label: 'School Mentor',  ids: ['school_sops', 'teacher_trainings'] },
  { label: 'Core System',    ids: ['launch_setup', 'audit_logs', 'settings', 'user_permissions'] },
];

export default function LaunchSetup({ toast = () => {} }) {
  const { moduleState, toggleModule, isActive, activateAll } = useModules();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  /* Launch Setup ▸ Activated Modules — module on/off ek configuration hai,
     is liye ye Edit (ya Settings) ki permission maangta hai. Jise ye na mile
     wo screen dekh to sakta hai magar switch nahi hila sakta. */
  const { can, canModule } = usePermissions();
  /* Module pehle, screen baad me — `can()` un modules ko allow kar deta hai jo
     permission response me hain hi nahi, jabke `canModule()` registry ke har
     module par sakht hai. Dono ka AND hi asli jawab hai. */
  const launchAllowed = canModule(LAUNCH_MENU);
  const canViewModules = launchAllowed && can(LAUNCH_MENU, ACTIVATED_MODULES_SCREEN, 'View');
  const canConfigure = launchAllowed && (
    can(LAUNCH_MENU, ACTIVATED_MODULES_SCREEN, 'Edit')
    || can(LAUNCH_MENU, ACTIVATED_MODULES_SCREEN, 'Settings')
  );

  const activeCount   = Object.values(moduleState).filter(v => v).length;
  const inactiveCount = Object.values(moduleState).filter(v => !v).length;
  const lockedCount   = MODULE_REGISTRY.filter(m => m.coreLocked).length;
  const noSession     = !activeSessionId();

  return (
    <>
      <style>{LAUNCH_CSS}</style>

      {/* Page header — same shape as every other ERP module */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-rocket"></i>
          </div>
          <div>
            <div className="page-title">Launch Setup</div>
            <div className="page-sub">Activate the modules your school has subscribed to</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Launch Setup module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open Launch Setup tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ─── No-session notice ─── */}
      {noSession && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 16px', marginBottom: 16, borderRadius: 12,
            background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.25)',
            color: '#92400E', fontSize: 13, fontWeight: 600,
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} aria-hidden="true"></i>
          <span>{NO_SESSION_MSG}. Please select an academic session before configuring setup.</span>
        </div>
      )}

      {/* Jise "Activated Modules" par View na mila ho — ho sakta hai uske paas
          Launch Setup ke doosre screens hon (School / Classes / …), jo setup app
          me khulte hain. Us soorat me yahan module grid ke bajaye saaf paighaam. */}
      {!canViewModules ? (
        <div className="ls-card">
          <div className="ls-card-body">
            <div className="ls-info">
              <i className="fa-solid fa-lock" aria-hidden="true"></i>
              <div>
                <div className="ls-info-t">Module activation is not available for your account</div>
                <div className="ls-info-s">
                  Your Launch Setup access does not include the Activated Modules screen. Use the setup
                  steps (School, Classes, Subjects, Departments, Staff, Students) that have been granted
                  to you, or ask your school administrator for access.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* ─── Activated Modules section card ─── */}
      <div className="ls-card">
        <div className="ls-card-h">
          <div className="ls-card-h-l">
            <div className="ls-card-h-ic"><i className="fa-solid fa-toggle-on" aria-hidden="true"></i></div>
            <div>
              <div className="ls-card-title">Activated Modules</div>
              <div className="ls-card-sub">
                Only activated modules appear in Navigation, User Permissions, and ERP workflows. Core modules cannot be disabled.
              </div>
            </div>
          </div>
          {canConfigure && (
            <Tooltip text="Reactivate every disabled module">
              <button
                type="button"
                className="ls-btn-ghost"
                onClick={() => { activateAll(); toast('All modules activated', 'success'); }}
              >
                <i className="fa-solid fa-check-double" aria-hidden="true"></i> Enable All
              </button>
            </Tooltip>
          )}
        </div>

        <div className="ls-card-body">
          {/* Info banner */}
          <div className="ls-info">
            <Tooltip text="More info about module activation">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            </Tooltip>
            <div>
              <div className="ls-info-t">Module Activation Controls ERP-wide Visibility</div>
              <div className="ls-info-s">
                Disabling a module hides it from the sidebar navigation, removes it from the User Permissions matrix, and suppresses its analytics from the dashboard. Enable only the modules your school has subscribed to.
              </div>
            </div>
          </div>

          {/* Summary chips */}
          <div className="ls-chips">
            <Tooltip text="Modules currently enabled">
              <span className="ls-chip ls-chip--green">
                <i className="fa-solid fa-circle-check" aria-hidden="true"></i> {activeCount} Active
              </span>
            </Tooltip>
            <Tooltip text="Modules currently disabled">
              <span className="ls-chip ls-chip--gray">
                <i className="fa-solid fa-circle-minus" aria-hidden="true"></i> {inactiveCount} Inactive
              </span>
            </Tooltip>
            <Tooltip text="Core ERP modules — always on">
              <span className="ls-chip ls-chip--blue">
                <i className="fa-solid fa-lock" aria-hidden="true"></i> {lockedCount} Core Locked
              </span>
            </Tooltip>
          </div>

          {/* Module groups */}
          {DISPLAY_GROUPS.map(group => (
            <div key={group.label} className="ls-group">
              <div className="ls-group-h">{group.label}</div>
              <div className="ls-grid">
                {group.ids.map(moduleId => {
                  const mod = MODULE_REGISTRY.find(m => m.id === moduleId);
                  if (!mod) return null;
                  const active = isActive(moduleId);
                  const locked = mod.coreLocked;

                  return (
                    <div
                      key={moduleId}
                      className={`ls-mod${active ? ' on' : ''}${locked ? ' locked' : ''}`}
                    >
                      <div className="ls-mod-l">
                        <Tooltip text={active ? `${mod.label} is active` : `${mod.label} is inactive`}>
                          <div className="ls-mod-ic">
                            <i className={`fa-solid ${mod.icon}`} aria-hidden="true"></i>
                          </div>
                        </Tooltip>
                        <div className="ls-mod-info">
                          <div className="ls-mod-name">{mod.label}</div>
                          {locked && (
                            <div className="ls-mod-meta">
                              <i className="fa-solid fa-lock" aria-hidden="true"></i> Core — always on
                            </div>
                          )}
                        </div>
                      </div>

                      {locked || !canConfigure ? (
                        <Tooltip text={locked
                          ? 'Core ERP modules cannot be disabled'
                          : 'You do not have permission to change module activation'}>
                          <div className="ls-lock-pill" aria-label="Locked">
                            <i className="fa-solid fa-lock" aria-hidden="true"></i>
                          </div>
                        </Tooltip>
                      ) : (
                        <Tooltip text={active ? `Disable ${mod.label}` : `Enable ${mod.label}`}>
                          <button
                            type="button"
                            className={`ls-switch${active ? ' on' : ''}`}
                            onClick={() => {
                              toggleModule(moduleId);
                              toast(
                                active ? `${mod.label} disabled` : `${mod.label} enabled`,
                                active ? 'info' : 'success'
                              );
                            }}
                            aria-label={active ? 'Disable module' : 'Enable module'}
                            aria-pressed={active}
                          >
                            <span className="ls-switch-knob" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Core-modules footnote */}
          <div className="ls-footnote">
            <i className="fa-solid fa-lock" aria-hidden="true"></i>
            <span>
              <strong>Core ERP modules</strong> (Audit Logs, User Permissions, Settings, Launch Setup) are always enabled and cannot be disabled.
            </span>
          </div>
        </div>
      </div>

      </>
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="launchSetup"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Self-contained CSS — ls-* prefix, dark-mode aware via design vars.
   ═══════════════════════════════════════════════════════════════════ */
const LAUNCH_CSS = `
:root { --ls-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes lsFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }

/* ─── Card shell ─── */
.ls-card {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 18px;
  animation: lsFade .25s ease;
}
.ls-card-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 16px 18px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  background: linear-gradient(135deg, rgba(30, 58, 138, .03), rgba(30, 64, 175, .015));
}
.ls-card-h-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ls-card-h-ic {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff; font-size: 16px;
}
.ls-card-title { font: 800 14px/1.2 var(--ls-font); color: var(--text-primary); }
.ls-card-sub   { font: 500 11.5px/1.4 var(--ls-font); color: var(--text-muted, #64748B); margin-top: 3px; }

/* Button — ERP ke .btn / .btn-secondary (src/erp/components/App.js) ke same. */
.ls-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 40px; padding: 0 18px;
  font-family: var(--font-body); font-size: 13px; font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  cursor: pointer; transition: var(--tr); flex-shrink: 0;
}
.ls-btn-ghost:hover { background: var(--bg-muted); }
[data-theme="dark"] .ls-btn-ghost { color: var(--text-secondary); border-color: var(--border-light); }

.ls-card-body { padding: 18px; }

/* ─── Info banner ─── */
.ls-info {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; margin-bottom: 16px;
  background: rgba(30, 64, 175, .06);
  border: 1px solid rgba(30, 64, 175, .14);
  border-left: 3px solid #1E40AF; border-radius: 10px;
}
.ls-info > i { color: #1E40AF; font-size: 14px; flex-shrink: 0; margin-top: 2px; }
.ls-info-t { font: 800 12px/1.2 var(--ls-font); color: #1E3A8A; }
.ls-info-s { font: 500 11.5px/1.5 var(--ls-font); color: var(--text-secondary, #475569); margin-top: 3px; }
[data-theme="dark"] .ls-info-t { color: #BFDBFE; }

/* ─── Summary chips ─── */
.ls-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.ls-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  font: 700 11.5px/1 var(--ls-font);
}
.ls-chip i { font-size: 11px; }
.ls-chip--green { background: rgba(21, 128, 61, .12); color: #15803D; }
.ls-chip--gray  { background: rgba(100, 116, 139, .14); color: #475569; }
.ls-chip--blue  { background: rgba(30, 64, 175, .12); color: #1E40AF; }
[data-theme="dark"] .ls-chip--green { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .ls-chip--gray  { background: rgba(148, 163, 184, .18); color: #CBD5E1; }
[data-theme="dark"] .ls-chip--blue  { background: rgba(96, 165, 250, .18); color: #BFDBFE; }

/* ─── Module group ─── */
.ls-group { margin-bottom: 22px; }
.ls-group-h {
  font: 800 10px/1 var(--ls-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .8px;
  margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
}

/* ─── Module card grid ─── */
.ls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.ls-mod {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-muted, #F8FAFF);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  transition: all .2s ease;
}
.ls-mod.on {
  background: var(--bg-card, #fff);
  border-color: rgba(30, 64, 175, .25);
  box-shadow: 0 2px 6px rgba(30, 58, 138, .08);
}
.ls-mod.locked { opacity: .92; }
.ls-mod-l { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.ls-mod-ic {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  background: rgba(100, 116, 139, .08);
  color: var(--text-muted, #64748B);
  transition: all .2s ease;
}
.ls-mod.on .ls-mod-ic {
  background: linear-gradient(135deg, rgba(30, 58, 138, .12), rgba(30, 64, 175, .08));
  color: #1E40AF;
}
.ls-mod-info { min-width: 0; }
.ls-mod-name {
  font: 700 13px/1.2 var(--ls-font);
  color: var(--text-muted, #64748B);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ls-mod.on .ls-mod-name { color: var(--text-primary); }
.ls-mod-meta {
  font: 600 10px/1.2 var(--ls-font);
  color: var(--text-muted, #94A3B8);
  margin-top: 3px;
}
.ls-mod-meta i { font-size: 9px; margin-right: 2px; }

/* ─── Lock pill (core modules) ─── */
.ls-lock-pill {
  width: 44px; height: 24px; border-radius: 12px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(30, 58, 138, .15);
  color: #1E40AF; font-size: 11px;
}
[data-theme="dark"] .ls-lock-pill { background: rgba(96, 165, 250, .18); color: #BFDBFE; }

/* ─── iOS-style toggle switch ─── */
.ls-switch {
  position: relative;
  width: 44px; height: 24px; border-radius: 12px;
  border: none; padding: 0; cursor: pointer;
  background: rgba(100, 116, 139, .25);
  transition: background .2s ease;
  flex-shrink: 0;
}
.ls-switch.on { background: linear-gradient(135deg, #1E3A8A, #1E40AF); }
.ls-switch-knob {
  position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
  transition: left .2s ease;
}
.ls-switch.on .ls-switch-knob { left: 23px; }
.ls-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }

/* ─── Footnote ─── */
.ls-footnote {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; margin-top: 4px;
  background: rgba(217, 119, 6, .05);
  border: 1px solid rgba(217, 119, 6, .22);
  border-radius: 10px;
  font: 500 11.5px/1.4 var(--ls-font); color: var(--text-secondary, #475569);
}
.ls-footnote i { color: #D97706; font-size: 13px; flex-shrink: 0; }
.ls-footnote b, .ls-footnote strong { color: var(--text-primary); font-weight: 700; }
[data-theme="dark"] .ls-footnote { background: rgba(217, 119, 6, .12); color: #FDE68A; }

/* ─── Dark-mode coverage (additive) ─── */
[data-theme="dark"] .ls-card {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .ls-card-h {
  background: linear-gradient(135deg, rgba(96, 165, 250, .06), rgba(59, 130, 246, .03));
  border-bottom-color: var(--border-light);
}
[data-theme="dark"] .ls-card-title { color: var(--text-primary); }
[data-theme="dark"] .ls-card-sub   { color: var(--text-muted); }
[data-theme="dark"] .ls-btn-ghost:hover { background: var(--bg-muted); }
[data-theme="dark"] .ls-info {
  background: rgba(96, 165, 250, .08);
  border-color: rgba(96, 165, 250, .25);
  border-left-color: #60A5FA;
}
[data-theme="dark"] .ls-info > i { color: #93C5FD; }
[data-theme="dark"] .ls-info-s { color: var(--text-secondary); }
[data-theme="dark"] .ls-group-h {
  color: var(--text-muted);
  border-bottom-color: var(--border-light);
}
[data-theme="dark"] .ls-mod {
  background: var(--bg-muted, rgba(148, 163, 184, .06));
  border-color: var(--border-light);
}
[data-theme="dark"] .ls-mod.on {
  background: var(--bg-card);
  border-color: rgba(96, 165, 250, .45);
  box-shadow: 0 2px 6px rgba(0, 0, 0, .35);
}
[data-theme="dark"] .ls-mod.locked { opacity: .85; }
[data-theme="dark"] .ls-mod-ic {
  background: rgba(148, 163, 184, .12);
  color: var(--text-muted);
}
[data-theme="dark"] .ls-mod.on .ls-mod-ic {
  background: linear-gradient(135deg, rgba(96, 165, 250, .22), rgba(59, 130, 246, .14));
  color: #BFDBFE;
}
[data-theme="dark"] .ls-mod-name { color: var(--text-muted); }
[data-theme="dark"] .ls-mod.on .ls-mod-name { color: var(--text-primary); }
[data-theme="dark"] .ls-mod-meta { color: var(--text-muted); }
[data-theme="dark"] .ls-switch { background: rgba(148, 163, 184, .35); }
[data-theme="dark"] .ls-switch.on { background: linear-gradient(135deg, #2563EB, #3B82F6); }
[data-theme="dark"] .ls-switch-knob { background: #F8FAFC; box-shadow: 0 1px 3px rgba(0, 0, 0, .55); }
[data-theme="dark"] .ls-switch:focus-visible { box-shadow: 0 0 0 3px rgba(96, 165, 250, .4); }

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .ls-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 11px; }
  .ls-card-h { flex-wrap: wrap; }
  .ls-card-body { padding: 16px; }
  .ls-chips { gap: 8px; }
}
@media (max-width: 820px) {
  .ls-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
}
@media (max-width: 700px) {
  .ls-card-h-l { gap: 10px; }
  .ls-card-h-ic { width: 36px; height: 36px; font-size: 14px; }
  .ls-group { margin-bottom: 18px; }
  .ls-mod { padding: 11px 12px; }
}
@media (max-width: 640px) {
  .ls-card-h { flex-direction: column; align-items: flex-start; gap: 10px; }
  .ls-grid { grid-template-columns: 1fr; }
  .ls-info { flex-direction: column; }
}
@media (max-width: 600px) {
  .ls-card { border-radius: 12px; margin-bottom: 14px; max-width: 96vw; }
  .ls-card-body { padding: 14px; }
  .ls-card-h { padding: 14px 14px; }
  .ls-card-title { font-size: 13.5px; }
  .ls-card-sub { font-size: 11px; }
  .ls-btn-ghost { width: 100%; justify-content: center; }
  .ls-chips { flex-wrap: wrap; }
  .ls-chip { padding: 5px 10px; font-size: 11px; }
  .ls-footnote { flex-wrap: wrap; align-items: flex-start; }
  .ls-mod-name { font-size: 12.5px; }
}
@media (max-width: 420px) {
  .ls-card-h-ic { width: 32px; height: 32px; font-size: 13px; }
  .ls-info { padding: 10px 12px; }
  .ls-info-t { font-size: 11.5px; }
  .ls-info-s { font-size: 11px; }
}

/* ═════════ MOBILE RESPONSIVE — module rows, group headers, info banner ═════════ */
@media (max-width: 600px) {
  .ls-card-h-l { width: 100%; min-width: 0; }
  .ls-card-h .ls-btn-ghost { width: 100%; }
  .ls-info { gap: 8px; padding: 10px 12px; }
  .ls-info-wrap, .ls-info > div { min-width: 0; }
  .ls-chips { gap: 6px; margin-bottom: 14px; }
  .ls-group { margin-bottom: 16px; }
  .ls-group-h { font-size: 9.5px; margin-bottom: 8px; }
  .ls-grid { gap: 10px; }
  .ls-mod {
    padding: 10px 12px;
    gap: 10px;
    border-radius: 11px;
  }
  .ls-mod-l { gap: 10px; min-width: 0; flex: 1 1 auto; }
  .ls-mod-ic { width: 32px; height: 32px; font-size: 13px; border-radius: 8px; }
  .ls-mod-info { flex: 1; min-width: 0; }
  .ls-mod-name { font-size: 12.5px; }
  .ls-mod-meta { font-size: 9.5px; }
  .ls-lock-pill,
  .ls-switch { flex-shrink: 0; }
  .ls-footnote { padding: 10px 12px; font-size: 11px; gap: 6px; }
}
@media (max-width: 420px) {
  .ls-card-body { padding: 12px; }
  .ls-mod { padding: 9px 10px; }
  .ls-mod-name { font-size: 12px; }
}
`;
