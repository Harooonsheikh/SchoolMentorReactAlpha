import { useState } from "react";

// ── Feature pills data ────────────────────────────────────────────────────────
const FEATURES = [
  "Academics & Exams",
  "HR & Payroll",
  "Fee Management",
  "Communication",
];

// ── Floating card modules ─────────────────────────────────────────────────────
const MODULES = [
  { icon: "📚", label: "Academics",      sub: "Exams & results"   },
  { icon: "👥", label: "HR & Admin",     sub: "Staff management"  },
  { icon: "💳", label: "Fee & Accounts", sub: "Auto billing"      },
  { icon: "💬", label: "Communication",  sub: "SMS & alerts"      },
];

// ── CTA Buttons ───────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick }) {
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
        padding: "13px 28px", borderRadius: 10,
        fontSize: 14, fontWeight: 700,
        background: "#fff", color: "#1565C0",
        border: "none", cursor: "pointer",
        fontFamily: "inherit", letterSpacing: ".3px",
        boxShadow: hov ? "0 8px 28px rgba(0,0,0,.2)" : "0 4px 20px rgba(0,0,0,.15)",
        transform: active ? "scale(.97)" : hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all .25s ease",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: "13px 28px", borderRadius: 10,
        fontSize: 14, fontWeight: 600,
        background: hov ? "rgba(255,255,255,.12)" : "transparent",
        color: "#fff",
        border: `1.5px solid ${hov ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.4)"}`,
        cursor: "pointer", fontFamily: "inherit", letterSpacing: ".3px",
        display: "flex", alignItems: "center", gap: 8,
        transform: active ? "scale(.97)" : hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all .25s ease",
      }}
    >
      {children}
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "rgba(255,255,255,.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10,
        transform: hov ? "translateX(3px)" : "translateX(0)",
        transition: "transform .25s ease",
      }}>›</span>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ErpHero() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes erpFadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes erpSlideIn  { from{opacity:0;transform:translateY(-50%) translateX(30px)} to{opacity:1;transform:translateY(-50%) translateX(0)} }
        @keyframes erpShimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes erpPulse    { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.5);opacity:0} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(135deg,#1565C0 0%,#1280a0 45%,#1DB88A 100%)",
        minHeight: 420,
        padding: "60px 48px 64px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}>

        {/* Orbs */}
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", top:-200, left:-150, background:"radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", bottom:-180, right:-100, background:"radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents:"none" }} />

        {/* Dot grid */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:"linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)",
          backgroundSize:"52px 52px",
        }} />

        {/* Shimmer top line */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:3,
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,.7),rgba(255,255,255,.3),rgba(255,255,255,.7),transparent)",
          backgroundSize:"200% 100%",
          animation:"erpShimmer 3s linear infinite",
        }} />

        {/* ── Left content ── */}
        <div style={{ position:"relative", zIndex:2, maxWidth:640 }}>

          {/* Badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.25)",
            borderRadius:100, padding:"6px 14px 6px 8px",
            marginBottom:24,
            animation:"erpFadeUp .6s ease .1s both",
          }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background:"rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14,
            }}>🖥️</div>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(255,255,255,.9)" }}>
              School Mentor ERP
            </span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize:54, fontWeight:800, color:"#fff",
            lineHeight:1.15, marginBottom:20, letterSpacing:-1,
            animation:"erpFadeUp .65s ease .2s both",
          }}>
            Complete School<br />
            <span style={{
              background:"linear-gradient(90deg,#a8f0d8,#e0f2fe)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            }}>
              Management Engine
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize:15.5, color:"rgba(255,255,255,.82)", lineHeight:1.75,
            maxWidth:520, marginBottom:36,
            animation:"erpFadeUp .65s ease .3s both",
          }}>
            School Mentor ERP is the core engine of the system, designed to manage all academic and administrative operations from one unified dashboard for principals and school management.
          </p>

          {/* CTAs */}
          <div style={{
            display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
            animation:"erpFadeUp .65s ease .4s both",
          }}>
            <PrimaryBtn onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}>Book a Free Demo</PrimaryBtn>
          </div>

          {/* Feature pills */}
          <div style={{
            display:"flex", alignItems:"center", gap:20,
            marginTop:32, flexWrap:"wrap",
            animation:"erpFadeUp .65s ease .5s both",
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12.5, color:"rgba(255,255,255,.7)" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1DB88A", flexShrink:0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── Floating modules card ── */}
        <div style={{
          position:"absolute", right:48, top:"50%",
          background:"rgba(255,255,255,.12)",
          border:"1px solid rgba(255,255,255,.2)",
          borderRadius:20, padding:"20px 22px",
          width:210, zIndex:2,
          animation:"erpSlideIn .7s ease .5s both",
        }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(255,255,255,.6)", marginBottom:14 }}>
            Core Modules
          </div>
          {MODULES.map((m, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"8px 0",
              borderBottom: i < MODULES.length - 1 ? "1px solid rgba(255,255,255,.1)" : "none",
            }}>
              <div style={{
                width:30, height:30, borderRadius:8,
                background:"rgba(255,255,255,.15)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14, flexShrink:0,
              }}>
                {m.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#fff" }}>{m.label}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.5)", marginTop:1 }}>{m.sub}</div>
              </div>
              <div style={{
                width:18, height:18, borderRadius:"50%",
                background:"#1DB88A",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, color:"#fff", fontWeight:700, flexShrink:0,
              }}>✓</div>
            </div>
          ))}
        </div>

        {/* Pulse dot connector */}
        <div style={{
          position:"absolute", right:270, top:"38%",
          width:10, height:10, borderRadius:"50%",
          background:"#1DB88A", zIndex:3,
        }}>
          <div style={{
            position:"absolute", inset:-4, borderRadius:"50%",
            border:"2px solid rgba(29,184,138,.5)",
            animation:"erpPulse 2s ease-out infinite",
          }} />
        </div>

      </section>
    </>
  );
}
