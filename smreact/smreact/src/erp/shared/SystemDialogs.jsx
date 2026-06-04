import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import { logout } from '../utils/auth';

/* ═══════════════════════════════════════════════════════════════════
   SYSTEM DIALOGS — 1:1 port from "ERP_Home Final.html".

   Renders all five demo system surfaces:
     1. Slow Internet banner       (top, amber)
     2. No Internet / Offline      (top, red, with Retry)
     3. Server Error dialog        (500, red glow)
     4. Session Timeout dialog     (amber, countdown)
     5. Are You Sure dialog        (blue, generic confirm)
     6. Floating Demo Trigger bar  (bottom-right pill)

   Public surface
   ──────────────
   Default export: <SystemDialogs toast={fn} />
   - Self-contained. Drop it once in the dashboard shell; the demo bar
     drives every surface.
   - All overlays + the trigger bar render via React Portal so parent
     overflow:hidden can never clip them.
   - Honors dark mode via the project's `[data-theme="dark"]` selector.
   - Inputs all kept simple — no business logic, mirrors the HTML demo.
   ═══════════════════════════════════════════════════════════════════ */

export default function SystemDialogs({ toast = () => {} }) {
  /* Banner visibility */
  const [showSlow,    setShowSlow]    = useState(false);
  const [showNoNet,   setShowNoNet]   = useState(false);

  /* Dialog visibility */
  const [showServer,  setShowServer]  = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showSure,    setShowSure]    = useState(false);

  /* Session countdown (seconds) */
  const [sessionSec,  setSessionSec]  = useState(300);
  const sessionTickRef = useRef(null);

  /* "Are you sure" payload */
  const [sureCfg, setSureCfg] = useState({
    title:  'Are you sure?',
    msg:    'This action cannot be undone. Please confirm you want to proceed.',
    hint:   'Once confirmed, this change will take effect immediately.',
    onConfirm: null,
  });

  /* Push <main> down while a banner is open so the page content
     never sits behind the fixed strip. The HTML reference does the
     same via .main-content padding-top. */
  useEffect(() => {
    const main = document.querySelector('.main-content');
    if (!main) return undefined;
    if (showSlow)       main.style.paddingTop = '60px';
    else if (showNoNet) main.style.paddingTop = '60px';
    else                main.style.paddingTop = '';
    return () => { if (main) main.style.paddingTop = ''; };
  }, [showSlow, showNoNet]);

  /* Esc closes any open dialog (HTML parity). */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showServer)  setShowServer(false);
      if (showSession) closeSession();
      if (showSure)    setShowSure(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showServer, showSession, showSure]);

  /* Body-scroll lock while any dialog is open. */
  useEffect(() => {
    const anyOpen = showServer || showSession || showSure;
    if (anyOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [showServer, showSession, showSure]);

  /* ── Slow / Offline banners ───────────────────────────────────── */
  const retryConnection = useCallback(() => {
    toast('Checking connection…', 'info');
    setTimeout(() => {
      setShowNoNet(false);
      toast('Connection restored!', 'success');
    }, 1800);
  }, [toast]);

  /* ── Session timeout countdown ────────────────────────────────── */
  const startSessionTimeout = useCallback((seconds = 300) => {
    setSessionSec(seconds);
    setShowSession(true);
  }, []);
  function closeSession() {
    if (sessionTickRef.current) {
      clearInterval(sessionTickRef.current);
      sessionTickRef.current = null;
    }
    setShowSession(false);
  }
  const extendSession = useCallback(() => {
    closeSession();
    toast('Session extended! You’re still signed in.', 'success');
  }, [toast]);
  const signOutNow = useCallback(() => {
    closeSession();
    toast('Signed out successfully.', 'info');
    logout();
  }, [toast]);

  useEffect(() => {
    if (!showSession) return undefined;
    if (sessionTickRef.current) clearInterval(sessionTickRef.current);
    sessionTickRef.current = setInterval(() => {
      setSessionSec((s) => {
        if (s <= 1) {
          clearInterval(sessionTickRef.current);
          sessionTickRef.current = null;
          setShowSession(false);
          toast('Session expired. Please sign in again.', 'error');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (sessionTickRef.current) {
        clearInterval(sessionTickRef.current);
        sessionTickRef.current = null;
      }
    };
  }, [showSession, toast]);

  /* ── Are You Sure helper ──────────────────────────────────────── */
  const showAreYouSure = useCallback((title, msg, hint, onConfirm) => {
    setSureCfg({
      title: title || 'Are you sure?',
      msg:   msg   || 'This action cannot be undone. Please confirm you want to proceed.',
      hint:  hint  || 'Once confirmed, this change will take effect immediately.',
      onConfirm: onConfirm || null,
    });
    setShowSure(true);
  }, []);
  const confirmAction = useCallback(() => {
    setShowSure(false);
    if (sureCfg.onConfirm) sureCfg.onConfirm();
  }, [sureCfg]);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <>
      {/* 1. Slow Internet banner */}
      {showSlow && createPortal(
        <div className="sys-banner">
          <div className="sys-banner-inner">
            <div className="sys-banner-icon sys-amber">
              <i className="fa-solid fa-wifi" aria-hidden="true"></i>
            </div>
            <div className="sys-banner-text">
              <strong>Slow Connection Detected</strong>
              <span>Your internet seems slow. Some features may load longer than usual.</span>
            </div>
            <div className="sys-banner-pulse">
              <span></span><span></span><span></span>
            </div>
            <Tooltip text="Dismiss" placement="bottom">
              <button className="sys-banner-close" onClick={() => setShowSlow(false)} aria-label="Dismiss banner">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>,
        document.body
      )}

      {/* 2. No Internet banner */}
      {showNoNet && createPortal(
        <div className="sys-banner sys-banner--red">
          <div className="sys-banner-inner">
            <div className="sys-banner-icon sys-red">
              <i className="fa-solid fa-wifi-slash" aria-hidden="true"></i>
            </div>
            <div className="sys-banner-text">
              <strong>No Internet Connection</strong>
              <span>You're offline. Please check your network and try again.</span>
            </div>
            <Tooltip text="Try reconnecting now" placement="bottom">
              <button className="sys-banner-retry" onClick={retryConnection}>
                <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Retry
              </button>
            </Tooltip>
            <Tooltip text="Dismiss" placement="bottom">
              <button className="sys-banner-close" onClick={() => setShowNoNet(false)} aria-label="Dismiss banner">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Server Error dialog */}
      {showServer && createPortal(
        <div
          className="sys-overlay open"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowServer(false); }}
          role="dialog" aria-modal="true" aria-labelledby="sysServerTitle"
        >
          <div className="sys-dialog">
            <div className="sys-dialog-glow sys-glow-red"></div>
            <div className="sys-dialog-hero">
              <div className="sys-dialog-ring sys-ring-red">
                <div className="sys-dialog-icon-wrap sys-icon-red">
                  <i className="fa-solid fa-server" aria-hidden="true"></i>
                </div>
              </div>
              <div className="sys-err-code">500</div>
            </div>
            <div className="sys-dialog-body">
              <div className="sys-dialog-title" id="sysServerTitle">Server Error</div>
              <div className="sys-dialog-msg">
                Something went wrong on our end. Our team has been notified and is working on a fix.
              </div>
              <div className="sys-dialog-detail sys-detail-red">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                <span>Error Code: <strong>INTERNAL_SERVER_ERROR</strong> · Please try again in a few moments.</span>
              </div>
            </div>
            <div className="sys-dialog-footer">
              <button
                className="sys-btn sys-btn-primary"
                onClick={() => { setShowServer(false); toast('Retrying…', 'info'); }}
              >
                <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Try Again
              </button>
              <button className="sys-btn sys-btn-ghost" onClick={() => setShowServer(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Session Timeout dialog */}
      {showSession && createPortal(
        <div className="sys-overlay open" role="dialog" aria-modal="true" aria-labelledby="sysSessionTitle">
          <div className="sys-dialog">
            <div className="sys-dialog-glow sys-glow-amber"></div>
            <div className="sys-dialog-hero">
              <div className="sys-dialog-ring sys-ring-amber">
                <div className="sys-dialog-icon-wrap sys-icon-amber">
                  <i className="fa-solid fa-clock" aria-hidden="true"></i>
                </div>
              </div>
              <div className="sys-session-timer">{fmtMMSS(sessionSec)}</div>
            </div>
            <div className="sys-dialog-body">
              <div className="sys-dialog-title" id="sysSessionTitle">Session Expiring Soon</div>
              <div className="sys-dialog-msg">
                You've been inactive for a while. For your security, your session will expire automatically.
              </div>
              <div className="sys-dialog-detail sys-detail-amber">
                <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
                <span>Your unsaved changes will be preserved. You'll need to sign in again after timeout.</span>
              </div>
            </div>
            <div className="sys-dialog-footer">
              <button className="sys-btn sys-btn-primary" onClick={extendSession}>
                <i className="fa-solid fa-rotate-right" aria-hidden="true"></i> Stay Signed In
              </button>
              <button className="sys-btn sys-btn-ghost sys-btn-danger" onClick={signOutNow}>
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Sign Out Now
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. Are You Sure dialog */}
      {showSure && createPortal(
        <div
          className="sys-overlay open"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSure(false); }}
          role="dialog" aria-modal="true" aria-labelledby="sysSureTitle"
        >
          <div className="sys-dialog sys-dialog-sm">
            <div className="sys-dialog-glow sys-glow-blue"></div>
            <div className="sys-dialog-hero">
              <div className="sys-dialog-ring sys-ring-blue">
                <div className="sys-dialog-icon-wrap sys-icon-blue">
                  <i className="fa-solid fa-circle-question" aria-hidden="true"></i>
                </div>
              </div>
            </div>
            <div className="sys-dialog-body">
              <div className="sys-dialog-title" id="sysSureTitle">{sureCfg.title}</div>
              <div className="sys-dialog-msg">{sureCfg.msg}</div>
              <div className="sys-dialog-detail sys-detail-blue">
                <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>{sureCfg.hint}</span>
              </div>
            </div>
            <div className="sys-dialog-footer">
              <button className="sys-btn sys-btn-primary" onClick={confirmAction}>
                <i className="fa-solid fa-check" aria-hidden="true"></i> Yes, Confirm
              </button>
              <button className="sys-btn sys-btn-ghost" onClick={() => setShowSure(false)}>
                <i className="fa-solid fa-xmark" aria-hidden="true"></i> Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Floating Demo Trigger bar */}
      {createPortal(
        <div className="demo-trigger-bar" role="group" aria-label="Demo system dialogs">
          <div className="demo-trigger-label">Demo Dialogs</div>
          <Tooltip text="Slow Internet" placement="top">
            <button className="demo-btn demo-btn-amber" onClick={() => setShowSlow(true)}>
              <i className="fa-solid fa-wifi" aria-hidden="true"></i> Slow
            </button>
          </Tooltip>
          <Tooltip text="No Internet" placement="top">
            <button className="demo-btn demo-btn-red" onClick={() => setShowNoNet(true)}>
              <i className="fa-solid fa-wifi-slash" aria-hidden="true"></i> Offline
            </button>
          </Tooltip>
          <Tooltip text="Server Error (500)" placement="top">
            <button className="demo-btn demo-btn-red" onClick={() => setShowServer(true)}>
              <i className="fa-solid fa-server" aria-hidden="true"></i> 500
            </button>
          </Tooltip>
          <Tooltip text="Session Timeout" placement="top">
            <button className="demo-btn demo-btn-amber" onClick={() => startSessionTimeout(300)}>
              <i className="fa-solid fa-clock" aria-hidden="true"></i> Session
            </button>
          </Tooltip>
          <Tooltip text="Are You Sure?" placement="top">
            <button
              className="demo-btn demo-btn-blue"
              onClick={() => showAreYouSure(
                'Delete Record',
                'Are you sure you want to delete this record? All associated data will be permanently removed.',
                'This action is irreversible.',
                () => toast('Record deleted', 'success'),
              )}
            >
              <i className="fa-solid fa-circle-question" aria-hidden="true"></i> Confirm
            </button>
          </Tooltip>
        </div>,
        document.body
      )}
    </>
  );
}

function fmtMMSS(total) {
  const t = Math.max(0, total | 0);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── One-time stylesheet (1:1 port of HTML's CSS) ────────────── */
if (typeof document !== 'undefined' && !document.getElementById('sys-dialog-style')) {
  const el = document.createElement('style');
  el.id = 'sys-dialog-style';
  el.textContent = `
/* ─── Top banners ─── */
.sys-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9000;
  background: linear-gradient(135deg, #FEF3C7, #FDE68A);
  border-bottom: 2px solid #F59E0B;
  animation: sysBannerSlideDown .35s cubic-bezier(.34, 1.3, .64, 1) both;
  box-shadow: 0 4px 20px rgba(245, 158, 11, .25);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.sys-banner--red {
  background: linear-gradient(135deg, #FEE2E2, #FECACA);
  border-color: #EF4444;
  box-shadow: 0 4px 20px rgba(239, 68, 68, .25);
}
@keyframes sysBannerSlideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}
.sys-banner-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
}
.sys-banner-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.sys-amber { background: rgba(245, 158, 11, .15); color: #D97706; }
.sys-red   { background: rgba(239, 68, 68, .15);  color: #DC2626; }
.sys-banner-text { flex: 1; min-width: 0; }
.sys-banner-text strong {
  display: block;
  font: 800 13px/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #92400E;
}
.sys-banner--red .sys-banner-text strong { color: #991B1B; }
.sys-banner-text span {
  font: 500 12px/1.4 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #78350F;
}
.sys-banner--red .sys-banner-text span { color: #7F1D1D; }

.sys-banner-pulse { display: flex; gap: 4px; align-items: center; }
.sys-banner-pulse span {
  width: 7px; height: 7px; border-radius: 50%; background: #D97706;
  animation: sysPulseDot 1.2s ease infinite;
}
.sys-banner-pulse span:nth-child(2) { animation-delay: .2s; }
.sys-banner-pulse span:nth-child(3) { animation-delay: .4s; }
@keyframes sysPulseDot {
  0%, 100% { opacity: .3; transform: scale(.8); }
  50%      { opacity: 1;  transform: scale(1);  }
}

.sys-banner-retry {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 999px;
  border: 1.5px solid #EF4444; background: rgba(239, 68, 68, .1);
  color: #DC2626;
  font: 700 12px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  cursor: pointer; transition: all .2s ease; flex-shrink: 0;
}
.sys-banner-retry:hover { background: rgba(239, 68, 68, .2); }

.sys-banner-close {
  width: 28px; height: 28px; border-radius: 7px; border: none;
  background: rgba(0, 0, 0, .08); color: #78350F; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; flex-shrink: 0; transition: all .15s ease;
}
.sys-banner--red .sys-banner-close { color: #7F1D1D; }
.sys-banner-close:hover { background: rgba(0, 0, 0, .16); }

/* ─── Dialog overlay ─── */
.sys-overlay {
  position: fixed; inset: 0;
  background: rgba(10, 22, 40, .60);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 8000;
  display: none; align-items: center; justify-content: center;
  padding: 20px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.sys-overlay.open { display: flex; }

.sys-dialog {
  background: var(--bg-card, #FFFFFF);
  border-radius: 24px;
  width: 100%; max-width: 400px;
  border: 1px solid var(--border-light, #E2E8F0);
  box-shadow: 0 30px 80px rgba(0, 0, 0, .20), 0 8px 24px rgba(0, 0, 0, .10);
  animation: sysDialogIn .35s cubic-bezier(.34, 1.3, .64, 1) both;
  overflow: hidden; position: relative;
  color: var(--text-primary, #0F172A);
}
.sys-dialog-sm { max-width: 360px; }
@keyframes sysDialogIn {
  from { opacity: 0; transform: scale(.88) translateY(20px); }
  to   { opacity: 1; transform: none; }
}

/* Glow top accent */
.sys-dialog-glow {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  border-radius: 24px 24px 0 0;
}
.sys-glow-red   { background: linear-gradient(90deg, #EF4444, #DC2626, #EF4444); }
.sys-glow-amber { background: linear-gradient(90deg, #F59E0B, #D97706, #F59E0B); }
.sys-glow-blue  { background: linear-gradient(90deg, #1E40AF, #1E3A8A, #1E40AF); }

/* Hero section */
.sys-dialog-hero {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 28px 10px; gap: 12px;
}

/* Spinning ring around the icon */
.sys-dialog-ring {
  position: relative; width: 80px; height: 80px;
  display: flex; align-items: center; justify-content: center;
}
.sys-dialog-ring::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid transparent;
  animation: sysRingRotate 3s linear infinite;
  opacity: .5;
}
.sys-ring-red::before   { border-top-color: #EF4444; border-right-color: #EF4444; }
.sys-ring-amber::before { border-top-color: #F59E0B; border-right-color: #F59E0B; }
.sys-ring-blue::before  { border-top-color: #1E40AF; border-right-color: #1E40AF; }
@keyframes sysRingRotate { to { transform: rotate(360deg); } }

.sys-dialog-icon-wrap {
  width: 60px; height: 60px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; position: relative; z-index: 1;
}
.sys-icon-red   { background: linear-gradient(135deg, #FEE2E2, #FECACA); color: #DC2626; box-shadow: 0 8px 24px rgba(220, 38, 38, .25); }
.sys-icon-amber { background: linear-gradient(135deg, #FEF3C7, #FDE68A); color: #D97706; box-shadow: 0 8px 24px rgba(245, 158, 11, .25); }
.sys-icon-blue  { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); color: #1E40AF; box-shadow: 0 8px 24px rgba(30,  58, 138, .25); }

/* Error code badge */
.sys-err-code {
  font: 800 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  letter-spacing: 1px;
  color: #DC2626;
  background: rgba(220, 38, 38, .08);
  border: 1px solid rgba(220, 38, 38, .20);
  padding: 3px 12px; border-radius: 999px;
}

/* Session countdown */
.sys-session-timer {
  font: 800 28px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #D97706;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
  animation: sysTimerPulse 1s ease infinite;
}
@keyframes sysTimerPulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }

/* Body */
.sys-dialog-body { padding: 16px 28px 8px; text-align: center; }
.sys-dialog-title {
  font: 800 20px/1.3 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary, #0F172A);
  margin-bottom: 10px;
  letter-spacing: -.02em;
}
.sys-dialog-msg {
  font: 500 13.5px/1.75 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  margin-bottom: 14px;
}

.sys-dialog-detail {
  display: flex; align-items: flex-start; gap: 9px; text-align: left;
  padding: 11px 14px; border-radius: 12px;
  font: 600 12px/1.5 'Plus Jakarta Sans', system-ui, sans-serif;
}
.sys-dialog-detail i { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.sys-detail-red   { background: rgba(220, 38, 38, .05);  border: 1px solid rgba(220, 38, 38, .15); color: #991B1B; }
.sys-detail-red i { color: #DC2626; }
.sys-detail-amber { background: rgba(245, 158, 11, .05); border: 1px solid rgba(245, 158, 11, .18); color: #78350F; }
.sys-detail-amber i { color: #D97706; }
.sys-detail-blue  { background: rgba(30,  58, 138, .05); border: 1px solid rgba(30,  58, 138, .15); color: #1E3A8A; }
.sys-detail-blue  i { color: #1E40AF; }

/* Footer */
.sys-dialog-footer {
  display: flex; flex-direction: column; gap: 8px;
  padding: 20px 28px 28px;
}
.sys-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px 20px; border-radius: 12px;
  font: 700 14px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  cursor: pointer; border: none;
  transition: all .2s cubic-bezier(.4, 0, .2, 1);
  letter-spacing: .01em;
}
.sys-btn-primary {
  background: linear-gradient(135deg, #1D4ED8, #1E3A8A);
  color: #fff;
  box-shadow: 0 4px 14px rgba(30, 58, 138, .35), inset 0 1px 0 rgba(255, 255, 255, .20);
}
.sys-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(30, 58, 138, .50);
}
.sys-btn-ghost {
  background: transparent;
  border: 1.5px solid var(--border-light, #E2E8F0);
  color: var(--text-muted, #64748B);
}
.sys-btn-ghost:hover {
  background: var(--bg-muted, #F1F5F9);
  border-color: var(--border-med, #93C5FD);
  color: var(--text-primary, #0F172A);
}
.sys-btn-danger { border-color: rgba(220, 38, 38, .25); color: #DC2626; }
.sys-btn-danger:hover { background: rgba(220, 38, 38, .06); border-color: #DC2626; }
.sys-btn:active { transform: scale(.97) translateY(0) !important; }

/* ─── Demo trigger bar ─── */
.demo-trigger-bar {
  position: fixed; bottom: 20px; right: 20px; z-index: 7000;
  display: flex; align-items: center; gap: 6px;
  background: var(--bg-card, #FFFFFF);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  padding: 8px 14px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, .14), 0 4px 8px rgba(15, 23, 42, .06);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.demo-trigger-label {
  font: 700 10px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  letter-spacing: .5px; text-transform: uppercase;
  margin-right: 4px;
}
.demo-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 999px;
  border: none;
  font: 700 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  cursor: pointer; transition: all .15s ease;
}
.demo-btn i { font-size: 10px; }
.demo-btn-amber { background: rgba(245, 158, 11, .10); color: #D97706; }
.demo-btn-amber:hover { background: rgba(245, 158, 11, .20); }
.demo-btn-red   { background: rgba(220, 38, 38, .10);  color: #DC2626; }
.demo-btn-red:hover   { background: rgba(220, 38, 38, .20); }
.demo-btn-blue  { background: rgba(30,  58, 138, .10); color: #1E40AF; }
.demo-btn-blue:hover  { background: rgba(30,  58, 138, .20); }

/* Responsive: stack the trigger bar vertically on tight screens */
@media (max-width: 720px) {
  .demo-trigger-bar {
    flex-wrap: wrap; bottom: 12px; right: 12px;
    max-width: calc(100vw - 24px);
  }
  .sys-banner-inner { padding: 10px 14px; }
  .sys-banner-text strong { font-size: 12.5px; }
  .sys-banner-text span   { font-size: 11.5px; }
}

/* ─── DARK MODE ─── */
[data-theme="dark"] .sys-dialog {
  background: #0E1628;
  border-color: #1C2E50;
  color: #E2E8F8;
  box-shadow: 0 30px 80px rgba(0, 0, 0, .60), 0 8px 24px rgba(0, 0, 0, .40);
}
[data-theme="dark"] .sys-dialog-title { color: #E2E8F8; }
[data-theme="dark"] .sys-dialog-msg   { color: #94A3B8; }

[data-theme="dark"] .sys-detail-red   { background: rgba(220, 38, 38, .10); border-color: rgba(220, 38, 38, .25); color: #FCA5A5; }
[data-theme="dark"] .sys-detail-red i { color: #F87171; }
[data-theme="dark"] .sys-detail-amber { background: rgba(245, 158, 11, .10); border-color: rgba(245, 158, 11, .28); color: #FDE68A; }
[data-theme="dark"] .sys-detail-amber i { color: #FCD34D; }
[data-theme="dark"] .sys-detail-blue  { background: rgba(59, 130, 246, .14); border-color: rgba(59, 130, 246, .28); color: #93C5FD; }
[data-theme="dark"] .sys-detail-blue i  { color: #93C5FD; }

[data-theme="dark"] .sys-btn-ghost {
  border-color: #1C2E50;
  color: #94A3B8;
}
[data-theme="dark"] .sys-btn-ghost:hover {
  background: #131F38;
  border-color: #243858;
  color: #E2E8F8;
}
[data-theme="dark"] .sys-btn-danger { border-color: rgba(248, 113, 113, .35); color: #FCA5A5; }
[data-theme="dark"] .sys-btn-danger:hover { background: rgba(248, 113, 113, .10); border-color: #F87171; color: #FCA5A5; }

[data-theme="dark"] .demo-trigger-bar {
  background: #0E1628;
  border-color: #1C2E50;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .55), 0 4px 8px rgba(0, 0, 0, .35);
}
[data-theme="dark"] .demo-trigger-label { color: #94A3B8; }
[data-theme="dark"] .demo-btn-amber { background: rgba(245, 158, 11, .14); color: #FCD34D; }
[data-theme="dark"] .demo-btn-amber:hover { background: rgba(245, 158, 11, .24); }
[data-theme="dark"] .demo-btn-red   { background: rgba(248, 113, 113, .14); color: #FCA5A5; }
[data-theme="dark"] .demo-btn-red:hover   { background: rgba(248, 113, 113, .24); }
[data-theme="dark"] .demo-btn-blue  { background: rgba(59, 130, 246, .14); color: #93C5FD; }
[data-theme="dark"] .demo-btn-blue:hover  { background: rgba(59, 130, 246, .24); }
  `;
  document.head.appendChild(el);
}
