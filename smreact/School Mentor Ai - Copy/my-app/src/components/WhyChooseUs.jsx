import { useState, useEffect, useRef, useCallback } from "react";
import dashboardImg from '../assets/dashboard.png';
import mobileapp from '../assets/mobile-app.jpg';

// ── Data ──────────────────────────────────────────────────────────────────────
const REASONS = [
  { bold: "Save operational costs", rest: "by reducing manual work and inefficiencies." },
  { bold: "Increase student retention", rest: "with better communication and academic performance." },
  { bold: "Make faster decisions", rest: "with real-time data and reports." },
  { bold: "Scale your school", rest: "like a systemized organization, not a traditional setup." },
  { bold: "Compete with top schools", rest: "without becoming a franchise." },
  { bold: "Invest once.", rest: "Improve every department." },
];

const FEATURES = [
  { icon: <i className="fa-solid fa-chart-column" />, title: "Real-time Insights", sub: "Track every aspect of your school instantly" },
  { icon: <i className="fa-solid fa-users" />, title: "Smart Management", sub: "Manage academics, staff, students and more" },
  { icon: <i className="fa-solid fa-bullseye" />, title: "Better Decisions", sub: "Make data-driven decisions with ease" },
  { icon: <i className="fa-solid fa-mobile-screen-button" />, title: "Anywhere Access", sub: "Access your school anytime, anywhere" },
];

// ── Breakpoint hook ───────────────────────────────────────────────────────────
function useBreakpoint() {
  const getBreakpoint = () => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w <= 480) return "xs";
    if (w <= 640) return "mobile";
    if (w <= 1024) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const h = () => setBp(getBreakpoint());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return bp;
}

// ── CheckIcon ─────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <i className="fa-solid fa-check" style={{ color: "#fff", fontSize: 13 }} />
  );
}

// ── ReasonItem ────────────────────────────────────────────────────────────────
function ReasonItem({ bold, rest, style = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 14, padding: "14px 16px",
        cursor: "default",
        transform: hov ? "translateX(4px)" : "translateX(0)",
        boxShadow: hov ? "0 12px 28px -14px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
        position: "relative",
        ...style,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 1,
        background: "var(--sm-navy)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: hov ? "scale(1.08)" : "scale(1)",
        transition: "transform .3s ease",
      }}>
        <CheckIcon />
      </div>
      <div style={{
        fontSize: 13.5, color: "var(--sm-text-muted)", lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--sm-text)", fontWeight: 800 }}>{bold}</strong>{" "}{rest}
      </div>
    </div>
  );
}

// ── ScrollDots ────────────────────────────────────────────────────────────────
function ScrollDots({ total, active, onDotClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          className="sm-carousel-dot"
          aria-label={`Go to benefit ${i + 1}`}
          onClick={() => onDotClick(i)}
          style={{
            width: i === active ? 26 : 10, height: 10,
            borderRadius: i === active ? 5 : "50%",
            background: i === active ? "var(--sm-navy)" : "var(--sm-border)",
            border: i === active ? "none" : "1px solid var(--sm-gray300)",
            boxShadow: "none",
            cursor: "pointer", padding: 0, flexShrink: 0,
            transition: "all .35s cubic-bezier(.22,.97,.47,1)",
          }}
        />
      ))}
    </div>
  );
}

// ── ArrowBtn ──────────────────────────────────────────────────────────────────
function ArrowBtn({ dir, disabled, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="sm-carousel-arrow"
      aria-label={dir === "prev" ? "Previous benefit" : "Next benefit"}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        background: hov && !disabled ? "var(--sm-hover)" : "var(--sm-surface)",
        border: `1px solid ${hov && !disabled ? "var(--sm-navy)" : "var(--sm-border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        fontSize: 20, color: "var(--sm-text)", lineHeight: 1,
        opacity: disabled ? .3 : 1,
        transform: hov && !disabled ? "scale(1.08)" : "scale(1)",
        transition: "all .25s ease",
        fontFamily: "inherit", padding: 0,
      }}
    >
      <i className={dir === "prev" ? "fa-solid fa-chevron-left" : "fa-solid fa-chevron-right"} style={{ fontSize: 14 }} />
    </button>
  );
}

// ── FeatureCard ───────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, sub, delay, compact }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: compact ? 12 : 16,
        padding: compact ? "12px 12px" : "18px 18px",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: compact ? 9 : 12,
        cursor: "default",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? "0 16px 36px -14px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transition: "all .3s ease",
        animation: `wcuFadeUp .6s ease ${delay}s both`,
      }}
    >
      <div style={{
        width: compact ? 32 : 44, height: compact ? 32 : 44,
        borderRadius: compact ? 9 : 11, flexShrink: 0,
        background: "var(--sm-teal-light)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: compact ? 14 : 20,
        color: "var(--sm-navy)",
        transition: "transform .3s ease",
        transform: hov ? "scale(1.06)" : "scale(1)",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: compact ? 11 : 14, fontWeight: 700, color: "var(--sm-text)", marginBottom: compact ? 2 : 4 }}>{title}</div>
        <div style={{ fontSize: compact ? 10 : 12.5, color: "var(--sm-text-muted)", lineHeight: 1.5 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhyChooseUs() {
  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "mobile";
  const isTablet = bp === "tablet";

  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);
  const slidesRef = useRef(null);
  const touchStart = useRef(0);

  const total = REASONS.length;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (isMobile && slidesRef.current) {
      slidesRef.current.style.transform = `translateX(-${current * 100}%)`;
    }
  }, [current, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setCurrent(0);
      if (slidesRef.current) slidesRef.current.style.transform = "none";
    }
  }, [isMobile]);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(total - 1, c + 1)), [total]);

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
  };

  // ── Responsive values ──────────────────────────────────────────────────────
  const sectionPadding = bp === "xs"
    ? "36px 14px 48px"
    : bp === "mobile"
      ? "44px 18px 56px"
      : bp === "tablet"
        ? "56px 32px 64px"
        : "52px 24px 60px";

  const headerMarginBottom = bp === "xs" ? 24 : isMobile ? 32 : isTablet ? 44 : 56;

  const contentGrid = isMobile
    ? "1fr"
    : isTablet
      ? "1fr 1fr"
      : "1fr 1.15fr";

  const contentGap = isMobile ? 28 : isTablet ? 48 : 52;

  // ── Device frame sizing ────────────────────────────────────────────────────
  // On mobile: laptop frame is full width with no phone overlay
  // On tablet: laptop frame is full width of column, phone overlay is smaller and kept inside
  // On desktop: original sizing with generous phone overlay
  const showPhone = !isMobile; // show phone on tablet + desktop only

  // Phone overlay: positioned absolutely INSIDE the laptop wrapper so it never bleeds
  // Tablet: smaller phone, anchored inside the frame
  const phoneWidth = bp === "tablet" ? 90 : 130;
  const phoneBottom = bp === "tablet" ? -10 : -20;
  // Negative right so it peeks out but is clipped by overflow:hidden on the wrapper
  const phoneRight = bp === "tablet" ? -8 : -14;

  // Laptop frame padding — tighter on tablet
  const laptopPaddingH = bp === "xs" ? 7 : isMobile ? 8 : isTablet ? 9 : 10;
  const laptopBorderRadius = bp === "xs" ? 10 : isMobile ? 12 : isTablet ? 16 : 18;
  const screenBorderRadius = `${bp === "xs" ? 5 : isMobile ? 6 : isTablet ? 8 : 10}px ${bp === "xs" ? 5 : isMobile ? 6 : isTablet ? 8 : 10}px 0 0`;
  const baseHeight = bp === "xs" ? 7 : isMobile ? 9 : isTablet ? 12 : 14;

  const featureColumns = bp === "xs" ? "1fr" : isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr" : "repeat(4,1fr)";
  const featureGap = isMobile ? 8 : isTablet ? 10 : 8;
  const featureMarginTop = isMobile ? 14 : isTablet ? 20 : 28;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes wcuFadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes wcuSlideL   { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes wcuSlideR   { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)} }
        * { box-sizing: border-box; }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          background: "var(--sm-bg)",
          padding: sectionPadding,
          position: "relative", overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ textAlign: "center", marginBottom: headerMarginBottom, position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)",
            borderRadius: 100, padding: isMobile ? "5px 12px 5px 8px" : "6px 16px 6px 10px", marginBottom: 16,
            fontSize: isMobile ? 9.5 : 11, fontWeight: 700, letterSpacing: isMobile ? "1.5px" : "2px", textTransform: "uppercase",
            color: "var(--sm-navy)",
            animation: visible ? "wcuFadeUp .6s ease .05s both" : "none",
            opacity: visible ? undefined : 0,
            maxWidth: "90vw", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)" }} />
            Why Choose Us
          </div>
          <h2 style={{
            fontSize: bp === "xs" ? "clamp(22px,7vw,28px)" : bp === "mobile" ? "clamp(24px,6.5vw,32px)" : "clamp(28px,5vw,52px)", fontWeight: 900, color: "var(--sm-text)",
            lineHeight: isMobile ? 1.2 : 1.1, letterSpacing: isMobile ? -0.5 : -1,
            margin: 0,
            animation: visible ? "wcuFadeUp .65s ease .12s both" : "none",
            opacity: visible ? undefined : 0,
          }}>
            Smarter. Faster.{" "}
            <em style={{ fontStyle: "normal", color: "var(--sm-navy)" }}>Future&#8209;Ready.</em>
          </h2>
        </div>

        {/* ── CONTENT GRID ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: contentGrid,
          gap: contentGap,
          alignItems: "center",
          position: "relative", zIndex: 2,
          maxWidth: "clamp(1200px, 93vw, 1850px)", margin: "0 auto",
          minWidth: 0,
        }}>

          {/* ── LEFT: reasons ── */}
          <div style={{ order: isMobile ? 2 : 1, minWidth: 0 }}>
            {isMobile ? (
              <div>
                <div style={{ overflow: "hidden" }}>
                  <div
                    ref={slidesRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      display: "flex",
                      transition: "transform .45s cubic-bezier(.22,.97,.47,1)",
                      willChange: "transform",
                      touchAction: "pan-y",
                    }}
                  >
                    {REASONS.map((r, i) => (
                      <div key={i} style={{ flex: "0 0 100%", minWidth: "100%", padding: "2px 0" }}>
                        <ReasonItem bold={r.bold} rest={r.rest} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <ArrowBtn dir="prev" disabled={current === 0} onClick={prev} />
                    <ArrowBtn dir="next" disabled={current === total - 1} onClick={next} />
                  </div>
                  <ScrollDots total={total} active={current} onDotClick={setCurrent} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sm-text-muted)", letterSpacing: ".5px" }}>
                    {current + 1} / {total}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: isTablet ? 8 : 10 }}>
                {REASONS.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      animation: visible ? `wcuSlideL .6s ease ${.1 + i * .07}s both` : "none",
                      opacity: visible ? undefined : 0,
                    }}
                  >
                    <ReasonItem bold={r.bold} rest={r.rest} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: screens ── */}
          <div style={{
            order: isMobile ? 1 : 2,
            animation: visible ? "wcuSlideR .7s ease .2s both" : "none",
            opacity: visible ? undefined : 0,
            overflow: isTablet ? "hidden" : "visible",
            minWidth: 0,
          }}>
            {/* Screens wrapper */}
            <div style={{
              position: "relative",
              // On mobile: no padding (device fills full column width)
              // On tablet: tighter padding to keep phone inside bounds
              // On desktop: generous padding for phone overlay
              paddingRight: isMobile ? 0 : isTablet ? 20 : 50,
              paddingBottom: isMobile ? 0 : isTablet ? 16 : 28,
            }}>
              {/* Laptop / monitor frame */}
              <div style={{
                background: "linear-gradient(145deg,#2d2d3e,#1a1a2a)",
                borderRadius: laptopBorderRadius,
                padding: `${laptopPaddingH}px ${laptopPaddingH}px 0`,
                boxShadow: "0 24px 60px -20px rgba(17,24,39,.30), 0 0 0 1px rgba(255,255,255,.08)",
                position: "relative", zIndex: 2,
                // Scale down monitor frame on xs to make sure it sits snugly
                maxWidth: bp === "xs" ? "100%" : "100%",
              }}>
                <img
                  src={dashboardImg}
                  alt="SchoolMentor Dashboard"
                  style={{
                    width: "100%", display: "block",
                    borderRadius: screenBorderRadius,
                    border: "1px solid rgba(255,255,255,.06)",
                  }}
                />
                {/* Reflection */}
                <div style={{
                  position: "absolute",
                  top: laptopPaddingH,
                  left: laptopPaddingH,
                  right: laptopPaddingH,
                  height: "40%",
                  borderRadius: screenBorderRadius,
                  background: "linear-gradient(180deg,rgba(255,255,255,.04),transparent)",
                  pointerEvents: "none", zIndex: 3,
                }} />
                <div style={{
                  background: "linear-gradient(180deg,#2a2a3a,#1a1a2a)",
                  height: baseHeight,
                  borderRadius: `0 0 ${laptopBorderRadius - 4}px ${laptopBorderRadius - 4}px`,
                }} />
              </div>

              {/* Stand */}
              <div style={{
                width: "38%",
                height: baseHeight - 1,
                background: "linear-gradient(180deg,#222230,#1a1a2a)",
                margin: "0 auto",
                borderRadius: "0 0 8px 8px",
                boxShadow: "0 4px 16px rgba(0,0,0,.4)",
              }} />

              {/* Phone overlay — tablet + desktop only, clipped inside wrapper */}
              {showPhone && (
                <div style={{
                  position: "absolute",
                  bottom: phoneBottom,
                  right: phoneRight,
                  width: phoneWidth,
                  zIndex: 10,
                  filter: "drop-shadow(0 16px 40px rgba(17,24,39,.35))",
                }}>
                  <div style={{
                    background: "linear-gradient(145deg,#1a1a2a,#0d0d1a)",
                    borderRadius: bp === "tablet" ? 20 : 28,
                    padding: bp === "tablet" ? 5 : 7,
                    boxShadow: "0 16px 50px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)",
                  }}>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        position: "absolute", top: 0, left: "50%",
                        transform: "translateX(-50%)",
                        width: bp === "tablet" ? 28 : 40,
                        height: bp === "tablet" ? 4 : 6,
                        background: "#0d0d1a", borderRadius: 3, zIndex: 11,
                      }} />
                      <img
                        src={mobileapp}
                        alt="SchoolMentor Mobile App"
                        style={{
                          width: "100%",
                          borderRadius: bp === "tablet" ? 16 : 22,
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature cards strip */}
            <div style={{
              display: "grid",
              gridTemplateColumns: featureColumns,
              gap: featureGap,
              marginTop: featureMarginTop,
            }}>
              {FEATURES.map((f, i) => (
                <FeatureCard
                  key={i}
                  {...f}
                  delay={.42 + i * .08}
                  compact={isTablet || isMobile}
                />
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
