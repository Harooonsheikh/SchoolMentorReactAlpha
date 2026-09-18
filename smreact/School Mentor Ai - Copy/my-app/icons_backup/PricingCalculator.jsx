import { useState, useEffect, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────
const PLANS = {
  basic: {
    id: "basic",
    label: "Basic Plan",
    addon: 0,
    addonLabel: "PKR 0",
    addonSub: "No add-on",
    aiClass: "basic",
    aiTitle: "✦ Mentor AI Basic",
    accentColor: "#1565C0",
    iconBg: "rgba(21,101,192,.1)",
    icon: "🔵",
    borderActive: "#1565C0",
    bgActive: "rgba(21,101,192,.05)",
    gets: [
      { icon:"🖥️", text:"Full ERP Access" },
      { icon:"📱", text:"3 Mobile Apps" },
      { icon:"📋", text:"Operational Manuals" },
      { icon:"🎓", text:"Teacher Trainings" },
      { icon:"🏫", text:"Head Office Support" },
      { icon:"✦",  text:"Mentor AI Basic" },
    ],
    ai: [
      { icon:"💬", val:"1M",  desc:"AI Chat (Tokens)" },
      { icon:"📄", val:"50",  desc:"Lesson Scans" },
      { icon:"📝", val:"5",   desc:"Worksheets" },
      { icon:"📱", val:"5",   desc:"Social Posts" },
    ],
  },
  pro: {
    id: "pro",
    label: "Pro Plan",
    addon: 4000,
    addonLabel: "PKR 4,000",
    addonSub: "fixed monthly",
    aiClass: "pro",
    aiTitle: "✦ Mentor AI Pro",
    accentColor: "#1DB88A",
    iconBg: "rgba(29,184,138,.1)",
    icon: "🟢",
    borderActive: "#1DB88A",
    bgActive: "rgba(29,184,138,.05)",
    popular: true,
    gets: [
      { icon:"🖥️", text:"Full ERP Access" },
      { icon:"📱", text:"3 Mobile Apps" },
      { icon:"📋", text:"Operational Manuals" },
      { icon:"🎓", text:"Teacher Trainings" },
      { icon:"🏫", text:"Head Office Support" },
      { icon:"✦",  text:"Mentor AI Pro" },
    ],
    ai: [
      { icon:"💬", val:"5M",  desc:"AI Chat (Tokens)" },
      { icon:"📄", val:"250", desc:"Lesson Scans" },
      { icon:"📝", val:"90",  desc:"Worksheets" },
      { icon:"📱", val:"90",  desc:"Social Posts" },
    ],
  },
  premium: {
    id: "premium",
    label: "Premium Plan",
    addon: 6000,
    addonLabel: "PKR 6,000",
    addonSub: "fixed monthly",
    aiClass: "premium",
    aiTitle: "✦ Mentor AI Premium",
    accentColor: "#B8860B",
    iconBg: "rgba(184,134,11,.1)",
    icon: "🟡",
    borderActive: "#B8860B",
    bgActive: "rgba(184,134,11,.05)",
    gets: [
      { icon:"🖥️", text:"Full ERP Access" },
      { icon:"📱", text:"3 Mobile Apps" },
      { icon:"📋", text:"Operational Manuals" },
      { icon:"🎓", text:"Teacher Trainings" },
      { icon:"🏫", text:"Head Office Support" },
      { icon:"✦",  text:"Mentor AI Premium" },
    ],
    ai: [
      { icon:"💬", val:"10M",   desc:"AI Chat (Tokens)" },
      { icon:"📄", val:"1,000", desc:"Lesson Scans" },
      { icon:"📝", val:"150",   desc:"Worksheets" },
      { icon:"📱", val:"150",   desc:"Social Posts" },
    ],
  },
};

const QUICK_VALS = [50, 100, 200, 500, 1000, 2000];

// ── Helpers ───────────────────────────────────────────────────────
function fmt(n) {
  return "PKR " + n.toLocaleString("en-PK");
}

function pct(val) {
  return Math.max(0, Math.min(100, ((Math.min(val, 2000) - 50) / (2000 - 50)) * 100));
}

// ── useIsMobile ───────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 760 : false
  );
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 760);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

// ── Step tab ──────────────────────────────────────────────────────
function StepTab({ num, label, status }) {
  // status: 'pending' | 'active' | 'done'
  return (
    <div style={{
      flex: 1, padding: "14px 8px", textAlign: "center",
      fontSize: 11, fontWeight: 600, letterSpacing: 1,
      textTransform: "uppercase",
      color: status === "active" ? "#1565C0" : status === "done" ? "#1DB88A" : "var(--sm-text-muted)",
      position: "relative",
      transition: "color .3s ease",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%", marginRight: 6,
        fontSize: 10, fontWeight: 800,
        background: status === "active"
          ? "linear-gradient(135deg,#1565C0,#1DB88A)"
          : status === "done" ? "#1DB88A" : "var(--sm-border)",
        color: status === "pending" ? "var(--sm-text-muted)" : "#fff",
        transition: "all .3s ease",
      }}>
        {status === "done" ? "✓" : num}
      </span>
      {label}
      {/* Active underline */}
      <div style={{
        position: "absolute", bottom: 0, left: "10%", right: "10%", height: 2,
        borderRadius: "2px 2px 0 0",
        background: "linear-gradient(90deg,#1565C0,#1DB88A)",
        transform: status === "active" ? "scaleX(1)" : "scaleX(0)",
        transformOrigin: "left",
        transition: "transform .35s ease",
      }} />
    </div>
  );
}

// ── Plan button ───────────────────────────────────────────────────
function PlanBtn({ plan, isActive, onClick }) {
  const [hov, setHov] = useState(false);
  const active = isActive || hov;

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        flex: 1, border: `2px solid ${isActive ? plan.borderActive : hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 16, padding: "14px 8px 12px",
        background: isActive ? plan.bgActive : hov ? "var(--sm-hover)" : "var(--sm-surface)",
        cursor: "pointer", textAlign: "center", position: "relative",
        overflow: "hidden", fontFamily: "inherit",
        transform: isActive ? "translateY(-4px)" : hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: isActive
          ? "0 8px 32px rgba(21,101,192,.12)"
          : hov ? "0 8px 24px rgba(21,101,192,.08)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}
    >
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        borderRadius: "16px 16px 0 0",
        background: plan.id === "premium"
          ? "linear-gradient(90deg,#D4A017,#B8860B)"
          : "linear-gradient(90deg,#1565C0,#1DB88A)",
        opacity: active ? 1 : 0,
        transition: "opacity .3s ease",
      }} />

      {/* Popular badge */}
      {plan.popular && (
        <div style={{
          position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(90deg,#1565C0,#1DB88A)",
          color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: ".8px",
          padding: "3px 8px", borderRadius: "0 0 8px 8px", whiteSpace: "nowrap",
        }}>
          ✦ Popular
        </div>
      )}

      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, margin: "6px auto 8px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, background: plan.iconBg,
        transform: isActive ? "scale(1.1) rotate(-5deg)" : "scale(1)",
        transition: "transform .3s ease",
      }}>
        {plan.icon}
      </div>

      <div style={{
        fontSize: 13, fontWeight: 700, marginBottom: 3,
        color: isActive ? plan.accentColor : "var(--sm-text)",
        transition: "color .3s ease",
      }}>
        {plan.id.charAt(0).toUpperCase() + plan.id.slice(1)}
      </div>
      <div style={{ fontSize: 10, color: "var(--sm-text-muted)", fontWeight: 500, lineHeight: 1.4 }}>
        {plan.id === "basic" ? "PKR 20\n/ Student" : `PKR 20 + ${plan.addon.toLocaleString()}\n/ Month`}
      </div>
    </button>
  );
}

// ── Quick pick ────────────────────────────────────────────────────
function QuickPick({ val, isActive, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 100,
        border: `1.5px solid ${isActive ? "#1565C0" : hov ? "#1565C0" : "var(--sm-border)"}`,
        background: isActive ? "var(--sm-navy-tint)" : hov ? "var(--sm-hover)" : "var(--sm-surface)",
        fontSize: 12, fontWeight: 600,
        color: isActive || hov ? "#1565C0" : "var(--sm-text-muted)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all .2s ease",
      }}
    >
      {val.toLocaleString()}
    </button>
  );
}

// ── AI section ────────────────────────────────────────────────────
function AiSection({ plan }) {
  const styles = {
    basic:   { bg:"var(--sm-surface)", border:"var(--sm-border)", color:"#1565C0" },
    pro:     { bg:"var(--sm-surface)", border:"var(--sm-border)", color:"#0D7A5F" },
    premium: { bg:"var(--sm-surface)", border:"var(--sm-border)", color:"#B8860B" },
  }[plan.aiClass];

  return (
    <div style={{
      borderRadius: 16, padding: "14px 16px",
      background: styles.bg, border: `1.5px solid ${styles.border}`,
      marginBottom: 20,
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px",
        textTransform: "uppercase", color: styles.color, marginBottom: 10,
      }}>
        {plan.aiTitle} — /month
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {plan.ai.map((s, i) => (
          <div key={i} style={{
            background: "var(--sm-surface-alt)", border: "1px solid var(--sm-border)",
            borderRadius: 10, padding: "9px 11px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: styles.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 9.5, color: "var(--sm-text-muted)", marginTop: 1 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Placeholder ───────────────────────────────────────────────────
function Placeholder() {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px 28px" }}>
      <div style={{ fontSize: 52, marginBottom: 14, animation: "calcPulse 2s ease-in-out infinite", display: "block" }}>
        🧮
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--sm-text)", marginBottom: 8 }}>
        Your estimate will appear here
      </div>
      <div style={{ fontSize: 13, color: "var(--sm-text-muted)", lineHeight: 1.6 }}>
        Select a plan on the left to instantly see your monthly cost and everything included.
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────
function Results({ plan, students, animKey }) {
  const studentFee = students * 20;
  const total = studentFee + plan.addon;
  const perStudent = (total / students).toFixed(1);
  const showSavings = students >= 500;

  return (
    <div style={{ animation: "calcFadeIn .4s ease" }} key={animKey}>

      {/* Cost card */}
      <div style={{
        borderRadius: 20, padding: "22px 20px", marginBottom: 20,
        background: "linear-gradient(135deg,#1565C0,#1178a8 50%,#1DB88A)",
        position: "relative", overflow: "hidden",
        animation: "calcSlideUp .4s ease",
      }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:140, height:140, borderRadius:"50%", background:"rgba(255,255,255,.07)" }} />
        <div style={{ position:"absolute", bottom:-30, left:-30, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,.05)" }} />

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, position:"relative", zIndex:1 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:6,
            background:"rgba(255,255,255,.18)", borderRadius:100,
            padding:"4px 12px", fontSize:11, fontWeight:600, color:"#fff",
          }}>
            {plan.label}
          </div>
          <div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.7)", textAlign:"right", marginBottom:2 }}>Total / Month</div>
            <div style={{
              fontSize: 30, fontWeight: 900, color: "#fff", textAlign: "right",
              lineHeight: 1, animation: "calcCountPop .3s ease",
            }}>
              {fmt(total)}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, position:"relative", zIndex:1 }}>
          <div style={{ background:"rgba(255,255,255,.14)", borderRadius:12, padding:"11px 13px" }}>
            <div style={{ fontSize:9.5, color:"rgba(255,255,255,.65)", marginBottom:4, fontWeight:500 }}>Student Fee</div>
            <div style={{ fontSize:17, fontWeight:800, color:"#fff" }}>{fmt(studentFee)}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,.55)", marginTop:2 }}>PKR 20 × {students.toLocaleString()}</div>
          </div>
          <div style={{ background:"rgba(255,255,255,.14)", borderRadius:12, padding:"11px 13px" }}>
            <div style={{ fontSize:9.5, color:"rgba(255,255,255,.65)", marginBottom:4, fontWeight:500 }}>AI Add-on</div>
            <div style={{ fontSize:17, fontWeight:800, color:"#fff" }}>{plan.addonLabel}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,.55)", marginTop:2 }}>{plan.addonSub}</div>
          </div>
        </div>
      </div>

      {/* Savings badge */}
      {showSavings && (
        <div style={{
          display:"inline-flex", alignItems:"center", gap:6,
          background:"rgba(29,184,138,.1)", border:"1px solid rgba(29,184,138,.25)",
          borderRadius:100, padding:"5px 12px", marginBottom:16,
          fontSize:11, fontWeight:600, color:"#0D7A5F",
          animation: "calcFadeIn .4s ease",
        }}>
          <span>✦</span> Just PKR {perStudent} per student — great value!
        </div>
      )}

      {/* What you get */}
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--sm-text-muted)", marginBottom:12 }}>
        ✦ What You Get
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {plan.gets.map((g, i) => (
          <GetChip key={i} icon={g.icon} text={g.text} delay={i * 0.05} />
        ))}
      </div>

      {/* AI section */}
      <AiSection plan={plan} />

      {/* CTAs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <CtaBtn primary onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}>🚀 Book Demo</CtaBtn>
        <CtaBtn>💬 Get Quote</CtaBtn>
      </div>
    </div>
  );
}

function GetChip({ icon, text, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:8,
        background: hov ? "var(--sm-hover)" : "var(--sm-surface-alt)",
        border: `1.5px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius:12, padding:"10px 12px",
        fontSize:12, fontWeight:600, color:"var(--sm-text)",
        transition:"all .2s ease",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        animation: `calcFadeIn .4s ease ${delay}s both`,
        cursor: "default",
      }}
    >
      <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
      {text}
    </div>
  );
}

function CtaBtn({ children, primary, onClick }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: 14, borderRadius: 13, fontSize: 13, fontWeight: 700,
        fontFamily: "inherit", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        ...(primary ? {
          background: "linear-gradient(90deg,#1565C0,#1DB88A)",
          color: "#fff", border: "none",
          boxShadow: hov ? "0 10px 30px rgba(21,101,192,.4)" : "0 6px 20px rgba(21,101,192,.3)",
        } : {
          background: hov ? "#1565C0" : "var(--sm-surface)",
          color: hov ? "#fff" : "#1565C0",
          border: "2px solid #1565C0",
          boxShadow: "none",
        }),
        transform: active ? "scale(.97)" : hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all .25s ease",
      }}
    >
      {children}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────
export default function PricingCalculator() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [students, setStudentsState] = useState(100);
  const [inputVal, setInputVal] = useState("100");
  const [animKey, setAnimKey] = useState(0);
  const isMobile = useIsMobile();

  // Derive step statuses
  const step1 = selectedPlan ? "done" : "active";
  const step2 = selectedPlan ? (students ? "done" : "active") : "pending";
  const step3 = selectedPlan && students ? "active" : "pending";

  const sliderPct = pct(students);
  const sliderBg = `linear-gradient(90deg, #1565C0 ${sliderPct}%, var(--sm-border) ${sliderPct}%)`;

  const setStudents = useCallback((n) => {
    const val = Math.max(1, n);
    setStudentsState(val);
    setInputVal(String(val));
    setAnimKey(k => k + 1);
  }, []);

  const handleSlider = (e) => {
    setStudents(parseInt(e.target.value));
  };

  const handleInput = (e) => {
    setInputVal(e.target.value);
    const n = parseInt(e.target.value);
    if (!isNaN(n) && n >= 1) {
      setStudentsState(n);
      setAnimKey(k => k + 1);
    }
  };

  const handleBlur = () => {
    const n = parseInt(inputVal);
    if (isNaN(n) || n < 1) setStudents(1);
  };

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setAnimKey(k => k + 1);
  };

  // Desktop card uses side-by-side layout
  const cardStyle = isMobile
    ? { borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(21,101,192,.16)" }
    : { borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(21,101,192,.16)", display: "grid", gridTemplateColumns: "1fr 1fr" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes calcShimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes calcFadeDown { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes calcSlideUp  { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        @keyframes calcFadeIn   { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes calcCountPop { 0%{transform:scale(1)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes calcPulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes calcBlink    { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", background:"var(--sm-surface-alt)", minHeight:"100vh", padding:"0 0 80px", overflowX:"hidden" }}>

        {/* ── Hero ── */}
        <div style={{
          background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
          padding: "52px 20px 80px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Dot grid */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none" }} />
          {/* Shimmer line */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize:"200% 100%", animation:"calcShimmer 3s linear infinite" }} />

          <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.25)", borderRadius:100, padding:"5px 14px", marginBottom:18, fontSize:11, fontWeight:600, letterSpacing:"2px", textTransform:"uppercase", color:"rgba(255,255,255,.9)", animation:"calcFadeDown .6s ease .1s both" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#1DB88A", animation:"calcBlink 1.5s ease-in-out infinite" }} />
            Instant Price Calculator
          </div>

          <h1 style={{ fontSize:"clamp(26px,5vw,40px)", fontWeight:900, color:"#fff", lineHeight:1.1, marginBottom:12, letterSpacing:-1, animation:"calcFadeDown .6s ease .2s both" }}>
            Calculate Your<br />
            <span style={{ background:"linear-gradient(90deg,#a8f0d8,#e0f2fe)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              School's Monthly Cost
            </span>
          </h1>

          <p style={{ fontSize:15, color:"rgba(255,255,255,.75)", maxWidth:420, margin:"0 auto", lineHeight:1.6, animation:"calcFadeDown .6s ease .3s both" }}>
            Pick a plan, enter your students — get an instant breakdown of what you'll pay and what you'll get.
          </p>
        </div>

        {/* ── Main card ── */}
        <div style={{ maxWidth: isMobile ? 520 : 900, margin:"-40px auto 0", padding:"0 16px", position:"relative", zIndex:2, animation:"calcSlideUp .7s ease .4s both" }}>
          <div style={{ background:"var(--sm-surface)", ...cardStyle }}>

            {/* Step tabs — full width */}
            <div style={{
              display: "flex",
              background: "var(--sm-surface-alt)",
              borderBottom: "1px solid var(--sm-border)",
              ...(isMobile ? {} : { gridColumn: "1 / -1" }),
            }}>
              <StepTab num="1" label="Plan"     status={step1} />
              <StepTab num="2" label="Students" status={step2} />
              <StepTab num="3" label="Summary"  status={step3} />
            </div>

            {/* ── Left / Input panel ── */}
            <div style={{ padding:"28px 24px 24px", borderRight: isMobile ? "none" : "1px solid var(--sm-border)" }}>

              {/* Plan picker */}
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--sm-text-muted)", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                Choose Plan
                <div style={{ flex:1, height:1, background:"var(--sm-border)" }} />
              </div>

              <div style={{ display:"flex", gap:10, marginBottom:28 }}>
                {Object.values(PLANS).map(p => (
                  <PlanBtn
                    key={p.id}
                    plan={p}
                    isActive={selectedPlan === p.id}
                    onClick={() => handlePlanSelect(p.id)}
                  />
                ))}
              </div>

              {/* Student count */}
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--sm-text-muted)", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                Students Enrolled
                <div style={{ flex:1, height:1, background:"var(--sm-border)" }} />
              </div>

              {/* Count box */}
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <CountBox
                  value={inputVal}
                  onDecrease={() => setStudents(students - 50)}
                  onIncrease={() => setStudents(students + 50)}
                  onChange={handleInput}
                  onBlur={handleBlur}
                />
                <span style={{ fontSize:13, color:"var(--sm-text-muted)", fontWeight:500 }}>students</span>
              </div>

              {/* Quick picks */}
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
                {QUICK_VALS.map(v => (
                  <QuickPick key={v} val={v} isActive={students === v} onClick={() => setStudents(v)} />
                ))}
              </div>

              {/* Slider */}
              <input
                type="range" min="50" max="2000" step="50"
                value={Math.min(students, 2000)}
                onChange={handleSlider}
                style={{ WebkitAppearance:"none", width:"100%", height:6, borderRadius:3, outline:"none", cursor:"pointer", background: sliderBg }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--sm-text-muted)", marginTop:6 }}>
                <span>50</span><span>500</span><span>1,000</span><span>2,000+</span>
              </div>

              {/* Info tip */}
              <div style={{ marginTop:20, background:"var(--sm-hover)", border:"1px solid var(--sm-border)", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"flex-start", gap:10 }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>💡</span>
                <div style={{ fontSize:12, color:"var(--sm-text-soft)", lineHeight:1.6 }}>
                  <strong>How pricing works:</strong> You pay <strong>PKR 20 × students</strong> every month. Pro and Premium plans add a fixed AI add-on fee. No hidden charges.
                </div>
              </div>
            </div>

            {/* ── Right / Results panel ── */}
            <div style={{ padding:"28px 24px 24px" }}>
              {selectedPlan ? (
                <Results
                  key={animKey}
                  plan={PLANS[selectedPlan]}
                  students={students}
                  animKey={animKey}
                />
              ) : (
                <Placeholder />
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ── Count box ─────────────────────────────────────────────────────
function CountBox({ value, onDecrease, onIncrease, onChange, onBlur }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center",
      border: `2px solid ${focused ? "#1565C0" : "var(--sm-border)"}`,
      borderRadius: 14, overflow: "hidden", background: "var(--sm-surface-alt)",
      boxShadow: focused ? "0 0 0 4px rgba(21,101,192,.1)" : "none",
      transition: "border-color .25s ease, box-shadow .25s ease",
    }}>
      <CountBtn onClick={onDecrease} label="−" />
      <input
        type="number" value={value} min="1" max="99999"
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur && onBlur(); }}
        style={{
          width: 80, textAlign: "center", fontSize: 20, fontWeight: 800,
          color: "var(--sm-text)", border: "none", background: "transparent",
          outline: "none", fontFamily: "inherit", padding: "0 4px",
          MozAppearance: "textfield",
        }}
      />
      <CountBtn onClick={onIncrease} label="+" />
    </div>
  );
}

function CountBtn({ onClick, label }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      onClick={onClick}
      style={{
        width: 44, height: 48, background: hov ? "var(--sm-navy-tint)" : "none",
        border: "none", fontSize: 22, fontWeight: 700, color: "#1565C0",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit",
        transform: press ? "scale(.9)" : "scale(1)",
        transition: "background .2s ease, transform .15s ease",
      }}
    >
      {label}
    </button>
  );
}
