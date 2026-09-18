import { useEffect, useRef, useState } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────
const STATS = [
  { icon: <i className="fa-solid fa-school" />, target: 830, suffix: "+", label: "Schools Onboarded", sublabel: "Across Pakistan", delay: 0 },
  { icon: <i className="fa-solid fa-calendar-days" />, target: 7, suffix: "+", label: "Years Operating", sublabel: "Est. 2018", delay: 140 },
  { icon: <i className="fa-solid fa-star" />, target: 98, suffix: "%", label: "Client Satisfaction", sublabel: "Verified reviews", delay: 280 },
  { icon: <i className="fa-solid fa-location-dot" />, target: 45, suffix: "+", label: "Cities Covered", sublabel: "Nationwide reach", delay: 420 },
];

// Tokens — fall back to the original blue/white look on pages that don't define
// the --sm-stats-* vars (e.g. About). Home (.home-modern) overrides them to a
// clean light scheme with dark text.
const C = {
  fg: "var(--sm-stats-fg, #fff)",
  fgSoft: "var(--sm-stats-fg-soft, rgba(255,255,255,.75))",
  fgMute: "var(--sm-stats-fg-mute, rgba(255,255,255,.45))",
  chip: "var(--sm-stats-chip, rgba(255,255,255,.18))",
  accent: "var(--sm-stats-accent, #fff)",
  line: "var(--sm-stats-line, rgba(255,255,255,.3))",
};

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target, triggered, delay) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!triggered) return;
    const duration = target <= 10 ? 1100 : 1900;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setValue(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
        else setValue(target);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [triggered, target, delay]);
  return value;
}

// ── Stat item ─────────────────────────────────────────────────────────────────
function StatItem({ stat, index, triggered, isLast }) {
  const count = useCountUp(stat.target, triggered, stat.delay);
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "16px 12px",
        textAlign: "center",
        position: "relative",
        cursor: "default",
        opacity: triggered ? 1 : 0,
        transform: triggered ? "translateY(0)" : "translateY(22px)",
        transition: `opacity .6s ease ${stat.delay}ms, transform .6s cubic-bezier(.22,.97,.47,1) ${stat.delay}ms`,
      }}
    >
      {/* Separator */}
      {!isLast && (
        <div style={{
          position: "absolute", right: 0, top: "16%", bottom: "16%", width: 1,
          background: C.line,
        }} />
      )}

      {/* Icon box — single, flat, blue-on-tint style */}
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: C.chip,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
        fontSize: 22,
        color: C.accent,
        transition: "transform .3s ease",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
      }}>
        {stat.icon}
      </div>

      {/* Number */}
      <div style={{
        fontSize: 48, fontWeight: 800, lineHeight: 1,
        letterSpacing: -1.5, marginBottom: 2,
        color: C.fg,
        display: "inline-block",
      }}>
        {count}
        <span style={{ fontSize: 28, fontWeight: 700, color: C.accent }}>
          {stat.suffix}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: 52, height: 3, borderRadius: 2,
        background: C.line,
        margin: "10px auto 12px",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: C.accent,
          width: triggered ? "100%" : "0%",
          transition: `width 1.8s cubic-bezier(.22,.97,.47,1) ${stat.delay}ms`,
        }} />
      </div>

      {/* Label */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "1.5px",
        textTransform: "uppercase", color: C.fgSoft,
      }}>
        {stat.label}
      </div>

      {/* Sub-label */}
      <div style={{
        fontSize: 10.5, color: C.fgMute,
        marginTop: 4, letterSpacing: ".4px",
      }}>
        {stat.sublabel}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function StatsStrip() {
  const [triggered, setTriggered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
      `}</style>

      <div
        ref={ref}
        className="sm-statsstrip"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          background: "var(--sm-stats-bg, linear-gradient(135deg,#1D4ED8 0%,#2563EB 55%,#3B82F6 100%))",
          padding: "clamp(36px, 5vw, 56px) clamp(16px, 2vw, 24px)",
          position: "relative",
        }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 0,
          maxWidth: "clamp(1200px, 93vw, 1850px)",
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
        }}>
          {STATS.map((stat, i) => (
            <StatItem
              key={i}
              stat={stat}
              index={i}
              triggered={triggered}
              isLast={i === STATS.length - 1}
            />
          ))}
        </div>
      </div>
    </>
  );
}
