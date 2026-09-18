// ── SchoolMentor FAQ Hero ─────────────────────────────────────────────────────
import { useState, useEffect } from "react";

const QA_BUBBLES = [
  { q: "What is SchoolMentor?", a: "Pakistan's #1 cloud-based school management platform.", delay: "0.6s", dur: "5s" },
  { q: "How much does it cost?", a: "Starting at PKR 20 per student per month.", delay: "0.8s", dur: "6s" },
  { q: "Is there a mobile app?", a: "Yes! Apps for Principals, Teachers & Parents.", delay: "1.0s", dur: "7s" },
];

const CATEGORY_CHIPS = [
  { label: "General", dot: "var(--sm-navy)" },
  { label: "Pricing", dot: "var(--sm-navy)" },
  { label: "Technical", dot: "var(--sm-navy)" },
  { label: "Support", dot: "var(--sm-navy)" },
  { label: "Getting Started", dot: "var(--sm-navy)" },
];

// Desktop absolute positions kept separate from data
const DESKTOP_BUBBLE_POS = [
  { right: 80, top: 45 },
  { right: 300, top: 60 },
  { right: 100, bottom: 45 },
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

// ── Q&A bubble — absolute on desktop, inline on mobile/tablet ─────────────────
function QaBubble({ bubble, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "12px 16px", maxWidth: 200,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `fqBubbleIn .6s ease ${bubble.delay} both`,
    }
    : {
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "12px 16px",
      flex: "1 1 180px",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `fqBubbleIn .6s ease ${bubble.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sm-navy)", letterSpacing: ".5px", marginBottom: 5 }}>
        {bubble.q}
      </div>
      <div style={{ fontSize: 11, color: "var(--sm-text-soft)", lineHeight: 1.5 }}>{bubble.a}</div>
    </div>
  );
}

// ── Ring badge ────────────────────────────────────────────────────────────────
function RingBadge({ badge }) {
  return (
    <div style={{
      position: "absolute", ...badge.pos, zIndex: 2,
      width: 44, height: 44, borderRadius: 12,
      background: "var(--sm-teal-light)",
      border: "1px solid var(--sm-border)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      animation: `fqBadgePop .5s ease ${badge.delay} both`,
    }}>
      {badge.icon}
    </div>
  );
}

// ── Floating search bar ───────────────────────────────────────────────────────
function SearchBar({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center", gap: 10,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 100, padding: "10px 16px",
      width: "100%", maxWidth: 320,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "fqFadeUp .7s ease .5s both",
    }
    : {
      position: "absolute", right: 180, top: "50%", transform: "translateY(-50%)",
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 100, padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 10,
      zIndex: 2, width: 220,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "fqSearchIn .7s ease .5s both",
    };

  return (
    <div style={style}>
      <span style={{ fontSize: 15, flexShrink: 0 }}><i className="fa-solid fa-magnifying-glass" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></span>
      <span style={{ fontSize: 12, color: "var(--sm-text-muted)", flex: 1 }}>Search questions...</span>
      <div style={{ width: 2, height: 14, background: "var(--sm-navy)", animation: "fqCursor .75s step-end infinite", flexShrink: 0 }} />
    </div>
  );
}

// ── Category chip ─────────────────────────────────────────────────────────────
function Chip({ chip }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: hov ? "var(--sm-hover)" : "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 100, padding: "7px 14px",
        fontSize: 12, fontWeight: 600, color: "var(--sm-text)",
        cursor: "pointer",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: "0 1px 2px rgba(17,24,39,.04)",
        transition: "all .25s ease",
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: chip.dot, flexShrink: 0 }} />
      {chip.label}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function FaqHero() {
  const winW = useWindowWidth();
  const isMobile = winW < 640;
  const isTablet = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const secPad = isMobile ? "44px 20px 48px" : isTablet ? "52px 36px 60px" : "64px 56px 72px";

  const ringBadges = isDesktop
    ? [
      { icon: <i className="fa-solid fa-circle-question" style={{ color: "var(--sm-navy)" }} />, pos: { right: 500, top: 45 }, delay: "0.9s" },
      { icon: <i className="fa-solid fa-lightbulb" style={{ color: "var(--sm-navy)" }} />, pos: { right: 460, bottom: 50 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: <i className="fa-solid fa-circle-question" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: <i className="fa-solid fa-lightbulb" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fqFadeUp     { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fqBubbleIn   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fqSearchIn   { from{opacity:0;transform:translateY(-50%)} to{opacity:1;transform:translateY(-50%)} }
        @keyframes fqBadgePop   { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
        @keyframes fqCursor     { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)",
        minHeight: isMobile ? "auto" : 360,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

        {/* Q&A bubbles — absolute on desktop only */}
        {isDesktop && QA_BUBBLES.map((b, i) => (
          <QaBubble key={i} bubble={b} absPos={DESKTOP_BUBBLE_POS[i]} />
        ))}

        {/* Floating search bar — absolute on desktop only */}
        {isDesktop && <SearchBar />}

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "fqFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block" }}><i className="fa-solid fa-circle-question" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>FAQ's</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "var(--sm-text)",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "fqFadeUp .65s ease .15s both",
          }}>
            Frequently Asked{!isMobile && <br />}{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Questions
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "var(--sm-text-muted)", lineHeight: 1.75, maxWidth: 520,
            marginBottom: isMobile ? 24 : 40,
            animation: "fqFadeUp .65s ease .25s both",
          }}>
            Everything you need to know about SchoolMentor®. Can't find what you're looking for? Contact our team directly.
          </p>

          {/* Category chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", animation: "fqFadeUp .65s ease .35s both" }}>
            {CATEGORY_CHIPS.map((chip, i) => <Chip key={i} chip={chip} />)}
          </div>

          {/* Mobile/tablet: search bar + Q&A bubbles inline */}
          {!isDesktop && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12, animation: "fqFadeUp .65s ease .45s both" }}>
              <SearchBar inline />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {QA_BUBBLES.map((b, i) => (
                  <QaBubble key={i} bubble={b} absPos={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
