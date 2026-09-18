import { useState, useEffect, useRef, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    initials: "SR",
    name: "Mrs. Saima Rahman",
    role: "Principal",
    text: "Before SchoolMentor, we were juggling spreadsheets, manual registers, and separate systems for fees and exams. It was chaotic. Now everything is centralized — attendance, payroll, results, reports — all in one dashboard.",
  },
  {
    initials: "AK",
    name: "Mr. Adeel Khan",
    role: "English Teacher",
    text: "What I appreciate most is how much time it saves me. Attendance is marked in seconds, assignments are uploaded easily, and parents are automatically notified.",
  },
  {
    initials: "HS",
    name: "Ms. Hira Siddiqui",
    role: "Admin Manager",
    text: "Fee tracking and payroll used to be our biggest headache. With SchoolMentor, we can generate reports instantly and track pending payments without confusion.",
  },
  {
    initials: "IS",
    name: "Mr. Imran Shah",
    role: "Parent",
    text: "As a parent, I no longer have to wait for PTMs to know how my child is doing. I get updates about attendance, homework, and announcements directly on my phone.",
  },
  {
    initials: "NF",
    name: "Dr. Nadia Farooq",
    role: "Vice Principal, Horizon International School",
    text: "The training sessions were practical and relevant to our daily challenges. Our teachers feel more confident using technology now.",
  },
  {
    initials: "RQ",
    name: "Mrs. Rubina Qureshi",
    role: "Academic Coordinator",
    text: "The Mentor AI feature has changed how we write lesson plans. What used to take two hours now takes ten minutes. Our whole academic team is more productive.",
  },
  {
    initials: "RS",
    name: "Romana Shabir",
    role: "Head of Customer Success & Support, School Mentor",
    text: "Every school's journey is different, and our team is with them at every step — from onboarding to daily support. Seeing institutions grow more confident and organized with SchoolMentor is exactly why we do what we do.",
  },
];

const STATS = [
  { val: "700+", label: "Schools Onboarded" },
  { val: "98%", label: "Satisfaction Rate" },
  { val: "50K+", label: "Active Users" },
  { val: "4.9★", label: "Average Rating" },
];

// ── Helpers ───────────────────────────────────────────────────────
function getCardsPerPage(width) {
  if (width <= 640) return 1;
  if (width <= 900) return 2;
  return 6;
}

function useWindowWidth() {
  const [w, setW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    let t;
    const h = () => { clearTimeout(t); t = setTimeout(() => setW(window.innerWidth), 160); };
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("resize", h); clearTimeout(t); };
  }, []);
  return w;
}

// ── Stars ─────────────────────────────────────────────────────────
function Stars() {
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
      {[...Array(5)].map((_, i) => (
        <span key={i} style={{ fontSize: 13, color: "var(--sm-accent)" }}><i className="fa-solid fa-star" /></span>
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────
function Avatar({ initials, hov }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 800, color: "#fff",
      background: "var(--sm-navy)",
      transform: hov ? "scale(1.08)" : "scale(1)",
      transition: "transform .3s ease",
    }}>
      {initials}
    </div>
  );
}

// ── Testimonial Card ──────────────────────────────────────────────
function TestimonialCard({ t, delay = 0 }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 16, padding: "28px 26px 24px",
        position: "relative", overflow: "hidden",
        cursor: "default", display: "flex", flexDirection: "column",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov
          ? "0 16px 36px -14px var(--sm-shadow)"
          : "0 1px 2px rgba(17,24,39,.04)",
        transition: "transform .3s cubic-bezier(.22,.97,.47,1), box-shadow .3s ease, border-color .3s ease",
        animation: `tmCardIn .55s ease ${delay}s both`,
      }}
    >
      {/* Quote */}
      <span style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 44, fontStyle: "italic", lineHeight: 1,
        color: "var(--sm-navy)", opacity: .5,
        marginBottom: 14, display: "block",
      }}>"</span>

      <Stars />

      <p style={{
        fontSize: 14, color: "var(--sm-text-muted)", lineHeight: 1.75,
        fontStyle: "italic", marginBottom: 22, flex: 1,
      }}>
        {t.text}
      </p>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingTop: 16, borderTop: "1px solid var(--sm-border)",
      }}>
        <Avatar initials={t.initials} hov={hov} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--sm-navy)", marginBottom: 2 }}>{t.name}</div>
          <div style={{ fontSize: 12, color: "var(--sm-text-muted)", fontWeight: 500 }}>{t.role}</div>
        </div>
      </div>
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────
function CtrlBtn({ dir, disabled, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      style={{
        width: 44, height: 44, borderRadius: "50%",
        border: `1px solid ${hov && !disabled ? "var(--sm-navy)" : "var(--sm-border)"}`,
        background: hov && !disabled ? "var(--sm-navy)" : "var(--sm-surface)",
        color: hov && !disabled ? "#fff" : "var(--sm-text)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        fontSize: 22, fontFamily: "inherit",
        opacity: disabled ? .3 : 1,
        transform: hov && !disabled ? "scale(1.06)" : "scale(1)",
        boxShadow: "0 1px 2px rgba(17,24,39,.04)",
        transition: "all .25s ease",
        padding: 0,
      }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

// ── Scroll Dots ───────────────────────────────────────────────────
function CtrlDots({ total, active, onDotClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          className="sm-carousel-dot"
          aria-label={`Go to testimonial ${i + 1}`}
          onClick={() => onDotClick(i)}
          style={{
            width: i === active ? 28 : 10,
            height: 10,
            borderRadius: i === active ? 5 : "50%",
            background: i === active ? "var(--sm-navy)" : "var(--sm-border)",
            border: "none",
            boxShadow: "none",
            cursor: "pointer", padding: 0, flexShrink: 0,
            transition: "all .35s cubic-bezier(.22,.97,.47,1)",
          }}
        />
      ))}
    </div>
  );
}

// ── Stat Item ─────────────────────────────────────────────────────
function StatItem({ val, label }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ textAlign: "center", cursor: "default" }}
    >
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: "clamp(28px,3.5vw,36px)",
        lineHeight: 1,
        background: "linear-gradient(135deg,#3B82F6,#2563EB)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        transform: hov ? "scale(1.06)" : "scale(1)",
        transition: "transform .25s ease",
      }}>{val}</div>
      <div style={{
        fontSize: 12, color: "var(--sm-text-muted)", fontWeight: 600,
        marginTop: 4, textTransform: "uppercase", letterSpacing: "1px",
      }}>{label}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function Testimonials() {
  const width = useWindowWidth();
  const cpp = getCardsPerPage(width);          // cards per page
  const totalPages = Math.ceil(TESTIMONIALS.length / cpp);
  const isMobile = width <= 640;

  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const trackRef = useRef(null);
  const sectionRef = useRef(null);
  const touchStartX = useRef(0);

  // Clamp current when layout changes
  useEffect(() => {
    setCurrent(c => Math.min(c, totalPages - 1));
  }, [totalPages]);

  // Slide track
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${current * 100}%)`;
    }
  }, [current]);

  // Intersection observer
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(totalPages - 1, c + 1)), [totalPages]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 44) diff > 0 ? next() : prev();
  };

  // Build pages array
  const pages = Array.from({ length: totalPages }, (_, p) =>
    TESTIMONIALS.slice(p * cpp, p * cpp + cpp)
  );

  // Grid columns based on cpp
  const gridCols = cpp === 6 ? "repeat(3,1fr)" : cpp === 2 ? "1fr 1fr" : "1fr";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=DM+Serif+Display:ital@0;1&display=swap');
        @keyframes tmFadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tmCardIn    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
      `}</style>

      <section
        ref={sectionRef}
        style={{
          background: "var(--sm-surface)",
          padding: "clamp(48px, 7vw, 88px) 0",
          position: "relative", overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* Centered content container */}
        <div style={{
          maxWidth: "clamp(1200px, 93vw, 1850px)",
          margin: "0 auto",
          padding: "0 clamp(16px, 2vw, 24px)",
          position: "relative", zIndex: 2,
        }}>

          {/* ── HEADER ── */}
          <div style={{
            textAlign: "center",
            marginBottom: isMobile ? 36 : 56,
            position: "relative", zIndex: 2,
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--sm-teal-light)",
              border: "1px solid var(--sm-border)",
              borderRadius: 100, padding: "6px 16px 6px 10px",
              marginBottom: 16,
              fontSize: 11, fontWeight: 700, letterSpacing: "2px",
              textTransform: "uppercase", color: "var(--sm-navy)",
              animation: visible ? "tmFadeUp .6s ease .05s both" : "none",
              opacity: visible ? undefined : 0,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)" }} />
              Testimonials
            </div>

            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(28px,4.5vw,50px)",
              color: "var(--sm-text)", lineHeight: 1.1, letterSpacing: "-.5px",
              animation: visible ? "tmFadeUp .65s ease .12s both" : "none",
              opacity: visible ? undefined : 0,
            }}>
              Trusted by{" "}
              <span style={{ color: "var(--sm-navy)" }}>Schools Everywhere</span>
            </h2>
          </div>

          {/* ── SLIDER ── */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ overflow: "hidden", borderRadius: 4 }}>
              <div
                ref={trackRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{
                  display: "flex",
                  transition: "transform .55s cubic-bezier(.22,.97,.47,1)",
                  willChange: "transform",
                }}
              >
                {pages.map((pageCards, pi) => (
                  <div
                    key={`${pi}-${cpp}`}
                    style={{
                      flex: "0 0 100%", minWidth: "100%",
                      display: "grid",
                      gridTemplateColumns: gridCols,
                      gap: isMobile ? 0 : width <= 900 ? 14 : 20,
                      padding: isMobile ? "2px 0" : 4,
                    }}
                  >
                    {pageCards.map((t, ci) => (
                      <TestimonialCard
                        key={t.initials}
                        t={t}
                        delay={visible ? 0.05 + ci * 0.07 : 0}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: isMobile ? 16 : 24,
              marginTop: isMobile ? 24 : 36,
            }}>
              <CtrlBtn dir="prev" disabled={current === 0} onClick={prev} />
              <CtrlDots total={totalPages} active={current} onDotClick={setCurrent} />
              <div style={{
                fontSize: 12, fontWeight: 700, color: "var(--sm-text-muted)",
                letterSpacing: ".5px", minWidth: 36, textAlign: "center",
              }}>
                {current + 1} / {totalPages}
              </div>
              <CtrlBtn dir="next" disabled={current === totalPages - 1} onClick={next} />
            </div>
          </div>

          {/* ── STATS BAR ── */}

        </div>
      </section>
    </>
  );
}
