import { useState } from "react";
import { openDemoForm } from "./DemoRequestModal.jsx";
import ModulesSlider from "./ModulesSlider.jsx";

const TAB = {
  id: 0,
  badgeSub: "Module 1 of 6",
  titlePrefix: "SchoolMentor", accent: "ERP", tm: true,
  desc: "Custom-built to cater to the real-time, on-ground needs of schools covering everything from academic operations and student data to HR, finance, and communication. Integrates with 3 dedicated mobile apps and includes a complete implementation plan.",
  ppLabel: "Available on", ppVal: "Web · Android · iOS", ppIcons: [<i className="fa-solid fa-globe" />, <i className="fa-solid fa-desktop" />, <i className="fa-brands fa-android" />, <i className="fa-brands fa-apple" />],
  stats: [{ v: "18", l: "Modules" }, { v: "830+", l: "Schools" }, { v: "3", l: "Mobile Apps" }, { v: "24/7", l: "Support" }],
  floatCards: [{ i: <i className="fa-solid fa-graduation-cap" />, v: "18", l: "ERP Modules" }, { i: <i className="fa-solid fa-mobile-screen-button" />, v: "3 Apps", l: "Mobile Platforms" }, { i: <i className="fa-solid fa-bolt" />, v: "100%", l: "Automated" }],
  secPill: "ERP Modules", secH2: ["All ", "18 ERP Modules", " Included"],
  ctaTitle: "Ready to automate your school?", ctaSub: "Join 830+ schools across Pakistan already using SchoolMentor ERP.",
  modules: [
    { n: "01", icon: <i className="fa-solid fa-book" />, name: "Academics", desc: "Manage lesson plans, submissions, schemes of studies, academic calendars, student performance statistics, class activities, homework, and all curriculum-related workflows." },
    { n: "02", icon: <i className="fa-solid fa-file-pen" />, name: "Examination", desc: "Handle exams with date sheets, syllabus management, result generation, report cards, question paper generator, grading system, and examination analytics." },
    { n: "03", icon: <i className="fa-solid fa-file-lines" />, name: "Paper Generator", desc: "Generate complete question papers directly within the ERP — build, customize, and produce exam papers in minutes for any class or subject." },
    { n: "04", icon: <i className="fa-solid fa-user-check" />, name: "Attendance", desc: "Manage both student attendance and staff attendance with daily tracking, records, and reporting." },
    { n: "05", icon: <i className="fa-solid fa-calendar-days" />, name: "Time Table", desc: "Create and manage class-wise and teacher-wise timetables for smooth daily scheduling across the school." },
    { n: "06", icon: <i className="fa-solid fa-money-bill-wave" />, name: "Fee", desc: "Complete fee management including fee setup, challans, fee receiving, defaulters tracking, and detailed fee reports." },
    { n: "07", icon: <i className="fa-solid fa-coins" />, name: "Accounts", desc: "Track revenue, expenses, account books, and financial reports for complete and transparent financial tracking." },
    { n: "08", icon: <i className="fa-solid fa-boxes-stacked" />, name: "Inventory", desc: "Manage school inventory along with an integrated Point of Sale (POS) for complete stock and sales handling." },
    { n: "09", icon: <i className="fa-solid fa-user-plus" />, name: "Admission CRM", desc: "Handle the full admissions CRM with lead setup, active leads, inactive leads, and follow-ups to convert inquiries into admissions." },
    { n: "10", icon: <i className="fa-solid fa-user-graduate" />, name: "Students", desc: "Maintain active students, student profiles, documents, certificates, and complete student records in one place." },
    { n: "11", icon: <i className="fa-solid fa-users" />, name: "Human Resource", desc: "Manage HR basics, employee management, financials, and complete HR records for all staff." },
    { n: "12", icon: <i className="fa-solid fa-star" />, name: "Staff Appraisals", desc: "Run appraisal setup, staff evaluations, appraisal reports, and increment recommendations for performance management." },
    { n: "13", icon: <i className="fa-solid fa-book-open" />, name: "School SOPs", desc: "Access school manuals and SOP documents available directly inside the ERP for easy reference and implementation." },
    { n: "14", icon: <i className="fa-solid fa-chalkboard-user" />, name: "Teacher Trainings", desc: "View monthly teacher training recordings and professional development sessions to support continuous growth." },
    { n: "15", icon: <i className="fa-solid fa-rocket" />, name: "Launch Setup", desc: "Onboard your school and build its virtual structure — classes, sections, staff, students, and subjects — through guided Launch Setup." },
    { n: "16", icon: <i className="fa-solid fa-clipboard-list" />, name: "Audit Logs", desc: "Track ERP activities, changes, updates, and user actions for full transparency and accountability." },
    { n: "17", icon: <i className="fa-solid fa-gear" />, name: "Settings", desc: "Configure academic sessions, signatures, and system-level settings to tailor the ERP to your school." },
    { n: "18", icon: <i className="fa-solid fa-user-shield" />, name: "User Permissions", desc: "Define user roles, permissions, module access, and controlled user rights across the entire system." },
  ],
};

function ModuleCard({ mod, index }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 16, padding: "20px 16px",
        position: "relative", overflow: "hidden", cursor: "pointer",
        animation: `sosCardIn .5s ease ${0.04 + index * 0.04}s both`,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? "0 16px 36px -16px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transition: "transform .3s ease, box-shadow .3s ease, border-color .3s ease",
      }}
    >
      <div style={{ position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, background: "var(--sm-teal-light)", color: "var(--sm-navy)", transition: "all .3s ease" }}>{mod.n}</div>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--sm-teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, marginBottom: 12, color: "var(--sm-navy)" }}>{mod.icon}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: hov ? "var(--sm-navy)" : "var(--sm-text)", marginBottom: 6, lineHeight: 1.2, transition: "color .2s ease" }}>{mod.name}</div>
      <div style={{ fontSize: 11.5, color: "var(--sm-text-muted)", lineHeight: 1.6 }}>{mod.desc}</div>
    </div>
  );
}

function CtaBtn({ solid, children, onClick }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        flex: 1, padding: "13px 26px", borderRadius: 12, fontSize: 13.5, fontWeight: solid ? 800 : 700,
        fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: solid ? "#fff" : hov ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.14)",
        color: solid ? "#1D4ED8" : "#fff",
        border: solid ? "none" : `1.5px solid ${hov ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.35)"}`,
        boxShadow: solid ? (hov ? "0 14px 32px rgba(0,0,0,.2)" : "0 6px 20px rgba(0,0,0,.15)") : (hov ? "0 8px 24px rgba(0,0,0,.15)" : "none"),
        transform: active ? "scale(.97)" : hov ? "translateY(-3px) scale(1.02)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}
    >{children}</button>
  );
}

export default function Tab0_SchoolMentorERP() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes sosFadeUp     {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosCardIn     {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--sm-gray300); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--sm-text-muted); }

        /* ── Responsive ─────────────────────────── */
        .sos-hero-grid { display: grid; grid-template-columns: 1fr 200px; gap: 28px; align-items: start; }
        .sos-hero-padding { padding: 40px 44px 48px; }
        .sos-modules-padding { padding: 32px 44px 24px; }
        .sos-cta-padding { padding: 28px 44px; }
        .sos-modules-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; padding-bottom: 8px; }
        .sos-float-col { display: flex; flex-direction: column; gap: 10px; }
        .sos-badge-pill { display: inline-flex; align-items: center; gap: 8px; background: var(--sm-teal-light); border: 1px solid var(--sm-border); border-radius: 100px; padding: 6px 14px 6px 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .sos-badge-text { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--sm-navy); }
        .sos-cta-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .sos-cta-btns { display: flex; gap: 10px; position: relative; z-index: 1; }

        @media (max-width: 768px) {
          .sos-hero-grid { grid-template-columns: 1fr !important; }
          .sos-float-col { flex-direction: row !important; flex-wrap: wrap; }
          .sos-hero-padding { padding: 24px 20px 28px !important; }
          .sos-modules-padding { padding: 20px 16px 16px !important; }
          .sos-cta-padding { padding: 20px 20px !important; }
          .sos-modules-grid { grid-template-columns: repeat(2,1fr) !important; gap: 10px !important; }
          .sos-badge-text { font-size: 9px !important; letter-spacing: 1px !important; }
          .sos-cta-row { flex-direction: column !important; align-items: flex-start !important; }
          .sos-cta-btns { width: 100% !important; }
          .sos-cta-btns button { flex: 1 !important; font-size: 12px !important; padding: 11px 16px !important; }
          /* "Available on" card: stack text over icons, soften pill into a card */
          .sos-avail { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; border-radius: 16px !important; padding: 12px 16px !important; }
          .sos-avail-icons { flex-wrap: wrap; }
        }

        @media (max-width: 480px) {
          .sos-modules-grid { grid-template-columns: 1fr !important; }
          .sos-float-col > div { flex: 1 1 calc(50% - 5px) !important; min-width: 120px !important; }
        }

        
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", minHeight: "100%", background: "var(--sm-surface-alt)" }}>

        {/* HERO */}
        <div className="sos-hero-padding" style={{ background: "linear-gradient(180deg, var(--sm-bg) 0%, var(--sm-surface) 60%)", borderBottom: "1px solid var(--sm-border)", overflow: "hidden", flexShrink: 0 }}>
          <div className="sos-hero-grid" style={{ position: "relative", zIndex: 2 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "6px 14px 6px 10px", marginBottom: 20, animation: "sosFadeUp .5s ease .05s both" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sm-navy)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sm-navy)" }}>School Operating System</span>
                <div style={{ width: 1, height: 13, background: "var(--sm-border)" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--sm-text-muted)" }}>{TAB.badgeSub}</span>
              </div>

              <h1 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 900, color: "var(--sm-text)", lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 12, animation: "sosFadeUp .55s ease .12s both" }}>
                {TAB.titlePrefix}{" "}
                <em style={{ fontStyle: "normal", color: "var(--sm-navy)" }}>{TAB.accent}</em>
                <sup style={{ fontSize: 14, verticalAlign: "super", color: "var(--sm-text-muted)", fontWeight: 400 }}>™</sup>
              </h1>

              <p style={{ fontSize: 14, color: "var(--sm-text-muted)", lineHeight: 1.75, maxWidth: 580, marginBottom: 24, animation: "sosFadeUp .55s ease .2s both" }}>{TAB.desc}</p>

              <div className="sos-avail" style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "9px 18px", marginBottom: 24, maxWidth: "100%", animation: "sosFadeUp .55s ease .28s both" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 1 }}>{TAB.ppLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sm-text)", whiteSpace: "nowrap" }}>{TAB.ppVal}</div>
                </div>
                <div className="sos-avail-icons" style={{ display: "flex", gap: 8 }}>
                  {TAB.ppIcons.map((ico, i) => (
                    <div key={i} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--sm-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", color: "var(--sm-navy)", transition: "all .25s ease" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--sm-hover)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >{ico}</div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", animation: "sosFadeUp .55s ease .36s both" }}>
                {TAB.stats.map((s, i) => (
                  <div key={i} style={{ background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 12, padding: "10px 16px", cursor: "default", transition: "all .3s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "var(--sm-navy)"; e.currentTarget.style.boxShadow = "0 16px 36px -16px var(--sm-shadow)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--sm-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Float cards */}
            <div className="sos-float-col" style={{ animation: "sosFadeUp .55s ease .2s both" }}>
              {TAB.floatCards.map((c, i) => (
                <div key={i} style={{ background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 14, padding: "14px 16px", cursor: "default", boxShadow: "0 1px 2px rgba(17,24,39,.04)", animation: `sosFadeUp .5s ease ${.25 + i * .12}s both`, transition: "all .3s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 16px 36px -16px var(--sm-shadow)"; e.currentTarget.style.borderColor = "var(--sm-navy)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(17,24,39,.04)"; e.currentTarget.style.borderColor = "var(--sm-border)"; }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6, color: "var(--sm-navy)" }}>{c.i}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>{c.v}</div>
                  <div style={{ fontSize: 9.5, color: "var(--sm-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{c.l}</div>
                  <div style={{ height: 2.5, borderRadius: 2, background: "var(--sm-border)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "100%", borderRadius: 2, background: "var(--sm-navy)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MODULES */}
        <div className="sos-modules-padding" style={{ background: "var(--sm-bg)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "5px 14px", flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)" }} />
              {TAB.secPill}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sm-text)" }}>
              {TAB.secH2[0]}
              <span style={{ color: "var(--sm-navy)" }}>{TAB.secH2[1]}</span>
              {TAB.secH2[2]}
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--sm-border)" }} />
          </div>

          <ModulesSlider modules={TAB.modules} Card={ModuleCard} />
        </div>

        {/* CTA */}
        <div className="sos-cta-padding sos-cta-row" style={{ background: "var(--sm-cta-grad, #2563EB)", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{TAB.ctaTitle}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>{TAB.ctaSub}</div>
          </div>
          <div className="sos-cta-btns">
            <CtaBtn solid onClick={() => { openDemoForm("SchoolMentor ERP"); }}><i className="fa-solid fa-calendar-check" aria-hidden="true" />Book a Free Demo</CtaBtn>
            <CtaBtn onClick={() => { window.open("https://wa.me/923700036867?text=" + encodeURIComponent("Hi, I'd like to talk to an expert about School Mentor."), "_blank"); }}><i className="fa-solid fa-comments" aria-hidden="true" />Talk to an Expert</CtaBtn>
          </div>
        </div>
      </div>
    </>
  );
}
