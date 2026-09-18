import { useState, useEffect } from "react";

const TRUST = ["Since 2020", "700+ Schools", "45+ Cities", "98% Satisfaction"];

const STAT_CARDS = [
  { icon: "🏫", label: "Schools Empowered", value: "700+", bar: "linear-gradient(90deg,#1DB88A,#7fffd4)" },
  { icon: "⭐", label: "Client Satisfaction", value: "98%", bar: "linear-gradient(90deg,#f59e0b,#fde68a)" },
  { icon: "📍", label: "Cities Across Pakistan", value: "45+", bar: "linear-gradient(90deg,#a78bfa,#c4b5fd)" },
];

// ── Window width hook ─────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ── Particles ─────────────────────────────────────────────────────────────────
function Particles() {
  const items = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    size: Math.random() * 5 + 2,
    left: Math.random() * 100,
    bottom: Math.random() * 20,
    opacity: 0.15 + Math.random() * 0.25,
    duration: 5 + Math.random() * 7,
    delay: Math.random() * 6,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {items.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          width: p.size, height: p.size,
          borderRadius: "50%",
          left: `${p.left}%`,
          bottom: `${p.bottom}%`,
          background: `rgba(255,255,255,${p.opacity})`,
          animation: `ahParticle ${p.duration}s ${p.delay}s linear infinite`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ── Stat Card — absolute on desktop, inline flex on mobile/tablet ─────────────
function StatCard({ card, index, absPos }) {
  const style = absPos
    ? {
      position: "absolute",
      ...absPos,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "12px 16px",
      zIndex: 2, minWidth: 130,
      animation: `ahCardIn .7s ease ${0.6 + index * 0.2}s both, ahCardFloat ${4 + index}s ease-in-out ${1.3 + index * 0.2}s infinite${index % 2 === 0 ? "" : " reverse"}`,
    }
    : {
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "12px 16px",
      flex: "1 1 120px",
      animation: `ahCardIn .7s ease ${0.6 + index * 0.2}s both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 18, marginBottom: 5 }}>{card.icon}</div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginBottom: 5 }}>
        {card.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{card.value}</div>
      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.2)", marginTop: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, background: card.bar,
          animation: `ahBarGrow 1.5s ease ${1.5 + index * 0.2}s both`,
        }} />
      </div>
    </div>
  );
}

// ── Book Demo Button ──────────────────────────────────────────────────────────
function BookDemoBtn({ fullWidth }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        position: "relative", overflow: "hidden",
        padding: "13px 28px", borderRadius: 12,
        fontSize: 14, fontWeight: 700,
        background: "linear-gradient(135deg,#1DB88A,#16a879)",
        color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: fullWidth ? "100%" : "auto",
        boxShadow: hov ? "0 14px 36px rgba(29,184,138,.5)" : "0 6px 24px rgba(29,184,138,.4)",
        transform: active ? "scale(.97)" : hov ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
        filter: hov ? "brightness(1.08)" : "brightness(1)",
        transition: "transform .3s cubic-bezier(.22,.97,.47,1), box-shadow .3s ease, filter .3s ease",
      }}
    >
      <div style={{
        position: "absolute", top: 0, height: "100%", width: "100%",
        background: "linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)",
        left: hov ? "100%" : "-100%",
        transition: "left .5s ease", pointerEvents: "none",
      }} />
      <div style={{
        width: 24, height: 24, borderRadius: 8, background: "rgba(255,255,255,.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, flexShrink: 0, position: "relative", zIndex: 1,
        transition: "transform .3s ease",
        transform: hov ? "scale(1.2) rotate(-10deg)" : "scale(1) rotate(0)",
      }}>🚀</div>
      <span style={{ position: "relative", zIndex: 1 }}>Book a Free Demo</span>
    </button>
  );
}

// ── Contact Team Button ───────────────────────────────────────────────────────
function ContactTeamBtn({ fullWidth }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        position: "relative", overflow: "hidden",
        padding: "13px 28px", borderRadius: 12,
        fontSize: 14, fontWeight: 600,
        background: "rgba(255,255,255,.1)", color: "#fff",
        border: `1.5px solid ${hov ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.4)"}`,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: fullWidth ? "100%" : "auto",
        transform: active ? "scale(.97)" : hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hov ? "0 10px 28px rgba(0,0,0,.15)" : "none",
        transition: "all .3s ease",
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(255,255,255,.12)",
        transform: hov ? "translateX(0)" : "translateX(-101%)",
        transition: "transform .35s ease", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, background: "rgba(255,255,255,.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, transition: "transform .3s ease",
          transform: hov ? "scale(1.15)" : "scale(1)",
        }}>👋</div>
        Contact Our Team
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AboutHero() {
  const winW = useWindowWidth();
  const isMobile = winW < 640;
  const isTablet = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const secPad = isMobile ? "48px 20px 52px" : isTablet ? "56px 36px 64px" : "64px 56px 72px";

  // Absolute positions for desktop floating cards
  const desktopCardPositions = [
    { right: 80, top: 60 },
    { right: 300, bottom: 60 },
    { right: 60, bottom: 80 },
  ];

  // Ring badges: full on desktop, edge-pinned on tablet, hidden on mobile
  const ringBadges = isDesktop
    ? [
      { icon: "🎓", pos: { right: 240, top: 80 }, delay: "0.7s" },
      { icon: "💡", pos: { right: 160, bottom: 100 }, delay: "0.9s" },
    ]
    : isTablet
      ? [
        { icon: "🎓", pos: { right: 16, top: 52 }, delay: "0.7s" },
        { icon: "💡", pos: { right: 16, bottom: 52 }, delay: "0.9s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes ahFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ahShimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ahWave      { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-12deg)} 75%{transform:rotate(12deg)} }
        @keyframes ahOrbFloat  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,15px)} }
        @keyframes ahParticle  { 0%{transform:translateY(0) scale(0);opacity:0} 15%{opacity:.5} 85%{opacity:.15} 100%{transform:translateY(-120px) scale(1.5);opacity:0} }
        @keyframes ahCardIn    { from{opacity:0;transform:translateY(20px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ahCardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes ahBarGrow   { from{width:0} to{width:100%} }
        @keyframes ahBadgePop  { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes ahRingFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes ahRingPulse { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.8);opacity:0} }
        @keyframes ahCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ahLineGrow  { from{transform:scaleY(0)} to{transform:scaleY(1)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
        minHeight: isMobile ? "auto" : 460,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />

        {/* Floating orbs */}
        <div style={{ position: "absolute", width: 580, height: 580, borderRadius: "50%", top: -220, left: -160, background: "radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents: "none", animation: "ahOrbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", bottom: -200, right: -100, background: "radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents: "none", animation: "ahOrbFloat 10s ease-in-out infinite reverse" }} />

        {/* Shimmer top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "ahShimmer 3.5s linear infinite" }} />

        {/* Particles */}
        <Particles />

        {/* Floating stat cards — desktop absolute positioning only */}
        {isDesktop && STAT_CARDS.map((card, i) => (
          <StatCard key={i} card={card} index={i} absPos={desktopCardPositions[i]} />
        ))}

        {/* Ring badges */}
        {ringBadges.map((badge, i) => (
          <div key={i} style={{
            position: "absolute", ...badge.pos,
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(255,255,255,.15)",
            border: "1.5px solid rgba(255,255,255,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, zIndex: 2,
            animation: `ahBadgePop .5s ease ${badge.delay} both, ahRingFloat 3s ease-in-out calc(${badge.delay} + .5s) infinite`,
          }}>
            {badge.icon}
            <div style={{
              position: "absolute", inset: -6, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.2)",
              animation: "ahRingPulse 2.5s ease-out infinite",
            }} />
          </div>
        ))}

        {/* Vertical connector line — desktop only */}
        {isDesktop && (
          <div style={{ position: "absolute", right: 200, top: "50%", width: 1, height: 120, marginTop: -60, background: "linear-gradient(180deg,transparent,rgba(255,255,255,.25),transparent)", animation: "ahLineGrow .8s ease 1s both", transformOrigin: "top" }} />
        )}

        {/* ── Main content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%",
          maxWidth: isDesktop ? 820 : isTablet ? 640 : "100%",
        }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 20 : 28, animation: "ahFadeUp .6s ease .05s both" }}>
            <span style={{ fontSize: 14, display: "inline-block", animation: "ahWave 2.5s ease-in-out infinite" }}>🦈</span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>As Seen on Shark Tank Pakistan</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 32 : isTablet ? 44 : 56,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.15,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "ahFadeUp .65s ease .15s both",
          }}>
            Empowering Schools Through{!isMobile && <br />}{" "}
            <span style={{ background: "linear-gradient(90deg,#7fffd4,#b0e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Innovation, Technology, and Educational Excellence
            </span>
            <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#7fffd4", marginLeft: 3, verticalAlign: "middle", animation: "ahCursor .75s step-end infinite" }} />
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "rgba(255,255,255,.75)",
            lineHeight: 1.75,
            maxWidth: 680,
            marginBottom: isMobile ? 28 : 44,
            animation: "ahFadeUp .65s ease .25s both",
          }}>
            SchoolMentor® has been transforming Pakistani schools since 2020. We are the team behind Pakistan's most trusted school management platform.
          </p>

          {/* Buttons */}
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? 12 : 16,
            animation: "ahFadeUp .65s ease .35s both",
          }}>
            <BookDemoBtn fullWidth={isMobile} />
            <ContactTeamBtn fullWidth={isMobile} />
          </div>

          {/* Trust row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 10 : 20,
            marginTop: isMobile ? 20 : 28,
            flexWrap: "wrap",
            animation: "ahFadeUp .65s ease .45s both",
          }}>
            {TRUST.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,.2)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 11 : 12, color: "rgba(255,255,255,.6)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1DB88A", flexShrink: 0 }} />
                  {t}
                </div>
              </div>
            ))}
          </div>

          {/* Inline stat cards — mobile & tablet (no room for absolute positioning) */}
          {!isDesktop && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10,
              marginTop: 28,
              animation: "ahFadeUp .65s ease .5s both",
            }}>
              {STAT_CARDS.map((card, i) => (
                <StatCard key={i} card={card} index={i} absPos={null} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
