// ── SchoolMentor Contact Hero ─────────────────────────────────────────────────
import { useState, useEffect } from "react";

const CONTACT_CARDS = [
  { icon: "📧", label: "Email Us", value: "admin@schoolmentor.app", sub: "We reply within 24 hours", delay: "0.6s", dur: "5s" },
  { icon: "💬", label: "WhatsApp / Phone", value: "+923700036867", sub: "Mon–Sat, 9am–6pm PKT", delay: "0.8s", dur: "6s" },
  { icon: "📍", label: "Office Address", value: "Paradise Commercial", sub: "Floors 3–5, Islamabad", delay: "1.0s", dur: "7s" },
];

const DESKTOP_CARD_POS = [
  { right: 70, top: 45 },
  { right: 290, top: 62 },
  { right: 110, bottom: 48 },
];

const CHIPS = [
  { icon: "📧", label: "Email Us" },
  { icon: "💬", label: "WhatsApp" },
  { icon: "🚀", label: "Book a Demo", onClick: () => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); } },
  { icon: "📍", label: "Visit Us" },
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
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i, size: Math.random() * 5 + 2,
    left: Math.random() * 100, bottom: Math.random() * 20,
    opacity: 0.12 + Math.random() * 0.22,
    duration: 5 + Math.random() * 7, delay: Math.random() * 6,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {items.map(p => (
        <div key={p.id} style={{
          position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
          left: `${p.left}%`, bottom: `${p.bottom}%`,
          background: `rgba(255,255,255,${p.opacity})`,
          animation: `ctParticle ${p.duration}s ${p.delay}s linear infinite`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ── Contact card — absolute on desktop, inline on mobile/tablet ───────────────
function ContactCard({ card, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2, minWidth: 185,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "13px 16px",
      animation: `ctCardIn .6s ease ${card.delay} both, ctCardFloat ${card.dur} ease-in-out calc(${card.delay} + .6s) infinite`,
    }
    : {
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "13px 16px",
      flex: "1 1 150px",
      animation: `ctCardIn .6s ease ${card.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{card.label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{card.value}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{card.sub}</div>
    </div>
  );
}

// ── 24h response badge — absolute on desktop, inline on mobile/tablet ─────────
function ResponseBadge({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "12px 16px",
      animation: "ctFadeUp .7s ease .5s both", alignSelf: "flex-start",
    }
    : {
      position: "absolute", right: 180, top: "50%",
      background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 20, padding: "16px 20px", textAlign: "center", zIndex: 2, minWidth: 130,
      animation: "ctTagIn .7s ease .5s both, ctTagFloat 6s ease-in-out 1.2s infinite",
    };

  return (
    <div style={style}>
      <div style={{ fontSize: inline ? 22 : 26, marginBottom: inline ? 0 : 8 }}>⚡</div>
      <div>
        <div style={{ fontSize: inline ? 20 : 24, fontWeight: 900, color: "#fff", lineHeight: 1 }}>24h</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>Response Time</div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1DB88A", ...(inline ? { marginLeft: "auto" } : { margin: "8px auto 0" }), animation: "ctDotPulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
    </div>
  );
}

// ── Ring badge ────────────────────────────────────────────────────────────────
function RingBadge({ badge }) {
  return (
    <div style={{
      position: "absolute", ...badge.pos, zIndex: 2,
      width: 44, height: 44, borderRadius: "50%",
      background: "rgba(255,255,255,.14)", border: "1.5px solid rgba(255,255,255,.28)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      animation: `ctBadgePop .5s ease ${badge.delay} both, ctBadgeFloat 3.5s ease-in-out calc(${badge.delay} + .5s) infinite`,
    }}>
      {badge.icon}
      <div style={{ position: "absolute", inset: -5, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.18)", animation: "ctRingPulse 2.5s ease-out infinite" }} />
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ chip }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={chip.onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: hov ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.12)",
        border: `1px solid ${hov ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.22)"}`,
        borderRadius: 100, padding: "8px 16px",
        fontSize: 12.5, fontWeight: 600, color: "#fff",
        cursor: "pointer",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 6px 16px rgba(0,0,0,.12)" : "none",
        transition: "all .25s ease",
      }}
    >
      {chip.icon} {chip.label}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ContactHero() {
  const winW = useWindowWidth();
  const isMobile = winW < 640;
  const isTablet = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const secPad = isMobile ? "44px 20px 48px" : isTablet ? "52px 36px 60px" : "64px 56px 72px";

  const ringBadges = isDesktop
    ? [
      { icon: "💌", pos: { right: 500, top: 45 }, delay: "0.9s" },
      { icon: "🤝", pos: { right: 460, bottom: 50 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: "💌", pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: "🤝", pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes ctFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ctShimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ctOrbFloat  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,14px)} }
        @keyframes ctParticle  { 0%{transform:translateY(0) scale(0);opacity:0} 15%{opacity:.45} 85%{opacity:.1} 100%{transform:translateY(-110px) scale(1.4);opacity:0} }
        @keyframes ctCardIn    { from{opacity:0;transform:translateY(16px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ctCardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes ctTagIn     { from{opacity:0;transform:translateY(-50%) scale(.85)} to{opacity:1;transform:translateY(-50%) scale(1)} }
        @keyframes ctTagFloat  { 0%,100%{transform:translateY(-50%)} 50%{transform:translateY(calc(-50% - 8px))} }
        @keyframes ctBadgePop  { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes ctBadgeFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes ctRingPulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.9);opacity:0} }
        @keyframes ctCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ctHeartBeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.25)} 28%{transform:scale(1)} 42%{transform:scale(1.15)} 70%{transform:scale(1)} }
        @keyframes ctDotPulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.6} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
        minHeight: isMobile ? "auto" : 360,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />

        {/* Orbs */}
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", top: -200, left: -140, background: "radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents: "none", animation: "ctOrbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: -180, right: -90, background: "radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents: "none", animation: "ctOrbFloat 10s ease-in-out infinite reverse" }} />

        {/* Shimmer top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "ctShimmer 3.5s linear infinite" }} />

        {/* Particles */}
        <Particles />

        {/* Contact cards — absolute on desktop only */}
        {isDesktop && CONTACT_CARDS.map((card, i) => (
          <ContactCard key={i} card={card} absPos={DESKTOP_CARD_POS[i]} />
        ))}

        {/* 24h badge — absolute on desktop only */}
        {isDesktop && <ResponseBadge />}

        {/* Ring badges */}
        {ringBadges.map((badge, i) => <RingBadge key={i} badge={badge} />)}

        {/* ── Content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%",
          maxWidth: isDesktop ? 660 : isTablet ? 540 : "100%",
          display: "flex", flexDirection: "column",
        }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "ctFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block", animation: "ctHeartBeat 1.5s ease-in-out infinite" }}>💙</span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>Contact Us</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "ctFadeUp .65s ease .15s both",
          }}>
            We'd Love to{!isMobile && <br />}{" "}
            <span style={{ background: "linear-gradient(90deg,#7fffd4,#b0e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Hear from You.
            </span>
            <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#7fffd4", marginLeft: 3, verticalAlign: "middle", animation: "ctCursor .75s step-end infinite" }} />
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "rgba(255,255,255,.75)", lineHeight: 1.75, maxWidth: 520,
            marginBottom: isMobile ? 24 : 40,
            animation: "ctFadeUp .65s ease .25s both",
          }}>
            Whether you want to book a demo, ask a question, or explore a partnership — our team responds within 24 hours.
          </p>

          {/* Contact chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", animation: "ctFadeUp .65s ease .35s both" }}>
            {CHIPS.map((chip, i) => <Chip key={i} chip={chip} />)}
          </div>

          {/* Mobile/tablet: 24h badge + contact cards inline */}
          {!isDesktop && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12, animation: "ctFadeUp .65s ease .45s both" }}>
              <ResponseBadge inline />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {CONTACT_CARDS.map((card, i) => (
                  <ContactCard key={i} card={card} absPos={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
