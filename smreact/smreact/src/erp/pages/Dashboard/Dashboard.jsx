import React, { useMemo, useState } from 'react';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import { useModules } from '../../context/ModuleContext';
import { INITIAL_USERS, INITIAL_ROLES, findRole, initialsOf } from '../UserPermissions/permissionsData';
import { CURRENT_SESSION, dashboardTypeFor } from './dashboardData';
import AdminDashboard from './AdminDashboard';
import TeacherDashboard from './TeacherDashboard';
import SystemDialogs from '../../shared/SystemDialogs';

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD SHELL — picks Admin or Teacher based on the impersonated
   user's `dashboardType`. Owns the page chrome, the module activation
   binding, and the shared design tokens (DASH_CSS).
   ═══════════════════════════════════════════════════════════════════ */
export default function Dashboard({
  toast = () => {},
  navigate = () => {},
  openActivityCalendar = () => {},
}) {
  const { isActive } = useModules();
  const [currentUserId, setCurrentUserId] = useState('u1');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const currentUser = useMemo(
    () => INITIAL_USERS.find(u => u.id === currentUserId) || INITIAL_USERS[0],
    [currentUserId]
  );
  const currentRole = useMemo(
    () => findRole(INITIAL_ROLES, currentUser.role),
    [currentUser]
  );
  const dashType = dashboardTypeFor(currentUser);

  const visibility = useMemo(() => ({
    moduleActive: (modId) => !modId || isActive(modId),
    session:      CURRENT_SESSION,
    user:         currentUser,
    role:         currentRole,
  }), [isActive, currentUser, currentRole]);

  return (
    <>
      <style>{DASH_CSS}</style>

      {/* ─── Page head ─── */}
      <div className="dash-head">
        <div className="dash-head-l">
          <div className={`dash-head-ic${dashType === 'teacher' ? ' dash-head-ic--teacher' : ''}`}>
            <i className={`fa-solid ${dashType === 'teacher' ? 'fa-chalkboard-user' : 'fa-gauge-high'}`}></i>
          </div>
          <div>
            <div className="dash-head-t">
              {dashType === 'teacher' ? 'My Workspace' : 'Command Center'}
            </div>
            <div className="dash-head-s">
              {dashType === 'teacher'
                ? `Personal dashboard scoped to ${currentUser.name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./, '').trim()}'s classes`
                : `Live operations across The Oxford System, Lahore Campus`}
            </div>
          </div>
        </div>
        <div className="dash-head-r">
          <Tooltip text={`Active academic session — ${CURRENT_SESSION.label}`}>
            <div className="dash-session">
              <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
              <span>Session {CURRENT_SESSION.label}</span>
              <span className="dash-session-days">{CURRENT_SESSION.daysLeft}d left</span>
            </div>
          </Tooltip>
          <Tooltip text="Switch perspective to another user (demo)">
            <div className="dash-impersonate">
              <span className="up-avatar dash-impersonate-av">{initialsOf(currentUser.name)}</span>
              <select
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="dash-impersonate-sel"
                aria-label="View dashboard as another user"
              >
                {INITIAL_USERS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {findRole(INITIAL_ROLES, u.role)?.name || '—'}
                  </option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </div>
          </Tooltip>
          <Tooltip text="Open Dashboard tutorials">
            <button
              className="dash-tutorial"
              onClick={() => setTutorialOpen(true)}
              aria-label="Open Dashboard tutorials"
            >
              <i className="fa-solid fa-play" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Inner dashboard */}
      {dashType === 'teacher'
        ? <TeacherDashboard visibility={visibility} toast={toast} navigate={navigate} openActivityCalendar={openActivityCalendar} />
        : <AdminDashboard   visibility={visibility} toast={toast} navigate={navigate} openActivityCalendar={openActivityCalendar} />}

      {/* ─── Demo system surfaces (slow / offline banners + server / session /
            confirm dialogs) — driven by the floating bottom-right trigger
            bar. 1:1 port of the HTML demo. */}
      <SystemDialogs toast={toast} />

      <TutorialModal
        open={tutorialOpen}
        moduleKey="dashboard"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED DASHBOARD CSS — modern SaaS treatment, premium, attractive.
   ═══════════════════════════════════════════════════════════════════ */
export const DASH_CSS = `
:root {
  --dash-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
  --dash-radius: 14px;
  --dash-radius-sm: 10px;
}
@keyframes dashFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dashRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dashPop  { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
@keyframes dashShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* ═════════ PAGE HEAD ═════════ */
.dash-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; margin-bottom: 18px; flex-wrap: wrap;
}
.dash-head-l { display: flex; align-items: center; gap: 13px; min-width: 0; }
.dash-head-ic {
  width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB);
  color: #fff; font-size: 19px;
  box-shadow: 0 8px 20px rgba(30, 58, 138, .30);
}
.dash-head-ic--teacher {
  background: linear-gradient(135deg, #6D28D9, #7C3AED, #A78BFA);
  box-shadow: 0 8px 20px rgba(124, 58, 237, .30);
}
.dash-head-t { font: 800 22px/1.05 var(--dash-font); color: var(--text-primary); letter-spacing: -0.4px; }
.dash-head-s { font: 500 12.5px/1.3 var(--dash-font); color: var(--text-muted, #64748B); margin-top: 4px; }
.dash-head-r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.dash-session {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 10px 0 12px;
  background: linear-gradient(135deg, rgba(30, 58, 138, .08), rgba(30, 64, 175, .04));
  border: 1px solid rgba(30, 64, 175, .22);
  border-radius: var(--dash-radius-sm);
  font: 700 11.5px/1 var(--dash-font); color: #1E40AF;
}
.dash-session-days { padding: 3px 8px; border-radius: 999px; background: #1E40AF; color: #fff; font-size: 10px; }
[data-theme="dark"] .dash-session { background: rgba(96, 165, 250, .08); color: #BFDBFE; }
[data-theme="dark"] .dash-session-days { background: #BFDBFE; color: #0F172A; }

.dash-impersonate {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 10px 0 4px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: var(--dash-radius-sm);
}
.dash-impersonate-av { width: 28px; height: 28px; font-size: 10px; }
.dash-impersonate-sel {
  border: none; background: transparent;
  font: 600 11.5px/1 var(--dash-font); color: var(--text-primary);
  outline: none; cursor: pointer; padding-right: 12px;
  appearance: none; -webkit-appearance: none; max-width: 220px;
}
.dash-impersonate > i { font-size: 9px; color: var(--text-muted, #94A3B8); }

.dash-tutorial {
  width: 36px; height: 36px; border-radius: var(--dash-radius-sm);
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff; border: none; cursor: pointer; font-size: 12px;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28);
  transition: all .18s;
}
.dash-tutorial:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(30, 58, 138, .38); }

/* ═════════ GREETING HERO ═════════ */
.dash-hero {
  position: relative; overflow: hidden;
  padding: 24px 28px; margin-bottom: 18px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 45%, #2563EB 100%);
  border-radius: 18px;
  color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px; flex-wrap: wrap;
  animation: dashRise .4s ease;
  box-shadow: 0 14px 36px rgba(30, 58, 138, .22);
}
.dash-hero--teacher {
  background: linear-gradient(135deg, #5B21B6 0%, #7C3AED 45%, #A78BFA 100%);
  box-shadow: 0 14px 36px rgba(124, 58, 237, .22);
}
.dash-hero::before {
  content: ''; position: absolute; top: -80px; right: -50px;
  width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.18), transparent 70%);
  pointer-events: none;
}
.dash-hero::after {
  content: ''; position: absolute; bottom: -70px; left: 15%;
  width: 220px; height: 220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 165, 250, .25), transparent 65%);
  pointer-events: none;
}
.dash-hero--teacher::after {
  background: radial-gradient(circle, rgba(167, 139, 250, .35), transparent 65%);
}
.dash-hero-l { position: relative; z-index: 1; min-width: 0; max-width: 620px; }
.dash-hero-greet {
  font: 800 28px/1.1 var(--dash-font); letter-spacing: -0.6px;
  margin-bottom: 6px;
}
.dash-hero-wave { display: inline-block; transform: rotate(-12deg); margin-right: 4px; }
.dash-hero-sub { font: 500 13px/1.55 var(--dash-font); color: rgba(255,255,255,.88); }
.dash-hero-sub b { color: #fff; font-weight: 800; }
.dash-hero-r {
  position: relative; z-index: 1;
  display: flex; gap: 28px; flex-wrap: wrap;
}
.dash-hero-stat { text-align: right; }
.dash-hero-stat-val { font: 800 30px/1 var(--dash-font); letter-spacing: -0.8px; }
.dash-hero-stat-val small { font-size: 18px; opacity: .6; font-weight: 700; }
.dash-hero-stat-lbl {
  font: 800 10px/1 var(--dash-font); color: rgba(255,255,255,.8);
  text-transform: uppercase; letter-spacing: .8px;
  margin-top: 6px;
}

/* ═════════ SECTION ═════════ */
.dash-sec { margin-bottom: 18px; animation: dashFade .3s ease; }
.dash-sec-h {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.dash-sec-title {
  display: inline-flex; align-items: center; gap: 8px;
  font: 800 15px/1.2 var(--dash-font); color: var(--text-primary); letter-spacing: -0.2px;
}
.dash-sec-title i { color: #1E40AF; font-size: 13px; }
[data-theme="dark"] .dash-sec-title i { color: #93C5FD; }
.dash-sec-sub { font: 500 11.5px/1.3 var(--dash-font); color: var(--text-muted, #64748B); }
.dash-sec-sub b { color: var(--text-primary); font-weight: 700; }
.dash-sec-link {
  display: inline-flex; align-items: center; gap: 4px;
  font: 700 11px/1 var(--dash-font); color: #1E40AF;
  background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: background .15s;
}
.dash-sec-link:hover { background: rgba(30, 64, 175, .08); }
[data-theme="dark"] .dash-sec-link { color: #93C5FD; }
[data-theme="dark"] .dash-sec-link:hover { background: rgba(96, 165, 250, .14); }
.dash-sec-link i { font-size: 9px; transition: transform .2s; }
.dash-sec-link:hover i { transform: translateX(2px); }

/* ═════════ PRIORITY CARDS (top-attention strip) ═════════ */
.dash-priority {
  display: grid; gap: 12px; margin-bottom: 18px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.dash-pri {
  position: relative; overflow: hidden;
  padding: 18px;
  border-radius: var(--dash-radius);
  cursor: pointer;
  transition: all .22s;
  animation: dashRise .4s ease;
}
.dash-pri:hover { transform: translateY(-3px); }
.dash-pri--red    { background: linear-gradient(135deg, #B91C1C 0%, #DC2626 100%);  color: #fff; box-shadow: 0 8px 24px rgba(220, 38, 38, .26); }
.dash-pri--amber  { background: linear-gradient(135deg, #B45309 0%, #D97706 100%);  color: #fff; box-shadow: 0 8px 24px rgba(217, 119, 6, .26); }
.dash-pri--blue   { background: linear-gradient(135deg, #1E40AF 0%, #2563EB 100%);  color: #fff; box-shadow: 0 8px 24px rgba(30, 64, 175, .26); }
.dash-pri--purple { background: linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%);  color: #fff; box-shadow: 0 8px 24px rgba(124, 58, 237, .26); }
.dash-pri::before {
  content: ''; position: absolute; top: -40px; right: -40px;
  width: 140px; height: 140px; border-radius: 50%;
  background: rgba(255, 255, 255, .12); pointer-events: none;
}
.dash-pri-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; position: relative; z-index: 1; }
.dash-pri-ic {
  width: 38px; height: 38px; border-radius: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, .22); color: #fff; font-size: 15px;
}
.dash-pri-tag {
  font: 800 9.5px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .7px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(255, 255, 255, .22);
}
.dash-pri-val { font: 800 42px/1 var(--dash-font); letter-spacing: -1.2px; position: relative; z-index: 1; }
.dash-pri-lbl { font: 700 12.5px/1.4 var(--dash-font); margin-top: 6px; position: relative; z-index: 1; }
.dash-pri-cta {
  display: inline-flex; align-items: center; gap: 5px;
  font: 800 10px/1 var(--dash-font); color: rgba(255, 255, 255, .92);
  margin-top: 10px; position: relative; z-index: 1;
  text-transform: uppercase; letter-spacing: .6px;
}
.dash-pri-cta i { font-size: 9px; transition: transform .2s; }
.dash-pri:hover .dash-pri-cta i { transform: translateX(4px); }

/* Expandable inline list inside a priority card (Teacher Dashboard:
   Pending Syllabus / Pending Marks cards). Toggled via .is-open. */
.dash-pri.is-open { transform: translateY(0); }
.dash-pri-list {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, .22);
  display: flex; flex-direction: column; gap: 6px;
  position: relative; z-index: 1;
  animation: dashRise .25s ease;
}
.dash-pri-list-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, .14);
  border-radius: 8px;
  font: 700 12px/1.2 var(--dash-font);
  color: #fff;
}
.dash-pri-list-row i {
  font-size: 11px; opacity: .9;
}
.dash-pri-list-cls { font-weight: 800; }
.dash-pri-list-sub {
  margin-left: auto;
  font: 600 11px/1 var(--dash-font);
  opacity: .9;
  background: rgba(255, 255, 255, .18);
  padding: 3px 8px;
  border-radius: 999px;
}
.dash-pri-list-cta {
  margin-top: 4px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, .22);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, .28);
  border-radius: 8px;
  font: 800 11px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .4px;
  cursor: pointer;
  transition: all .15s ease;
  font-family: var(--dash-font);
}
.dash-pri-list-cta:hover { background: rgba(255, 255, 255, .32); }
.dash-pri-list-cta i { font-size: 9px; transition: transform .2s; }
.dash-pri-list-cta:hover i { transform: translateX(3px); }

/* ═════════ MODULE TILE GRID ═════════ */
.dash-tiles {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
.dash-tile {
  position: relative;
  padding: 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: var(--dash-radius);
  cursor: pointer;
  transition: all .18s ease;
  animation: dashRise .35s ease;
  overflow: hidden;
}
.dash-tile::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--tile-accent, #1E40AF);
  opacity: .9;
}
.dash-tile:hover {
  transform: translateY(-2px);
  border-color: #CBD5E1;
  box-shadow: 0 12px 26px rgba(15, 23, 42, .08);
}
[data-theme="dark"] .dash-tile:hover { border-color: #2B3E66; box-shadow: 0 12px 26px rgba(0, 0, 0, .4); }
.dash-tile-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.dash-tile-ic {
  width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  background: var(--tile-soft, rgba(30, 64, 175, .12));
  color: var(--tile-accent, #1E40AF);
}
.dash-tile-lbl {
  font: 800 10.5px/1.2 var(--dash-font); color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .5px;
  flex: 1; min-width: 0;
}
.dash-tile-arrow {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, .04);
  color: var(--text-muted, #94A3B8); font-size: 9px;
  transition: all .2s;
}
.dash-tile:hover .dash-tile-arrow {
  background: var(--tile-accent, #1E40AF); color: #fff; transform: translate(2px, -2px);
}
.dash-tile-val {
  font: 800 30px/1 var(--dash-font); color: var(--text-primary);
  letter-spacing: -0.7px; margin-bottom: 8px;
}
.dash-tile-val small { font-size: 16px; opacity: .55; font-weight: 700; }
.dash-tile-meta {
  display: flex; align-items: center; gap: 6px;
  font: 600 11px/1.2 var(--dash-font); color: var(--text-muted, #64748B);
}
.dash-tile-meta-pill {
  display: inline-flex; align-items: center; gap: 3px;
  font: 800 10px/1 var(--dash-font);
  padding: 3px 7px; border-radius: 999px;
  background: var(--tile-soft); color: var(--tile-accent);
}

/* ═════════ TWO-COLUMN GRID ═════════ */
.dash-grid-2 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.dash-grid-3 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.dash-grid-43 { display: grid; gap: 14px; grid-template-columns: 1.4fr 1fr; }
@media (max-width: 900px) { .dash-grid-43 { grid-template-columns: 1fr; } }

/* ═════════ PANEL CARD ═════════ */
.dash-panel {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: var(--dash-radius);
  overflow: hidden;
  animation: dashRise .35s ease;
}
.dash-panel-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid var(--border-light, #E2E8F0);
}
.dash-panel-h-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dash-panel-h-ic {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  background: var(--panel-soft, rgba(30, 64, 175, .12));
  color: var(--panel-accent, #1E40AF);
}
.dash-panel-h-t { font: 800 13.5px/1.2 var(--dash-font); color: var(--text-primary); letter-spacing: -0.2px; }
.dash-panel-h-s { font: 500 11px/1.2 var(--dash-font); color: var(--text-muted, #64748B); margin-top: 2px; }
.dash-panel-pill {
  padding: 4px 10px; border-radius: 999px;
  font: 800 11px/1 var(--dash-font);
  background: var(--panel-soft, rgba(30, 64, 175, .12));
  color: var(--panel-accent, #1E40AF);
}
.dash-panel-body { padding: 14px 16px; }

/* ═════════ ROWS (list items) ═════════ */
.dash-rows { display: flex; flex-direction: column; gap: 0; }
.dash-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light, #F1F5F9);
  transition: background .15s;
}
.dash-row:hover { background: var(--bg-muted, #F8FAFF); }
.dash-row:first-child { border-top: none; }
.dash-row-ic {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  background: rgba(30, 64, 175, .12); color: #1E40AF;
}
.dash-row-info { flex: 1; min-width: 0; }
.dash-row-t { font: 700 12.5px/1.3 var(--dash-font); color: var(--text-primary); }
.dash-row-s { font: 500 11px/1.3 var(--dash-font); color: var(--text-muted, #64748B); margin-top: 2px; }
.dash-row-val {
  flex-shrink: 0; padding: 4px 11px; border-radius: 999px;
  font: 800 12px/1 var(--dash-font);
  background: rgba(100, 116, 139, .14); color: #475569;
}
.dash-row-val--red    { background: rgba(220, 38, 38, .12); color: #B91C1C; }
.dash-row-val--amber  { background: rgba(217, 119, 6, .14); color: #92400E; }
.dash-row-val--green  { background: rgba(21, 128, 61, .12); color: #15803D; }
.dash-row-val--blue   { background: rgba(30, 64, 175, .12); color: #1E40AF; }
.dash-row-val--purple { background: rgba(124, 58, 237, .14); color: #6D28D9; }
.dash-row-val--indigo { background: rgba(79, 70, 229, .14); color: #4338CA; }
[data-theme="dark"] .dash-row-val--red    { background: rgba(248, 113, 113, .18); color: #FCA5A5; }
[data-theme="dark"] .dash-row-val--amber  { background: rgba(245, 158, 11, .18); color: #FCD34D; }
[data-theme="dark"] .dash-row-val--green  { background: rgba(74, 222, 128, .18); color: #86EFAC; }
[data-theme="dark"] .dash-row-val--blue   { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .dash-row-val--purple { background: rgba(167, 139, 250, .18); color: #DDD6FE; }
[data-theme="dark"] .dash-row-val--indigo { background: rgba(129, 140, 248, .18); color: #C7D2FE; }

/* Donut split row (for stats like By Status) */
.dash-stat-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px dashed var(--border-light, #F1F5F9);
}
.dash-stat-row:last-child { border-bottom: none; }
.dash-stat-row-l { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.dash-stat-row-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dash-stat-row-lbl { font: 600 12px/1.2 var(--dash-font); color: var(--text-primary); }
.dash-stat-row-val {
  display: inline-flex; align-items: center; gap: 6px;
  font: 800 12.5px/1 var(--dash-font); color: var(--text-primary);
}
.dash-stat-row-mini {
  font: 600 10.5px/1 var(--dash-font); color: var(--text-muted, #64748B);
}

/* ═════════ PROGRESS BARS ═════════ */
.dash-bar { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
.dash-bar-h {
  display: flex; align-items: center; justify-content: space-between;
  font: 700 11.5px/1 var(--dash-font); color: var(--text-primary);
}
.dash-bar-val { color: var(--text-muted, #64748B); font-weight: 700; }
.dash-bar-track { position: relative; height: 8px; border-radius: 999px; background: var(--bg-muted, #F1F5F9); overflow: hidden; }
.dash-bar-fill {
  position: absolute; top: 0; left: 0; bottom: 0; border-radius: 999px;
  background: linear-gradient(90deg, var(--bar-from, #1E3A8A), var(--bar-to, #2563EB));
  transition: width .6s ease;
}

/* ═════════ FUNNEL (CRM) ═════════ */
.dash-funnel { display: flex; flex-direction: column; gap: 6px; align-items: center; padding: 8px 0; }
.dash-funnel-row {
  position: relative; width: 100%; max-width: 380px;
  padding: 11px 16px;
  color: #fff; border-radius: 10px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  font: 700 12px/1 var(--dash-font);
  transition: transform .2s;
}
.dash-funnel-row:hover { transform: scale(1.02); }
.dash-funnel-row-l { display: inline-flex; align-items: center; gap: 8px; }
.dash-funnel-row-l i { font-size: 11px; }
.dash-funnel-count { font: 800 12.5px/1 var(--dash-font); padding: 4px 11px; border-radius: 999px; background: rgba(255,255,255,.22); }
.dash-funnel-arrow { font-size: 14px; color: var(--text-muted, #94A3B8); }

/* ═════════ SCHEDULE CARD (teacher) ═════════ */
.dash-sched {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
.dash-sched-card {
  position: relative; overflow: hidden;
  padding: 14px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  transition: all .18s;
  animation: dashRise .35s ease;
}
.dash-sched-card::before {
  content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 4px;
  background: linear-gradient(180deg, #6D28D9, #7C3AED);
}
.dash-sched-card:hover { transform: translateY(-1px); border-color: #CBD5E1; box-shadow: 0 8px 18px rgba(124, 58, 237, .12); }
[data-theme="dark"] .dash-sched-card:hover { border-color: #2B3E66; box-shadow: 0 8px 18px rgba(124, 58, 237, .22); }
.dash-sched-time {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(124, 58, 237, .14); color: #6D28D9;
  font: 800 11px/1 var(--dash-font);
  margin-bottom: 10px;
}
.dash-sched-period {
  font: 800 9px/1 var(--dash-font); color: #94A3B8;
  text-transform: uppercase; letter-spacing: .6px;
  float: right; padding-top: 6px;
}
.dash-sched-cls { font: 800 15px/1.1 var(--dash-font); color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 6px; }
.dash-sched-room { font: 600 11.5px/1.2 var(--dash-font); color: var(--text-muted, #64748B); margin-bottom: 4px; }
.dash-sched-room i { margin-right: 5px; font-size: 10px; }
.dash-sched-topic { font: 600 12px/1.3 var(--dash-font); color: var(--text-secondary, #475569); margin-top: 4px; }
.dash-sched-topic i { margin-right: 5px; font-size: 10px; color: #7C3AED; }

/* ═════════ EMPTY STATES ═════════ */
.dash-empty {
  padding: 28px 22px; text-align: center;
  background: var(--bg-card, #fff);
  border: 1px dashed var(--border-light, #E2E8F0);
  border-radius: 14px;
  color: var(--text-muted, #64748B);
  font: 600 13px/1.5 var(--dash-font);
  animation: dashFade .25s ease;
}
.dash-empty i { font-size: 26px; margin-bottom: 8px; color: #94A3B8; display: block; }
.dash-empty b { color: var(--text-primary); font-weight: 800; }

/* ═════════ MICRO TILE (mini stat) ═════════ */
.dash-mini { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--bg-muted, #F8FAFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; }
.dash-mini-ic {
  width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
  background: rgba(30, 64, 175, .12); color: #1E40AF;
}
.dash-mini-info { min-width: 0; }
.dash-mini-lbl { font: 700 10px/1 var(--dash-font); color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: .5px; }
.dash-mini-val { font: 800 17px/1 var(--dash-font); color: var(--text-primary); letter-spacing: -0.3px; margin-top: 3px; }

/* ═════════ RESPONSIVE ═════════ */
@media (max-width: 900px) {
  .dash-hero { padding: 20px 22px; }
  .dash-hero-greet { font-size: 24px; }
  .dash-hero-stat-val { font-size: 24px; }
  .dash-pri-val { font-size: 36px; }
  .dash-tile-val { font-size: 26px; }
}
@media (max-width: 600px) {
  .dash-head-r { gap: 6px; }
  .dash-session-days { display: none; }
  .dash-impersonate-sel { max-width: 150px; }
  .dash-hero { flex-direction: column; align-items: flex-start; gap: 18px; }
  .dash-hero-r { gap: 16px; align-self: stretch; }
  .dash-hero-stat { text-align: left; }
  .dash-tiles { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .dash-tile-val { font-size: 22px; }
  .dash-tile { padding: 14px; }
  .dash-pri-val { font-size: 30px; }
}

/* ═════════ MOBILE RESPONSIVE — page head, picker controls, hero stack ═════════ */
@media (max-width: 600px) {
  .dash-head {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 14px;
  }
  .dash-head-l { width: 100%; gap: 10px; }
  .dash-head-ic { width: 40px; height: 40px; border-radius: 12px; font-size: 16px; }
  .dash-head-t { font-size: 18px; }
  .dash-head-s { font-size: 11.5px; }
  .dash-head-r {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
  }
  .dash-session,
  .dash-impersonate {
    flex: 1 1 auto;
    min-width: 0;
    height: 34px;
  }
  .dash-impersonate-sel {
    flex: 1 1 auto;
    max-width: none;
    width: 100%;
  }
  .dash-tutorial {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }
  .dash-hero {
    padding: 16px 16px;
    border-radius: 14px;
    gap: 14px;
  }
  .dash-hero-greet { font-size: 20px; line-height: 1.15; }
  .dash-hero-sub { font-size: 12px; }
  .dash-hero-r {
    width: 100%;
    gap: 12px;
    justify-content: flex-start;
  }
  .dash-hero-stat-val { font-size: 22px; }
  .dash-hero-stat-val small { font-size: 14px; }
  .dash-hero-stat-lbl { font-size: 9.5px; }
  .dash-sec { margin-bottom: 14px; }
  .dash-tiles { grid-template-columns: 1fr; gap: 10px; }
  .dash-grid-43 { gap: 10px; }
}
@media (max-width: 480px) {
  .dash-head-t { font-size: 16.5px; }
  .dash-hero { padding: 14px 14px; }
  .dash-hero-greet { font-size: 18px; }
  .dash-hero-r { gap: 10px; }
}
`;
