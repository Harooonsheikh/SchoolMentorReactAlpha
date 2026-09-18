// ── SchoolMentor Success Stories Hero ────────────────────────────────────────
import { useEffect, useState } from "react";

const REVIEW_CARDS = [
  {
    text: '"Everything is now centralised — attendance, payroll, results."',
    avatar: "👨‍💼", name: "Principal, Lahore", role: "Using SchoolMentor since 2022",
    delay: "0.6s", floatDuration: "5s",
  },
  {
    text: '"Attendance in seconds, parents notified automatically."',
    avatar: "👩‍🏫", name: "Teacher, Karachi", role: "Using SchoolMentor since 2023",
    delay: "0.8s", floatDuration: "6s",
  },
  {
    text: '"Fee tracking & payroll — no more confusion at month end."',
    avatar: "👨‍💼", name: "Admin, Islamabad", role: "Using SchoolMentor since 2021",
    delay: "1.0s", floatDuration: "7s",
  },
];

const STATS = [
  { val: "700+", label: "Schools" },
  { val: "98%", label: "Satisfaction" },
  { val: "45+", label: "Cities" },
];

const TRUST = ["700+ Schools", "45+ Cities", "98% Satisfaction", "Since 2020"];

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
          animation: `shParticle ${p.duration}s ${p.delay}s linear infinite`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ── Review card — absolute on desktop, inline on mobile/tablet ────────────────
function ReviewCard({ card, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "14px 16px", maxWidth: 200,
      animation: `shCardIn .7s ease ${card.delay} both, shCardFloat ${card.floatDuration} ease-in-out calc(${card.delay} + .7s) infinite`,
    }
    : {
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 14, padding: "14px 16px",
      flex: "1 1 200px",
      animation: `shCardIn .7s ease ${card.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>⭐⭐⭐⭐⭐</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)", lineHeight: 1.5, fontStyle: "italic" }}>{card.text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
          {card.avatar}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.75)" }}>{card.name}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginTop: 1 }}>{card.role}</div>
        </div>
      </div>
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
      animation: `shBadgePop .5s ease ${badge.delay} both, shBadgeFloat 3.5s ease-in-out calc(${badge.delay} + .5s) infinite`,
    }}>
      {badge.icon}
      <div style={{ position: "absolute", inset: -5, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.18)", animation: "shRingPulse 2.5s ease-out infinite" }} />
    </div>
  );
}

// ── Stat strip ────────────────────────────────────────────────────────────────
function StatStrip({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center",
      background: "rgba(255,255,255,.1)",
      border: "1px solid rgba(255,255,255,.2)",
      borderRadius: 100, overflow: "hidden",
      animation: "shStripIn .7s ease .5s both",
      alignSelf: "flex-start",
    }
    : {
      position: "absolute", right: 48, bottom: 28, zIndex: 2,
      display: "flex", alignItems: "center",
      background: "rgba(255,255,255,.1)",
      border: "1px solid rgba(255,255,255,.2)",
      borderRadius: 100, overflow: "hidden",
      animation: "shStripIn .7s ease 1.2s both",
    };

  return (
    <div style={style}>
      {STATS.map((s, i) => (
        <div key={i} style={{
          padding: "8px 16px",
          display: "flex", alignItems: "center", gap: 6,
          borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,.15)" : "none",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{s.val}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", fontWeight: 500, letterSpacing: ".5px" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SuccessHero() {
  const winW = useWindowWidth();
  const isMobile = winW < 640;
  const isTablet = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const secPad = isMobile ? "44px 20px 48px" : isTablet ? "52px 36px 60px" : "64px 56px 72px";

  // Desktop absolute positions for review cards
  const desktopCardPos = [
    { right: 60, top: 50 },
    { right: 280, top: 70 },
    { right: 120, bottom: 50 },
  ];

  // Ring badges — desktop & tablet edge-pinned; hidden on mobile
  const ringBadges = isDesktop
    ? [
      { icon: "🏆", pos: { right: 500, top: 50 }, delay: "0.9s" },
      { icon: "💬", pos: { right: 460, bottom: 55 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: "🏆", pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: "💬", pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes shFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shShimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes shOrbFloat  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,14px)} }
        @keyframes shParticle  { 0%{transform:translateY(0) scale(0);opacity:0} 15%{opacity:.45} 85%{opacity:.1} 100%{transform:translateY(-110px) scale(1.4);opacity:0} }
        @keyframes shCardIn    { from{opacity:0;transform:translateY(16px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shCardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes shBadgePop  { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes shBadgeFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shRingPulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.9);opacity:0} }
        @keyframes shStripIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shTrophy    { 0%,100%{transform:scale(1) rotate(0)} 50%{transform:scale(1.2) rotate(-8deg)} }
        @keyframes shCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shDotPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.4)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
        minHeight: isMobile ? "auto" : 380,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />

        {/* Orbs */}
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", top: -200, left: -140, background: "radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents: "none", animation: "shOrbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: -180, right: -90, background: "radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents: "none", animation: "shOrbFloat 10s ease-in-out infinite reverse" }} />

        {/* Shimmer top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "shShimmer 3.5s linear infinite" }} />

        {/* Particles */}
        <Particles />

        {/* Review cards — absolute on desktop only */}
        {isDesktop && REVIEW_CARDS.map((card, i) => (
          <ReviewCard key={i} card={card} absPos={desktopCardPos[i]} />
        ))}

        {/* Ring badges */}
        {ringBadges.map((badge, i) => <RingBadge key={i} badge={badge} />)}

        {/* Stat strip — absolute on desktop, hidden here on mobile/tablet (shown inline below) */}
        {isDesktop && <StatStrip />}

        {/* ── Content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%",
          maxWidth: isDesktop ? 660 : isTablet ? 540 : "100%",
          display: "flex", flexDirection: "column",
        }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "shFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block", animation: "shTrophy 3s ease-in-out infinite" }}>🏆</span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>Success Stories</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "shFadeUp .65s ease .15s both",
          }}>
            Real Schools.{!isMobile && <br />}{" "}
            <span style={{ background: "linear-gradient(90deg,#7fffd4,#b0e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Real Results.
            </span>
            {!isMobile && <br />}{" "}Real Impact.
            <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#7fffd4", marginLeft: 3, verticalAlign: "middle", animation: "shCursor .75s step-end infinite" }} />
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "rgba(255,255,255,.75)", lineHeight: 1.75, maxWidth: 520,
            marginBottom: isMobile ? 24 : 40,
            animation: "shFadeUp .65s ease .25s both",
          }}>
            Hundreds of schools across Pakistan have transformed their operations with SchoolMentor®.
          </p>

          {/* Trust row */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: isMobile ? 10 : 20,
            flexWrap: "wrap",
            animation: "shFadeUp .65s ease .35s both",
          }}>
            {TRUST.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,.2)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: isMobile ? 11 : 12.5, color: "rgba(255,255,255,.65)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1DB88A", flexShrink: 0, animation: `shDotPulse 2s ${i * 0.4}s ease-in-out infinite` }} />
                  {t}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile/tablet: review cards + stat strip inline */}
          {!isDesktop && (
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16, animation: "shFadeUp .65s ease .45s both" }}>
              {/* Stat strip inline */}
              <StatStrip inline />

              {/* Review cards as a flex row that wraps */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {REVIEW_CARDS.map((card, i) => (
                  <ReviewCard key={i} card={card} absPos={null} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
