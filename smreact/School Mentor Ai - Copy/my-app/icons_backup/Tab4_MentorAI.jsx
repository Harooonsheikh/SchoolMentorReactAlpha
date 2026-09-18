import { useState } from "react";

const TAB = {
  id: 4,
  badgeSub: "Module 5 of 6",
  titlePrefix: "Mentor", accent: "AI", tm: false,
  desc: "An intelligent AI-powered suite built directly into SchoolMentor helping teachers, admins, and school staff save hours every day with smart lesson planning, content generation, worksheet creation, and professional social media management.",
  ppLabel: "Powered by", ppVal: "AI-Powered · Cloud · Integrated", ppIcons: ["✦", "🤖", "☁️"],
  stats: [{ v: "4", l: "AI Tools" }, { v: "Smart", l: "Assistant" }, { v: "Instant", l: "Generation" }, { v: "Custom", l: "Branding" }],
  floatCards: [{ i: "✦", v: "AI", l: "Powered" }, { i: "⚡", v: "Instant", l: "Generation" }, { i: "🎨", v: "Custom", l: "Branding" }],
  secPill: "AI Features", secH2: ["", "4 Powerful", " Mentor AI Tools"],
  ctaTitle: "Save hours every day with Mentor AI.", ctaSub: "Smart AI tools for lesson planning, worksheets, question banks, and social media — all in one place.",
  modules: [
    { n: "01", icon: "💬", name: "AI Assistant", desc: "Smart AI-powered chat assistant for teachers and school staff to help with academic planning, communication, ideas, and daily school operations — always available, always intelligent." },
    { n: "02", icon: "📖", name: "Lesson Plans & Question Bank", desc: "Scan any publisher's book and instantly generate lesson plans, question banks, answers, and full academic content through Mentor AI — curriculum-aligned and ready to use." },
    { n: "03", icon: "📝", name: "AI Worksheet Generator", desc: "Generate fully customized worksheets for any class, subject, or topic with your school logo, school name, and personalized formatting automatically applied." },
    { n: "04", icon: "📱", name: "Social Media Content Studio", desc: "Create professional social media posts for your school using your own logos, team pictures, branding, and school content — powered by Mentor AI for polished, on-brand results." },
  ],
};

function ModuleCard({ mod, index }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: "var(--sm-surface)", border: `1.5px solid ${hov ? "rgba(21,101,192,.28)" : "var(--sm-border)"}`, borderRadius: 18, padding: "28px 22px", position: "relative", overflow: "hidden", cursor: "pointer", animation: `sosCardIn .5s ease ${0.04 + index * 0.06}s both`, transform: hov ? "translateY(-6px) scale(1.015)" : "translateY(0) scale(1)", boxShadow: hov ? "0 20px 48px rgba(21,101,192,.14), 0 0 0 3px rgba(21,101,192,.07)" : "none", transition: "transform .35s cubic-bezier(.22,.97,.47,1), box-shadow .35s ease, border-color .3s ease" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#1565C0,#1DB88A)", borderRadius: "18px 18px 0 0", transform: hov ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left", transition: "transform .35s cubic-bezier(.22,.97,.47,1)" }} />
      <div style={{ position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)", width: "80%", height: 60, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(29,184,138,.12),transparent 70%)", opacity: hov ? 1 : 0, transition: "opacity .35s ease", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, background: hov ? "linear-gradient(135deg,#1565C0,#1DB88A)" : "var(--sm-surface-alt)", color: hov ? "#fff" : "var(--sm-text-muted)", border: hov ? "none" : "1px solid var(--sm-border)", transform: hov ? "scale(1.1)" : "scale(1)", boxShadow: hov ? "0 0 12px rgba(21,101,192,.35)" : "none", transition: "all .3s cubic-bezier(.22,.97,.47,1)" }}>{mod.n}</div>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: hov ? "linear-gradient(135deg,rgba(21,101,192,.18),rgba(29,184,138,.14))" : "linear-gradient(135deg,rgba(21,101,192,.1),rgba(29,184,138,.08))", border: "1px solid rgba(21,101,192,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16, boxShadow: hov ? "0 6px 18px rgba(21,101,192,.2)" : "none", transition: "background .3s ease, box-shadow .3s ease" }}>{mod.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: hov ? "var(--sm-navy)" : "var(--sm-text)", marginBottom: 8, lineHeight: 1.2, transition: "color .2s ease" }}>{mod.name}</div>
      <div style={{ fontSize: 12.5, color: "var(--sm-text-muted)", lineHeight: 1.7 }}>{mod.desc}</div>
    </div>
  );
}

function CtaBtn({ solid, children, onClick }) {
  const [hov, setHov] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setActive(false); }} onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      style={{ flex: 1, padding: "13px 26px", borderRadius: 12, fontSize: 13.5, fontWeight: solid ? 800 : 700, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: solid ? "#fff" : hov ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.14)", color: solid ? "#1565C0" : "#fff", border: solid ? "none" : `1.5px solid ${hov ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.35)"}`, boxShadow: solid ? (hov ? "0 14px 32px rgba(0,0,0,.2)" : "0 6px 20px rgba(0,0,0,.15)") : (hov ? "0 8px 24px rgba(0,0,0,.15)" : "none"), transform: active ? "scale(.97)" : hov ? "translateY(-3px) scale(1.02)" : "none", transition: "all .3s cubic-bezier(.22,.97,.47,1)" }}
    >{children}</button>
  );
}

export default function Tab4_MentorAI() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes sosShimmer    {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes sosFadeUp     {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosOrbFloat   {0%,100%{transform:translate(0,0)}50%{transform:translate(14px,10px)}}
        @keyframes sosBlink      {0%,100%{opacity:1}50%{opacity:0}}
        @keyframes sosDotPulse   {0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
        @keyframes sosCardIn     {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosBarGrow    {from{width:0}to{width:100%}}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(21,101,192,.3); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(21,101,192,.55); }

        /* ── Responsive ─────────────────────────── */
        .sos-hero-grid { display: grid; grid-template-columns: 1fr 200px; gap: 28px; align-items: start; }
        .sos-hero-padding { padding: 40px 44px 48px; }
        .sos-modules-padding { padding: 32px 44px 24px; }
        .sos-cta-padding { padding: 28px 44px; }
        .sos-modules-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; padding-bottom: 8px; }
        .sos-float-col { display: flex; flex-direction: column; gap: 10px; }
        .sos-badge-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.28); border-radius: 100px; padding: 6px 14px 6px 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .sos-badge-text { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.9); }
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
        }

        @media (max-width: 480px) {
          .sos-modules-grid { grid-template-columns: 1fr !important; }
          .sos-float-col > div { flex: 1 1 calc(50% - 5px) !important; min-width: 120px !important; }
        }
      `}</style>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", minHeight: "100%", background: "var(--sm-surface-alt)" }}>
        {/* HERO */}
        <div className="sos-hero-padding" style={{ background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", top: -180, right: -100, background: "radial-gradient(circle,rgba(255,255,255,.07),transparent 65%)", pointerEvents: "none", animation: "sosOrbFloat 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", bottom: -120, left: -60, background: "radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)", pointerEvents: "none", animation: "sosOrbFloat 11s ease-in-out infinite reverse" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.2),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "sosShimmer 3.5s linear infinite" }} />
          <div className="sos-hero-grid" style={{ position: "relative", zIndex: 2 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 100, padding: "6px 14px 6px 10px", marginBottom: 20, animation: "sosFadeUp .5s ease .05s both" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.9)", animation: "sosDotPulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>School Operating System</span>
                <div style={{ width: 1, height: 13, background: "rgba(255,255,255,.3)" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.75)" }}>{TAB.badgeSub}</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 12, animation: "sosFadeUp .55s ease .12s both" }}>
                {TAB.titlePrefix}{" "}<em style={{ fontStyle: "normal", background: "linear-gradient(90deg,#a8f0d8,#c8ecff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{TAB.accent}</em>
                <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#a8f0d8", marginLeft: 4, verticalAlign: "middle", animation: "sosBlink .75s step-end infinite" }} />
              </h1>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.78)", lineHeight: 1.75, maxWidth: 580, marginBottom: 24, animation: "sosFadeUp .55s ease .2s both" }}>{TAB.desc}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 100, padding: "9px 18px", marginBottom: 24, animation: "sosFadeUp .55s ease .28s both" }}>
                <div><div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 1 }}>{TAB.ppLabel}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{TAB.ppVal}</div></div>
                <div style={{ display: "flex", gap: 8 }}>{TAB.ppIcons.map((ico, i) => (<div key={i} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", transition: "all .25s ease" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.18)"; e.currentTarget.style.transform = "scale(1.1) rotate(-5deg)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}>{ico}</div>))}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", animation: "sosFadeUp .55s ease .36s both" }}>
                {TAB.stats.map((s, i) => (<div key={i} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: "10px 16px", cursor: "default", transition: "all .3s ease" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px) scale(1.03)"; e.currentTarget.style.background = "rgba(255,255,255,.22)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.12)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.boxShadow = "none"; }}><div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.v}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{s.l}</div></div>))}
              </div>
            </div>
            <div className="sos-float-col" style={{ animation: "sosFadeUp .55s ease .2s both" }}>
              {TAB.floatCards.map((c, i) => (<div key={i} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(8px)", cursor: "default", animation: `sosFadeUp .5s ease ${.25 + i * .12}s both`, transition: "all .3s ease" }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,.18)"; e.currentTarget.style.background = "rgba(255,255,255,.22)"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}><div style={{ fontSize: 20, marginBottom: 6 }}>{c.i}</div><div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{c.v}</div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{c.l}</div><div style={{ height: 2.5, borderRadius: 2, background: "rgba(255,255,255,.2)", marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#a8f0d8,#c8ecff)", animation: "sosBarGrow 1.5s ease .5s both" }} /></div></div>))}
            </div>
          </div>
        </div>
        {/* MODULES — 4 cards, 2-col layout with bigger cards */}
        <div className="sos-modules-padding" style={{ background: "var(--sm-surface-alt)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(21,101,192,.09)", border: "1px solid rgba(21,101,192,.18)", borderRadius: 100, padding: "5px 14px", flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)", animation: "sosDotPulse 2s ease-in-out infinite" }} />{TAB.secPill}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--sm-text)" }}>{TAB.secH2[0]}<span style={{ background: "linear-gradient(90deg,#1565C0,#1DB88A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{TAB.secH2[1]}</span>{TAB.secH2[2]}</div>
            <div style={{ flex: 1, height: 1, background: "var(--sm-border)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, paddingBottom: 8 }}>
            {TAB.modules.map((mod, i) => <ModuleCard key={i} mod={mod} index={i} />)}
          </div>
        </div>
        {/* CTA */}
        <div className="sos-cta-padding sos-cta-row" style={{ background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}><div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{TAB.ctaTitle}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>{TAB.ctaSub}</div></div>
          <div className="sos-cta-btns"><CtaBtn solid onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}>🚀 Book a Free Demo</CtaBtn><CtaBtn onClick={() => { window.open("https://wa.me/923700036867?text=" + encodeURIComponent("Hi, I'd like to talk to an expert about School Mentor."), "_blank"); }}>💬 Talk to an Expert</CtaBtn></div>
        </div>
      </div>
    </>
  );
}
