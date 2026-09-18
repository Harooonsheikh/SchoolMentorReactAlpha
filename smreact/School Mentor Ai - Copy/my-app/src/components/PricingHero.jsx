// ── SchoolMentor Pricing Hero ─────────────────────────────────────────────────
import { useEffect, useState } from "react";

const PLAN_PILLS = [
  { color: "#3b82f6", label: "Basic Plan", price: "PKR 20/mo", delay: "0.6s" },
  { color: "#3B82F6", label: "Pro Plan", price: "+ PKR 4,000", delay: "0.75s" },
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

// ── Plan pill — inline (mobile/tablet) or absolute (desktop) ──────────────────
function PlanPill({ pill, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos,
      display: "flex", alignItems: "center", gap: 8,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      borderRadius: 100, padding: "8px 16px 8px 10px",
      zIndex: 2,
      animation: `phPillIn .6s ease ${pill.delay} both`,
    }
    : {
      display: "flex", alignItems: "center", gap: 8,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      borderRadius: 100, padding: "8px 16px 8px 10px",
      animation: `phPillIn .6s ease ${pill.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: pill.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sm-text)" }}>{pill.label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sm-text-muted)", marginLeft: 4 }}>{pill.price}</span>
    </div>
  );
}

// ── Price tag card ─────────────────────────────────────────────────────────────
function PriceTag({ inline }) {
  const style = inline
    ? {
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      borderRadius: 20, padding: "16px 20px",
      textAlign: "center", flex: "0 0 auto",
      animation: "phFadeUp .7s ease .5s both",
    }
    : {
      position: "absolute", right: 300, top: "50%", transform: "translateY(-50%)",
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      boxShadow: "0 16px 36px -16px var(--sm-shadow)",
      borderRadius: 20, padding: "20px 24px",
      zIndex: 2, textAlign: "center",
      animation: "phTagIn .7s ease .5s both",
    };

  return (
    <div style={style}>
      <div style={{ fontSize: inline ? 22 : 28, marginBottom: 6 }}><i className="fa-solid fa-wallet" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-text-muted)", marginBottom: 6 }}>
        Starting from
      </div>
      <div style={{ fontSize: inline ? 22 : 28, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>PKR 20</div>
      <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 4 }}>per Student / Month</div>
      <div style={{ height: 3, background: "var(--sm-border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "var(--sm-navy)", animation: "phBarGrow 1.5s ease 1.2s both" }} />
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
      background: "var(--sm-teal-light)",
      border: "1px solid var(--sm-border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, zIndex: 2,
      animation: `phBadgePop .5s ease ${badge.delay} both`,
    }}>
      {badge.icon}
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
      { icon: <i className="fa-solid fa-chart-column" style={{ color: "var(--sm-navy)" }} />, pos: { right: 500, top: 50 }, delay: "0.8s" },
      { icon: <i className="fa-solid fa-bullseye" style={{ color: "var(--sm-navy)" }} />, pos: { right: 450, bottom: 55 }, delay: "1.0s" },
    ]
    : isTablet
      ? [
        { icon: <i className="fa-solid fa-chart-column" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, top: 48 }, delay: "0.8s" },
        { icon: <i className="fa-solid fa-bullseye" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, bottom: 48 }, delay: "1.0s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes phFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes phPillIn    { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes phTagIn     { from{opacity:0;transform:translateY(-50%) scale(.85)} to{opacity:1;transform:translateY(-50%) scale(1)} }
        @keyframes phBarGrow   { from{width:0} to{width:100%} }
        @keyframes phBadgePop  { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)",
        minHeight: isMobile ? "auto" : 380,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "phFadeUp .6s ease .05s both" }}>
            <span style={{ fontSize: 14, display: "inline-block" }}><i className="fa-solid fa-gem" aria-hidden="true" style={{ color: "var(--sm-navy)" }} /></span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>Simple, Transparent Pricing</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 32 : isTablet ? 46 : 60,
            fontWeight: 900, color: "var(--sm-text)",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "phFadeUp .65s ease .15s both",
          }}>
            Transparent Pricing.{!isMobile && <br />}{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Tailored to Your School.
            </span>
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "var(--sm-text-muted)",
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
                {i > 0 && <div style={{ width: 1, height: 14, background: "var(--sm-border)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: isMobile ? 11 : 12.5, color: "var(--sm-text-muted)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)", flexShrink: 0 }} />
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
