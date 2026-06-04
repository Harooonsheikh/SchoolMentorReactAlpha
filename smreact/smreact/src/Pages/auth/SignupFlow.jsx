import { useState, useRef, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { buildUrl } from '../../utils/apiConfig';
import { normalizePkPhone } from '../../utils/phone';
import { useApp } from '../../context/AppContext';



/* ── Country list ── */
const COUNTRIES = [
  { code: 'PK', name: 'Pakistan',             flag: '🇵🇰', method: 'phone' },
  { code: 'US', name: 'United States',        flag: '🇺🇸', method: 'email' },
  { code: 'GB', name: 'United Kingdom',       flag: '🇬🇧', method: 'email' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', method: 'email' },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦', method: 'email' },
  { code: 'IN', name: 'India',                flag: '🇮🇳', method: 'email' },
  { code: 'BD', name: 'Bangladesh',           flag: '🇧🇩', method: 'email' },
  { code: 'AF', name: 'Afghanistan',          flag: '🇦🇫', method: 'email' },
  { code: 'CA', name: 'Canada',               flag: '🇨🇦', method: 'email' },
  { code: 'AU', name: 'Australia',            flag: '🇦🇺', method: 'email' },
  { code: 'DE', name: 'Germany',              flag: '🇩🇪', method: 'email' },
  { code: 'OTHER', name: 'Other',             flag: '🌐', method: 'email' },
];

function saveCountrySession(c) {
  try {
    sessionStorage.setItem('sm_country', JSON.stringify({
      code: c.code, name: c.name, flag: c.flag,
      verificationMethod: c.method,
    }));
  } catch(_) {}
}
function getCountrySession() {
  try { return JSON.parse(sessionStorage.getItem('sm_country') || '{}'); } catch(_) { return {}; }
}

/* ═══════════════════════════════════
   Tiny shared UI pieces (className-based)
═══════════════════════════════════ */
function ErrBox({ msg }) {
  return <div className="auth-error-box">{msg}</div>;
}
function Label({ text }) {
  return <label className="auth-label">{text}</label>;
}
function InputWrap({ icon, children }) {
  return (
    <div className="auth-input-wrap">
      <span className="auth-input-icon">{icon}</span>
      {children}
    </div>
  );
}
function EyeBtn({ show, onToggle }) {
  return (
    <button className="auth-eye-btn" onClick={onToggle} tabIndex={-1}>
      {show
        ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <line x1={1} y1={1} x2={23} y2={23}/>
          </svg>
        : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/>
          </svg>
      }
    </button>
  );
}
function NavBtns({ onBack, onNext, backLabel = '← Back', nextLabel = 'Next →' }) {
  return (
    <div className="auth-btn-row">
      <button className="auth-btn-back" onClick={onBack}>{backLabel}</button>
      <button className="auth-btn-next" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
function QA({ q, a }) {
  return (
    <>
      <p style={{ fontWeight:700, color:'#1E3A5F', margin:'10px 0 2px', fontSize:13 }}>{q}</p>
      <p style={{ margin:'0 0 2px', color:'#475569', fontSize:13 }}>{a}</p>
    </>
  );
}

/* SVG icons */
const ip = { width:17, height:17, viewBox:"0 0 24 24", fill:"none", stroke:"#1565C0", strokeWidth:2, strokeLinecap:"round" };
const ICONS = {
  home:   <svg {...ip}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  user:   <svg {...ip}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>,
  phone:  <svg {...ip}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.85-.85a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  email:  <svg {...ip}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  lock:   <svg {...ip}><rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  shield: <svg {...ip}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>,
};

/* ═══════════════════════════════════
   STEP 1 — Branch / Owner / Country
═══════════════════════════════════ */
function StepBranchOwner({ data, onChange, onNext, onBack }) {
  const [error,       setError]       = useState('');
  const [dropOpen,    setDropOpen]    = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    function close(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = COUNTRIES.find(c => c.code === data.countryCode) || null;

  function next() {
    if (!data.branchName.trim()) { setError('Branch name is required.'); return; }
    if (!data.ownerName.trim())  { setError('Owner name is required.'); return; }
    if (!data.countryCode)       { setError('Please select your country.'); return; }
    if (selected) saveCountrySession(selected);
    setError(''); onNext();
  }

  return (
    <AuthLayout illustration="signup" heading="Set up your school"
      tagline="Tell us about your branch and team" step={1} totalSteps={5}>
      {error && <ErrBox msg={error} />}

      <Label text="Branch Name" />
      <InputWrap icon={ICONS.home}>
        <input className="auth-input" placeholder="e.g. Gulberg Branch, Main Campus"
          value={data.branchName} onChange={e => onChange('branchName', e.target.value)} />
      </InputWrap>

      <Label text="Owner / Principal Name" />
      <InputWrap icon={ICONS.user}>
        <input className="auth-input" placeholder="e.g. Muhammad Ali"
          value={data.ownerName} onChange={e => onChange('ownerName', e.target.value)} />
      </InputWrap>

      <Label text="Country" />
      <div style={{ position:'relative', marginBottom:16 }} ref={dropRef}>
        {/* Trigger */}
        <button onClick={() => setDropOpen(o => !o)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', border:'1.5px solid #BFDBFE', borderRadius:10, background:'#F8FAFF', fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, color: selected ? '#0F172A' : '#94A3B8', cursor:'pointer', textAlign:'left', outline:'none', transition:'border-color .2s' }}>
          {selected ? <><span style={{fontSize:20}}>{selected.flag}</span>{selected.name}</> : '🌍  Select your country'}
          <svg style={{marginLeft:'auto',flexShrink:0}} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
        </button>

        {/* Dropdown */}
        {dropOpen && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#fff', borderRadius:12, boxShadow:'0 8px 30px rgba(21,101,192,.18)', border:'1px solid #BFDBFE', zIndex:200, maxHeight:220, overflowY:'auto' }}>
            {COUNTRIES.map(c => (
              <button key={c.code}
                onClick={() => { onChange('countryCode', c.code); setDropOpen(false); }}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background: data.countryCode === c.code ? '#EFF6FF' : 'transparent', border:'none', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, color:'#0F172A', textAlign:'left' }}>
                <span style={{fontSize:18}}>{c.flag}</span>
                {c.name}
                {c.method === 'phone' && <span style={{marginLeft:'auto',fontSize:11,background:'#DBEAFE',color:'#1565C0',padding:'2px 8px',borderRadius:99,fontWeight:700}}>SMS</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Country method hint */}
      {selected && (
        <div style={{ background: selected.method === 'phone' ? '#F0FDF4' : '#EFF6FF', border:`1px solid ${selected.method === 'phone' ? '#86EFAC' : '#BFDBFE'}`, borderRadius:10, padding:'10px 14px', fontSize:12, color: selected.method === 'phone' ? '#166534' : '#1E40AF', marginBottom:16 }}>
          {selected.method === 'phone'
            ? '📱 Pakistan selected — verification via SMS OTP'
            : '📧 International — verification via Email OTP'}
        </div>
      )}

      <NavBtns onBack={onBack} onNext={next} backLabel="← Login" nextLabel="Continue →" />
    </AuthLayout>
  );
}

function StepPhone({ data, onChange, onNext, onBack }) {
  const [error, setError] = useState('');
const { showToast } = useApp();


  async function next() {
  debugger;

  if (data.phone.replace(/\D/g, '').length < 10) {
    setError('Enter a valid phone number.');
    return;
  }

  setError('');

  try {
    const res = await fetch(
      buildUrl(`/api/Auth/send?PhoneNumber=${data.phone}`),
      {
        method: 'POST',
        headers: {
          'Accept': '*/*',
        },
      }
    );

    const response = await res.json();
    if(response.success === true){
      const otpFromServer = response.otp;
onChange('OTP', otpFromServer);
localStorage.setItem('signup_otp', otpFromServer);
    showToast(response.message, 'success');
  }
  else{
    showToast(response.message, 'success');
  }

    if (!res.ok) {
      setError(response?.message || 'Request failed');
      return;
    }

    onNext();

  } catch (err) {
    setError('Network error. Please try again.');
    console.error(err);
  }
}

  return (
    <AuthLayout illustration="signup" heading="Your phone number"
      tagline="We'll send a 4-digit verification code" step={2} totalSteps={5}>
      {error && <ErrBox msg={error} />}
      <Label text="Phone Number" />
      <InputWrap icon={ICONS.phone}>
        <input className="auth-input" type="tel" placeholder="+92 300 0000000"
          value={data.phone} onChange={e => onChange('phone', normalizePkPhone(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && next()} />
      </InputWrap>
      <p style={{fontSize:12,color:'#64748B',marginTop:-8,marginBottom:16}}>🇵🇰 Format: 03XX-XXXXXXX or +92-3XX-XXXXXXX</p>
      <NavBtns onBack={onBack} onNext={next} nextLabel="Send OTP →" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 2b — Email (others)
═══════════════════════════════════ */
function StepEmail({ data, onChange, onNext, onBack }) {
  const [error, setError] = useState('');
  // function next() {
  //   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setError('Enter a valid email address.'); return; }
  //   setPhoneNo(data.email)
  //   setError(''); onNext();
  // }
  async function next() {

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setError('Enter a valid email address.'); return; }

  setError('');

  try {
    const res = await fetch(
      buildUrl(`/api/Auth/send?PhoneNumber=${data.email}`),
      {
        method: 'POST',
        headers: {
          'Accept': '*/*',
        },
      }
    );

    const response = await res.json();


    if (!res.ok) {
      setError(response?.message || 'Request failed');
      return;
    }

    if (response.success) {

  const otpFromServer = response.otp;
  onChange('OTP', otpFromServer);
  localStorage.setItem('signup_otp', otpFromServer);
  onNext();
}

  } catch (err) {
    setError('Network error. Please try again.');
    console.error(err);
  }
}
  return (
    <AuthLayout illustration="signup" heading="Your email address"
      tagline="We'll send a 4-digit verification code" step={2} totalSteps={5}>
      {error && <ErrBox msg={error} />}
      <Label text="Email Address" />
      <InputWrap icon={ICONS.email}>
        <input className="auth-input" type="email" placeholder="you@school.com"
          value={data.email} onChange={e => onChange('email', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && next()} />
      </InputWrap>
      <NavBtns onBack={onBack} onNext={next} nextLabel="Send OTP →" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 3 — 4-digit OTP
═══════════════════════════════════ */
function StepOTP({ data,onChange,  onNext, onBack }) {
  const [otp,   setOtp]   = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const refs = useRef([]);
  const country = getCountrySession();
  const dest = country.verificationMethod === 'phone' ? data.phone : data.email;

  useEffect(() => {
    refs.current[0]?.focus();
    const id = setInterval(() => setTimer(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(id);
  }, []);

  function handleChange(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 3) refs.current[i + 1]?.focus();
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  }
  function verify() {
    const enteredOtp = otp.join('');
    if (otp.join('').length < 4) { setError('Please enter the full 4-digit code.'); return; }
    setError(''); 
const savedOtp = data.OTP;
if (enteredOtp !== String(savedOtp)) {
setError('Invalid OTP. Please try again.');
return;
}
setError('');
onNext();
  }

  const { showToast } = useApp();


  async function resendOTP() {
    
    setError('');
    
    try {
      const phone = country.verificationMethod === 'phone' ? data.phone : data.email;
      
      const res = await fetch(
        buildUrl(`/api/Auth/send?PhoneNumber=${encodeURIComponent(phone)}`),
        {
          method: 'POST',
          headers: {
            'Accept': '*/*',
          },
        }
      );
 
      const response = await res.json();
 
      if (res.ok && response.success) {
        setTimer(30);
        setOtp(['', '', '', '']);
        showToast(response.message || 'OTP resent successfully', 'success');
        const otpFromServer = response.otp;
onChange('OTP', otpFromServer);
localStorage.setItem('signup_otp', otpFromServer);
        refs.current[0]?.focus();
      } else {
        setError(response?.message || 'Failed to resend OTP');
        showToast(response?.message || 'Failed to resend OTP', 'error');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      showToast('Network error. Please try again.', 'error');
      console.error(err);
    } finally {
    }
  }


  return (
    <AuthLayout illustration="signup" heading="Verify your account"
      tagline={`4-digit code sent to ${dest || 'your contact'}`} step={3} totalSteps={5}>
      {error && <ErrBox msg={error} />}

      <div className="auth-otp-row">
        {otp.map((d, i) => (
          <input key={i} ref={el => refs.current[i] = el}
            className={`auth-otp-box${d ? ' filled' : ''}`}
            maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
          />
        ))}
      </div>

      <div style={{textAlign:'center',fontSize:13,color:'#64748B',marginBottom:20}}>
        {timer > 0
          ? <span>Resend in <strong style={{color:'#1565C0'}}>{timer}s</strong></span>
          : <button onClick={() => resendOTP()}
              style={{background:'none',border:'none',color:'#1565C0',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              Resend OTP
            </button>
        }
      </div>

      <NavBtns onBack={onBack} onNext={verify} nextLabel="Verify →" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 4 — Password
═══════════════════════════════════ */
function StepPassword({ data,onChange,  onNext, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showP,    setShowP]    = useState(false);
  const [showC,    setShowC]    = useState(false);
  const [error,    setError]    = useState('');

  const strength = !password ? 0
    : password.length < 6  ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const sLabel = ['','Weak','Fair','Good','Strong'];
  const sColor = ['','#DC2626','#D97706','#16A34A','#1DB88A'];

  function next() {
    if (password.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    onChange('password', password)
    setError(''); onNext();
  }

  return (
    <AuthLayout illustration="signup" heading="Create your password"
      tagline="Choose a strong password to secure your account" step={4} totalSteps={5}>
      {error && <ErrBox msg={error} />}

      <Label text="Password" />
      <InputWrap icon={ICONS.lock}>
        <input className="auth-input" type={showP ? 'text' : 'password'}
          placeholder="Minimum 6 characters"
          value={password} onChange={e => setPassword(e.target.value)} />
        <EyeBtn show={showP} onToggle={() => setShowP(p => !p)} />
      </InputWrap>

      {password.length > 0 && (
        <div style={{marginTop:-8,marginBottom:14}}>
          <div className="auth-strength-row">
            {[1,2,3,4].map(i => (
              <div key={i} className="auth-strength-seg"
                style={{background: i <= strength ? sColor[strength] : '#E2E8F0'}}/>
            ))}
          </div>
          <span style={{fontSize:11,color:sColor[strength],fontWeight:700}}>{sLabel[strength]}</span>
        </div>
      )}

      <Label text="Confirm Password" />
      <InputWrap icon={ICONS.shield}>
        <input className="auth-input" type={showC ? 'text' : 'password'}
          placeholder="Re-enter password"
          style={{ borderColor: confirm && confirm !== password ? '#FCA5A5' : confirm && confirm === password ? '#86EFAC' : '#BFDBFE' }}
          value={confirm} onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && next()} />
        <EyeBtn show={showC} onToggle={() => setShowC(p => !p)} />
      </InputWrap>

      <NavBtns onBack={onBack} onNext={next} nextLabel="Continue →" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 5 — Terms & Conditions
═══════════════════════════════════ */
function StepTerms({ data, onAccept, onBack }) {
  const [agreed, setAgreed] = useState(false);
  const [error,  setError]  = useState('');

  async function accept() {
  if (!agreed) {
    setError('Please accept the Terms & Conditions to proceed.');
    return;
  }
  setError('');
  try {
    const res = await fetch(buildUrl('/api/Registration/signup'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          password: data.password,
          branchName: data.branchName,
          branchOwnerName: data.ownerName,
          branchPhone: data.phone,
        }),
    });

    const responseData = await res.json();

    if (!res.ok) {
      setError(responseData?.message || 'Signup failed');
      return;
    }

    onAccept();

  } catch (err) {
    setError('Network error. Please try again.');
    console.error(err);
  }
}

  

  return (
    <AuthLayout illustration="signup" heading="Terms & Conditions"
      tagline="Please review our privacy policy before continuing" step={5} totalSteps={5}>
      {error && <ErrBox msg={error} />}

      {/* Scrollable T&C card */}
      <div style={{
        maxHeight:280, overflowY:'auto',
        border:'1.5px solid #BFDBFE', borderRadius:12,
        padding:'14px 16px', background:'#F8FAFF',
        marginBottom:16, fontSize:13, color:'#334155', lineHeight:1.7,
      }}>
        <h4 style={{margin:'0 0 10px',color:'#0F172A',fontSize:14,fontWeight:800,display:'flex',alignItems:'center',gap:6}}>
          🔒 Privacy Policy
        </h4>
        <QA q="1. What information do we collect?"
          a="We collect name, email address, phone number, and other information necessary to create and manage user accounts, including school name and location." />
        <QA q="2. How do we collect information?"
          a="Through user registration on our web and mobile app, and through interactions such as chat conversations and usage of features like video content." />
        <QA q="3. Why do we collect information?"
          a="To create and manage user accounts, provide personalized services, improve our products and services, and comply with legal and regulatory requirements." />
        <QA q="4. How do we use the information collected?"
          a="To provide services, personalize experience, communicate with users, and improve our products. We may also use information for research and analytics." />
        <QA q="5. Do we share information with third parties?"
          a="We do not share user information with third parties without consent, except as required by law or to provide our services. We may share with trusted service providers who help us operate the platform." />
        <QA q="6. How do we protect user information?"
          a="We use encryption, firewalls, and security technologies to safeguard data. Our employees are trained on data protection and privacy best practices." />
        <QA q="7. How long do we keep user information?"
          a="As long as necessary to provide services and comply with legal obligations. Data is deleted securely when no longer needed." />
        <p style={{marginTop:12,color:'#64748B',fontSize:12}}>
          Questions? Contact us at <strong>support@schoolmentor.pk</strong>
        </p>
      </div>

      {/* Agree checkbox */}
      <label onClick={() => setAgreed(a => !a)}
        style={{
          display:'flex', alignItems:'flex-start', gap:12,
          cursor:'pointer', marginBottom:16,
          padding:'12px 14px',
          background: agreed ? '#F0FDF4' : '#F8FAFF',
          border:`1.5px solid ${agreed ? '#86EFAC' : '#BFDBFE'}`,
          borderRadius:12, transition:'all .2s',
        }}>
        <div style={{
          width:22, height:22, minWidth:22, borderRadius:6,
          border:`2px solid ${agreed ? '#1DB88A' : '#BFDBFE'}`,
          background: agreed ? '#1DB88A' : '#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .2s', marginTop:1,
        }}>
          {agreed && (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
        <span style={{fontSize:13,color:'#334155',fontWeight:500,lineHeight:1.5}}>
          I have read and agree to the{' '}
          <strong style={{color:'#1565C0'}}>Terms & Conditions</strong>{' '}and{' '}
          <strong style={{color:'#1565C0'}}>Privacy Policy</strong>{' '}of SchoolMentor.
        </span>
      </label>

      <button onClick={accept} style={{
        width:'100%', padding:'13px',
        background: agreed ? 'linear-gradient(135deg,#1565C0,#1DB88A)' : '#E2E8F0',
        color: agreed ? '#fff' : '#94A3B8',
        border:'none', borderRadius:12,
        fontSize:15, fontWeight:700,
        cursor: agreed ? 'pointer' : 'not-allowed',
        fontFamily:"'Plus Jakarta Sans',sans-serif",
        boxShadow: agreed ? '0 4px 14px rgba(21,101,192,.3)' : 'none',
        transition:'all .2s', marginBottom:10,
      }}>
        ✓ Accept & Create Account
      </button>

      <button onClick={onBack} style={{
        width:'100%', padding:'11px', background:'transparent',
        color:'#64748B', border:'1.5px solid #E2E8F0',
        borderRadius:12, fontSize:14, fontWeight:600,
        cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif",
      }}>
        ← Back
      </button>
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   SUCCESS
═══════════════════════════════════ */
function StepSuccess({ data, onGoToLogin }) {
  const country = getCountrySession();
  const rows = [
    ['🏫', 'Branch',    data.branchName],
    ['📍', 'Country',   `${country.flag || ''} ${country.name || ''}`],
    [country.verificationMethod === 'phone' ? '📱' : '📧',
      'Verified via',
      country.verificationMethod === 'phone' ? data.phone : data.email],
    ['🔒', 'Password',  'Set successfully'],
    ['📋', 'Terms',     'Accepted'],
  ];

  return (
    <AuthLayout illustration="signup" heading="You're all set! 🎉"
      tagline="Your school account has been created successfully">
      <div style={{textAlign:'center',padding:'8px 0'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#1565C0,#1DB88A)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 8px 24px rgba(29,184,138,.35)'}}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style={{margin:'0 0 4px',color:'#0F172A',fontSize:18,fontWeight:800}}>Welcome, {data.ownerName}!</h3>
        <p style={{color:'#64748B',fontSize:13,margin:'0 0 18px'}}>{data.branchName} is now live on SchoolMentor.</p>
      </div>

      <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:12,padding:'12px 14px',marginBottom:20,display:'flex',flexDirection:'column',gap:8}}>
        {rows.map(([icon, label, val]) => (
          <div key={label} style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
            <span style={{color:'#166534'}}>{icon} {label}</span>
            <span style={{color:'#0F172A',fontWeight:600,maxWidth:'55%',textAlign:'right'}}>{val}</span>
          </div>
        ))}
      </div>

      <button className="auth-btn-primary" onClick={onGoToLogin}>Go to Login →</button>
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   ORCHESTRATOR
═══════════════════════════════════ */
export default function SignupFlow({ onBack, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ branchName:'', ownerName:'', countryCode:'', phone:'', email:'', OTP: '', password: '' });

  const update = (k, v) => setForm(d => ({ ...d, [k]: v }));
  const isPK = COUNTRIES.find(c => c.code === form.countryCode)?.method === 'phone';

  if (step === 1) return <StepBranchOwner data={form} onChange={update} onNext={() => setStep(2)} onBack={onBack} />;
  if (step === 2) return isPK
    ? <StepPhone  data={form} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />
    : <StepEmail  data={form} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />;
  if (step === 3) return <StepOTP      data={form} onChange={update} onNext={() => setStep(4)} onBack={() => setStep(2)} />;
  if (step === 4) return <StepPassword    data={form}   onChange={update} onNext={() => setStep(5)} onBack={() => setStep(3)} />;
  if (step === 5) return <StepTerms      data={form}         onAccept={() => setStep(6)} onBack={() => setStep(4)} />;
  if (step === 6) return <StepSuccess  data={form} onGoToLogin={onComplete} />;
}
