import { useState, useRef, useEffect, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic",
    tier: "Basic",
    name: "School Mentor Basic",
    desc: "Complete School OS + Basic Mentor AI",
    popular: false,
    color: "var(--sm-navy)",
    aiLabel: "Mentor AI Basic",
    aiAccent: { bg: "var(--sm-surface)", border: "var(--sm-border)", label: "var(--sm-navy)", val: "var(--sm-navy)" },
    divider: "var(--sm-border)",
    glowBar: "var(--sm-navy)",
    hoverBorder: "var(--sm-navy)",
    hoverShadow: "0 16px 36px -16px var(--sm-shadow)",
    hoverBg: "transparent",
    priceMonthly: null,
    btnVariant: "outline",
    ai: [
      { icon: <i className="fa-solid fa-comment-dots" />, val: "1M", desc: "AI Chat (Tokens)" },
      { icon: <i className="fa-solid fa-file-lines" />, val: "50", desc: "Lesson Scans" },
      { icon: <i className="fa-solid fa-file-pen" />, val: "5", desc: "Worksheets" },
      { icon: <i className="fa-solid fa-mobile-screen-button" />, val: "5", desc: "Social Posts" },
    ],
  },
  {
    id: "pro",
    tier: "Pro",
    name: "School Mentor Pro",
    desc: "Complete School OS + Pro Mentor AI",
    popular: true,
    color: "var(--sm-navy)",
    aiLabel: "Mentor AI Pro",
    aiAccent: { bg: "var(--sm-surface)", border: "var(--sm-border)", label: "var(--sm-navy)", val: "var(--sm-navy)" },
    divider: "var(--sm-border)",
    glowBar: "var(--sm-navy)",
    hoverBorder: "var(--sm-navy)",
    hoverShadow: "0 16px 36px -16px var(--sm-shadow)",
    hoverBg: "transparent",
    priceMonthly: "PKR 4,000 / Month",
    btnVariant: "solid",
    ai: [
      { icon: <i className="fa-solid fa-comment-dots" />, val: "5M", desc: "AI Chat (Tokens)" },
      { icon: <i className="fa-solid fa-file-lines" />, val: "250", desc: "Lesson Scans" },
      { icon: <i className="fa-solid fa-file-pen" />, val: "90", desc: "Worksheets" },
      { icon: <i className="fa-solid fa-mobile-screen-button" />, val: "90", desc: "Social Posts" },
    ],
  },
  {
    id: "premium",
    tier: "Premium",
    name: "School Mentor Premium",
    desc: "Complete School OS + Premium Mentor AI",
    popular: false,
    color: "var(--sm-gold)",
    aiLabel: "Mentor AI Premium",
    aiAccent: { bg: "var(--sm-surface)", border: "var(--sm-border)", label: "var(--sm-gold)", val: "var(--sm-gold)" },
    divider: "var(--sm-gold)",
    glowBar: "var(--sm-gold)",
    hoverBorder: "var(--sm-gold)",
    hoverShadow: "0 16px 36px -16px var(--sm-shadow)",
    hoverBg: "transparent",
    priceMonthly: "PKR 6,000 / Month",
    btnVariant: "outline",
    btnHoverGradient: "var(--sm-gold)",
    ai: [
      { icon: <i className="fa-solid fa-comment-dots" />, val: "10M", desc: "AI Chat (Tokens)" },
      { icon: <i className="fa-solid fa-file-lines" />, val: "1,000", desc: "Lesson Scans" },
      { icon: <i className="fa-solid fa-file-pen" />, val: "150", desc: "Worksheets" },
      { icon: <i className="fa-solid fa-mobile-screen-button" />, val: "150", desc: "Social Posts" },
    ],
  },
];

const CORE_FEATURES = [
  "Full ERP (Academics, Exams, HR, Fees)",
  "3 Mobile Apps (Principal, Teachers, Parents)",
  "School Operational Manuals",
  "Monthly Teachers Training Workshops",
  "Dedicated Head Office Support",
];

// ── Feature row ───────────────────────────────────────────────────────────────
function FeatureItem({ text, color }) {
  const [hov, setHov] = useState(false);
  return (
    <li
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 7,
        fontSize: 11.5, lineHeight: 1.45, cursor: "default",
        color: hov ? "var(--sm-text)" : "var(--sm-text-soft)",
        transition: "transform .25s ease, color .25s ease",
        transform: hov ? "translateX(3px)" : "translateX(0)",
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: "50%", background: color,
        flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff",
        transition: "transform .3s ease",
        transform: hov ? "scale(1.2)" : "scale(1)",
      }}><i className="fa-solid fa-check" aria-hidden="true" /></span>
      {text}
    </li>
  );
}

// ── AI stat cell ──────────────────────────────────────────────────────────────
function AiCell({ item, valColor }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface-alt)", border: `1px solid ${hov ? "var(--sm-border)" : "var(--sm-border)"}`,
        borderRadius: 6, padding: "6px 8px",
        display: "flex", alignItems: "center", gap: 7, cursor: "default",
        transition: "transform .25s ease, border-color .25s ease, box-shadow .25s ease",
        transform: hov ? "translateY(-2px) scale(1.03)" : "translateY(0) scale(1)",
        boxShadow: hov ? "0 4px 10px rgba(0,0,0,.07)" : "none",
      }}
    >
      <span style={{
        fontSize: 15, flexShrink: 0, display: "inline-block",
        transition: "transform .3s ease",
        transform: hov ? "scale(1.2) rotate(-5deg)" : "scale(1) rotate(0deg)",
      }}>
        {item.icon}
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: valColor, lineHeight: 1 }}>{item.val}</div>
        <div style={{ fontSize: 9, color: "var(--sm-text-muted)", lineHeight: 1.2, marginTop: 1 }}>{item.desc}</div>
      </div>
    </div>
  );
}

// ── AI box ────────────────────────────────────────────────────────────────────
function AiBox({ plan, cardHovered }) {
  return (
    <div style={{
      borderRadius: 10, padding: "10px 12px",
      background: plan.aiAccent.bg, border: `1px solid ${plan.aiAccent.border}`,
      transition: "box-shadow .3s ease",
      boxShadow: cardHovered ? "0 4px 16px rgba(0,0,0,.06)" : "none",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: "1.5px",
        textTransform: "uppercase", color: plan.aiAccent.label, marginBottom: 7,
      }}>
        <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {plan.aiLabel} — /month
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {plan.ai.map((item, i) => (
          <AiCell key={i} item={item} valColor={plan.aiAccent.val} />
        ))}
      </div>
    </div>
  );
}

// ── CTA Button ────────────────────────────────────────────────────────────────
function CtaButton({ plan }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);

  const isGold = plan.id === "premium";
  const isSolid = plan.btnVariant === "solid";

  let style = {
    width: "100%", padding: "10px", borderRadius: 9,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", letterSpacing: ".3px",
    transition: "all .25s ease",
    transform: active ? "scale(.97)" : hov ? "translateY(-1px)" : "translateY(0)",
  };

  if (isSolid) {
    style = {
      ...style,
      background: hov ? "var(--sm-navy-dark)" : "var(--sm-navy)",
      color: "#fff", border: "1px solid var(--sm-navy)",
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
    };
  } else if (isGold) {
    style = {
      ...style,
      background: hov ? "var(--sm-gold)" : "var(--sm-surface)",
      border: `1.5px solid ${plan.color}`,
      color: hov ? "#fff" : plan.color,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
    };
  } else {
    style = {
      ...style,
      background: hov ? plan.color : "var(--sm-surface)",
      border: `1.5px solid ${plan.color}`,
      color: hov ? "#fff" : plan.color,
      boxShadow: "0 1px 2px rgba(17,24,39,.04)",
    };
  }

  return (
    <button
      className="pc-cta"
      onClick={() => window.dispatchEvent(new CustomEvent("sm:open-signup"))}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={style}
    >
      Get Started
    </button>
  );
}

// ── Pricing card ──────────────────────────────────────────────────────────────
function PricingCard({ plan, animDelay }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: plan.popular
          ? `2px solid ${plan.color}`
          : `1px solid ${hov ? plan.hoverBorder : "var(--sm-border)"}`,
        borderRadius: 16, overflow: "hidden",
        display: "flex", flexDirection: "column",
        transition: "transform .35s cubic-bezier(.22,.97,.47,1), box-shadow .35s ease, border-color .3s ease",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov
          ? plan.hoverShadow
          : "0 1px 2px rgba(17,24,39,.04)",
        animation: `pcFade .6s ease ${animDelay}s both`,
        position: "relative", cursor: "default",
      }}
    >

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{
          height: 3, background: plan.glowBar,
          transformOrigin: "left",
          transition: "transform .4s cubic-bezier(.22,.97,.47,1)",
          transform: hov || plan.popular ? "scaleX(1)" : "scaleX(0)",
        }} />

        {plan.popular && (
          <div style={{
            textAlign: "center", padding: "6px",
            fontSize: 10, fontWeight: 600, letterSpacing: "1px",
            textTransform: "uppercase",
            background: "var(--sm-navy)", color: "#fff",
          }}>
            <i className="fa-solid fa-star" aria-hidden="true" /> Most Popular
          </div>
        )}

        <div style={{ padding: "18px 18px 0", flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: hov ? "2.5px" : "1.5px",
            textTransform: "uppercase", color: plan.color, marginBottom: 4,
            transition: "letter-spacing .3s ease",
          }}>
            {plan.tier}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--sm-text)", lineHeight: 1.3, marginBottom: 3 }}>
            {plan.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
            {plan.desc}
          </div>

          <div style={{
            height: 1.5, background: plan.divider, borderRadius: 2, marginBottom: 12,
            transformOrigin: "left",
            transition: "transform .45s cubic-bezier(.22,.97,.47,1)",
            transform: hov || plan.popular ? "scaleX(1)" : "scaleX(.4)",
          }} />

          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, padding: 0 }}>
            {CORE_FEATURES.map((f, i) => (
              <FeatureItem key={i} text={f} color={plan.color} />
            ))}
          </ul>

          <AiBox plan={plan} cardHovered={hov} />
        </div>

        <div style={{ padding: "14px 18px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginBottom: 1 }}>Starting from</div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: plan.color, marginBottom: 2,
            display: "inline-block",
            transition: "transform .3s ease",
            transform: hov ? "scale(1.04)" : "scale(1)",
            transformOrigin: "left",
          }}>
            PKR 20{" "}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--sm-text-muted)" }}>/ Student / Month</span>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 500, marginBottom: 10,
            color: plan.priceMonthly ? plan.color : "var(--sm-text-muted)",
          }}>
            {plan.priceMonthly ?? "No monthly add-on"}
          </div>
          <CtaButton plan={plan} />
        </div>
      </div>
    </div>
  );
}

// ── Mobile Slider ─────────────────────────────────────────────────────────────
const MIDDLE_INDEX = Math.floor(PLANS.length / 2); // 1 for 3 plans

function MobileSlider() {
  const [current, setCurrent] = useState(MIDDLE_INDEX); // ← default to middle card
  const wrapRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(null);

  const goTo = useCallback((idx) => {
    setCurrent(Math.max(0, Math.min(PLANS.length - 1, idx)));
  }, []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goTo(dx < 0 ? current + 1 : current - 1);
    }
  };

  return (
    <div>
      <div
        ref={wrapRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ overflow: "hidden", position: "relative", width: "100%" }}
      >
        <div style={{
          display: "flex",
          transform: `translateX(${-current * 100}%)`,
          transition: "transform 0.38s cubic-bezier(.22,.97,.47,1)",
        }}>
          {PLANS.map((plan, i) => (
            <div key={plan.id} style={{ flex: "0 0 100%", boxSizing: "border-box", padding: "0 8px" }}>
              <PricingCard plan={plan} animDelay={0.05 + i * 0.07} />
            </div>
          ))}
        </div>
      </div>

      {/* Dotted pagination */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 7, marginTop: 18, paddingBottom: 4,
      }}>
        {PLANS.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: 7, height: 7, borderRadius: "50%", cursor: "pointer",
              border: `1.5px ${i === current ? "solid" : "dotted"} var(--sm-navy)`,
              background: i === current ? "var(--sm-navy)" : "transparent",
              transform: i === current ? "scale(1.25)" : "scale(1)",
              transition: "background .25s, transform .25s, border-style .25s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Responsive wrapper ────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PricingCards() {
  const isMobile = useIsMobile(700);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes pcFade {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--sm-surface)", padding: "56px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "var(--sm-navy)", marginBottom: 6 }}>
            Simple, transparent pricing
          </p>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.6rem)", fontWeight: 700, color: "var(--sm-text)", margin: "0 0 6px" }}>
            Choose Your{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              SchoolMentor Plan
            </span>
          </h2>
          <p style={{ fontSize: "clamp(16px, 1vw, 18px)", color: "var(--sm-text-muted)" }}>
            All plans include full ERP + 3 mobile apps. Scale your AI as you grow.
          </p>
        </div>

        {isMobile ? (
          <MobileSlider />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 26, margin: "0 auto", padding: "clamp(30px,30px,30px)"
          }}>
            {PLANS.map((plan, i) => (
              <PricingCard key={plan.id} plan={plan} animDelay={0.05 + i * 0.07} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
