import { useEffect, useState } from 'react';
import { SA_AUTH_CSS } from './saAuthStyles';
import { login as loginRequest } from './api/services/auth';

/* ═══════════════════════════════════════════════════════════════════
   SUPER ADMIN — sign-in screen

   Built on the same split layout as the school ERP's login (story panel
   left, form card right) so the two products read as one family. The
   copy is head-office specific: this console controls every school, so
   the panel sells reach and the card leads with restricted access.

   Theme follows the shell — the toggle writes the same `sa-theme` key
   SuperAdminShell reads, so whichever mode you sign in with is the one
   the console opens in.
   ═══════════════════════════════════════════════════════════════════ */

const CAPABILITIES = [
  {
    icon: 'fa-key',
    title: 'Schools & Permissions',
    desc: 'Activate schools, grant module access, and control exactly what each branch can open.',
    chips: ['School Permissions', 'Schools Progress', 'User Management'],
  },
  {
    icon: 'fa-chart-line',
    title: 'Payments & Plans',
    desc: 'Track onboarding, subscriptions and collections across the whole network.',
    chips: ['Schools Payment', 'Mentor AI Plans'],
  },
  {
    icon: 'fa-headset',
    title: 'Content & Support',
    desc: 'Publish training content and answer every school from one shared inbox.',
    chips: ['E-Tube', 'Operational SOPs', 'Teacher Trainings', 'Quiz Content', 'Support'],
  },
];

/* A failed sign-in should say what actually went wrong. ApiError carries
   status 0 for network/CORS failures, which otherwise surfaces as a bare
   "Failed to fetch" and reads like wrong credentials. */
function errorMessage(err) {
  if (err?.status === 401 || err?.status === 403) return 'Incorrect username or password.';
  if (err?.status === 0) return 'Cannot reach the server. Check your connection and try again.';
  return err?.message || 'Sign in failed. Please try again.';
}

/* The SchoolMentor mark, served from public/ — same asset the ERP auth screen
   uses, so both products show an identical logo. */
const BRAND_LOGO = `${process.env.PUBLIC_URL}/logo192.png`;

function BrandLockup({ className = 'sa-lockup', tag = 'Super Admin' }) {
  return (
    <div className={className}>
      <img className="sa-brand-icon" src={BRAND_LOGO} alt="" aria-hidden="true" />
      <div className="sa-lockup-txt">
        <span className="sa-lockup-name"><b>School</b><span>Mentor</span></span>
        <span className="sa-lockup-tag">{tag}</span>
      </div>
    </div>
  );
}

export default function SuperAdminLogin({ onLogin }) {
  /* Same key and precedence as SuperAdminShell, so the choice carries over. */
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sa-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch { /* storage blocked — fall back to light */ }
    return 'light';
  });
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { localStorage.setItem('sa-theme', theme); } catch { /* ignore */ } }, [theme]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!userName.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const session = await loginRequest({ userName: userName.trim(), password });
      if (!session?.token) {
        setError('Signed in, but no session token was returned. Please contact support.');
        return;
      }
      onLogin(session, { remember });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sa-auth" data-theme={theme === 'dark' ? 'dark' : undefined}>
      <style>{SA_AUTH_CSS}</style>

      {/* ═════════ LEFT — STORY ═════════ */}
      <div className="sa-story">
        <div className="sa-blob sa-blob-1" />
        <div className="sa-blob sa-blob-2" />
        <i className="fa-solid fa-shield-halved sa-spark" style={{ top: '15%', left: '80%', animationDelay: '.4s' }} />
        <i className="fa-solid fa-school sa-spark" style={{ top: '60%', left: '7%', animationDelay: '2.4s' }} />
        <i className="fa-solid fa-chart-pie sa-spark" style={{ top: '38%', left: '89%', animationDelay: '4.2s' }} />

        <div className="sa-story-in">
          <BrandLockup className="sa-lockup sa-logo-badge" />

          <div>
            <div className="sa-eyebrow"><i className="fa-solid fa-circle" /> Head office · restricted access</div>
            <h1 className="sa-headline">
              The <span className="sa-hl">control room</span> behind every School Mentor campus
            </h1>
            <p className="sa-sub">
              One console for onboarding, permissions, payments, content and support —
              across every school and branch on the network.
            </p>
          </div>

          <div>
            <div className="sa-rail-head">What you manage here</div>
            <div className="sa-rail">
              <div className="sa-rail-line" />
              {CAPABILITIES.map((c) => (
                <div className="sa-item" key={c.title}>
                  <div className="sa-node"><i className={`fa-solid ${c.icon}`} /></div>
                  <div>
                    <div className="sa-item-title">{c.title}</div>
                    <div className="sa-item-desc">{c.desc}</div>
                    <div className="sa-chips">
                      {c.chips.map((chip) => <span key={chip}>{chip}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sa-story-foot">
            <i className="fa-solid fa-user-shield" />
            <span>Super Admin accounts reach every school's data. Sign-ins and changes are recorded.</span>
          </div>
        </div>
      </div>

      {/* ═════════ RIGHT — FORM ═════════ */}
      <div className="sa-formside">
        <button
          type="button"
          className="sa-theme-btn"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        >
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
        </button>

        <form className="sa-card" onSubmit={handleSubmit}>
          <div className="sa-card-badge"><BrandLockup /></div>

          <h2 className="sa-welcome-title">Super Admin Sign In</h2>
          <p className="sa-welcome-sub">Head office access to the School Mentor platform.</p>

          <div className="sa-form">
            {error && (
              <div className="sa-err-box" role="alert">
                <i className="fa-solid fa-circle-exclamation" />
                <span>{error}</span>
              </div>
            )}

            <label className="sa-label" htmlFor="sa-user">Username</label>
            <div className="sa-input-wrap">
              <span className="sa-input-icon"><i className="fa-solid fa-user-shield" /></span>
              <input
                id="sa-user"
                className="sa-input"
                type="text"
                autoComplete="username"
                placeholder="Enter your super admin username"
                value={userName}
                onChange={(e) => { setUserName(e.target.value); setError(''); }}
              />
            </div>

            <label className="sa-label" htmlFor="sa-pass">Password</label>
            <div className="sa-input-wrap">
              <span className="sa-input-icon"><i className="fa-solid fa-lock" /></span>
              <input
                id="sa-pass"
                className="sa-input"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              <button
                type="button"
                className="sa-eye-btn"
                tabIndex={-1}
                title={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((p) => !p)}
              >
                <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>

            <div className="sa-form-meta">
              <label className="sa-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Keep me signed in
              </label>
              <button type="button" className="sa-forgot" onClick={() => setError('Password resets are handled by the platform team — please contact them.')}>
                Forgot password?
              </button>
            </div>

            <button className="sa-btn" type="submit" disabled={busy}>
              {busy ? (
                <><i className="fa-solid fa-circle-notch sa-spin" /> Signing in…</>
              ) : (
                <>Sign In to Console <i className="fa-solid fa-arrow-right" /></>
              )}
            </button>

            <div className="sa-secure">
              <i className="fa-solid fa-shield-halved" />
              <span>Restricted to authorised head-office staff. If you manage a single school, sign in from your school's ERP instead.</span>
            </div>

            <p className="sa-foot-note">School Mentor · Super Admin Console</p>
          </div>
        </form>
      </div>
    </div>
  );
}
