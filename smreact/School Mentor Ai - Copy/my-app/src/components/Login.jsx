import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────
const BLUE = "#1565C0";
const TEAL = "#1DB88A";
const TEXT = "var(--sm-text)";
const MUTED = "var(--sm-text-muted)";
const BORDER = "var(--sm-border)";
const ERR = "#dc2626";
const OK = "#16a34a";
const GRAD = "linear-gradient(135deg,#1565C0,#1DB88A)";
const PK = /^(\+92|0092|92|0)3[0-9]{9}$/;
const validPK = v => PK.test(v.replace(/\s/g, ""));
const WA = "+923700036867";
const EMAIL = "support@schoolmentor.ai";

// ─── SVG Icons ────────────────────────────────────────────────────
const ic = (d, props = {}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={props.sw || 1.75} strokeLinecap="round" strokeLinejoin="round"
    style={{ width: props.w || 16, height: props.h || 16, display: "block", flexShrink: 0, ...(props.style || {}) }}>
    {d}
  </svg>
);
const ICONS = {
  phone: ic(<><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="6" x2="15" y2="6" /><line x1="12" y1="18" x2="12.01" y2="18" /></>),
  lock: ic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  eyeOn: ic(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: ic(<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>),
  check: ic(<><polyline points="20 6 9 17 4 12" /></>, { sw: 2.2 }),
  alert: ic(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>, { sw: 2 }),
  tri: ic(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>, { sw: 2 }),
  info: ic(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>, { sw: 2 }),
  clock: ic(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>, { sw: 2 }),
  back: ic(<><polyline points="15 18 9 12 15 6" /></>, { sw: 2 }),
  login: ic(<><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></>, { sw: 2.2, w: 18, h: 18, style: { stroke: "#fff" } }),
  send: ic(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>, { sw: 2.2, w: 18, h: 18, style: { stroke: "#fff" } }),
  verifyOk: ic(<><polyline points="20 6 9 17 4 12" /></>, { sw: 2.2, w: 18, h: 18, style: { stroke: "#fff" } }),
  resetLk: ic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>, { sw: 2.2, w: 18, h: 18, style: { stroke: "#fff" } }),
  grad: ic(<><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" /><path d="M6 12v5c0 2.21 2.686 4 6 4s6-1.79 6-4v-5" /></>, { sw: 2.2, w: 22, h: 22, style: { stroke: "rgba(255,255,255,.92)" } }),
  principal: ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>, { sw: 1.6, w: 28, h: 28, style: { stroke: BLUE } }),
  teacher: ic(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>, { sw: 1.6, w: 28, h: 28, style: { stroke: BLUE } }),
  parent: ic(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></>, { sw: 1.6, w: 28, h: 28, style: { stroke: BLUE } }),
  admin: ic(<><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l-1.41-1.41M6.34 6.34L4.93 4.93" /></>, { sw: 1.6, w: 28, h: 28, style: { stroke: BLUE } }),
  mail: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>),
  wa: (<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.529 5.872L0 24l6.319-1.501A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.813 9.813 0 01-4.988-1.364l-.358-.213-3.751.891.935-3.62-.234-.372A9.808 9.808 0 012.182 12C2.182 6.577 6.577 2.182 12 2.182S21.818 6.577 21.818 12 17.423 21.818 12 21.818z" /></svg>),
};

// ─── Shared primitives ────────────────────────────────────────────

function FMsg({ type = "err", children }) {
  if (!children) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 5, fontSize: 12, color: type === "err" ? ERR : OK, lineHeight: 1.4, animation: "lgSlideErr .25s ease" }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}>{type === "err" ? ICONS.alert : ICONS.check}</span>
      {children}
    </div>
  );
}

function AlertBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "11px 14px", borderRadius: 11, background: "rgba(220,38,38,.06)", border: "1.5px solid rgba(220,38,38,.2)", color: ERR, fontSize: 13, lineHeight: 1.5, animation: "lgSlideErr .3s ease" }}>
      <span style={{ flexShrink: 0 }}>{ICONS.tri}</span>{msg}
    </div>
  );
}

function TextInput({ leadIcon, trailIcon, state, ...rest }) {
  const [focused, setFocused] = useState(false);
  const bc = state === "err" ? ERR : state === "ok" ? OK : focused ? BLUE : BORDER;
  const sh = focused ? `0 0 0 3px ${state === "err" ? "rgba(220,38,38,.1)" : "rgba(21,101,192,.1)"}` : "none";
  return (
    <div style={{ position: "relative" }}>
      {leadIcon && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTED, display: "flex", pointerEvents: "none" }}>{leadIcon}</span>}
      <input
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 46,
          paddingLeft: leadIcon ? 40 : 14,
          paddingRight: trailIcon ? 42 : 14,
          fontSize: 14, fontFamily: "inherit",
          border: `1.5px solid ${bc}`, borderRadius: 12, outline: "none",
          background: state === "err" ? "rgba(220,38,38,.025)" : "var(--sm-surface)",
          color: TEXT, boxShadow: sh,
          transition: "border-color .2s,box-shadow .2s,background .2s",
          WebkitAppearance: "none",
        }}
        {...rest}
      />
      {trailIcon && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{trailIcon}</span>}
    </div>
  );
}

function PwdInput({ state, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <TextInput
      type={show ? "text" : "password"}
      leadIcon={ICONS.lock} state={state}
      value={value} onChange={onChange} placeholder={placeholder}
      trailIcon={
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 2 }}>
          {show ? ICONS.eyeOff : ICONS.eyeOn}
        </button>
      }
    />
  );
}

function Field({ label, error, okMsg, helper, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: TEXT, marginBottom: 7 }}>{label}</label>}
      {children}
      {error && <FMsg type="err">{error}</FMsg>}
      {okMsg && !error && <FMsg type="ok">{okMsg}</FMsg>}
      {helper && !error && !okMsg && (
        <div style={{ marginTop: 7, fontSize: 11.5, color: MUTED, lineHeight: 1.55, padding: "9px 11px", background: "rgba(21,101,192,.04)", borderRadius: 9, border: "1px solid rgba(21,101,192,.1)", display: "flex", gap: 7, alignItems: "flex-start" }}>
          {ICONS.info}<span>{helper}</span>
        </div>
      )}
    </div>
  );
}

// Strength meter
const SC = ["", "#ef4444", "#f59e0b", "#3B82F6", "#16a34a"];
const SL = ["", "Weak", "Fair", "Good", "Strong"];
function getStr(p) { if (!p) return 0; return Math.max(1, (p.length >= 8 ? 1 : 0) + (/[A-Z]/.test(p) ? 1 : 0) + (/[0-9]/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0)); }
function StrengthMeter({ password }) {
  if (!password) return null;
  const s = getStr(password);
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= s ? SC[s] : BORDER, transition: "background .3s" }} />)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: SC[s] }}>{SL[s]}</div>
    </div>
  );
}

// Primary button
function Btn({ children, disabled, loading, onClick, style: sx = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" disabled={disabled || loading} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", height: 48, borderRadius: 13,
        background: disabled ? "#c5d3e8" : GRAD, color: "#fff",
        fontSize: 14.5, fontWeight: 800, border: "none",
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        boxShadow: disabled ? "none" : hov ? "0 12px 32px rgba(21,101,192,.34)" : "0 6px 22px rgba(21,101,192,.26)",
        transform: hov && !disabled ? "translateY(-2px)" : "none",
        transition: "all .22s ease", position: "relative", overflow: "hidden",
        ...sx,
      }}>
      {loading ? <span style={{ animation: "lgSpin .9s linear infinite", display: "inline-block", fontSize: 18 }}>⟳</span> : children}
    </button>
  );
}

// Ghost button
function GhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", height: 44, borderRadius: 13,
        background: hov ? "rgba(21,101,192,.06)" : "transparent",
        color: BLUE, fontSize: 14, fontWeight: 700,
        border: `1.5px solid ${hov ? "rgba(21,101,192,.4)" : "rgba(21,101,192,.25)"}`,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all .22s ease", marginTop: 10,
      }}>
      {children}
    </button>
  );
}

// ─── OTP Boxes ────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, hasError, hasSuccess }) {
  const refs = useRef([]);
  const digits = (value.padEnd(6, " ")).slice(0, 6).split("");

  const handleChange = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const arr = [...digits];
    arr[i] = d || " ";
    onChange(arr.join("").trimEnd());
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = e => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(p);
    refs.current[Math.min(p.length, 5)]?.focus();
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, width: "100%", marginBottom: 6 }}>
      {digits.map((d, i) => {
        const filled = !!d.trim();
        const bc = hasError ? ERR : hasSuccess && filled ? OK : filled ? BLUE : BORDER;
        const bg = hasError ? "rgba(220,38,38,.04)" : hasSuccess && filled ? "rgba(22,163,74,.04)" : filled ? "rgba(21,101,192,.05)" : "var(--sm-surface)";
        return (
          <input key={i} ref={el => refs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1}
            value={d.trim()} onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
            style={{
              flex: 1, minWidth: 0, maxWidth: 52,
              aspectRatio: "1/1",
              textAlign: "center",
              fontSize: "clamp(14px,4vw,20px)",
              fontWeight: 800, color: TEXT, fontFamily: "inherit",
              border: `1.5px solid ${bc}`, borderRadius: 12, outline: "none",
              background: bg, caretColor: BLUE,
              padding: 0, WebkitAppearance: "none",
              transition: "border-color .2s,box-shadow .2s,background .2s,transform .15s",
              animation: hasError ? "lgShake .35s ease" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Support Bar ──────────────────────────────────────────────────
function SupportBar() {
  const [hovWa, setHovWa] = useState(false);
  const [hovMail, setHovMail] = useState(false);
  const pill = (hov, extra) => ({
    display: "inline-flex", alignItems: "center", gap: 7,
    color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700,
    padding: "8px 16px", borderRadius: 100, flexShrink: 0,
    transform: hov ? "translateY(-2px)" : "none",
    transition: "all .25s ease", ...extra,
  });
  return (
    <div style={{ marginTop: 16, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)", letterSpacing: "1.5px", textTransform: "uppercase", flexShrink: 0 }}>Need Help?</span>
      <a href={`https://wa.me/${WA.replace("+", "")}`} target="_blank" rel="noreferrer"
        onMouseEnter={() => setHovWa(true)} onMouseLeave={() => setHovWa(false)}
        style={pill(hovWa, { background: "linear-gradient(135deg,#25D366,#128C7E)", boxShadow: hovWa ? "0 8px 20px rgba(37,211,102,.4)" : "0 4px 12px rgba(37,211,102,.3)" })}>
        {ICONS.wa}{WA}
      </a>
      <a href={`mailto:${EMAIL}`}
        onMouseEnter={() => setHovMail(true)} onMouseLeave={() => setHovMail(false)}
        style={pill(hovMail, { background: "rgba(21,101,192,.85)", border: "1px solid rgba(255,255,255,.25)", boxShadow: hovMail ? "0 8px 20px rgba(21,101,192,.4)" : "0 4px 12px rgba(21,101,192,.3)" })}>
        {ICONS.mail}{EMAIL}
      </a>
    </div>
  );
}

// ─── SCREEN 1: Login ─────────────────────────────────────────────
function ScreenLogin({ onForgot, onSuccess, onSignUp }) {
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [errs, setErrs] = useState({});
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const phoneOk = validPK(phone);

  const submit = async () => {
    const e = {};
    if (!phone.trim()) e.phone = "Please enter your registered contact number.";
    else if (!phoneOk) e.phone = "Please enter a valid Pakistani mobile number.";
    if (!pass) e.pass = "Please enter your password.";
    setErrs(e);
    if (Object.keys(e).length) return;

    setLoading(true); setAlert(""); setProgress(0);
    const iv = setInterval(() => setProgress(p => Math.min(p + 8, 90)), 200);
    await new Promise(r => setTimeout(r, 2000));
    clearInterval(iv); setProgress(100);
    await new Promise(r => setTimeout(r, 300));
    setLoading(false); setProgress(0);

    if (pass === "wrong") { setAlert("Incorrect password. Please try again or reset your password."); return; }
    if (phone === "03000000000") { setAlert("No account found with this contact number."); return; }
    if (pass === "error") { setAlert("Something went wrong. Please try again after a few moments."); return; }
    onSuccess();
  };

  return (
    <div style={{ animation: "lgFadeIn .4s ease both" }}>
      <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 5, letterSpacing: "-.3px" }}>Welcome back</h2>
      <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>Login to your SchoolMentor account</p>

      {progress > 0 && (
        <div style={{ height: 3, background: "var(--sm-surface-alt)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", borderRadius: 2, background: GRAD, width: `${progress}%`, transition: "width .4s ease" }} />
        </div>
      )}

      <AlertBanner msg={alert} />

      <Field label="Contact Number" error={errs.phone}
        helper="Your contact number is your Login ID for Principals, Teachers, and all authorized users.">
        <TextInput type="tel" leadIcon={ICONS.phone} state={errs.phone ? "err" : phone && phoneOk ? "ok" : ""}
          value={phone} placeholder="Enter your registered mobile number"
          onChange={e => { setPhone(e.target.value); setErrs(p => ({ ...p, phone: "" })); setAlert(""); }}
          trailIcon={phone && phoneOk ? <span style={{ color: OK, display: "flex" }}>{ICONS.check}</span> : null} />
      </Field>

      <Field label="Password" error={errs.pass}>
        <PwdInput state={errs.pass ? "err" : ""} value={pass} placeholder="Enter your password"
          onChange={e => { setPass(e.target.value); setErrs(p => ({ ...p, pass: "" })); setAlert(""); }} />
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -8, marginBottom: 20 }}>
        <button onClick={onForgot} style={{ background: "none", border: "none", color: BLUE, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Forgot Password?
        </button>
      </div>

      <Btn loading={loading} onClick={submit}>{ICONS.login} Login</Btn>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: MUTED }}>
        Don't have an account?{" "}
        <button onClick={onSignUp} style={{ background: "none", border: "none", color: BLUE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sign Up</button>
      </div>
    </div>
  );
}

// ─── Role Card (extracted so useState is called in a proper component) ───────
function RoleCard({ icon, name, sub }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => alert(`Going to ${name} Dashboard`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ border: `1.5px solid ${hov ? "rgba(21,101,192,.3)" : BORDER}`, borderRadius: 14, padding: "16px 14px", cursor: "pointer", textAlign: "center", background: hov ? "rgba(21,101,192,.04)" : "var(--sm-surface)", transform: hov ? "translateY(-2px)" : "none", boxShadow: hov ? "0 8px 24px rgba(21,101,192,.1)" : "none", transition: "all .25s ease" }}
    >
      {icon}
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 8 }}>{name}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── SCREEN 2: Login Success (Role Picker) ────────────────────────
function ScreenLoginSuccess({ onBack }) {
  const roles = [
    { icon: ICONS.principal, name: "Principal", sub: "Admin Dashboard" },
    { icon: ICONS.teacher, name: "Teacher", sub: "Teacher Dashboard" },
    { icon: ICONS.parent, name: "Parent", sub: "Parent Dashboard" },
    { icon: ICONS.admin, name: "Admin", sub: "Admin Panel" },
  ];
  return (
    <div style={{ textAlign: "center", animation: "lgFadeIn .4s ease both" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px", background: "linear-gradient(135deg,rgba(22,163,74,.12),rgba(29,184,138,.12))", border: "2px solid rgba(22,163,74,.2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", animation: "lgPop .6s ease" }}>
        <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid rgba(22,163,74,.2)", animation: "lgPulse 2.5s ease-out .5s infinite" }} />
        <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }} fill="none" stroke={OK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 28, strokeDashoffset: 28, animation: "lgDrawChk .5s ease .4s both" }} />
        </svg>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: OK, marginBottom: 14 }}>
        <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }} fill="none" stroke={OK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Login Successful
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 5 }}>Welcome back!</h2>
      <p style={{ fontSize: 13.5, color: MUTED, marginBottom: 20 }}>Select your dashboard to continue</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {roles.map(r => (
          <RoleCard key={r.name} icon={r.icon} name={r.name} sub={r.sub} />
        ))}
      </div>
      <GhostBtn onClick={onBack}>{ICONS.back} Back to Login</GhostBtn>
    </div>
  );
}

// ─── SCREEN 3: Forgot — Enter Phone ──────────────────────────────
function ScreenForgot1({ onSent, onBack }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone.trim()) { setError("Please enter your registered contact number."); return; }
    if (!validPK(phone)) { setError("Please enter a valid Pakistani mobile number."); return; }
    setLoading(true); setAlert("");
    await new Promise(r => setTimeout(r, 1400));
    setLoading(false);
    if (phone === "03111111111") { setAlert("No account found with this contact number."); return; }
    onSent(phone);
  };

  return (
    <div style={{ animation: "lgFadeIn .4s ease both" }}>
      <GhostBtn onClick={onBack}>{ICONS.back} Back to Login</GhostBtn>
      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 5 }}>Reset Password</h2>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>Enter your registered mobile number to receive an OTP</p>
        <AlertBanner msg={alert} />
        <Field label="Registered Contact Number" error={error}>
          <TextInput type="tel" leadIcon={ICONS.phone} state={error ? "err" : phone && validPK(phone) ? "ok" : ""}
            value={phone} placeholder="Enter your registered mobile number"
            onChange={e => { setPhone(e.target.value); setError(""); setAlert(""); }}
            trailIcon={phone && validPK(phone) ? <span style={{ color: OK, display: "flex" }}>{ICONS.check}</span> : null} />
        </Field>
        <Btn loading={loading} onClick={submit}>{ICONS.send} Send OTP</Btn>
      </div>
    </div>
  );
}

// ─── SCREEN 4: Forgot — OTP ──────────────────────────────────────
function ScreenForgot2({ phone, onVerified, onBack }) {
  const [otp, setOtp] = useState("");
  const [alert, setAlert] = useState("");
  const [otpOk, setOtpOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const tRef = useRef(null);

  const startTimer = useCallback(() => {
    setTimer(60); setCanResend(false);
    clearInterval(tRef.current);
    tRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(tRef.current); setCanResend(true); return 0; } return t - 1; });
    }, 1000);
  }, []);

  useEffect(() => { startTimer(); return () => clearInterval(tRef.current); }, [startTimer]);

  const verify = async () => {
    if (otp.trim().length < 6) { setAlert("Please enter the complete 6-digit code."); return; }
    setLoading(true); setAlert("");
    await new Promise(r => setTimeout(r, 1400));
    setLoading(false);
    if (otp.trim() === "000000") { setAlert("Invalid OTP. Please enter the correct verification code."); return; }
    setOtpOk(true); clearInterval(tRef.current);
    setTimeout(onVerified, 500);
  };

  const resend = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setOtp(""); setAlert(""); setOtpOk(false); startTimer();
  };

  return (
    <div style={{ animation: "lgFadeIn .4s ease both" }}>
      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px", background: "linear-gradient(135deg,rgba(21,101,192,.08),rgba(29,184,138,.08))", border: "2px solid rgba(21,101,192,.12)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", animation: "lgPop .55s ease" }}>
          <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid rgba(21,101,192,.15)", animation: "lgPulse 2s ease-out infinite" }} />
          {ic(<><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="6" x2="15" y2="6" /><line x1="12" y1="18" x2="12.01" y2="18" /></>, { w: 28, h: 28, sw: 1.8, style: { stroke: BLUE } })}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(21,101,192,.07)", border: "1px solid rgba(21,101,192,.15)", borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: BLUE, marginBottom: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: TEAL, display: "inline-block" }} />
          OTP Verification
        </div>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 6 }}>Verify your number</h2>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 3 }}>We've sent a 6-digit code to</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{phone}</p>
      </div>

      <AlertBanner msg={alert} />

      <OtpBoxes value={otp} onChange={v => { setOtp(v); setAlert(""); }} hasError={!!alert && !otpOk} hasSuccess={otpOk} />

      {/* Timer */}
      <div style={{ textAlign: "center", margin: "14px 0 18px", fontSize: 13, color: MUTED }}>
        {canResend
          ? <button onClick={resend} disabled={loading} style={{ background: "none", border: "none", color: BLUE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {ICONS.clock} Resend OTP
          </button>
          : <span>Resend OTP in <strong style={{ color: BLUE }}>{timer}s</strong></span>
        }
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: BORDER, borderRadius: 2, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: "100%", borderRadius: 2, background: GRAD, width: `${(timer / 60) * 100}%`, transition: "width 1s linear" }} />
      </div>

      <Btn disabled={otp.trim().length < 6} loading={loading} onClick={verify}>{ICONS.verifyOk} Verify OTP</Btn>
      <GhostBtn onClick={onBack}>{ICONS.back} Change mobile number</GhostBtn>

      <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(21,101,192,.04)", borderRadius: 10, border: "1px solid rgba(21,101,192,.1)", fontSize: 11.5, color: MUTED, lineHeight: 1.55, display: "flex", gap: 7, alignItems: "flex-start" }}>
        {ICONS.info}
        <span>Did not receive OTP? Ensure your number is on its original network. Ported numbers may not receive OTP.</span>
      </div>
    </div>
  );
}

// ─── SCREEN 5: Forgot — New Password ─────────────────────────────
function ScreenForgot3({ onReset }) {
  const [np, setNp] = useState("");
  const [cp, setCp] = useState("");
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);

  const passOk = np.length >= 8;
  const match = np === cp && cp.length > 0 && passOk;

  const submit = async () => {
    const e = {};
    if (!passOk) e.np = "Password must contain at least 8 characters.";
    if (!match) e.cp = "New password and confirm password do not match.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1600));
    setLoading(false);
    onReset();
  };

  return (
    <div style={{ animation: "lgFadeIn .4s ease both" }}>
      <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 5 }}>Create New Password</h2>
      <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>Enter and confirm your new password below</p>

      <Field label="New Password" error={errs.np}>
        <PwdInput state={errs.np ? "err" : passOk ? "ok" : ""} value={np} placeholder="Enter new password"
          onChange={e => { setNp(e.target.value); setErrs(p => ({ ...p, np: "", cp: "" })); }} />
        <StrengthMeter password={np} />
      </Field>

      <Field label="Confirm New Password" error={errs.cp} okMsg={!errs.cp && match ? "Passwords match" : ""}>
        <PwdInput state={errs.cp ? "err" : match ? "ok" : ""} value={cp} placeholder="Re-enter new password"
          onChange={e => { setCp(e.target.value); setErrs(p => ({ ...p, cp: "" })); }} />
      </Field>

      <Btn loading={loading} onClick={submit}>{ICONS.resetLk} Reset Password</Btn>
    </div>
  );
}

// ─── SCREEN 6: Reset Success ──────────────────────────────────────
function ScreenResetSuccess({ onLogin }) {
  return (
    <div style={{ textAlign: "center", animation: "lgFadeIn .5s ease both" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px", background: "linear-gradient(135deg,rgba(22,163,74,.12),rgba(29,184,138,.12))", border: "2px solid rgba(22,163,74,.2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", animation: "lgPop .6s ease" }}>
        <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid rgba(22,163,74,.2)", animation: "lgPulse 2.5s ease-out .5s infinite" }} />
        <svg viewBox="0 0 24 24" style={{ width: 34, height: 34 }} fill="none" stroke={OK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 28, strokeDashoffset: 28, animation: "lgDrawChk .5s ease .4s both" }} />
        </svg>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: OK, marginBottom: 14 }}>
        <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }} fill="none" stroke={OK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Password Reset Successful
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 900, color: TEXT, marginBottom: 10 }}>Password Updated!</h2>
      <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>
        Your password has been reset successfully.<br />Please login with your new password.
      </p>
      <Btn onClick={onLogin}>{ICONS.login} Go to Login</Btn>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────
export default function Login({ onSignUp }) {
  const [screen, setScreen] = useState("login");
  const [fpPhone, setFpPhone] = useState("");

  const nav = s => { setScreen(s); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes lgShimmer  {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes lgOrbFloat {0%,100%{transform:translate(0,0)}50%{transform:translate(14px,10px)}}
        @keyframes lgFadeUp   {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lgFadeIn   {from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes lgShake    {0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        @keyframes lgSpin     {to{transform:rotate(360deg)}}
        @keyframes lgPop      {0%{opacity:0;transform:scale(.65)}65%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
        @keyframes lgPulse    {0%{transform:scale(1);opacity:.6}70%{transform:scale(1.55);opacity:0}100%{opacity:0}}
        @keyframes lgDrawChk  {from{stroke-dashoffset:28}to{stroke-dashoffset:0}}
        @keyframes lgSlideErr {from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0", overflow: "hidden", position: "relative" }}>

        {/* Bg */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />
        <div style={{ position: "fixed", width: 520, height: 520, borderRadius: "50%", top: -180, right: -100, background: "radial-gradient(circle,rgba(255,255,255,.07),transparent 65%)", animation: "lgOrbFloat 9s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "fixed", width: 380, height: 380, borderRadius: "50%", bottom: -140, left: -90, background: "radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)", animation: "lgOrbFloat 12s ease-in-out infinite reverse", pointerEvents: "none" }} />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 999, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.85),rgba(255,255,255,.2),rgba(255,255,255,.85),transparent)", backgroundSize: "200% 100%", animation: "lgShimmer 3.5s linear infinite" }} />

        {/* Page wrap */}
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 500, margin: "32px auto", padding: "0 16px 40px" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 22, animation: "lgFadeUp .5s ease both" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.18)", border: "1.5px solid rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {ICONS.grad}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-.3px" }}>
                <span style={{ fontWeight: 400, opacity: .82 }}>School</span>Mentor
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.58)", fontWeight: 500, letterSpacing: ".5px" }}>Creating the Future</div>
            </div>
          </div>

          {/* Card */}
          <div style={{ background: "var(--sm-surface)", borderRadius: 24, boxShadow: "0 32px 80px rgba(0,0,0,.22)", overflow: "hidden", width: "100%", animation: "lgFadeUp .6s ease .08s both" }}>
            <div style={{ height: 4, background: GRAD }} />
            <div style={{ padding: "30px 28px 32px" }}>
              {screen === "login" && <ScreenLogin onForgot={() => nav("fp1")} onSuccess={() => nav("loginOk")} onSignUp={() => onSignUp?.()} />}
              {screen === "loginOk" && <ScreenLoginSuccess onBack={() => nav("login")} />}
              {screen === "fp1" && <ScreenForgot1 onSent={p => { setFpPhone(p); nav("fp2"); }} onBack={() => nav("login")} />}
              {screen === "fp2" && <ScreenForgot2 phone={fpPhone} onVerified={() => nav("fp3")} onBack={() => nav("fp1")} />}
              {screen === "fp3" && <ScreenForgot3 onReset={() => nav("resetOk")} />}
              {screen === "resetOk" && <ScreenResetSuccess onLogin={() => nav("login")} />}
            </div>
          </div>

          <SupportBar />
        </div>
      </div>
    </>
  );
}
