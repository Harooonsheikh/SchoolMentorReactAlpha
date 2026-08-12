import { useState, useRef, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { buildUrl, buildChainApiUrl } from '../../utils/apiConfig';
import { normalizePkPhone } from '../../utils/phone';
import { useApp } from '../../context/AppContext';



/* ── Endpoints: school vs network ──
   Network Head Office ka apna users table hai (AHM_Login_Users), is liye uske
   OTP aur signup endpoints ERP walon se bilkul alag hain. Ek hi jagah rakhe
   hain taake teeno OTP steps aur signup ek jaisa faisla karein. */
const OTP_URL = (isNetwork, dest) => (isNetwork
  ? buildChainApiUrl(`/api/AHM_Login_Users/network-send-otp?PhoneNumber=${encodeURIComponent(dest)}`)
  : buildUrl(`/api/Auth/send?PhoneNumber=${encodeURIComponent(dest)}`));

const SIGNUP_URL = (isNetwork) => (isNetwork
  ? buildChainApiUrl('/api/AHM_Login_Users/network-signup')
  : buildUrl('/api/Registration/signup'));

/* ── Screen copy: school vs network ──
   Ek hi flow dono ke liye chalta hai, sirf alfaaz badalte hain. Network wala
   Head Office banata hai (poora network + owner/chairman), school wala ek
   branch. Sab text yahin se aata hai taake har step consistent rahe. */
const COPY = {
  school: {
    illustration: 'signup',
    step1Heading: 'Set up your school',
    step1Tagline: 'Tell us about your branch and team',
    nameLabel:    'Branch Name',
    namePlaceholder: 'e.g. Gulberg Branch, Main Campus',
    nameRequired: 'Branch name is required.',
    ownerLabel:   'Owner / Principal Name',
    ownerPlaceholder: 'e.g. Muhammad Ali',
    ownerRequired: 'Owner name is required.',
    emailPlaceholder: 'you@school.com',
    passwordTagline: 'Choose a strong password to secure your account',
    successTagline: 'Your school account has been created successfully',
    successNameLabel: 'Branch',
    successNameIcon: '🏫',
    liveSuffix: 'is now live on SchoolMentor.',
  },
  network: {
    illustration: 'signupNetwork',
    step1Heading: 'Set up your school network',
    step1Tagline: 'Tell us about your network and head office',
    nameLabel:    'School Network Name',
    namePlaceholder: 'e.g. Al-Noor Education Network',
    nameRequired: 'Network name is required.',
    ownerLabel:   'Owner / Chairman Name',
    ownerPlaceholder: 'e.g. Muhammad Ali',
    ownerRequired: 'Owner name is required.',
    emailPlaceholder: 'you@network.com',
    passwordTagline: 'Choose a strong password to secure your network account',
    successTagline: 'Your school network account has been created successfully',
    successNameLabel: 'Network',
    successNameIcon: '🏢',
    liveSuffix: 'network is now live on SchoolMentor.',
  },
};
const copyFor = (isNetwork) => (isNetwork ? COPY.network : COPY.school);

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
      <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: 14 }} />
    </button>
  );
}
function NavBtns({ onBack, onNext, backLabel = '← Back', nextLabel = 'Next →', busy = false, busyLabel = 'Please wait…' }) {
  return (
    <div className="auth-btn-row">
      <button className="auth-btn-back" onClick={onBack} disabled={busy}>{backLabel}</button>
      <button className="auth-btn-next" onClick={onNext} disabled={busy}
        style={busy ? { opacity:.6, cursor:'not-allowed' } : undefined}>
        {busy ? busyLabel : nextLabel}
      </button>
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

/* Icons — Font Awesome (login page ke saath consistent) */
const fi = { fontSize: 14 };
const ICONS = {
  home:   <i className="fa-solid fa-house"          style={fi} />,
  network:<i className="fa-solid fa-building"       style={fi} />,
  user:   <i className="fa-solid fa-user"           style={fi} />,
  phone:  <i className="fa-solid fa-mobile-screen"  style={fi} />,
  email:  <i className="fa-solid fa-envelope"       style={fi} />,
  lock:   <i className="fa-solid fa-lock"           style={fi} />,
  shield: <i className="fa-solid fa-shield-halved"  style={fi} />,
};

/* ═══════════════════════════════════
   STEP 1 — Branch / Owner / Country
═══════════════════════════════════ */
function StepBranchOwner({ data, onChange, onNext, onBack, isNetwork }) {
  const [error,       setError]       = useState('');
  const [dropOpen,    setDropOpen]    = useState(false);
  const dropRef = useRef(null);
  const c = copyFor(isNetwork);

  useEffect(() => {
    function close(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = COUNTRIES.find(c => c.code === data.countryCode) || null;

  function next() {
    if (!data.branchName.trim()) { setError(c.nameRequired); return; }
    if (!data.ownerName.trim())  { setError(c.ownerRequired); return; }
    if (!data.countryCode)       { setError('Please select your country.'); return; }
    if (selected) saveCountrySession(selected);
    setError(''); onNext();
  }

  return (
    <AuthLayout illustration={c.illustration} heading={c.step1Heading}
      tagline={c.step1Tagline} step={1} totalSteps={5}>
      {error && <ErrBox msg={error} />}

      <Label text={c.nameLabel} />
      <InputWrap icon={isNetwork ? ICONS.network : ICONS.home}>
        <input className="auth-input" placeholder={c.namePlaceholder}
          value={data.branchName} onChange={e => onChange('branchName', e.target.value)} />
      </InputWrap>

      <Label text={c.ownerLabel} />
      <InputWrap icon={ICONS.user}>
        <input className="auth-input" placeholder={c.ownerPlaceholder}
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

function StepPhone({ data, onChange, onNext, onBack, isNetwork }) {
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);
  const inFlight = useRef(false);   // double-click guard (state update async hota hai)
const { showToast } = useApp();


  async function next() {
  if (inFlight.current) return;

  if (data.phone.replace(/\D/g, '').length < 10) {
    setError('Enter a valid phone number.');
    return;
  }

  setError('');
  inFlight.current = true;
  setBusy(true);

  try {
    const res = await fetch(
      OTP_URL(isNetwork, data.phone),
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
  } finally {
    inFlight.current = false;
    setBusy(false);
  }
}

  return (
    <AuthLayout illustration={copyFor(isNetwork).illustration} heading="Your phone number"
      tagline="We'll send a 4-digit verification code" step={2} totalSteps={5}>
      {error && <ErrBox msg={error} />}
      <Label text="Phone Number" />
      <InputWrap icon={ICONS.phone}>
        <input className="auth-input" type="tel" placeholder="+92 300 0000000"
          value={data.phone} onChange={e => onChange('phone', normalizePkPhone(e.target.value))}
          disabled={busy}
          onKeyDown={e => e.key === 'Enter' && next()} />
      </InputWrap>
      <p style={{fontSize:12,color:'#64748B',marginTop:-8,marginBottom:16}}>🇵🇰 Format: 03XX-XXXXXXX or +92-3XX-XXXXXXX</p>
      <NavBtns onBack={onBack} onNext={next} nextLabel="Send OTP →" busy={busy} busyLabel="Sending OTP…" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 2b — Email (others)
═══════════════════════════════════ */
function StepEmail({ data, onChange, onNext, onBack, isNetwork }) {
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);
  const inFlight = useRef(false);   // double-click guard
  // function next() {
  //   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setError('Enter a valid email address.'); return; }
  //   setPhoneNo(data.email)
  //   setError(''); onNext();
  // }
  async function next() {
  if (inFlight.current) return;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setError('Enter a valid email address.'); return; }

  setError('');
  inFlight.current = true;
  setBusy(true);

  try {
    const res = await fetch(
      OTP_URL(isNetwork, data.email),
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
  } finally {
    inFlight.current = false;
    setBusy(false);
  }
}
  return (
    <AuthLayout illustration={copyFor(isNetwork).illustration} heading="Your email address"
      tagline="We'll send a 4-digit verification code" step={2} totalSteps={5}>
      {error && <ErrBox msg={error} />}
      <Label text="Email Address" />
      <InputWrap icon={ICONS.email}>
        <input className="auth-input" type="email" placeholder={copyFor(isNetwork).emailPlaceholder}
          value={data.email} onChange={e => onChange('email', e.target.value)}
          disabled={busy}
          onKeyDown={e => e.key === 'Enter' && next()} />
      </InputWrap>
      <NavBtns onBack={onBack} onNext={next} nextLabel="Send OTP →" busy={busy} busyLabel="Sending OTP…" />
    </AuthLayout>
  );
}

/* ═══════════════════════════════════
   STEP 3 — 4-digit OTP
═══════════════════════════════════ */
function StepOTP({ data,onChange,  onNext, onBack, isNetwork }) {
  const [otp,   setOtp]   = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const [busy,  setBusy]  = useState(false);
  const resending = useRef(false);   // double-click guard
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
    if (resending.current) return;
    setError('');
    resending.current = true;
    setBusy(true);

    try {
      const phone = country.verificationMethod === 'phone' ? data.phone : data.email;
      
      const res = await fetch(
        OTP_URL(isNetwork, phone),
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
      resending.current = false;
      setBusy(false);
    }
  }


  return (
    <AuthLayout illustration={copyFor(isNetwork).illustration} heading="Verify your account"
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
          : <button onClick={() => resendOTP()} disabled={busy}
              style={{background:'none',border:'none',color:'#1565C0',fontWeight:700,cursor: busy ? 'not-allowed' : 'pointer',opacity: busy ? .6 : 1,fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              {busy ? 'Sending…' : 'Resend OTP'}
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
function StepPassword({ data,onChange,  onNext, onBack, isNetwork }) {
  const c = copyFor(isNetwork);
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
    <AuthLayout illustration={c.illustration} heading="Create your password"
      tagline={c.passwordTagline} step={4} totalSteps={5}>
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
function StepTerms({ data, onAccept, onBack, isNetwork }) {
  const [agreed, setAgreed] = useState(false);
  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);
  /* Ref se guard karte hain kyunki setBusy async hai — tez double-click par
     dono clicks purani state parh kar do POST bhej dete the (duplicate branches). */
  const inFlight = useRef(false);

  async function accept() {
  if (inFlight.current) {
    setError('Branch is being created, please wait…');
    return;
  }
  if (!agreed) {
    setError('Please accept the Terms & Conditions to proceed.');
    return;
  }
  setError('');
  inFlight.current = true;
  setBusy(true);
  try {
    /* Dono signup endpoints ka payload bilkul alag hai:
         school  → { branchName, branchOwnerName, branchPhone, password }
         network → { schoolNetwork, ownerName, contactNumber, password, ... }
       Network ke bank/address fields is flow me abhi collect nahi hote, is liye
       khali jaate hain — backend inhe optional rakhta hai. */
    const res = await fetch(SIGNUP_URL(isNetwork), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        isNetwork
          ? {
              ownerName:     data.ownerName,
              schoolNetwork: data.branchName,
              contactNumber: data.phone,
              password:      data.password,
              address:       '',
              accountTitle:  '',
              bankName:      '',
              accountNumber: '',
              isAdmin:       true,
            }
          : {
              password: data.password,
              branchName: data.branchName,
              branchOwnerName: data.ownerName,
              branchPhone: data.phone,
            }
      ),
    });

    const responseData = await res.json();

    if (!res.ok) {
      setError(responseData?.message || 'Signup failed');
      inFlight.current = false;
      setBusy(false);
      return;
    }

    /* Success par guard jaan bujh kar release nahi karte — step 6 par jaate waqt
       koi late click dobara branch create na kar de. */
    onAccept();

  } catch (err) {
    setError('Network error. Please try again.');
    console.error(err);
    inFlight.current = false;
    setBusy(false);
  }
}

  

  return (
    <AuthLayout illustration={copyFor(isNetwork).illustration} heading="Terms & Conditions"
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

      {/* Button jaan bujh kar disabled nahi — taake dobara click par user ko
          "please wait" message dikhe; asli guard `inFlight` ref hai. */}
      <button onClick={accept} style={{
        width:'100%', padding:'13px',
        background: agreed ? 'linear-gradient(135deg,#1565C0,#1DB88A)' : '#E2E8F0',
        color: agreed ? '#fff' : '#94A3B8',
        border:'none', borderRadius:12,
        fontSize:15, fontWeight:700,
        cursor: (agreed && !busy) ? 'pointer' : 'not-allowed',
        opacity: busy ? .7 : 1,
        fontFamily:"'Plus Jakarta Sans',sans-serif",
        boxShadow: agreed ? '0 4px 14px rgba(21,101,192,.3)' : 'none',
        transition:'all .2s', marginBottom:10,
      }}>
        {busy ? 'Creating account…' : '✓ Accept & Create Account'}
      </button>

      <button onClick={onBack} disabled={busy} style={{
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
function StepSuccess({ data, onGoToLogin, isNetwork }) {
  const country = getCountrySession();
  const c = copyFor(isNetwork);
  const rows = [
    [c.successNameIcon, c.successNameLabel, data.branchName],
    ['📍', 'Country',   `${country.flag || ''} ${country.name || ''}`],
    [country.verificationMethod === 'phone' ? '📱' : '📧',
      'Verified via',
      country.verificationMethod === 'phone' ? data.phone : data.email],
    ['🔒', 'Password',  'Set successfully'],
    ['📋', 'Terms',     'Accepted'],
  ];

  return (
    <AuthLayout illustration={c.illustration} heading="You're all set! 🎉"
      tagline={c.successTagline}>
      <div style={{textAlign:'center',padding:'8px 0'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#1565C0,#1DB88A)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 8px 24px rgba(29,184,138,.35)'}}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style={{margin:'0 0 4px',color:'#0F172A',fontSize:18,fontWeight:800}}>Welcome, {data.ownerName}!</h3>
        <p style={{color:'#64748B',fontSize:13,margin:'0 0 18px'}}>{data.branchName} {c.liveSuffix}</p>
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
/* `isNetwork` login screen se aata hai: Network Head Office tab par signup
   dabaya gaya to poora flow network ke endpoints use karta hai
   (network-send-otp / network-signup), warna school wale. */
export default function SignupFlow({ onBack, onComplete, isNetwork = false }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ branchName:'', ownerName:'', countryCode:'', phone:'', email:'', OTP: '', password: '' });

  const update = (k, v) => setForm(d => ({ ...d, [k]: v }));
  const isPK = COUNTRIES.find(c => c.code === form.countryCode)?.method === 'phone';

  if (step === 1) return <StepBranchOwner data={form} onChange={update} onNext={() => setStep(2)} onBack={onBack} isNetwork={isNetwork} />;
  if (step === 2) return isPK
    ? <StepPhone  data={form} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} isNetwork={isNetwork} />
    : <StepEmail  data={form} onChange={update} onNext={() => setStep(3)} onBack={() => setStep(1)} isNetwork={isNetwork} />;
  if (step === 3) return <StepOTP      data={form} onChange={update} onNext={() => setStep(4)} onBack={() => setStep(2)} isNetwork={isNetwork} />;
  if (step === 4) return <StepPassword    data={form}   onChange={update} onNext={() => setStep(5)} onBack={() => setStep(3)} isNetwork={isNetwork} />;
  if (step === 5) return <StepTerms      data={form}         onAccept={() => setStep(6)} onBack={() => setStep(4)} isNetwork={isNetwork} />;
  if (step === 6) return <StepSuccess  data={form} onGoToLogin={onComplete} isNetwork={isNetwork} />;
}
