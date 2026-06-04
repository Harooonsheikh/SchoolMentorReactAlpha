import AuthLayout from './AuthLayout';
import { useState } from 'react';
import { buildUrl } from '../../utils/apiConfig';
import { normalizePkPhone } from '../../utils/phone';

export default function LoginScreen({ onLogin, onSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
   try {
    const res = await fetch(buildUrl('/api/Auth/login'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_Name: normalizePkPhone(username),
        password: password,
      }),
    });

    const data = await res.json();
    console.log("Login Response:", data);

    if (!res.ok) {
      setError(data?.message || 'Login failed');
      return;
    }
    if (data?.branchID) {
      sessionStorage.setItem("branchID", data.branchID);
    }
    if (data?.accountType) {
      sessionStorage.setItem("accountType", data.accountType);
    }
    if (data?.displayName) {
      sessionStorage.setItem("displayName", data.displayName);
    }
    if (data?.id) {
      sessionStorage.setItem("UserID", data.id);
    }
    if (data?.employee_ID) {
      sessionStorage.setItem("employee_ID", data.employee_ID);
    }
    if (data?.userName) {
      sessionStorage.setItem("userName", data.userName);
    }
    if (data?.token) {
      sessionStorage.setItem("token", data.token);
    }
    if (data?.launchSetup) {
      sessionStorage.setItem("launchSetup", data.launchSetup);
    }
    onLogin(data);

  } catch (err) {
    setError('Network error. Please try again.');
    console.error(err);
  }
    // onLogin({ username });
    
  }




  return (
    <AuthLayout illustration="login" heading="Welcome back" tagline="Sign in to your school dashboard">

      {error && <div className="auth-error-box">{error}</div>}

      <label className="auth-label">Username</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth={2} strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx={12} cy={7} r={4}/>
          </svg>
        </span>
        <input className="auth-input" type="text" placeholder="Enter your username"
          value={username} onChange={e => setUsername(normalizePkPhone(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      </div>

      <label className="auth-label">Password</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth={2} strokeLinecap="round">
            <rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </span>
        <input className="auth-input" type={showPass ? 'text' : 'password'}
          placeholder="Enter your password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <button className="auth-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
          <EyeIcon open={showPass} />
        </button>
      </div>

      <button className="auth-btn-primary" onClick={handleLogin}>Sign In →</button>

      <div className="auth-divider">
        <div className="auth-divider-line" />
        <span className="auth-divider-text">or</span>
        <div className="auth-divider-line" />
      </div>

      <button className="auth-btn-outline" onClick={onSignup}>Create New Account</button>

      <p className="auth-foot-note">By signing in you agree to SchoolMentor's Terms of Service</p>
    </AuthLayout>
  );
}

function EyeIcon({ open }) {
  return open
    ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <line x1={1} y1={1} x2={23} y2={23}/>
      </svg>
    : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/>
      </svg>;
}
