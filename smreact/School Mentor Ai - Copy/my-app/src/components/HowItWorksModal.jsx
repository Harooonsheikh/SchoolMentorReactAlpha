/**
 * HowItWorksModal.jsx
 *
 * Premium, fully-responsive "See How It Works" onboarding modal for
 * School Mentor. Opens in-place (no navigation) from the hero's
 * "See How It Works" button.
 *
 * Design system: reuses the site-wide --sm-* CSS variables (defined in
 * index.css), so it themes automatically in both light and dark mode.
 * Fonts: Plus Jakarta Sans (body) + Instrument Serif (display), matching
 * the rest of the website. Icons: Font Awesome 6 (loaded globally).
 *
 * Usage:
 *   import HowItWorksModal from "./HowItWorksModal";
 *   <HowItWorksModal open={open} onClose={() => setOpen(false)} />
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
// DATA — the 10-step onboarding journey
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Contact Our Team",
    desc: "The school contacts our sales team for an introductory discussion.",
    hint: "Call · Meeting · Consultation",
    icon: "fa-phone-volume",
    color: "#3B82F6",
    rgb: "37,99,235",
  },
  {
    n: "02",
    title: "Demo & Presentation",
    desc: "Our team provides a detailed presentation and live demo of the complete School Mentor ecosystem including ERP, Mobile Apps, Mentor AI, SOPs, and Teacher Training System.",
    hint: "Presentation · Screen Demo",
    icon: "fa-display",
    color: "#0EA5E9",
    rgb: "14,165,233",
  },
  {
    n: "03",
    title: "School Registration & Sign-Up",
    desc: "The school completes the registration process and becomes a School Mentor member institution.",
    hint: "Registration · Sign-Up",
    icon: "fa-file-signature",
    color: "#6366F1",
    rgb: "99,102,241",
  },
  {
    n: "04",
    title: "Launch Setup & School Configuration",
    desc: "The school creates its virtual structure by configuring classes, sections, staff, students, subjects, and other school settings through Launch Setup.",
    hint: "Settings · Configuration",
    icon: "fa-sliders",
    color: "#8B5CF6",
    rgb: "139,92,246",
  },
  {
    n: "05",
    title: "ERP Activation",
    desc: "After Launch Setup completion, the School Mentor ERP is activated and ready for daily operations.",
    hint: "ERP Dashboard",
    icon: "fa-gauge-high",
    color: "#0D9488",
    rgb: "13,148,136",
  },
  {
    n: "06",
    title: "ERP Training",
    desc: "Our Customer Success Team provides complete training on every ERP module to ensure smooth adoption.",
    hint: "Training Session",
    icon: "fa-chalkboard-user",
    color: "#16A34A",
    rgb: "22,163,74",
  },
  {
    n: "07",
    title: "Principal App Training",
    desc: "The school leadership is trained on the Principal Mobile Application.",
    hint: "Mobile App",
    icon: "fa-user-tie",
    color: "#D97706",
    rgb: "217,119,6",
  },
  {
    n: "08",
    title: "Teacher App Training",
    desc: "Teachers receive training on the Teacher Mobile Application and daily workflows.",
    hint: "Teacher Mobile App",
    icon: "fa-mobile-screen-button",
    color: "#EA580C",
    rgb: "234,88,12",
  },
  {
    n: "09",
    title: "Parent App Training",
    desc: "Parents are introduced to the Parent Mobile Application for communication and engagement.",
    hint: "Parent Mobile App",
    icon: "fa-people-roof",
    color: "#DB2777",
    rgb: "219,39,119",
  },
  {
    n: "10",
    title: "School Fully Onboarded",
    desc: "The school is now fully onboarded and actively using the School Mentor ecosystem.",
    hint: "Success · Completion",
    icon: "fa-circle-check",
    color: "#16A34A",
    rgb: "22,163,74",
  },
];

// Highlighted feature sections shown after the journey
const FEATURES = [
  {
    title: "Ongoing Customer Support",
    desc: "Our Customer Success Team remains available to assist schools with implementation, training, support, and continuous improvement.",
    hint: "Always-on assistance",
    icon: "fa-headset",
    color: "#3B82F6",
    rgb: "37,99,235",
  },
  {
    title: "Monthly Professional Development Trainings",
    desc: "Every month, School Mentor conducts live online training workshops on new topics with expert trainers to support continuous professional growth.",
    hint: "Live Training · Webinar",
    icon: "fa-video",
    color: "#0EA5E9",
    rgb: "14,165,233",
  },
  {
    title: "School SOPs & Manuals",
    desc: "Comprehensive school SOPs and operational manuals are available directly inside the School Mentor ERP for easy access and implementation.",
    hint: "Manuals · Documents",
    icon: "fa-book-open",
    color: "#8B5CF6",
    rgb: "139,92,246",
  },
  {
    title: "Mentor AI",
    desc: "Teachers can generate lesson plans, worksheets, notebook plans, assessments, and academic content using Mentor AI. Generated content can also be synchronized with School Mentor workflows.",
    hint: "AI Assistant",
    icon: "fa-wand-magic-sparkles",
    color: "#16A34A",
    rgb: "22,163,74",
  },
];

const ECOSYSTEM = [
  { label: "ERP", icon: "fa-desktop" },
  { label: "Mobile Apps", icon: "fa-mobile-screen-button" },
  { label: "Mentor AI", icon: "fa-wand-magic-sparkles" },
  { label: "Teacher Trainings", icon: "fa-graduation-cap" },
  { label: "School SOPs", icon: "fa-file-lines" },
  { label: "Customer Success Support", icon: "fa-headset" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SCOPED CSS  (theme-aware via --sm-* tokens)
// ─────────────────────────────────────────────────────────────────────────────

const HIW_CSS = `
@keyframes hiw-overlayIn { from{opacity:0} to{opacity:1} }
@keyframes hiw-modalIn   { from{opacity:0;transform:translateY(26px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes hiw-stepIn    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
@keyframes hiw-popIn     { from{opacity:0;transform:scale(.55)} to{opacity:1;transform:scale(1)} }
@keyframes hiw-shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
@keyframes hiw-ringPulse { 0%{transform:scale(1);opacity:.55} 70%{transform:scale(1.85);opacity:0} 100%{transform:scale(1.85);opacity:0} }
@keyframes hiw-float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes hiw-drawLine  { from{transform:scaleY(0)} to{transform:scaleY(1)} }

.hiw-overlay{
  position:fixed; inset:0; z-index:3000;
  background:rgba(8,13,26,.62);
  backdrop-filter:blur(7px); -webkit-backdrop-filter:blur(7px);
  display:flex; align-items:center; justify-content:center;
  padding:clamp(8px,2.5vw,28px);
  animation:hiw-overlayIn .3s ease both;
  font-family:var(--sm-font-body,'Plus Jakarta Sans',sans-serif);
}
.hiw-modal{
  position:relative;
  width:100%; max-width:980px; max-height:92vh;
  display:flex; flex-direction:column;
  background:var(--sm-surface,#fff);
  border:1px solid var(--sm-border,#DBEAFE);
  border-radius:clamp(16px,2.4vw,26px);
  box-shadow:0 40px 110px rgba(8,13,26,.5), 0 0 0 1px rgba(255,255,255,.04);
  overflow:hidden;
  animation:hiw-modalIn .42s cubic-bezier(.22,1,.36,1) both;
}

/* ── Header banner ── */
.hiw-header{
  position:relative; flex:0 0 auto;
  padding:clamp(22px,3vw,34px) clamp(22px,4vw,46px) clamp(20px,2.6vw,28px);
  background:linear-gradient(180deg,var(--sm-bg) 0%,var(--sm-surface) 60%);
  border-bottom:1px solid var(--sm-border);
  overflow:hidden;
}
.hiw-eyebrow{
  position:relative; z-index:1;
  display:inline-flex; align-items:center; gap:8px;
  padding:5px 13px; border-radius:30px;
  background:var(--sm-teal-light); border:1px solid var(--sm-border);
  color:var(--sm-navy); font-size:10.5px; font-weight:700;
  letter-spacing:.13em; text-transform:uppercase; margin-bottom:14px;
}
.hiw-title{
  position:relative; z-index:1;
  font-family:var(--sm-font-body,'Plus Jakarta Sans',sans-serif);
  font-size:clamp(24px,4.4vw,38px); font-weight:800;
  color:var(--sm-text); line-height:1.12; letter-spacing:-.6px; margin:0 0 9px;
}
.hiw-sub{
  position:relative; z-index:1;
  font-size:clamp(13px,1.7vw,15.5px); color:var(--sm-text-muted);
  line-height:1.6; max-width:620px; margin:0; font-weight:400;
}
.hiw-close{
  position:absolute; top:16px; right:16px; z-index:5;
  width:38px; height:38px; border-radius:50%;
  background:var(--sm-surface); border:1px solid var(--sm-border);
  color:var(--sm-text); font-size:16px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:all .22s ease;
}
.hiw-close:hover{ background:var(--sm-hover); color:var(--sm-navy); transform:rotate(90deg) scale(1.06); }

/* ── Scroll body ── */
.hiw-body{
  flex:1 1 auto; overflow-y:auto; overflow-x:hidden;
  padding:clamp(22px,3.4vw,40px) clamp(18px,4vw,46px) clamp(28px,4vw,44px);
  background:var(--sm-bg,#F0F4FF);
}
.hiw-body::-webkit-scrollbar{ width:10px; }
.hiw-body::-webkit-scrollbar-track{ background:transparent; }
.hiw-body::-webkit-scrollbar-thumb{ background:var(--sm-gray300,#93C5FD); border-radius:8px; border:3px solid var(--sm-bg,#F0F4FF); }

.hiw-section-label{
  display:flex; align-items:center; gap:12px; margin:0 0 22px;
}
.hiw-section-label span{
  font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  color:var(--sm-text-muted,#64748B); white-space:nowrap;
}
.hiw-section-label .hiw-rule{
  height:1px; flex:1;
  background:linear-gradient(90deg,var(--sm-gray300,#93C5FD),transparent);
}
.hiw-section-label .hiw-rule.r{
  background:linear-gradient(90deg,transparent,var(--sm-gray300,#93C5FD));
}

/* ── Timeline ── */
.hiw-timeline{ position:relative; }
.hiw-step{
  display:flex; gap:clamp(12px,2vw,20px); position:relative;
  animation:hiw-stepIn .5s cubic-bezier(.22,1,.36,1) both;
}
.hiw-rail{
  flex:0 0 auto; display:flex; flex-direction:column; align-items:center;
  width:clamp(46px,9vw,58px);
}
.hiw-node{
  position:relative; flex:0 0 auto;
  width:clamp(46px,9vw,58px); height:clamp(46px,9vw,58px);
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:clamp(17px,3vw,21px); color:#fff;
  box-shadow:0 8px 22px rgba(0,0,0,.18);
  z-index:2; animation:hiw-popIn .5s cubic-bezier(.34,1.56,.64,1) both;
}
.hiw-node::before{ content:none; }
.hiw-node-num{
  position:absolute; top:-6px; right:-6px;
  min-width:21px; height:21px; padding:0 5px; border-radius:11px;
  background:var(--sm-surface,#fff); color:var(--sm-text,#0F172A);
  font-size:10.5px; font-weight:800; line-height:21px; text-align:center;
  box-shadow:0 2px 6px rgba(0,0,0,.18);
  border:1px solid var(--sm-border,#DBEAFE);
}
.hiw-connector{
  flex:1 1 auto; width:3px; min-height:24px; border-radius:3px;
  margin:7px 0 0; transform-origin:top;
  animation:hiw-drawLine .6s ease both;
}

.hiw-card{
  flex:1 1 auto; min-width:0;
  margin-bottom:clamp(16px,2.4vw,22px);
  background:var(--sm-surface,#fff);
  border:1px solid var(--sm-border,#DBEAFE);
  border-left-width:4px;
  border-radius:var(--sm-radius-lg,14px);
  padding:clamp(15px,2.4vw,20px) clamp(16px,2.6vw,24px);
  box-shadow:0 4px 18px var(--sm-shadow,rgba(30,58,138,.10));
  transition:transform .26s cubic-bezier(.22,1,.36,1), box-shadow .26s ease, border-color .26s ease;
}
.hiw-card:hover{
  transform:translateY(-4px);
  box-shadow:0 16px 40px var(--sm-shadow,rgba(30,58,138,.2));
}
.hiw-card-top{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:7px; }
.hiw-step-tag{
  font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
  padding:3px 9px; border-radius:6px;
}
.hiw-card-title{
  font-size:clamp(15px,2.2vw,18px); font-weight:700;
  color:var(--sm-text,#0F172A); line-height:1.25; margin:0;
}
.hiw-card-desc{
  font-size:clamp(12.5px,1.7vw,14px); color:var(--sm-text-soft,#334155);
  line-height:1.65; margin:0 0 11px;
}
.hiw-card-hint{
  display:inline-flex; align-items:center; gap:7px;
  font-size:11px; font-weight:700; letter-spacing:.02em;
  padding:5px 11px; border-radius:30px;
}

/* ── Highlighted feature grid ── */
.hiw-features{
  display:grid; grid-template-columns:repeat(2,1fr);
  gap:clamp(12px,2vw,18px);
}
.hiw-feature{
  position:relative; overflow:hidden;
  background:var(--sm-surface,#fff);
  border:1px solid var(--sm-border,#DBEAFE);
  border-radius:var(--sm-radius-lg,14px);
  padding:clamp(18px,2.6vw,24px);
  box-shadow:0 4px 18px var(--sm-shadow,rgba(30,58,138,.10));
  transition:transform .26s cubic-bezier(.22,1,.36,1), box-shadow .26s ease;
}
.hiw-feature:hover{ transform:translateY(-5px); box-shadow:0 18px 44px var(--sm-shadow,rgba(30,58,138,.22)); }
.hiw-feature::before{
  content:''; position:absolute; top:0; left:0; right:0; height:4px;
}
.hiw-feature-icon{
  width:48px; height:48px; border-radius:13px;
  display:flex; align-items:center; justify-content:center;
  font-size:21px; margin-bottom:14px;
}
.hiw-feature-title{
  font-size:clamp(14.5px,2vw,16.5px); font-weight:700;
  color:var(--sm-text,#0F172A); line-height:1.3; margin:0 0 7px;
}
.hiw-feature-desc{
  font-size:clamp(12.5px,1.6vw,13.5px); color:var(--sm-text-soft,#334155);
  line-height:1.65; margin:0 0 12px;
}
.hiw-feature-hint{
  display:inline-flex; align-items:center; gap:7px;
  font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  color:var(--sm-text-muted,#64748B);
}

/* ── Final success card ── */
.hiw-finale{
  position:relative; overflow:hidden;
  border-radius:var(--sm-radius-xl,20px);
  padding:clamp(28px,4vw,44px) clamp(22px,4vw,40px);
  text-align:center;
  background:var(--sm-cta-grad,#2563EB);
  box-shadow:0 20px 48px -20px rgba(17,24,39,.30);
}
.hiw-finale-badge{
  position:relative; z-index:1;
  width:74px; height:74px; margin:0 auto 18px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:32px; color:#fff;
  background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.36);
}
.hiw-finale-title{
  position:relative; z-index:1;
  font-family:var(--sm-font-body,'Plus Jakarta Sans',sans-serif);
  font-size:clamp(25px,4.8vw,38px); font-weight:800; letter-spacing:-.6px;
  margin:0 0 12px; color:#fff;
}
.hiw-finale-text{
  position:relative; z-index:1;
  font-size:clamp(13.5px,2vw,16px); color:rgba(255,255,255,.9);
  line-height:1.7; max-width:560px; margin:0 auto 22px;
}
.hiw-chips{
  position:relative; z-index:1;
  display:flex; flex-wrap:wrap; gap:9px; justify-content:center; margin-bottom:22px;
}
.hiw-chip{
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 15px; border-radius:30px;
  background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.3);
  color:#fff; font-size:12.5px; font-weight:600;
  backdrop-filter:blur(6px); transition:all .24s cubic-bezier(.34,1.56,.64,1);
}
.hiw-chip:hover{ background:#fff; color:var(--sm-navy,#1D4ED8); transform:translateY(-3px) scale(1.05); }
.hiw-finale-note{
  position:relative; z-index:1;
  font-size:clamp(12px,1.7vw,13.5px); color:rgba(255,255,255,.72);
  line-height:1.6; max-width:520px; margin:0 auto; font-weight:500;
}

/* ── Responsive ── */
@media(max-width:640px){
  .hiw-features{ grid-template-columns:1fr; }
  .hiw-node-num{ top:-5px; right:-5px; min-width:18px; height:18px; line-height:18px; font-size:9.5px; }
}
@media(prefers-reduced-motion:reduce){
  .hiw-overlay,.hiw-modal,.hiw-step,.hiw-node,.hiw-connector,
  .hiw-finale-badge,.hiw-finale-title{ animation:none!important; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function HowItWorksModal({ open, onClose }) {
  // Inject scoped styles once
  useEffect(() => {
    if (!document.getElementById("hiw-modal-styles")) {
      const el = document.createElement("style");
      el.id = "hiw-modal-styles";
      el.textContent = HIW_CSS;
      document.head.appendChild(el);
    }
  }, []);

  // Lock body scroll + close on Escape while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Render through a portal to <body> so the fixed overlay escapes the hero's
  // overflow:hidden / stacking context and always covers the full viewport.
  return createPortal(
    <div
      className="hiw-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hiw-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="hiw-modal">
        {/* ── Header ── */}
        <div className="hiw-header">
          <button className="hiw-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
          <span className="hiw-eyebrow">
            <i className="fa-solid fa-route" /> Onboarding Journey
          </span>
          <h2 className="hiw-title" id="hiw-title">How School Mentor Works</h2>
          <p className="hiw-sub">
            A simple step-by-step journey from onboarding to successful digital transformation.
          </p>
        </div>

        {/* ── Scrollable content ── */}
        <div className="hiw-body">

          {/* Timeline of steps */}
          <div className="hiw-section-label">
            <span>The Journey · 10 Steps</span>
            <div className="hiw-rule r" />
          </div>

          <div className="hiw-timeline">
            {STEPS.map((s, i) => {
              const isLast = i === STEPS.length - 1;
              return (
                <div
                  key={s.n}
                  className="hiw-step"
                  style={{ animationDelay: `${0.06 + i * 0.07}s` }}
                >
                  {/* Rail: node + connector */}
                  <div className="hiw-rail">
                    <div
                      className="hiw-node"
                      style={{
                        background: "var(--sm-navy)",
                        color: "#fff",
                        animationDelay: `${0.12 + i * 0.07}s`,
                      }}
                    >
                      <i className={`fa-solid ${s.icon}`} style={{ color: "#fff" }} />
                      <span className="hiw-node-num">{s.n}</span>
                    </div>
                    {!isLast && (
                      <div
                        className="hiw-connector"
                        style={{
                          background: "var(--sm-gray300)",
                          animationDelay: `${0.2 + i * 0.07}s`,
                        }}
                      />
                    )}
                  </div>

                  {/* Content card */}
                  <div className="hiw-card" style={{ borderLeftColor: "var(--sm-navy)" }}>
                    <div className="hiw-card-top">
                      <span
                        className="hiw-step-tag"
                        style={{ background: "var(--sm-teal-light)", color: "var(--sm-navy)" }}
                      >
                        Step {s.n}
                      </span>
                      <h3 className="hiw-card-title">{s.title}</h3>
                    </div>
                    <p className="hiw-card-desc">{s.desc}</p>
                    <span
                      className="hiw-card-hint"
                      style={{
                        background: "var(--sm-teal-light)",
                        color: "var(--sm-navy)",
                        border: "1px solid var(--sm-border)",
                      }}
                    >
                      <i className={`fa-solid ${s.icon}`} /> {s.hint}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Highlighted feature sections */}
          <div className="hiw-section-label" style={{ marginTop: 14 }}>
            <div className="hiw-rule" />
            <span>Beyond Onboarding · Always With You</span>
            <div className="hiw-rule r" />
          </div>

          <div className="hiw-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="hiw-feature">
                <div
                  className="hiw-feature-icon"
                  style={{
                    background: "var(--sm-teal-light)",
                    color: "var(--sm-navy)",
                  }}
                >
                  <i className={`fa-solid ${f.icon}`} />
                </div>
                <h3 className="hiw-feature-title">{f.title}</h3>
                <p className="hiw-feature-desc">{f.desc}</p>
                <span className="hiw-feature-hint">
                  <i className={`fa-solid ${f.icon}`} style={{ color: "var(--sm-navy)" }} /> {f.hint}
                </span>
              </div>
            ))}
          </div>

          {/* Final success message */}
          <div className="hiw-finale" style={{ marginTop: "clamp(26px,4vw,40px)" }}>
            <div className="hiw-finale-badge">
              <i className="fa-solid fa-trophy" />
            </div>
            <h3 className="hiw-finale-title">Congratulations!</h3>
            <p className="hiw-finale-text">
              Your school is now powered by the complete School Mentor Ecosystem.
            </p>
            <div className="hiw-chips">
              {ECOSYSTEM.map((c) => (
                <span key={c.label} className="hiw-chip">
                  <i className={`fa-solid ${c.icon}`} /> {c.label}
                </span>
              ))}
            </div>
            <p className="hiw-finale-note">
              All working together to help schools operate smarter and more efficiently.
            </p>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
