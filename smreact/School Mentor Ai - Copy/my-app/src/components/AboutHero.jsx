import { useState, useEffect } from "react";
import { openDemoForm } from "./DemoRequestModal.jsx";

const TRUST = ["Since 2020", "700+ Schools", "45+ Cities", "98% Satisfaction"];

const STAT_CARDS = [
  { icon: <i className="fa-solid fa-school" style={{ color: "var(--sm-navy)" }} />, label: "Schools Empowered", value: "700+" },
  { icon: <i className="fa-solid fa-star" style={{ color: "var(--sm-navy)" }} />, label: "Client Satisfaction", value: "98%" },
  { icon: <i className="fa-solid fa-location-dot" style={{ color: "var(--sm-navy)" }} />, label: "Cities Across Pakistan", value: "45+" },
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

// ── Stat Card — absolute on desktop, inline flex on mobile/tablet ─────────────
function StatCard({ card, index, absPos }) {
  const baseCard = {
    background: "var(--sm-surface)",
    border: "1px solid var(--sm-border)",
    borderRadius: 16,
    padding: "14px 18px",
    boxShadow: "0 1px 2px rgba(17,24,39,.04)",
  };
  const style = absPos
    ? {
      position: "absolute",
      ...absPos,
      ...baseCard,
      zIndex: 2, minWidth: 130,
      animation: `ahCardIn .7s ease ${0.6 + index * 0.2}s both`,
    }
    : {
      ...baseCard,
      flex: "1 1 120px",
      animation: `ahCardIn .7s ease ${0.6 + index * 0.2}s both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 18, marginBottom: 5 }}>{card.icon}</div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-text-muted)", marginBottom: 5 }}>
        {card.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sm-text)", lineHeight: 1 }}>{card.value}</div>
      <div style={{ height: 3, borderRadius: 2, background: "var(--sm-teal-light)", marginTop: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, background: "var(--sm-navy)",
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
      onClick={() => { openDemoForm("About page"); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: "13px 28px", borderRadius: 10,
        fontSize: 14, fontWeight: 700,
        background: hov ? "var(--sm-navy-dark)" : "var(--sm-navy)",
        color: "#fff", border: "1px solid var(--sm-navy)", cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: fullWidth ? "100%" : "auto",
        boxShadow: hov ? "0 16px 36px -16px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transform: active ? "scale(.98)" : hov ? "translateY(-2px)" : "translateY(0)",
        transition: "transform .25s ease, box-shadow .25s ease, background .2s ease",
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 8, background: "rgba(255,255,255,.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, flexShrink: 0,
      }}><i className="fa-solid fa-calendar-check" aria-hidden="true" style={{ color: "#fff" }} /></div>
      <span>Book a Free Demo</span>
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
        padding: "13px 28px", borderRadius: 10,
        fontSize: 14, fontWeight: 600,
        background: hov ? "var(--sm-hover)" : "var(--sm-surface)", color: "var(--sm-text)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: fullWidth ? "100%" : "auto",
        transform: active ? "scale(.98)" : hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 16px 36px -16px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transition: "all .25s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, background: "var(--sm-teal-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12,
        }}><i className="fa-solid fa-hand" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></div>
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

  const secPad = isMobile ? "48px 20px 52px" : isTablet ? "56px 36px 64px" : "72px 56px 80px";

  // Absolute positions for desktop floating cards
  const desktopCardPositions = [
    { right: 80, top: 60 },
    { right: 300, bottom: 60 },
    { right: 60, bottom: 80 },
  ];

  // Ring badges: full on desktop, edge-pinned on tablet, hidden on mobile
  const ringBadges = isDesktop
    ? [
      { icon: <i className="fa-solid fa-graduation-cap" style={{ color: "var(--sm-navy)" }} />, pos: { right: 240, top: 80 }, delay: "0.7s" },
      { icon: <i className="fa-solid fa-lightbulb" style={{ color: "var(--sm-navy)" }} />, pos: { right: 160, bottom: 100 }, delay: "0.9s" },
    ]
    : isTablet
      ? [
        { icon: <i className="fa-solid fa-graduation-cap" style={{ color: "var(--sm-navy)" }} />, pos: { right: 16, top: 52 }, delay: "0.7s" },
        { icon: <i className="fa-solid fa-lightbulb" style={{ color: "var(--sm-navy)" }} />, pos: { right: 16, bottom: 52 }, delay: "0.9s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes ahFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ahCardIn    { from{opacity:0;transform:translateY(20px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ahBarGrow   { from{width:0} to{width:100%} }
        @keyframes ahBadgePop  { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)",
        minHeight: isMobile ? "auto" : 460,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

        {/* Floating stat cards — desktop absolute positioning only */}
        {isDesktop && STAT_CARDS.map((card, i) => (
          <StatCard key={i} card={card} index={i} absPos={desktopCardPositions[i]} />
        ))}

        {/* Ring badges */}
        {ringBadges.map((badge, i) => (
          <div key={i} style={{
            position: "absolute", ...badge.pos,
            width: 48, height: 48, borderRadius: 13,
            background: "var(--sm-teal-light)",
            border: "1px solid var(--sm-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, zIndex: 2,
            animation: `ahBadgePop .5s ease ${badge.delay} both`,
          }}>
            {badge.icon}
          </div>
        ))}

        {/* ── Main content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%",
          maxWidth: isDesktop ? 820 : isTablet ? 640 : "100%",
        }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "7px 16px 7px 12px", marginBottom: isMobile ? 20 : 28, animation: "ahFadeUp .6s ease .05s both" }}>
            <span style={{ fontSize: 14, display: "inline-block", color: "var(--sm-navy)" }}><i className="fa-solid fa-award" aria-hidden="true" /></span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>As Seen on Shark Tank Pakistan</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 32 : isTablet ? 44 : 56,
            fontWeight: 900, color: "var(--sm-text)",
            lineHeight: 1.15,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "ahFadeUp .65s ease .15s both",
          }}>
            Empowering Schools Through{!isMobile && <br />}{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Innovation, Technology, and Educational Excellence
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "var(--sm-text-muted)",
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
                {i > 0 && <div style={{ width: 1, height: 14, background: "var(--sm-border)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 11 : 12, color: "var(--sm-text-muted)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)", flexShrink: 0 }} />
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
