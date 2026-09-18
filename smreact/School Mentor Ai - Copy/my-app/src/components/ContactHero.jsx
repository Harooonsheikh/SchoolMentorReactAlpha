// ── SchoolMentor Contact Hero ─────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { openDemoForm } from "./DemoRequestModal.jsx";

const CONTACT_CARDS = [
  { icon: <i className="fa-solid fa-envelope" style={{ color: "var(--sm-navy)" }} />, label: "Email Us", value: "admin@schoolmentor.app", sub: "We reply within 24 hours", delay: "0.6s", dur: "5s" },
  { icon: <i className="fa-solid fa-comment-dots" style={{ color: "var(--sm-navy)" }} />, label: "WhatsApp / Phone", value: "+923700036867", sub: "Mon–Sat, 9am–6pm PKT", delay: "0.8s", dur: "6s" },
  { icon: <i className="fa-solid fa-location-dot" style={{ color: "var(--sm-navy)" }} />, label: "Office Address", value: "Paradise Commercial", sub: "Floors 3–5, Islamabad", delay: "1.0s", dur: "7s" },
];

const DESKTOP_CARD_POS = [
  { right: 70, top: 45 },
  { right: 290, top: 62 },
  { right: 110, bottom: 48 },
];

const CHIPS = [
  { icon: <i className="fa-solid fa-envelope" style={{ color: "var(--sm-navy)" }} />, label: "Email Us" },
  { icon: <i className="fa-solid fa-comment-dots" style={{ color: "var(--sm-navy)" }} />, label: "WhatsApp" },
  { icon: <i className="fa-solid fa-rocket" style={{ color: "var(--sm-navy)" }} />, label: "Book a Demo", onClick: () => { openDemoForm("Contact page"); } },
  { icon: <i className="fa-solid fa-location-dot" style={{ color: "var(--sm-navy)" }} />, label: "Visit Us" },
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

// ── Contact card — absolute on desktop, inline on mobile/tablet ───────────────
function ContactCard({ card, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2, minWidth: 185,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "13px 16px",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `ctCardIn .6s ease ${card.delay} both`,
    }
    : {
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "13px 16px",
      flex: "1 1 150px",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `ctCardIn .6s ease ${card.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-text-muted)", marginBottom: 4 }}>{card.label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sm-text)" }}>{card.value}</div>
      <div style={{ fontSize: 10, color: "var(--sm-text-muted)", marginTop: 2 }}>{card.sub}</div>
    </div>
  );
}

// ── 24h response badge — absolute on desktop, inline on mobile/tablet ─────────
function ResponseBadge({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--sm-surface)", border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "12px 16px",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "ctFadeUp .7s ease .5s both", alignSelf: "flex-start",
    }
    : {
      position: "absolute", right: 180, top: "50%", transform: "translateY(-50%)",
      background: "var(--sm-surface)", border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "16px 20px", textAlign: "center", zIndex: 2, minWidth: 130,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "ctTagIn .7s ease .5s both",
    };

  return (
    <div style={style}>
      <div style={{ fontSize: inline ? 22 : 26, marginBottom: inline ? 0 : 8 }}><i className="fa-solid fa-bolt" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></div>
      <div>
        <div style={{ fontSize: inline ? 20 : 24, fontWeight: 900, color: "var(--sm-navy)", lineHeight: 1 }}>24h</div>
        <div style={{ fontSize: 9, color: "var(--sm-text-muted)", letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>Response Time</div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sm-navy)", ...(inline ? { marginLeft: "auto" } : { margin: "8px auto 0" }), flexShrink: 0 }} />
    </div>
  );
}

// ── Ring badge ────────────────────────────────────────────────────────────────
function RingBadge({ badge }) {
  return (
    <div style={{
      position: "absolute", ...badge.pos, zIndex: 2,
      width: 44, height: 44, borderRadius: 12,
      background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      animation: `ctBadgePop .5s ease ${badge.delay} both`,
    }}>
      {badge.icon}
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
        background: hov ? "var(--sm-hover)" : "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 100, padding: "8px 16px",
        fontSize: 12.5, fontWeight: 600, color: "var(--sm-text)",
        cursor: "pointer",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 16px 36px -16px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
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
      { icon: <i className="fa-solid fa-envelope" style={{ color: "var(--sm-navy)" }} />, pos: { right: 500, top: 45 }, delay: "0.9s" },
      { icon: <i className="fa-solid fa-handshake" style={{ color: "var(--sm-navy)" }} />, pos: { right: 460, bottom: 50 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: <i className="fa-solid fa-envelope" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: <i className="fa-solid fa-handshake" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes ctFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ctCardIn    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ctTagIn     { from{opacity:0;transform:translateY(-50%)} to{opacity:1;transform:translateY(-50%)} }
        @keyframes ctBadgePop  { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)",
        minHeight: isMobile ? "auto" : 360,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "ctFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block" }}><i className="fa-solid fa-heart" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>Contact Us</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "var(--sm-text)",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "ctFadeUp .65s ease .15s both",
          }}>
            We'd Love to{!isMobile && <br />}{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Hear from You.
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "var(--sm-text-muted)", lineHeight: 1.75, maxWidth: 520,
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
