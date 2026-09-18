/**
 * SchoolMentorHero.jsx
 *
 * Clean, enterprise-grade white hero for SchoolMentor (PowerSchool/Notion style).
 * Content is unchanged — only the visual system was modernized:
 *  · white / light background (no grid, orbs, particles, glows, glassmorphism)
 *  · dark headline, single blue accent, generous whitespace
 *  · unified white cards (1px border, 16px radius, very soft shadow)
 *  · ambient motion removed; functional motion kept (typewriter, count-up,
 *    mobile slider, gentle hover-lift)
 *
 * No external dependencies beyond React itself.
 */

import { useState, useEffect, useRef } from "react";
import { openDemoForm } from "./DemoRequestModal.jsx";
import HowItWorksModal from "./HowItWorksModal";

// ─────────────────────────────────────────────────────────────────────────────
// DATA  (unchanged content)
// ─────────────────────────────────────────────────────────────────────────────

const CARDS = [
  {
    id: 0,
    num: "01",
    label: "ERP",
    icon: (c) => (
      <i className="fa-solid fa-desktop" style={{ color: c, fontSize: 16 }} />
    ),
    title: "SchoolMentor ERP",
    desc: "Custom-built school management for real on-ground needs",
    tags: ["Academics", "Administration", "Communication"],
    detail:
      "SchoolMentor ERP covers Academics, Administration, and Communication from statistical data to in-depth management. It integrates with three dedicated mobile apps and includes a complete implementation plan to automate all school processes, including examinations, timetable, fee collection, HR, accounts, student records, and schooling SOPs.",
  },
  {
    id: 1,
    num: "02",
    label: "APP",
    icon: (c) => (
      <i className="fa-solid fa-mobile-screen-button" style={{ color: c, fontSize: 16 }} />
    ),
    title: "Mobile App",
    desc: "Dedicated apps for Principals, Teachers & Parents",
    tags: ["Principal App", "Teachers App", "Parents App"],
    detail:
      "The SchoolMentor Mobile App offers three dedicated portals: Principal App for administration and oversight, Teachers App for academics and lesson management, and Parents App for communication and student tracking. Features Mentor AI, push notifications, gamified learning, and eTube. Available on Web, Android & iOS.",
  },
  {
    id: 2,
    num: "03",
    label: "SOPs",
    icon: (c) => (
      <i className="fa-solid fa-file-lines" style={{ color: c, fontSize: 16 }} />
    ),
    title: "Operational Manuals",
    desc: "Standardized SOPs for consistent school excellence",
    tags: ["Academics", "Administration", "Human Resource", "Accounts", "Health & Safety"],
    detail:
      "SchoolMentor provides comprehensive SOPs covering Academics, Administration, Human Resource, Accounts, and Health & Safety. These franchise-level manuals ensure consistent quality protocols across all school operations, including curriculum planning, HR policies, financial management, parent communication, and safety standards.",
  },
  {
    id: 3,
    num: "04",
    label: "TRAINING",
    icon: (c) => (
      <i className="fa-solid fa-graduation-cap" style={{ color: c, fontSize: 16 }} />
    ),
    title: "Teacher Trainings",
    desc: "Monthly online workshops for professional development",
    tags: ["Academics", "Administration", "Marketing", "Character Building", "Parenting", "Psychological Wellbeing"],
    detail:
      "SchoolMentor hosts monthly online workshops covering Academics, Administration, Marketing, Character Building, Parenting, and Psychological Wellbeing — led by expert trainers via Google Meet. Participants receive e-certificates and build skills that transform school culture and student outcomes.",
  },
  {
    id: 4,
    num: "05",
    label: "AI",
    icon: (c) => (
      <i className="fa-solid fa-wand-magic-sparkles" style={{ color: c, fontSize: 16 }} />
    ),
    title: "Mentor AI",
    desc: "Smart AI assistant for teachers and students",
    tags: ["AI Chat", "AI Lesson Plans", "AI Worksheets", "Design Studio"],
    detail:
      "Mentor AI offers AI Chat for instant query resolution, AI Lesson Plans generated in seconds, AI Worksheets tailored to any topic or grade, and a Design Studio for creating high-quality classroom materials. It empowers teachers and students to work smarter and more creatively every day.",
  },
  {
    id: 5,
    num: "06",
    label: "SUPPORT",
    icon: (c) => (
      <i className="fa-solid fa-headset" style={{ color: c, fontSize: 16 }} />
    ),
    title: "Head Office Support",
    desc: "Dedicated on-demand support for every school",
    tags: ["WhatsApp", "Direct Calls", "R&D"],
    detail:
      "SchoolMentor offers dedicated on-demand support via WhatsApp, Direct Calls, and from our head office staffed with academic, IT, and marketing experts. We address queries, conduct on-demand product trainings, R&D, and work on continuous improvements to support all school management needs.",
  },
];

const PHRASES = [
  "Every School Process Simplified.",
  "Every Stakeholder Connected.",
  "Every Challenge Solved.",
];

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CSS  (lean — ambient motion removed)
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

@keyframes sm-fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes sm-blink   { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes sm-cardIn  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

.sm-hero *{box-sizing:border-box;margin:0;padding:0}
.sm-hero{font-family:'DM Sans',sans-serif;background:linear-gradient(180deg,var(--sm-bg) 0%,var(--sm-surface) 60%)}

/* Buttons */
.sm-btn1{transition:transform .18s ease, box-shadow .2s ease, background .2s ease}
.sm-btn1:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(37,99,235,.28);background:var(--sm-navy-dark)!important}
.sm-btn1:active{transform:translateY(0)}
.sm-btn2{transition:background .2s ease, border-color .2s ease, transform .18s ease}
.sm-btn2:hover{background:var(--sm-hover)!important;border-color:var(--sm-gray300)!important;transform:translateY(-2px)}
.sm-btn2:active{transform:translateY(0)}

/* Feature card — single unified card system */
.sm-card{
  transition:transform .26s cubic-bezier(.22,.61,.36,1), box-shadow .26s ease, border-color .26s ease;
  will-change:transform;
}
.sm-card:hover{
  transform:translateY(-4px);
  box-shadow:0 16px 36px -14px var(--sm-shadow);
  border-color:var(--sm-navy)!important;
}

.sm-chip{transition:background .2s ease}

.sm-cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:900px){.sm-cards-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:540px){.sm-cards-grid{grid-template-columns:1fr}}

.sm-stats{display:flex;align-items:stretch;gap:0;flex-wrap:nowrap}
@media(max-width:600px){
  .sm-stats{flex-wrap:wrap}
  .sm-stat{
    flex:1 1 calc(50% - 1px);
    border-right:none!important;
    border-bottom:1px solid var(--sm-border);
  }
  .sm-stat:nth-child(odd){border-right:1px solid var(--sm-border)!important}
  .sm-stat:nth-last-child(-n+2){border-bottom:none!important}
}

.sm-btns{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
@media(max-width:480px){
  .sm-btns{flex-direction:column;align-items:stretch}
  .sm-btn1,.sm-btn2{width:100%;text-align:center;justify-content:center}
}

.sm-h1{font-family:'Sora',sans-serif;font-size:clamp(30px,5vw,52px);font-weight:800;color:var(--sm-text);line-height:1.12;letter-spacing:-.5px}
.sm-typed-wrap{display:flex;align-items:center;gap:0;margin-bottom:24px;min-height:1.2em;flex-wrap:wrap}
.sm-typed{font-family:'Sora',sans-serif;font-size:clamp(30px,5vw,52px);font-weight:800;color:var(--sm-navy);line-height:1.12;letter-spacing:-.5px}
.sm-cursor{font-family:'Sora',sans-serif;font-size:clamp(30px,5vw,52px);font-weight:300;color:var(--sm-navy);line-height:1;margin-left:2px;animation:sm-blink 1s step-end infinite}

.sm-inner{position:relative;z-index:2;padding:clamp(40px,5vw,72px) clamp(16px,2vw,24px);max-width:clamp(1200px, 93vw, 1850px);margin:0 auto}
@media(max-width:700px){.sm-inner{padding:44px 22px 52px}}

/* Mobile slider */
.sm-slider-wrap{position:relative}
.sm-slider{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:14px;padding:6px 2px 16px;scrollbar-width:none;-ms-overflow-style:none}
.sm-slider::-webkit-scrollbar{display:none}
.sm-slider-item{flex:0 0 80vw;max-width:300px;scroll-snap-align:center}
.sm-dots{display:flex;justify-content:center;gap:6px;margin-top:4px}
.sm-dot{width:6px;height:6px;border-radius:50%;background:var(--sm-gray300);transition:all .25s ease;cursor:pointer;border:none;padding:0}
.sm-dot.active{background:var(--sm-navy);width:18px;border-radius:3px}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function useInjectStyles(id, css) {
  useEffect(() => {
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = css;
      document.head.appendChild(el);
    }
  }, []);
}

function useTypewriter(phrases) {
  const [text, setText] = useState("");
  useEffect(() => {
    let pi = 0, ci = 0, deleting = false, timer;
    const tick = () => {
      const phrase = phrases[pi];
      if (!deleting && ci <= phrase.length) {
        setText(phrase.slice(0, ci++));
        timer = setTimeout(tick, ci === phrase.length + 1 ? 2000 : 60);
      } else if (!deleting && ci > phrase.length) {
        deleting = true;
        timer = setTimeout(tick, 60);
      } else if (deleting && ci > 0) {
        setText(phrase.slice(0, --ci));
        timer = setTimeout(tick, 38);
      } else {
        deleting = false;
        pi = (pi + 1) % phrases.length;
        timer = setTimeout(tick, 180);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, []);
  return text;
}

function useCounter(target, delay = 900, step = 14, interval = 18) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let c = 0;
    const go = () => {
      if (c < target) { c += step; setCount(Math.min(c, target)); setTimeout(go, interval); }
      else { setCount(target); }
    };
    const t = setTimeout(go, delay);
    return () => clearTimeout(t);
  }, []);
  return count;
}

function useIsMobile(breakpoint = 540) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ card, index, isActive, onClick }) {
  const animDelay = `${0.32 + index * 0.07}s`;
  return (
    <div
      className="sm-card"
      onClick={() => onClick(card.id)}
      style={{
        background: "var(--sm-surface)",
        border: isActive ? "1px solid var(--sm-navy)" : "1px solid var(--sm-border)",
        boxShadow: isActive
          ? "0 0 0 1px var(--sm-navy), 0 16px 36px -16px var(--sm-shadow)"
          : "0 1px 2px rgba(17,24,39,.04)",
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        animation: `sm-cardIn .5s ${animDelay} ease both`,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--sm-text-muted)", letterSpacing: "0.1em" }}>
          {card.num} / {card.label}
        </span>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: "var(--sm-teal-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {card.icon("var(--sm-navy)")}
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--sm-text)", marginBottom: 6 }}>{card.title}</div>
      <div style={{ fontSize: 12.5, color: "var(--sm-text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{card.desc}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="sm-chip"
            style={{
              fontSize: 10.5, padding: "4px 10px", borderRadius: 7,
              background: "var(--sm-teal-light)",
              color: "var(--sm-navy)",
              fontWeight: 600,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE SLIDER
// ─────────────────────────────────────────────────────────────────────────────

function MobileSlider({ cards, activeCard, onCardClick }) {
  const sliderRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = (i) => {
    const slider = sliderRef.current;
    if (!slider) return;
    const itemWidth = slider.clientWidth * 0.8 + 14;
    slider.scrollTo({ left: i * itemWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    const handleScroll = () => {
      const itemWidth = slider.clientWidth * 0.8 + 14;
      const index = Math.round(slider.scrollLeft / itemWidth);
      setActiveIndex(index);
    };
    slider.addEventListener("scroll", handleScroll, { passive: true });
    return () => slider.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="sm-slider-wrap">
      <div className="sm-slider" ref={sliderRef}>
        {cards.map((card, i) => (
          <div key={card.id} className="sm-slider-item">
            <FeatureCard
              card={card}
              index={i}
              isActive={activeCard === card.id}
              onClick={onCardClick}
            />
          </div>
        ))}
      </div>
      <div className="sm-dots">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`sm-dot${i === activeIndex ? " active" : ""}`}
            onClick={() => scrollToIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function SchoolMentorHero() {
  useInjectStyles("sm-hero-global", GLOBAL_CSS);

  const [activeCard, setActiveCard] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const typedText = useTypewriter(PHRASES);
  const schoolCount = useCounter(830);
  const isMobile = useIsMobile(540);

  const handleCardClick = (id) => setActiveCard((prev) => (prev === id ? null : id));
  const activeData = activeCard !== null ? CARDS[activeCard] : null;

  const fadeUp = (delay) => ({
    animation: `sm-fadeUp .55s ${delay} ease both`,
    opacity: 0,
    animationFillMode: "both",
  });

  return (
    <div className="sm-hero" style={{ position: "relative" }}>
      <div className="sm-inner">

        {/* ── Badge ── */}
        <div style={fadeUp("0s")}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "7px 16px", borderRadius: 30,
              background: "var(--sm-teal-light)",
              border: "1px solid var(--sm-border)",
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--sm-navy)" }}><i className="fa-solid fa-star" /></span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sm-navy)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              As Seen on Shark Tank Pakistan
            </span>
            <span style={{ fontSize: 11, color: "var(--sm-gray300)", margin: "0 1px" }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sm-text-muted)", letterSpacing: "0.03em" }}>
              Pakistan's #1 School OS
            </span>
          </span>
        </div>

        {/* ── Headline ── */}
        <div style={fadeUp("0.08s")}>
          <h1 className="sm-h1">School Mentor One Platform,</h1>
          <div className="sm-typed-wrap">
            <span className="sm-typed">{typedText}</span>
            <span className="sm-cursor">|</span>
          </div>
        </div>

        {/* ── Subtext ── */}
        <div style={fadeUp("0.18s")}>
          <p style={{
            fontSize: 16, color: "var(--sm-text-muted)", lineHeight: 1.75,
            maxWidth: 600, marginBottom: 34, fontWeight: 400,
          }}>
            From attendance and fee management to AI-powered lesson planning SchoolMentor®
            connects administrators, teachers, students, and parents in one secure cloud platform.
          </p>
        </div>

        {/* ── CTA Buttons ── */}
        <div className="sm-btns" style={{ marginBottom: 44, ...fadeUp("0.26s") }}>
          <button
            className="sm-btn1"
            onClick={() => { openDemoForm("Home hero"); }}
            style={{
              background: "var(--sm-navy)", color: "#fff", border: "1px solid var(--sm-navy)",
              padding: "14px 30px", borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Book Your Free Demo
          </button>
          <button
            className="sm-btn2"
            onClick={() => setShowHowItWorks(true)}
            style={{
              background: "var(--sm-surface)",
              color: "var(--sm-text)", border: "1px solid var(--sm-border)",
              padding: "14px 30px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            See How It Works <span style={{ color: "var(--sm-navy)" }}>›</span>
          </button>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ marginBottom: 48, ...fadeUp("0.32s") }}>
          <div
            className="sm-stats"
            style={{
              background: "var(--sm-surface)",
              border: "1px solid var(--sm-border)",
              borderRadius: 16, overflow: "hidden",
              width: "fit-content",
              maxWidth: "100%",
              boxShadow: "0 1px 2px rgba(17,24,39,.04)",
            }}
          >
            {[
              { id: "count", value: `${schoolCount}+`, label: "Schools Onboarded" },
              { id: "sys", value: "6-in-1", label: "Complete System" },
              { id: "ai", value: "AI", label: "Powered Platform" },
              { id: "sup", value: "24/7", label: "Support Available" },
            ].map((st, i, arr) => (
              <div
                key={st.id}
                className="sm-stat"
                style={{
                  padding: "20px 30px",
                  borderRight: i < arr.length - 1 ? "1px solid var(--sm-border)" : "none",
                }}
              >
                <div style={{
                  fontFamily: "'Sora',sans-serif", fontSize: 30, fontWeight: 800,
                  color: "var(--sm-text)", lineHeight: 1, letterSpacing: "-1px",
                }}>
                  {st.value}
                </div>
                <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section header + Cards ── */}
        <div style={fadeUp("0.38s")}>
          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ height: 1, flex: 1, background: "var(--sm-border)" }} />
            <span style={{ fontSize: 10.5, color: "var(--sm-text-muted)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Complete School Operating System
            </span>
            <div style={{ height: 1, flex: 1, background: "var(--sm-border)" }} />
          </div>

          {/* Cards — slider on mobile, grid on desktop */}
          {isMobile ? (
            <MobileSlider
              cards={CARDS}
              activeCard={activeCard}
              onCardClick={handleCardClick}
            />
          ) : (
            <div className="sm-cards-grid">
              {CARDS.map((card, i) => (
                <FeatureCard
                  key={card.id}
                  card={card}
                  index={i}
                  isActive={activeCard === card.id}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          )}

          {/* Detail panel */}
          {activeData && (
            <div
              style={{
                marginTop: 16, borderRadius: 16, padding: "24px 26px",
                border: "1px solid var(--sm-navy)",
                background: "var(--sm-surface)",
                boxShadow: "0 16px 36px -18px var(--sm-shadow)",
                animation: "sm-fadeUp .3s ease both",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                <div style={{
                  fontFamily: "'Sora',sans-serif", fontSize: 44, fontWeight: 800,
                  lineHeight: 1, color: "var(--sm-navy)",
                  flexShrink: 0, minWidth: 52,
                }}>
                  {activeData.num}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--sm-text)", marginBottom: 8 }}>
                    {activeData.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--sm-text-muted)", lineHeight: 1.75 }}>
                    {activeData.detail}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── "See How It Works" onboarding modal ── */}
      <HowItWorksModal open={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </div>
  );
}
