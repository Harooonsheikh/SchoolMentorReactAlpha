import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   COMING SOON — generic placeholder used by sidebar entries whose
   module hasn't been built yet (e.g. School SOPs, Teacher Trainings).

   Designed to feel native: same page header chrome as every other
   ERP module (icon chip + title + subtitle), with a centred card
   underneath announcing the in-development status. Fully self-styled
   via an injected <style> tag — no global CSS changes needed and the
   styles use the same brand-blue palette + Plus Jakarta Sans family
   the rest of the ERP is on.
   ═══════════════════════════════════════════════════════════════════ */
export default function ComingSoon({ module = 'This module', icon = 'fa-clock' }) {
  return (
    <>
      <style>{COMING_SOON_CSS}</style>

      {/* Page header — same shape as HR / Staff Appraisals / Settings */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div>
            <div className="page-title">{module}</div>
            <div className="page-sub">This module is coming soon.</div>
          </div>
        </div>
      </div>

      {/* Centred white card */}
      <section
        className="cs-card"
        role="status"
        aria-live="polite"
        aria-label={`${module} coming soon`}
      >
        <div className="cs-icon" aria-hidden="true">
          <i className={`fa-solid ${icon}`}></i>
        </div>
        <h1 className="cs-title">{module} — Coming Soon</h1>
        <p className="cs-desc">
          We're building this module. It will be available in a future update.
        </p>
        <span className="cs-badge">
          <i className="fa-solid fa-wrench" aria-hidden="true" style={{ marginRight: 6 }}></i>
          In Development
        </span>
      </section>
    </>
  );
}

const COMING_SOON_CSS = `
.cs-card {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 20px;
  padding: 48px;
  text-align: center;
  max-width: 480px;
  margin: 40px auto;
  box-shadow: 0 4px 20px rgba(30, 58, 138, .08);
  font-family: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
}
[data-theme="dark"] .cs-card {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255, 255, 255, .08));
  box-shadow: 0 4px 20px rgba(0, 0, 0, .35);
}
.cs-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  color: #1E3A8A;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  border: 1px solid #BFDBFE;
}
[data-theme="dark"] .cs-icon {
  background: rgba(30, 64, 175, .12);
  border-color: rgba(30, 64, 175, .35);
  color: #93C5FD;
}
.cs-title {
  font-family: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  margin: 0 0 10px;
  line-height: 1.25;
}
[data-theme="dark"] .cs-title { color: var(--text-primary, #E2E8F0); }
.cs-desc {
  font-family: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.6;
  margin: 0 auto 22px;
  max-width: 380px;
}
.cs-badge {
  display: inline-flex;
  align-items: center;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  color: #1E40AF;
  font-family: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 999px;
  letter-spacing: -.005em;
}
[data-theme="dark"] .cs-badge {
  background: rgba(30, 64, 175, .14);
  border-color: rgba(30, 64, 175, .35);
  color: #BFDBFE;
}
@media (max-width: 720px) {
  .cs-card { padding: 36px 28px; margin: 28px auto; }
  .cs-icon { width: 72px; height: 72px; font-size: 32px; }
  .cs-title { font-size: 18px; }
}
`;
