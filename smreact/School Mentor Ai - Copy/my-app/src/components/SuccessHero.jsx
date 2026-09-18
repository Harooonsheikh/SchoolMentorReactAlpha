// ── SchoolMentor Success Stories Hero ────────────────────────────────────────
import { useEffect, useState } from "react";

const REVIEW_CARDS = [
  {
    text: '"Everything is now centralised — attendance, payroll, results."',
    avatar: <i className="fa-solid fa-user-tie" style={{ color: "var(--sm-navy)" }} />, name: "Principal, Lahore", role: "Using SchoolMentor since 2022",
    delay: "0.6s", floatDuration: "5s",
  },
  {
    text: '"Attendance in seconds, parents notified automatically."',
    avatar: <i className="fa-solid fa-chalkboard-user" style={{ color: "var(--sm-navy)" }} />, name: "Teacher, Karachi", role: "Using SchoolMentor since 2023",
    delay: "0.8s", floatDuration: "6s",
  },
  {
    text: '"Fee tracking & payroll — no more confusion at month end."',
    avatar: <i className="fa-solid fa-user-tie" style={{ color: "var(--sm-navy)" }} />, name: "Admin, Islamabad", role: "Using SchoolMentor since 2021",
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

// ── Review card — absolute on desktop, inline on mobile/tablet ────────────────
function ReviewCard({ card, absPos }) {
  const style = absPos
    ? {
      position: "absolute", ...absPos, zIndex: 2,
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "14px 16px", maxWidth: 200,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `shCardIn .7s ease ${card.delay} both`,
    }
    : {
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 16, padding: "14px 16px",
      flex: "1 1 200px",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: `shCardIn .7s ease ${card.delay} both`,
    };

  return (
    <div style={style}>
      <div style={{ fontSize: 11, marginBottom: 6, letterSpacing: 1, display: "flex", gap: 2, color: "var(--sm-navy)" }}>{Array.from({ length: 5 }).map((_, i) => (<i key={i} className="fa-solid fa-star" aria-hidden="true" />))}</div>
      <div style={{ fontSize: 11, color: "var(--sm-text-soft)", lineHeight: 1.5, fontStyle: "italic" }}>{card.text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--sm-teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
          {card.avatar}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--sm-text)" }}>{card.name}</div>
          <div style={{ fontSize: 9, color: "var(--sm-text-muted)", marginTop: 1 }}>{card.role}</div>
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
      width: 44, height: 44, borderRadius: 12,
      background: "var(--sm-teal-light)",
      border: "1px solid var(--sm-border)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      animation: `shBadgePop .5s ease ${badge.delay} both`,
    }}>
      {badge.icon}
    </div>
  );
}

// ── Stat strip ────────────────────────────────────────────────────────────────
function StatStrip({ inline }) {
  const style = inline
    ? {
      display: "flex", alignItems: "center",
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 100, overflow: "hidden",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "shStripIn .7s ease .5s both",
      alignSelf: "flex-start",
    }
    : {
      position: "absolute", right: 48, bottom: 28, zIndex: 2,
      display: "flex", alignItems: "center",
      background: "var(--sm-surface)",
      border: "1px solid var(--sm-border)",
      borderRadius: 100, overflow: "hidden",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
      animation: "shStripIn .7s ease 1.2s both",
    };

  return (
    <div style={style}>
      {STATS.map((s, i) => (
        <div key={i} style={{
          padding: "8px 16px",
          display: "flex", alignItems: "center", gap: 6,
          borderRight: i < STATS.length - 1 ? "1px solid var(--sm-border)" : "none",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--sm-navy)" }}>{s.val}</div>
          <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 500, letterSpacing: ".5px" }}>{s.label}</div>
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
      { icon: <i className="fa-solid fa-trophy" style={{ color: "var(--sm-navy)" }} />, pos: { right: 500, top: 50 }, delay: "0.9s" },
      { icon: <i className="fa-solid fa-comment-dots" style={{ color: "var(--sm-navy)" }} />, pos: { right: 460, bottom: 55 }, delay: "1.1s" },
    ]
    : isTablet
      ? [
        { icon: <i className="fa-solid fa-trophy" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, top: 48 }, delay: "0.9s" },
        { icon: <i className="fa-solid fa-comment-dots" style={{ color: "var(--sm-navy)" }} />, pos: { right: 14, bottom: 48 }, delay: "1.1s" },
      ]
      : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes shFadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shCardIn    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shBadgePop  { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
        @keyframes shStripIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <section style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)",
        minHeight: isMobile ? "auto" : 380,
        padding: secPad,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "7px 16px 7px 10px", marginBottom: isMobile ? 18 : 28, animation: "shFadeUp .6s ease .05s both", alignSelf: "flex-start" }}>
            <span style={{ fontSize: 14, display: "inline-block", color: "var(--sm-navy)" }}><i className="fa-solid fa-trophy" aria-hidden="true" /></span>
            <span style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>Success Stories</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: isMobile ? 34 : isTablet ? 46 : 60,
            fontWeight: 900, color: "var(--sm-text)",
            lineHeight: 1.12,
            marginBottom: isMobile ? 14 : 20,
            letterSpacing: isMobile ? -0.5 : -1.5,
            animation: "shFadeUp .65s ease .15s both",
          }}>
            Real Schools.{!isMobile && <br />}{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Real Results.
            </span>
            {!isMobile && <br />}{" "}Real Impact.
          </h1>

          {/* Description */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            color: "var(--sm-text-muted)", lineHeight: 1.75, maxWidth: 520,
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
                {i > 0 && <div style={{ width: 1, height: 14, background: "var(--sm-border)", marginRight: isMobile ? 10 : 20 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: isMobile ? 11 : 12.5, color: "var(--sm-text-muted)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)", flexShrink: 0 }} />
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
