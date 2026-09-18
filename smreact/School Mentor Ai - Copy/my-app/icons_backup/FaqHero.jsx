// ── SchoolMentor FAQ Hero ─────────────────────────────────────────────────────
import { useState, useEffect } from "react";

const QA_BUBBLES = [
  { q: "❓ What is SchoolMentor?", a: "Pakistan's #1 cloud-based school management platform.", delay: "0.6s", dur: "5s" },
  { q: "💰 How much does it cost?", a: "Starting at PKR 20 per student per month.", delay: "0.8s", dur: "6s" },
  { q: "📱 Is there a mobile app?", a: "Yes! Apps for Principals, Teachers & Parents.", delay: "1.0s", dur: "7s" },
];

const CATEGORY_CHIPS = [
  { label: "General", dot: "#3b82f6" },
  { label: "Pricing", dot: "#1DB88A" },
  { label: "Technical", dot: "#f59e0b" },
  { label: "Support", dot: "#a78bfa" },
  { label: "Getting Started", dot: "#f87171" },
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
          animation: `fqParticle ${p.duration}s ${p.delay}s linear infinite`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ── Q&A bubble — absolute on desktop, inline on mobile/tablet ─────────────────
function QaBubble({ bubble, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "12px 16px", maxWidth: 200,
      animation: `fqBubbleIn .6s ease ${bubble.delay} both, fqBubbleFloat ${bubble.dur} ease-in-out calc(${bubble.delay} + .6s) infinite`,
    }
    : {
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "12px 16px",
      flex: "1 1 180px",
      animation: `fqBubbleIn .6s ease ${bubble.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#7fffd4", letterSpacing: ".5px", marginBottom: 5 }}>
        {bubble.q}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.78)", lineHeight: 1.5 }}>{bubble.a}</div>
    </div>
  );
}

// ── Ring badge ────────────────────────────────────────────────────────────────
function RingBadge({ badge }) {
  return (
    <div style={{
      position: "absolute", ...badge.pos, zIndex: 2,
      width: 44, height: 44, borderRadius: "50%",
      background: "rgba(255,255,255,.14)",
      border: "1.5px solid rgba(255,255,255,.28)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      animation: `fqBadgePop .5s ease ${badge.delay} both, fqBadgeFloat 3.5s ease-in-out calc(${badge.delay} + .5s) infinite`,
    }}>
      {badge.icon}
      <div style={{ position: "absolute", inset: -5, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.18)", animation: "fqRingPulse 2.5s ease-out infinite" }} />
    </div>
  );
}

// ── Floating search bar ───────────────────────────────────────────────────────
function SearchBar({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.25)",
      borderRadius: 100, padding: "10px 16px",
      width: "100%", maxWidth: 320,
      animation: "fqFadeUp .7s ease .5s both",
    }
    : {
      position: "absolute", right: 180, top: "50%",
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.25)",
      borderRadius: 100, padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 10,
      zIndex: 2, width: 220,
      animation: "fqSearchIn .7s ease .5s both, fqSearchFloat 6s ease-in-out 1.2s infinite",
    };

  return (
    <div style={style}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>🔍</span>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)", flex: 1 }}>Search questions...</span>
      <div style={{ width: 2, height: 14, background: "rgba(255,255,255,.7)", animation: "fqCursor .75s step-end infinite", flexShrink: 0 }} />
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
        background: hov ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.12)",
        border: `1px solid ${hov ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.22)"}`,
        borderRadius: 100, padding: "7px 14px",
        fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)",
        cursor: "pointer",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
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
      { icon: "❓", pos: { right: 500, top: 45 }, delay: "0.9s" },
      { icon: "💡", pos: { right: 460, bottom: 50 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: "❓", pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: "💡", pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fqFadeUp     { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fqShimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fqOrbFloat   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,14px)} }
        @keyframes fqParticle   { 0%{transform:translateY(0) scale(0);opacity:0} 15%{opacity:.45} 85%{opacity:.1} 100%{transform:translateY(-110px) scale(1.4);opacity:0} }
        @keyframes fqBubbleIn   { from{opacity:0;transform:translateY(16px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes fqBubbleFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes fqSearchIn   { from{opacity:0;transform:translateY(-50%) scale(.9)} to{opacity:1;transform:translateY(-50%) scale(1)} }
        @keyframes fqSearchFloat{ 0%,100%{transform:translateY(-50%)} 50%{transform:translateY(calc(-50% - 7px))} }
        @keyframes fqBadgePop   { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes fqBadgeFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fqRingPulse  { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.9);opacity:0} }
        @keyframes fqCursor     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fqQBob       { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-3px) scale(1.15)} }
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
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", top: -200, left: -140, background: "radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents: "none", animation: "fqOrbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: -180, right: -90, background: "radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents: "none", animation: "fqOrbFloat 10s ease-in-out infinite reverse" }} />

        {/* Shimmer top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "fqShimmer 3.5s linear infinite" }} />

        {/* Particles */}
        <Particles />

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "fqFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block", animation: "fqQBob 2s ease-in-out infinite" }}>❓</span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>FAQ's</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "fqFadeUp .65s ease .15s both",
          }}>
            Frequently Asked{!isMobile && <br />}{" "}
            <span style={{ background: "linear-gradient(90deg,#7fffd4,#b0e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Questions
            </span>
            <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#7fffd4", marginLeft: 3, verticalAlign: "middle", animation: "fqCursor .75s step-end infinite" }} />
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "rgba(255,255,255,.75)", lineHeight: 1.75, maxWidth: 520,
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
