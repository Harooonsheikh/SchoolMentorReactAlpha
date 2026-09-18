import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const BLUE  = "#1565C0";
const TEAL  = "#1DB88A";
const TEXT  = "var(--sm-text)";
const MUTED = "var(--sm-text-muted)";
const BORDER= "var(--sm-border)";
const ERR   = "#dc2626";
const OK    = "#16a34a";
const GRAD  = "linear-gradient(135deg,#1565C0,#1DB88A)";
const PK_RE = /^(\+92|0092|92|0)3[0-9]{9}$/;
const WA    = "+923700036867";
const EMAIL = "support@schoolmentor.ai";
const validPhone = (v) => PK_RE.test(v.replace(/\s/g, ""));

// ─────────────────────────────────────────────────────────────────
// SVG ICON HELPERS  (Feather/Lucide style — no emojis)
// ─────────────────────────────────────────────────────────────────
const I = ({ d, cx, cy, r, rx, ry, width, height, points, x, x1, x2, y, y1, y2, viewBox, children, style: sx, ...rest }) => null; // placeholder unused

// Inline icon function — returns JSX
const icon = (content, { w=16, h=16, sw=1.75, col="currentColor", fill="none" } = {}) => (
  <svg viewBox="0 0 24 24" width={w} height={h} fill={fill}
    stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{display:"block",flexShrink:0}}>
    {content}
  </svg>
);

const ICONS = {
  user:      icon(<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></>),
  building:  icon(<><path d="M3 21h18M9 21V7l9-4v18M9 11H3v10"/><rect x="9" y="11" width="3" height="4"/></>),
  phone:     icon(<><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="12" y1="18" x2="12.01" y2="18"/></>),
  lock:      icon(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>),
  eyeOn:     icon(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>),
  eyeOff:    icon(<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>),
  check:     icon(<><polyline points="20 6 9 17 4 12"/></>, {sw:2.2}),
  alert:     icon(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>, {sw:2}),
  tri:       icon(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, {sw:2}),
  clock:     icon(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, {sw:2}),
  back:      icon(<><polyline points="15 18 9 12 15 6"/></>, {sw:2,w:14,h:14}),
  info:      icon(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>, {sw:2,w:14,h:14,col:BLUE}),
  grad:      icon(<><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c0 2.21 2.686 4 6 4s6-1.79 6-4v-5"/></>, {w:22,h:22,col:"rgba(255,255,255,.9)"}),
  school:    icon(<><path d="M3 21h18M9 21V7l9-4v18M9 11H3v10"/><rect x="9" y="11" width="3" height="4"/></>, {w:20,h:20,col:"#fff"}),
  userPlus:  icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>, {w:18,h:18,col:"#fff",sw:2.2}),
  checkBtn:  icon(<><polyline points="20 6 9 17 4 12"/></>, {w:18,h:18,col:"#fff",sw:2.2}),
  login:     icon(<><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>, {w:18,h:18,col:"#fff",sw:2.2}),
  otp:       icon(<><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="12" y1="18" x2="12.01" y2="18"/></>, {w:28,h:28,col:BLUE,sw:1.8}),
  bigCheck:  icon(<><polyline points="20 6 9 17 4 12" style={{strokeDasharray:28,strokeDashoffset:28,animation:"suCheckDraw .5s ease .4s both"}}/></>, {w:36,h:36,col:OK,sw:2.5}),
  mail:      icon(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>, {w:15,h:15,col:"#fff",sw:2}),
  checkOk:   icon(<><polyline points="20 6 9 17 4 12"/></>, {w:13,h:13,col:OK,sw:2.5}),
};

const WaIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" style={{display:"block",flexShrink:0}}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.529 5.872L0 24l6.319-1.501A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.813 9.813 0 01-4.988-1.364l-.358-.213-3.751.891.935-3.62-.234-.372A9.808 9.808 0 012.182 12C2.182 6.577 6.577 2.182 12 2.182S21.818 6.577 21.818 12 17.423 21.818 12 21.818z"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────

function FMsg({ type = "err", children }) {
  if (!children) return null;
  const col = type === "err" ? ERR : OK;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:5, marginTop:5, fontSize:12, color:col, lineHeight:1.4, animation:"suSlideErr .25s ease" }}>
      <span style={{marginTop:1, flexShrink:0}}>{type==="err" ? ICONS.alert : ICONS.checkOk}</span>
      {children}
    </div>
  );
}

function TextInput({ hasLeadIcon, hasTrailIcon, state, ...rest }) {
  const [focused, setFocused] = useState(false);
  const bc = state==="err" ? ERR : state==="ok" ? OK : focused ? BLUE : BORDER;
  const sh = focused ? `0 0 0 3px ${state==="err" ? "rgba(220,38,38,.1)" : "rgba(21,101,192,.1)"}` : "none";
  return (
    <input
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width:"100%", height:46,
        paddingLeft: hasLeadIcon ? 40 : 14,
        paddingRight: hasTrailIcon ? 42 : 14,
        fontSize:14, fontFamily:"inherit",
        border:`1.5px solid ${bc}`, borderRadius:12, outline:"none",
        background: state==="err" ? "rgba(220,38,38,.025)" : "var(--sm-surface)",
        color:TEXT, boxShadow:sh,
        transition:"border-color .2s,box-shadow .2s,background .2s",
        WebkitAppearance:"none",
      }}
      {...rest}
    />
  );
}

function PwdInput({ state, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <TextInput type={show?"text":"password"} hasLeadIcon hasTrailIcon
        state={state} value={value} onChange={onChange} placeholder={placeholder}/>
      <button type="button" onClick={() => setShow(s=>!s)}
        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
          background:"none",border:"none",cursor:"pointer",color:MUTED,padding:0,
          display:"flex",alignItems:"center"}}
        aria-label="Toggle password">
        {show ? ICONS.eyeOff : ICONS.eyeOn}
      </button>
    </>
  );
}

function TrailCheck({ on }) {
  if (!on) return null;
  return (
    <span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",color:OK,pointerEvents:"none",display:"flex"}}>
      {ICONS.check}
    </span>
  );
}

function Field({ label, leadIcon, error, okMsg, helper, children }) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:12.5,fontWeight:700,color:TEXT,marginBottom:7}}>
        {label}
      </label>
      <div style={{position:"relative"}}>
        {leadIcon && (
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:MUTED,pointerEvents:"none",display:"flex"}}>
            {leadIcon}
          </span>
        )}
        {children}
      </div>
      {error  && <FMsg type="err">{error}</FMsg>}
      {okMsg && !error && <FMsg type="ok">{okMsg}</FMsg>}
      {helper && !error && !okMsg && (
        <div style={{marginTop:7,fontSize:11.5,color:MUTED,lineHeight:1.55,padding:"9px 11px",background:"rgba(21,101,192,.04)",borderRadius:9,border:"1px solid rgba(21,101,192,.1)",display:"flex",gap:7,alignItems:"flex-start"}}>
          {ICONS.info}<span>{helper}</span>
        </div>
      )}
    </div>
  );
}

// Password strength
const SC = ["","#ef4444","#f59e0b","#3B82F6","#16a34a"];
const SL = ["","Weak","Fair","Good","Strong"];
function getStr(p) {
  if (!p) return 0;
  return Math.max(1,(p.length>=8?1:0)+(/[A-Z]/.test(p)?1:0)+(/[0-9]/.test(p)?1:0)+(/[^A-Za-z0-9]/.test(p)?1:0));
}
function StrengthMeter({ password }) {
  if (!password) return null;
  const s = getStr(password);
  return (
    <div style={{marginTop:9}}>
      <div style={{display:"flex",gap:4}}>
        {[1,2,3,4].map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=s?SC[s]:BORDER,transition:"background .3s"}}/>)}
      </div>
      <div style={{fontSize:11,fontWeight:700,marginTop:4,color:SC[s]}}>{SL[s]}</div>
    </div>
  );
}

// Checkbox
function Chkbox({ checked, error, onClick }) {
  return (
    <div onClick={onClick} style={{
      width:19,height:19,borderRadius:6,flexShrink:0,marginTop:2,
      border:`1.5px solid ${error?ERR:checked?BLUE:BORDER}`,
      background:checked?BLUE:"var(--sm-surface)",
      display:"flex",alignItems:"center",justifyContent:"center",
      cursor:"pointer",transition:"all .2s",
    }}>
      {checked && (
        <svg viewBox="0 0 12 10" style={{width:11,height:11}} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 5 4.5 8.5 11 1"/>
        </svg>
      )}
    </div>
  );
}

// Primary button
function PBtn({ children, disabled, loading, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" disabled={disabled||loading} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:"100%",height:48,borderRadius:13,
        background:disabled?"#c5d3e8":GRAD,
        color:"#fff",fontSize:14.5,fontWeight:800,
        border:"none",cursor:disabled?"not-allowed":"pointer",
        fontFamily:"inherit",letterSpacing:".2px",
        display:"flex",alignItems:"center",justifyContent:"center",gap:9,
        boxShadow:disabled?"none":hov?"0 12px 32px rgba(21,101,192,.34)":"0 6px 22px rgba(21,101,192,.26)",
        transform:hov&&!disabled?"translateY(-2px)":"none",
        transition:"all .22s ease",
        position:"relative",overflow:"hidden",
      }}>
      {loading
        ? <span style={{animation:"suSpin .9s linear infinite",display:"inline-block",fontSize:18}}>⟳</span>
        : children}
    </button>
  );
}

// OTP digit boxes
function OtpBoxes({ value, onChange, hasError, hasSuccess }) {
  const refs = useRef([]);
  const digits = (value.padEnd(6," ")).slice(0,6).split("");

  const handleChange = (i, v) => {
    const d = v.replace(/\D/g,"").slice(-1);
    const arr = [...digits];
    arr[i] = d || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (d && i < 5) refs.current[i+1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key==="Backspace" && !digits[i].trim() && i>0) refs.current[i-1]?.focus();
    if (e.key==="ArrowLeft"  && i>0) refs.current[i-1]?.focus();
    if (e.key==="ArrowRight" && i<5) refs.current[i+1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    onChange(p);
    refs.current[Math.min(p.length,5)]?.focus();
  };

  return (
    <div style={{display:"flex",gap:9,justifyContent:"center",marginBottom:6}}>
      {digits.map((d,i)=>{
        const filled = !!d.trim();
        const bc = hasError ? ERR : hasSuccess&&filled ? OK : filled ? BLUE : BORDER;
        const bg = hasError ? "rgba(220,38,38,.04)" : hasSuccess&&filled ? "rgba(22,163,74,.04)" : filled ? "rgba(21,101,192,.05)" : "var(--sm-surface)";
        return (
          <input key={i} ref={el=>refs.current[i]=el}
            type="text" inputMode="numeric" maxLength={1}
            value={d.trim()} onChange={e=>handleChange(i,e.target.value)}
            onKeyDown={e=>handleKey(i,e)} onPaste={handlePaste}
            style={{
              width:50,height:58,textAlign:"center",
              fontSize:22,fontWeight:800,color:TEXT,fontFamily:"inherit",
              border:`1.5px solid ${bc}`,borderRadius:13,outline:"none",
              background:bg,caretColor:BLUE,
              transition:"all .2s ease",
              animation:hasError?"suShake .35s ease":"none",
            }}
          />
        );
      })}
    </div>
  );
}

// Support bar — always visible below card
function SupportBar() {
  const [hovWa,   setHovWa]   = useState(false);
  const [hovMail, setHovMail] = useState(false);
  const pill = (hov, extra={}) => ({
    display:"inline-flex",alignItems:"center",gap:7,
    color:"#fff",textDecoration:"none",
    fontSize:13,fontWeight:700,
    padding:"8px 16px",borderRadius:100,
    flexShrink:0,
    transition:"all .25s ease",
    transform:hov?"translateY(-2px)":"none",
    ...extra,
  });
  return (
    <div style={{marginTop:16,background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.22)",borderRadius:16,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
      <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.6)",letterSpacing:"1.5px",textTransform:"uppercase",flexShrink:0}}>
        Need Help?
      </span>
      <a href={`https://wa.me/${WA.replace("+","")}`} target="_blank" rel="noreferrer"
        onMouseEnter={()=>setHovWa(true)} onMouseLeave={()=>setHovWa(false)}
        style={pill(hovWa,{background:"linear-gradient(135deg,#25D366,#128C7E)",boxShadow:hovWa?"0 8px 20px rgba(37,211,102,.4)":"0 4px 12px rgba(37,211,102,.3)"})}>
        <WaIcon/>{WA}
      </a>
      <a href={`mailto:${EMAIL}`}
        onMouseEnter={()=>setHovMail(true)} onMouseLeave={()=>setHovMail(false)}
        style={pill(hovMail,{background:"rgba(21,101,192,.85)",border:"1px solid rgba(255,255,255,.25)",boxShadow:hovMail?"0 8px 20px rgba(21,101,192,.4)":"0 4px 12px rgba(21,101,192,.3)"})}>
        {ICONS.mail}{EMAIL}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP 1 — FORM
// ─────────────────────────────────────────────────────────────────
function StepForm({ onDone, onLogin }) {
  const [f, setF] = useState({ owner:"", org:"", phone:"", pass:"", conf:"" });
  const [agreed, setAgreed] = useState(false);
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const clrErr = (k) => setErrs(p=>({...p,[k]:""}));

  const phoneOk = validPhone(f.phone);
  const passOk  = f.pass.length >= 8;
  const confOk  = f.pass===f.conf && f.conf.length>0 && passOk;
  const canGo   = f.owner.trim() && f.org.trim() && phoneOk && passOk && confOk && agreed;

  const submit = async () => {
    const e = {};
    if (!f.owner.trim()) e.owner="Please enter the school owner or authorized person name.";
    if (!f.org.trim())   e.org  ="Please enter your school or educational institute name.";
    if (!phoneOk)        e.phone="Please enter a valid Pakistani mobile number (03XXXXXXXXX or +92XXXXXXXXXX).";
    if (!passOk)         e.pass ="Password must contain at least 8 characters.";
    if (!confOk)         e.conf ="Password and confirm password do not match.";
    if (!agreed)         e.terms="Please agree to the Terms & Conditions and Privacy Policy to continue.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,1400));
    setLoading(false);
    onDone({ owner:f.owner, org:f.org, phone:f.phone });
  };

  return (
    <div style={{animation:"suFadeIn .4s cubic-bezier(.22,.97,.47,1) both"}}>
      <h2 style={{fontSize:21,fontWeight:900,color:TEXT,marginBottom:5,letterSpacing:"-.3px"}}>Create your account</h2>
      <p  style={{fontSize:13.5,color:MUTED,lineHeight:1.6,marginBottom:26}}>Join 700+ schools already using SchoolMentor</p>

      <Field label="School Owner / Authorized Person Name" leadIcon={ICONS.user} error={errs.owner}>
        <TextInput type="text" hasLeadIcon hasTrailIcon={!errs.owner&&f.owner.trim().length>1}
          value={f.owner} placeholder="Enter your full name"
          state={errs.owner?"err":f.owner.trim()?"ok":""}
          onChange={e=>{set("owner",e.target.value);clrErr("owner")}}/>
        <TrailCheck on={!errs.owner&&f.owner.trim().length>1}/>
      </Field>

      <Field label="School / Educational Institute Name" leadIcon={ICONS.building} error={errs.org}>
        <TextInput type="text" hasLeadIcon hasTrailIcon={!errs.org&&f.org.trim().length>1}
          value={f.org} placeholder="Enter your school or institute name"
          state={errs.org?"err":f.org.trim()?"ok":""}
          onChange={e=>{set("org",e.target.value);clrErr("org")}}/>
        <TrailCheck on={!errs.org&&f.org.trim().length>1}/>
      </Field>

      <Field label="Contact Number" leadIcon={ICONS.phone} error={errs.phone}
        okMsg={!errs.phone&&f.phone&&phoneOk?"Valid Pakistani mobile number":""}
        helper="Please enter an active mobile number where you can receive OTP. Ensure the number is on its original network to avoid OTP delivery issues.">
        <TextInput type="tel" hasLeadIcon hasTrailIcon={!errs.phone&&phoneOk}
          value={f.phone} placeholder="03XXXXXXXXX or +92XXXXXXXXXX"
          state={errs.phone?"err":f.phone&&phoneOk?"ok":""}
          onChange={e=>{set("phone",e.target.value);clrErr("phone")}}/>
        <TrailCheck on={!errs.phone&&phoneOk}/>
      </Field>

      <Field label="Create Password" leadIcon={ICONS.lock} error={errs.pass}>
        <div style={{position:"relative"}}>
          <PwdInput value={f.pass} placeholder="Create a secure password"
            state={errs.pass?"err":passOk?"ok":""}
            onChange={e=>{set("pass",e.target.value);clrErr("pass");clrErr("conf")}}/>
        </div>
        <StrengthMeter password={f.pass}/>
      </Field>

      <Field label="Confirm Password" leadIcon={ICONS.lock} error={errs.conf}
        okMsg={!errs.conf&&confOk?"Passwords match":""}>
        <div style={{position:"relative"}}>
          <PwdInput value={f.conf} placeholder="Re-enter your password"
            state={errs.conf?"err":confOk?"ok":""}
            onChange={e=>{set("conf",e.target.value);clrErr("conf")}}/>
        </div>
      </Field>

      {/* Terms */}
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:20,cursor:"pointer"}}
        onClick={()=>{setAgreed(a=>!a);clrErr("terms")}}>
        <Chkbox checked={agreed} error={!!errs.terms} onClick={()=>{}}/>
        <span style={{fontSize:13,color:MUTED,lineHeight:1.6,userSelect:"none"}}>
          I agree to the{" "}
          <a href="/terms" target="_blank" style={{color:BLUE,fontWeight:700}} onClick={e=>e.stopPropagation()}>Terms &amp; Conditions</a>
          {" "}and{" "}
          <a href="/privacy" target="_blank" style={{color:BLUE,fontWeight:700}} onClick={e=>e.stopPropagation()}>Privacy Policy</a>
          {" "}of School Mentor.
        </span>
      </div>
      {errs.terms && <div style={{marginTop:-12,marginBottom:16}}><FMsg type="err">{errs.terms}</FMsg></div>}

      <PBtn disabled={!canGo} loading={loading} onClick={submit}>
        {ICONS.userPlus} Create Account &amp; Send OTP
      </PBtn>

      <div style={{textAlign:"center",marginTop:20,fontSize:13,color:MUTED}}>
        Already have an account?{" "}
        <button onClick={onLogin} style={{background:"none",border:"none",color:BLUE,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Login</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP 2 — OTP
// ─────────────────────────────────────────────────────────────────
function StepOtp({ phone, onSuccess, onBack }) {
  const [otp,       setOtp]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [otpErr,    setOtpErr]    = useState("");
  const [otpOk,     setOtpOk]     = useState(false);
  const [timer,     setTimer]     = useState(60);
  const [canResend, setCanResend] = useState(false);
  const tRef = useRef(null);

  const startTimer = useCallback(() => {
    setTimer(60); setCanResend(false);
    clearInterval(tRef.current);
    tRef.current = setInterval(() => {
      setTimer(t => { if(t<=1){ clearInterval(tRef.current); setCanResend(true); return 0; } return t-1; });
    }, 1000);
  },[]);

  useEffect(() => { startTimer(); return () => clearInterval(tRef.current); }, [startTimer]);

  const verify = async () => {
    if (otp.trim().length < 6) { setOtpErr("Please enter the complete 6-digit verification code."); return; }
    setLoading(true); setOtpErr("");
    await new Promise(r=>setTimeout(r,1400));
    setLoading(false);
    if (otp.trim() === "000000") {
      setOtpErr("Invalid OTP. Please enter the correct verification code.");
    } else {
      setOtpOk(true); clearInterval(tRef.current);
      setTimeout(onSuccess, 500);
    }
  };

  const resend = async () => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,900));
    setLoading(false);
    setOtp(""); setOtpErr(""); setOtpOk(false); startTimer();
  };

  const pct = (timer/60)*100;

  return (
    <div style={{animation:"suFadeIn .4s cubic-bezier(.22,.97,.47,1) both"}}>
      {/* Header */}
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:68,height:68,borderRadius:"50%",margin:"0 auto 16px",background:"linear-gradient(135deg,rgba(21,101,192,.1),rgba(29,184,138,.1))",border:"2px solid rgba(21,101,192,.15)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",animation:"suPop .55s cubic-bezier(.22,.97,.47,1)"}}>
          <div style={{position:"absolute",inset:-6,borderRadius:"50%",border:"2px solid rgba(21,101,192,.22)",animation:"suPulseRing 2s ease-out infinite"}}/>
          {ICONS.otp}
        </div>
        <h2 style={{fontSize:21,fontWeight:900,color:TEXT,marginBottom:5}}>Verify your number</h2>
        <p style={{fontSize:13.5,color:MUTED,lineHeight:1.6}}>
          A 6-digit OTP was sent to<br/>
          <strong style={{color:TEXT,fontSize:15}}>{phone}</strong>
        </p>
      </div>

      <OtpBoxes value={otp} onChange={v=>{setOtp(v);setOtpErr("");}} hasError={!!otpErr} hasSuccess={otpOk}/>

      {/* Error banner */}
      {otpErr && (
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"12px 0",padding:"11px 14px",background:"rgba(220,38,38,.06)",border:"1.5px solid rgba(220,38,38,.2)",borderRadius:11,fontSize:13,color:ERR,animation:"suSlideErr .3s ease"}}>
          <span style={{flexShrink:0}}>{ICONS.tri}</span>{otpErr}
        </div>
      )}

      {/* Progress bar */}
      <div style={{height:3,background:BORDER,borderRadius:2,overflow:"hidden",margin:"18px 0 0"}}>
        <div style={{height:"100%",borderRadius:2,background:GRAD,width:`${pct}%`,transition:"width 1s linear"}}/>
      </div>

      <PBtn disabled={otp.trim().length<6} loading={loading} onClick={verify} style={{marginTop:18}}>
        {ICONS.checkBtn} Verify OTP
      </PBtn>

      {/* Resend */}
      <div style={{textAlign:"center",marginTop:14,fontSize:13,color:MUTED}}>
        {canResend ? (
          <button onClick={resend} disabled={loading}
            style={{background:"none",border:"none",color:BLUE,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6}}>
            {ICONS.clock} Resend OTP
          </button>
        ) : (
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(21,101,192,.07)",borderRadius:100,padding:"4px 12px",fontSize:12.5,fontWeight:700,color:BLUE}}>
            {ICONS.clock} Resend in <strong>{timer}s</strong>
          </span>
        )}
      </div>

      {/* Note */}
      <div style={{marginTop:16,padding:"11px 14px",background:"rgba(21,101,192,.04)",borderRadius:11,border:"1px solid rgba(21,101,192,.1)",fontSize:12,color:MUTED,lineHeight:1.6,display:"flex",gap:9,alignItems:"flex-start"}}>
        {ICONS.info}
        <span>Did not receive the OTP? Ensure your number is on its original network. Numbers converted to a different network may not receive OTP messages.</span>
      </div>

      {/* Back */}
      <button onClick={onBack}
        style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:MUTED,fontSize:12.5,cursor:"pointer",fontFamily:"inherit",padding:"8px 0",width:"100%",justifyContent:"center",marginTop:8,transition:"color .2s"}}
        onMouseEnter={e=>e.currentTarget.style.color=BLUE}
        onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
        {ICONS.back} Change mobile number
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STEP 3 — SUCCESS
// ─────────────────────────────────────────────────────────────────
function StepSuccess({ owner, org, onLogin }) {
  return (
    <div style={{textAlign:"center",animation:"suFadeIn .5s cubic-bezier(.22,.97,.47,1) both"}}>
      {/* Animated check */}
      <div style={{width:84,height:84,borderRadius:"50%",margin:"0 auto 22px",background:"linear-gradient(135deg,rgba(22,163,74,.12),rgba(29,184,138,.12))",border:"2px solid rgba(22,163,74,.2)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",animation:"suPop .6s cubic-bezier(.22,.97,.47,1)"}}>
        <div style={{position:"absolute",inset:-8,borderRadius:"50%",border:"2px solid rgba(22,163,74,.2)",animation:"suPulseRing 2.5s ease-out .5s infinite"}}/>
        {ICONS.bigCheck}
      </div>

      {/* Pill */}
      <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(22,163,74,.08)",border:"1px solid rgba(22,163,74,.2)",borderRadius:100,padding:"5px 14px",fontSize:12,fontWeight:700,color:OK,marginBottom:14}}>
        {ICONS.checkOk} Account Created Successfully
      </div>

      <h2 style={{fontSize:21,fontWeight:900,color:TEXT,marginBottom:5}}>Welcome to SchoolMentor!</h2>
      <p  style={{fontSize:13.5,color:MUTED,lineHeight:1.6,marginBottom:22}}>
        Your account has been created successfully.<br/>Please login to continue.
      </p>

      {/* School card */}
      <div style={{background:"linear-gradient(135deg,rgba(21,101,192,.05),rgba(29,184,138,.04))",border:"1.5px solid rgba(21,101,192,.1)",borderRadius:14,padding:"14px 18px",marginBottom:24,display:"flex",alignItems:"center",gap:13,textAlign:"left"}}>
        <div style={{width:42,height:42,borderRadius:12,flexShrink:0,background:GRAD,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {ICONS.school}
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:800,color:TEXT}}>{org}</div>
          <div style={{fontSize:12,color:MUTED,marginTop:2}}>{owner}</div>
        </div>
      </div>

      <PBtn onClick={onLogin}>{ICONS.login} Go to Login</PBtn>

      <div style={{textAlign:"center",marginTop:16,fontSize:13,color:MUTED}}>
        <button onClick={onLogin} style={{background:"none",border:"none",color:BLUE,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Already have an account? Login
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────
export default function SignUp({ onLogin }) {
  const [step, setStep] = useState("form");
  const [data, setData] = useState({ owner:"", org:"", phone:"" });

  const handleFormDone = (info) => {
    setData(info);
    setStep("otp");
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes suShimmer   {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes suOrbFloat  {0%,100%{transform:translate(0,0)}50%{transform:translate(14px,12px)}}
        @keyframes suFadeUp    {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes suFadeIn    {from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes suShake     {0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        @keyframes suSpin      {to{transform:rotate(360deg)}}
        @keyframes suPop       {0%{opacity:0;transform:scale(.65)}65%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
        @keyframes suPulseRing {0%{transform:scale(1);opacity:.6}70%{transform:scale(1.55);opacity:0}100%{opacity:0}}
        @keyframes suSlideErr  {from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes suCheckDraw {from{stroke-dashoffset:28}to{stroke-dashoffset:0}}
        * { box-sizing:border-box; }
      `}</style>

      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",background:"linear-gradient(135deg,#1565C0 0%,#1178a8 55%,#1DB88A 100%)",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",padding:"0",position:"relative",overflow:"hidden"}}>

        {/* Dot grid */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)",backgroundSize:"52px 52px"}}/>

        {/* Orbs */}
        <div style={{position:"fixed",width:540,height:540,borderRadius:"50%",top:-190,right:-100,background:"radial-gradient(circle,rgba(255,255,255,.07),transparent 65%)",animation:"suOrbFloat 9s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"fixed",width:400,height:400,borderRadius:"50%",bottom:-150,left:-90,background:"radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)",animation:"suOrbFloat 12s ease-in-out infinite reverse",pointerEvents:"none"}}/>

        {/* Top shimmer bar */}
        <div style={{position:"fixed",top:0,left:0,right:0,height:3,zIndex:999,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.85),rgba(255,255,255,.2),rgba(255,255,255,.85),transparent)",backgroundSize:"200% 100%",animation:"suShimmer 3.5s linear infinite"}}/>

        {/* Page wrap */}
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:520,margin:"32px auto",padding:"0 16px 40px"}}>

          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:22,animation:"suFadeUp .5s ease both"}}>
            <div style={{width:40,height:40,borderRadius:12,background:"rgba(255,255,255,.18)",border:"1.5px solid rgba(255,255,255,.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {ICONS.grad}
            </div>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-.3px"}}>
                <span style={{fontWeight:400,opacity:.82}}>School</span>Mentor
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.58)",fontWeight:500,letterSpacing:".5px"}}>Creating the Future</div>
            </div>
          </div>

          {/* Card */}
          <div style={{background:"var(--sm-surface)",borderRadius:24,boxShadow:"0 32px 80px rgba(0,0,0,.22)",overflow:"hidden",width:"100%",animation:"suFadeUp .6s ease .08s both"}}>
            <div style={{height:4,background:GRAD}}/>
            <div style={{padding:"32px 34px 34px"}}>
              {step==="form"    && <StepForm    onDone={handleFormDone} onLogin={()=>onLogin?.()}/>}
              {step==="otp"     && <StepOtp     phone={data.phone} onSuccess={()=>setStep("success")} onBack={()=>setStep("form")}/>}
              {step==="success" && <StepSuccess owner={data.owner} org={data.org} onLogin={()=>onLogin?.()}/>}
            </div>
          </div>

          {/* Support bar — always visible below card */}
          <SupportBar/>
        </div>
      </div>
    </>
  );
}
