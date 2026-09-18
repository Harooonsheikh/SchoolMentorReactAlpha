import { useState } from "react";

// ── Workshop topics data ───────────────────────────────────────────────────────
const WORKSHOPS = [
  { icon: "📚", label: "Academics",        sub: "Teaching methods",   iconBg: "rgba(59,130,246,.25)"  },
  { icon: "🏫", label: "Administration",   sub: "School management",  iconBg: "rgba(29,184,138,.25)"  },
  { icon: "📣", label: "Marketing",        sub: "School branding",    iconBg: "rgba(251,191,36,.2)"   },
  { icon: "🌱", label: "Character Building",sub: "Student development",iconBg: "rgba(167,139,250,.25)" },
];

const FEATURES = ["Academics", "Administration", "Marketing", "Character Building", "Parenting"];

// ── CTA Button ────────────────────────────────────────────────────────────────
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

// ── Main export ───────────────────────────────────────────────────────────────
export default function TeachersTrainingHero() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ttFadeUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ttSlideIn { from{opacity:0;transform:translateY(-50%) translateX(30px)} to{opacity:1;transform:translateY(-50%) translateX(0)} }
        @keyframes ttShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ttPulse   { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.5);opacity:0} }
        @keyframes ttBlink   { 0%,100%{opacity:.4} 50%{opacity:1} }
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
          animation:"ttShimmer 3s linear infinite",
        }} />

        {/* ── Left content ── */}
        <div style={{ position:"relative", zIndex:2, maxWidth:620 }}>

          {/* Badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.25)",
            borderRadius:100, padding:"6px 14px 6px 8px",
            marginBottom:24,
            animation:"ttFadeUp .6s ease .1s both",
          }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background:"rgba(255,255,255,.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14,
            }}>🎓</div>
            <span style={{ fontSize:11, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(255,255,255,.9)" }}>
              Teachers Training Workshops
            </span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize:54, fontWeight:800, color:"#fff",
            lineHeight:1.15, marginBottom:20, letterSpacing:-1,
            animation:"ttFadeUp .65s ease .2s both",
          }}>
            Grow Every Teacher,<br />
            <span style={{
              background:"linear-gradient(90deg,#a8f0d8,#e0f2fe)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            }}>
              Every Month
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize:15.5, color:"rgba(255,255,255,.82)", lineHeight:1.75,
            maxWidth:520, marginBottom:36,
            animation:"ttFadeUp .65s ease .3s both",
          }}>
            Monthly online workshops designed to empower teachers with the latest academic, administrative, and personal development skills — keeping every school ahead of the curve.
          </p>

          {/* CTA */}
          <div style={{ animation:"ttFadeUp .65s ease .4s both" }}>
            <PrimaryBtn onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}>Book a Free Demo</PrimaryBtn>
          </div>

          {/* Feature pills */}
          <div style={{
            display:"flex", alignItems:"center", gap:20,
            marginTop:32, flexWrap:"wrap",
            animation:"ttFadeUp .65s ease .5s both",
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12.5, color:"rgba(255,255,255,.7)" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1DB88A", flexShrink:0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── Floating workshops card ── */}
        <div style={{
          position:"absolute", right:48, top:"50%",
          background:"rgba(255,255,255,.12)",
          border:"1px solid rgba(255,255,255,.2)",
          borderRadius:20, padding:"20px 22px",
          width:226, zIndex:2,
          animation:"ttSlideIn .7s ease .5s both",
        }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(255,255,255,.6)", marginBottom:14 }}>
            Workshop Topics
          </div>

          {WORKSHOPS.map((w, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"8px 0",
              borderBottom: i < WORKSHOPS.length - 1 ? "1px solid rgba(255,255,255,.1)" : "none",
            }}>
              <div style={{
                width:32, height:32, borderRadius:9,
                background:w.iconBg,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, flexShrink:0,
              }}>
                {w.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#fff" }}>{w.label}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.5)", marginTop:1 }}>{w.sub}</div>
              </div>
              <div style={{
                width:18, height:18, borderRadius:"50%",
                background:"#1DB88A",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, color:"#fff", fontWeight:700, flexShrink:0,
              }}>✓</div>
            </div>
          ))}

          {/* Monthly sessions pill */}
          <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid rgba(255,255,255,.1)" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background:"rgba(29,184,138,.25)",
              border:"1px solid rgba(29,184,138,.4)",
              borderRadius:20, padding:"4px 10px",
            }}>
              <div style={{
                width:6, height:6, borderRadius:"50%",
                background:"#1DB88A",
                animation:"ttBlink 1.5s ease-in-out infinite",
              }} />
              <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,.8)" }}>
                Monthly sessions
              </span>
            </div>
          </div>
        </div>

        {/* Pulse connector dot */}
        <div style={{
          position:"absolute", right:282, top:"38%",
          width:10, height:10, borderRadius:"50%",
          background:"#1DB88A", zIndex:3,
        }}>
          <div style={{
            position:"absolute", inset:-4, borderRadius:"50%",
            border:"2px solid rgba(29,184,138,.5)",
            animation:"ttPulse 2s ease-out infinite",
          }} />
        </div>

      </section>
    </>
  );
}
