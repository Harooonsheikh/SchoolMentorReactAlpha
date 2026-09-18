// ── SchoolMentor Pricing Hero ─────────────────────────────────────────────────
import { useEffect, useState } from "react";

const PLAN_PILLS = [
  { color: "#3b82f6", label: "Basic Plan", price: "PKR 20/mo", delay: "0.6s" },
  { color: "#1DB88A", label: "Pro Plan", price: "+ PKR 4,000", delay: "0.75s" },
  { color: "#B8860B", label: "Premium Plan", price: "+ PKR 6,000", delay: "0.9s" },
];

const TRUST = [
  "No Hidden Fees",
  "Cancel Anytime",
  "700+ Schools Trust Us",
  "24/7 Support",
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
    id: i,
    size: Math.random() * 5 + 2,
    left: Math.random() * 100,
    bottom: Math.random() * 20,
    opacity: 0.12 + Math.random() * 0.22,
    duration: 5 + Math.random() * 7,
    delay: Math.random() * 6,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {items.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          width: p.size, height: p.size, borderRadius: "50%",
          left: `${p.left}%`, bottom: `${p.bottom}%`,
          background: `rgba(255,255,255,${p.opacity})`,
          animation: `phParticle ${p.duration}s ${p.delay}s linear infinite`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ── Plan pill — inline (mobile/tablet) or absolute (desktop) ──────────────────
function PlanPill({ pill, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos,
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 100, padding: "8px 16px 8px 10px",
      zIndex: 2,
      animation: `phPillIn .6s ease ${pill.delay} both, phPillFloat 4s ease-in-out calc(${pill.delay} + .6s) infinite`,
    }
    : {
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,.13)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 100, padding: "8px 16px 8px 10px",
      animation: `phPillIn .6s ease ${pill.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: pill.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{pill.label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)", marginLeft: 4 }}>{pill.price}</span>
    </div>
  );
}

// ── Price tag card ─────────────────────────────────────────────────────────────
function PriceTag({ inline }) {
  const style = inline
    ? {
      background: "rgba(255,255,255,.12)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 20, padding: "16px 20px",
      textAlign: "center", flex: "0 0 auto",
      animation: "phFadeUp .7s ease .5s both",
    }
    : {
      position: "absolute", right: 300, top: "50%",
      background: "rgba(255,255,255,.12)",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 20, padding: "20px 24px",
      zIndex: 2, textAlign: "center",
      animation: "phTagIn .7s ease .5s both, phTagFloat 5s ease-in-out 1.2s infinite",
    };

  return (
    <div style={style}>
      <div style={{ fontSize: inline ? 22 : 28, marginBottom: 6 }}>💰</div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.55)", marginBottom: 6 }}>
        Starting from
      </div>
      <div style={{ fontSize: inline ? 22 : 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>PKR 20</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 4 }}>per Student / Month</div>
      <div style={{ height: 3, background: "rgba(255,255,255,.2)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg,#1DB88A,#7fffd4)", animation: "phBarGrow 1.5s ease 1.2s both" }} />
      </div>
    </div>
  );
}

// ── Ring badge ────────────────────────────────────────────────────────────────
function RingBadge({ badge }) {
  return (
    <div style={{
      position: "absolute", ...badge.pos,
      width: 44, height: 44, borderRadius: "50%",
      background: "rgba(255,255,255,.14)",
      border: "1.5px solid rgba(255,255,255,.28)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, zIndex: 2,
      animation: `phBadgePop .5s ease ${badge.delay} both, phBadgeFloat 3.5s ease-in-out calc(${badge.delay} + .5s) infinite`,
    }}>
      {badge.icon}
      <div style={{
        position: "absolute", inset: -5, borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,.18)",
        animation: "phRingPulse 2.5s ease-out infinite",
      }} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PricingHero() {
  const winW = useWindowWidth();
  const isMobile = winW < 640;
  const isTablet = winW >= 640 && winW < 1024;
  const isDesktop = winW >= 1024;

  const secPad = isMobile ? "44px 20px 48px" : isTablet ? "52px 36px 60px" : "64px 56px 72px";

  // Desktop absolute positions for pills
  const desktopPillPos = [
    { right: 120, top: 55 },
    { right: 80, top: 130 },
    { right: 140, bottom: 60 },
  ];

  // Ring badges — desktop only (would overlap content on smaller screens)
  const ringBadges = isDesktop
    ? [
      { icon: "📊", pos: { right: 500, top: 50 }, delay: "0.8s" },
      { icon: "🎯", pos: { right: 450, bottom: 55 }, delay: "1.0s" },
    ]
    : isTablet
      ? [
        { icon: "📊", pos: { right: 14, top: 48 }, delay: "0.8s" },
        { icon: "🎯", pos: { right: 14, bottom: 48 }, delay: "1.0s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes phFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes phShimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes phOrbFloat  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,14px)} }
        @keyframes phParticle  { 0%{transform:translateY(0) scale(0);opacity:0} 15%{opacity:.45} 85%{opacity:.1} 100%{transform:translateY(-110px) scale(1.4);opacity:0} }
        @keyframes phPillIn    { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes phPillFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes phTagIn     { from{opacity:0;transform:translateY(-50%) scale(.85)} to{opacity:1;transform:translateY(-50%) scale(1)} }
        @keyframes phTagFloat  { 0%,100%{transform:translateY(-50%)} 50%{transform:translateY(calc(-50% - 8px))} }
        @keyframes phBarGrow   { from{width:0} to{width:100%} }
        @keyframes phBadgePop  { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes phBadgeFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes phRingPulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.9);opacity:0} }
        @keyframes phCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes phDotPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.4)} }
        @keyframes phBadgeSpin { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-8deg)} 75%{transform:rotate(8deg)} }
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
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", top: -200, left: -140, background: "radial-gradient(circle,rgba(255,255,255,.1),transparent 65%)", pointerEvents: "none", animation: "phOrbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: -180, right: -90, background: "radial-gradient(circle,rgba(29,184,138,.2),transparent 65%)", pointerEvents: "none", animation: "phOrbFloat 10s ease-in-out infinite reverse" }} />

        {/* Shimmer top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.3),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "phShimmer 3.5s linear infinite" }} />

        {/* Particles */}
        <Particles />

        {/* Plan pills — absolute on desktop only */}
        {isDesktop && PLAN_PILLS.map((pill, i) => (
          <PlanPill key={i} pill={pill} absPos={desktopPillPos[i]} />
        ))}

        {/* Price tag — absolute on desktop only */}
        {isDesktop && <PriceTag />}

        {/* Ring badges */}
        {ringBadges.map((badge, i) => <RingBadge key={i} badge={badge} />)}

        {/* ── Content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%",
          maxWidth: isDesktop ? 680 : isTablet ? 560 : "100%",
        }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "phFadeUp .6s ease .05s both" }}>
            <span style={{ fontSize: 14, display: "inline-block", animation: "phBadgeSpin 4s linear infinite" }}>💎</span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>Simple, Transparent Pricing</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 32 : isTablet ? 46 : 60,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "phFadeUp .65s ease .15s both",
          }}>
            Transparent Pricing.{!isMobile && <br />}{" "}
            <span style={{ background: "linear-gradient(90deg,#7fffd4,#b0e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Tailored to Your School.
            </span>
            <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#7fffd4", marginLeft: 3, verticalAlign: "middle", animation: "phCursor .75s step-end infinite" }} />
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "rgba(255,255,255,.75)",
            lineHeight: 1.75, maxWidth: 540,
            marginBottom: isMobile ? 24 : 40,
            animation: "phFadeUp .65s ease .25s both",
          }}>
            We believe every Pakistani school deserves world-class management tools at a price that makes sense.
          </p>

          {/* Trust row */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: isMobile ? 10 : 20,
            flexWrap: "wrap",
            animation: "phFadeUp .65s ease .35s both",
          }}>
            {TRUST.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,.2)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: isMobile ? 11 : 12.5, color: "rgba(255,255,255,.65)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1DB88A", flexShrink: 0, animation: `phDotPulse 2s ${i * 0.4}s ease-in-out infinite` }} />
                  {t}
                </div>
              </div>
            ))}
          </div>

          {/* Inline pills + price tag — mobile & tablet only */}
          {!isDesktop && (
            <div style={{
              display: "flex", flexWrap: "wrap",
              alignItems: "center", gap: 10,
              marginTop: 24,
              animation: "phFadeUp .65s ease .45s both",
            }}>
              {PLAN_PILLS.map((pill, i) => (
                <PlanPill key={i} pill={pill} absPos={null} />
              ))}
              <PriceTag inline />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
