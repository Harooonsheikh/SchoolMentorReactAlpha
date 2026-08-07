import { useState, useRef, useEffect, useCallback } from 'react';
import AuthLayout from './AuthLayout';
import { buildUrl } from '../../utils/apiConfig';
import { normalizePkPhone } from '../../utils/phone';

/* ═══════════════════════════════════════════════════════════════════
   FORGOT PASSWORD — teen qadam, HTML design ke mutabiq:
     1) phone   → OTP bhejo
     2) otp     → 4 boxes me code
     3) reset   → naya password + confirm
     4) done    → success screen

   Backend endpoints (Swagger se tasdeeq shuda):
     POST /api/Auth/ERP-send-otp-forgetpassword?PhoneNumber=03xxxxxxxxx
          → { success, message, otp }
     PUT  /api/HR/update-password  { userID, newPassword }

   NOTE: backend me OTP *verify* karne ka koi endpoint nahi hai — send wala
   endpoint OTP khud response me wapas bhejta hai, is liye milaan yahin
   frontend par hota hai. Ye mehfooz nahi (OTP DevTools me nazar aata hai);
   asli fix backend par verify endpoint banana hai.
   ═══════════════════════════════════════════════════════════════════ */

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

/* localStorage key jahan bheji hui OTP rakhi jati hai — ERP ke change-password
   flow jaisa hi pattern (wahan key 'profile_pwd_otp' hai, dekhein
   erp/services/profileService.js). Application → Local Storage me nazar aati hai. */
const FORGOT_OTP_KEY = 'forget_otp';

const otpStore = {
  save(otp) {
    try { localStorage.setItem(FORGOT_OTP_KEY, String(otp)); } catch { /* private mode */ }
  },
  read() {
    try { return (localStorage.getItem(FORGOT_OTP_KEY) || '').trim(); } catch { return ''; }
  },
  clear() {
    try { localStorage.removeItem(FORGOT_OTP_KEY); } catch { /* private mode */ }
  },
};

/* Server ka asli message nikaalo — JSON ho ya plain text. */
function serverMessage(data, raw) {
  const msg =
    data?.message ?? data?.Message ?? data?.error ?? data?.title ??
    (typeof data === 'string' ? data : '') ?? '';
  return String(msg || raw || '').trim()
    .replace(/^(internal\s+server\s+error|bad\s+request|error)\s*:\s*/i, '').trim();
}

export default function ForgotPasswordScreen({ onBack }) {
  const [step,     setStep]     = useState('phone');
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState(Array(OTP_LENGTH).fill(''));
  const [sentOtp,  setSentOtp]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpRefs = useRef([]);

  /* Resend cooldown — har second ghatta hai. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /* OTP step par pehle box me focus. */
  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus();
  }, [step]);

  const sendOtp = useCallback(async (targetPhone, isResend) => {
    const clean = normalizePkPhone(targetPhone).trim();
    if (!/^03\d{9}$/.test(clean)) {
      setError('Please enter a valid phone number (e.g. 03001234567).');
      return false;
    }
    setError(''); setNotice(''); setBusy(true);
    try {
      /* PhoneNumber query param me jata hai (body me nahi) — Swagger yahi kehta
         hai. Content-Length: 0 zaroori hai, warna IIS 411 de deta hai. */
      const res = await fetch(
        buildUrl(`/api/Auth/ERP-send-otp-forgetpassword?PhoneNumber=${encodeURIComponent(clean)}`),
        { method: 'POST', headers: { 'Accept': '*/*', 'Content-Length': '0' } },
      );
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* plain-text */ }

      if (!res.ok || data?.success === false) {
        /* Nayi OTP nahi mili to purani wali bhi hata do, warna wo match kar
           sakti thi aur user ghalat code se aage nikal jata. */
        otpStore.clear();
        setSentOtp('');
        setError(serverMessage(data, raw) || 'Could not send the code. Please try again.');
        return false;
      }

      if (data?.otp != null) {
        setSentOtp(String(data.otp));
        otpStore.save(data.otp);
      } else {
        otpStore.clear();
        setSentOtp('');
      }
      setCooldown(RESEND_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      if (isResend) setNotice('A new code has been sent to your phone.');
      return true;
    } catch (err) {
      setError(err?.message ? `Network error: ${err.message}` : 'Network error. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  async function handleSendOtp() {
    if (await sendOtp(phone, false)) setStep('otp');
  }

  function handleOtpChange(i, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    setError('');
    if (digit && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft'  && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
    if (e.key === 'Enter') handleVerifyOtp();
  }

  /* Poora code ek saath paste karna — har box me ek digit. */
  function handleOtpPaste(e) {
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    digits.split('').forEach((d, idx) => { next[idx] = d; });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleVerifyOtp() {
    const entered = otp.join('');
    if (entered.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    /* localStorage pehle — refresh ke baad state khali hoti hai magar saved OTP
       rehti hai, is liye user ko dobara code mangna nahi parta. */
    const saved = otpStore.read() || sentOtp;
    if (!saved) {
      setError('Your code has expired. Please request a new one.');
      return;
    }
    if (entered !== saved) {
      setError('That code is incorrect. Please check and try again.');
      return;
    }
    setError(''); setNotice('');
    setStep('reset');
  }

  async function handleResetPassword() {
    if (password.length < 6) {
      setError('Your new password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Both passwords must match.');
      return;
    }
    setError(''); setBusy(true);
    try {
      /* PUT /api/Auth/forget-password — ye phone (`user_Name`) leta hai, userID
         nahi. Isi liye ab reset mukammal ho sakta hai: is flow me sirf phone
         hota hai, aur phone→userID nikalne ka koi endpoint maujood nahi. */
      const res = await fetch(buildUrl('/api/Auth/forget-password'), {
        method: 'PUT',
        headers: { 'Accept': '*/*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_Name: normalizePkPhone(phone).trim(),
          newPassword: password,
        }),
      });
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* plain-text */ }

      if (!res.ok || data?.success === false) {
        setError(serverMessage(data, raw) || 'Could not update your password. Please try again.');
        return;
      }

      otpStore.clear();    // OTP apna kaam kar chuki — disk par chhorna bekaar
      setStep('done');
    } catch (err) {
      setError(err?.message ? `Network error: ${err.message}` : 'Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /* Login par wapas jaate waqt saved OTP hata do — flow khatam ho chuka. */
  function leave() {
    otpStore.clear();
    onBack?.();
  }

  const otpFilled = otp.join('').length === OTP_LENGTH;

  /* ── heading / tagline har step ke hisab se ── */
  const HEADINGS = {
    phone:   ['Forgot your password?',  'Enter your registered phone number and we will send you a verification code.'],
    otp:     ['Verify OTP', `Enter the ${OTP_LENGTH}-digit OTP sent to +92 ${phone.replace(/^0/, '')}.`],
    reset:   ['Set a new password',      'Choose a strong password you have not used before.'],
    done:    ['Password updated',        'You can now sign in with your new password.'],
  };
  const [heading, tagline] = HEADINGS[step] || HEADINGS.phone;

  return (
    <AuthLayout illustration="login" heading={heading} tagline={tagline}>

      {error  && <div className="auth-error-box">{error}</div>}
      {notice && <div className="auth-success-card show">{notice}</div>}

      {/* ── STEP 1: phone ── */}
      {step === 'phone' && (
        <>
          <button type="button" className="auth-back-link" onClick={leave}>
            <i className="fa-solid fa-arrow-left" /> Back to sign in
          </button>

          <label className="auth-label">Phone Number</label>
          <div className="auth-phone-row">
            <span className="auth-phone-code">+92</span>
            <div className="auth-input-wrap">
              <input className="auth-input" type="tel" placeholder="3XX XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(normalizePkPhone(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()} />
            </div>
          </div>

          <button className="auth-btn-primary" onClick={handleSendOtp} disabled={busy}>
            {busy ? 'Sending…' : 'Send Verification Code'} <i className="fa-solid fa-arrow-right" />
          </button>
        </>
      )}

      {/* ── STEP 2: OTP ── */}
      {step === 'otp' && (
        <>
          <div className="auth-otp-row">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                className={`auth-otp-box${digit ? ' filled' : ''}${error ? ' has-error' : ''}`}
                type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={1} value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={handleOtpPaste} />
            ))}
          </div>

          <div className="auth-resend-row">
            <button type="button" className="auth-resend-link"
              disabled={cooldown > 0 || busy}
              onClick={() => sendOtp(phone, true)}>
              Resend OTP
            </button>
            {cooldown > 0 && (
              <span>Resend OTP in 00:{String(cooldown).padStart(2, '0')}</span>
            )}
          </div>

          <button className="auth-btn-primary" onClick={handleVerifyOtp} disabled={!otpFilled || busy}>
            Verify OTP <i className="fa-solid fa-arrow-right" />
          </button>

          {/* Verify button ke neeche — design ke mutabiq underlined link. */}
          <button type="button" className="auth-change-dest"
            onClick={() => { setStep('phone'); setError(''); setNotice(''); }}>
            Change Phone Number
          </button>
        </>
      )}

      {/* ── STEP 3: naya password ── */}
      {step === 'reset' && (
        <>
          <label className="auth-label">New Password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><i className="fa-solid fa-lock" /></span>
            <input className="auth-input" type={showPass ? 'text' : 'password'}
              placeholder="Enter your new password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="auth-eye-btn" onClick={() => setShowPass((p) => !p)} tabIndex={-1}>
              <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
          <p className="auth-pw-hint">Use at least 6 characters.</p>

          <label className="auth-label">Confirm New Password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><i className="fa-solid fa-lock" /></span>
            <input className="auth-input" type={showPass ? 'text' : 'password'}
              placeholder="Re-enter your new password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()} />
          </div>

          <button className="auth-btn-primary" onClick={handleResetPassword} disabled={busy}>
            {busy ? 'Updating…' : 'Update Password'} <i className="fa-solid fa-arrow-right" />
          </button>
        </>
      )}

      {/* ── Success ── */}
      {step === 'done' && (
        <div className="auth-screen-center">
          <div className="auth-success-icon-wrap"><i className="fa-solid fa-check" /></div>
          <h3 className="auth-success-title">Password updated</h3>
          <p className="auth-success-sub">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <button className="auth-btn-primary" onClick={leave}>
            Back to Sign In <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      )}

    </AuthLayout>
  );
}
