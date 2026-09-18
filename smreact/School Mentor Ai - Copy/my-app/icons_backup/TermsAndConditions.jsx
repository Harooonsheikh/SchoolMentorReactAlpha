import { useState, useEffect, useRef } from "react";


// ── Shared styles (must be before SECTIONS) ─────────────────────
const linkStyle = { color: "var(--sm-navy)", textDecoration: "none", fontWeight: 600 };
// ── Data ──────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "s1", num: 1, title: "Services",
    body: (
      <>
        <p>School Mentor provides a comprehensive educational technology platform including the following services:</p>
        <ul>
          <li>School ERP with 12 core management modules</li>
          <li>Mobile Applications for principals, teachers, and parents</li>
          <li>Mentor AI for lesson planning, worksheets, and content generation</li>
          <li>Operational Manuals and SOPs</li>
          <li>Teacher Training Systems with monthly workshops</li>
          <li>Communication and Notification Tools</li>
          <li>Academic and Examination Management</li>
        </ul>
        <p>Services may be updated, improved, or expanded over time. We will notify users of significant changes to core features.</p>
      </>
    ),
  },
  {
    id: "s2", num: 2, title: "User Accounts",
    body: (
      <>
        <p>Schools are responsible for managing their platform access. This includes:</p>
        <ul>
          <li>Creating authorized user accounts for all staff and stakeholders</li>
          <li>Managing user permissions and role-based access levels</li>
          <li>Protecting login credentials and enforcing password policies</li>
          <li>Monitoring platform usage within their institution</li>
        </ul>
        <Highlight icon="🔐" text="Users must not share accounts without proper authorization. School Mentor is not liable for unauthorized access resulting from a school's failure to manage credentials appropriately." />
      </>
    ),
  },
  {
    id: "s3", num: 3, title: "Acceptable Use",
    body: (
      <>
        <p>By using School Mentor, users agree to use the platform responsibly and lawfully. Users agree not to:</p>
        <ul>
          <li>Use the platform for any unlawful purpose or in violation of applicable regulations</li>
          <li>Upload harmful, illegal, misleading, or offensive content</li>
          <li>Attempt unauthorized access to any system, account, or data</li>
          <li>Disrupt or interfere with platform operations or other users</li>
          <li>Misuse School Mentor intellectual property, branding, or technology</li>
          <li>Use Mentor AI for unlawful, harmful, or deceptive purposes</li>
        </ul>
        <p>Violations may result in immediate account suspension or termination without prior notice.</p>
      </>
    ),
  },
  {
    id: "s4", num: 4, title: "Mentor AI Disclaimer",
    body: (
      <>
        <p>Mentor AI provides AI-generated assistance and content generation tools to support school operations and teaching activities. Users understand and acknowledge that:</p>
        <ul>
          <li>AI-generated responses and content may not always be fully accurate or complete</li>
          <li>Schools and teachers should review all AI-generated outputs before official use</li>
          <li>School Mentor is not responsible for decisions made solely based on AI-generated content</li>
          <li>AI outputs are tools to assist educators, not replacements for professional judgment</li>
        </ul>
        <Highlight icon="⚠️" text="Always review AI-generated content for accuracy, appropriateness, and curriculum alignment before publishing or distributing it." />
      </>
    ),
  },
  {
    id: "s5", num: 5, title: "Payments and Subscriptions",
    body: (
      <>
        <p>Some School Mentor services require paid subscriptions. Schools agree to the following payment terms:</p>
        <ul>
          <li>Pay all applicable subscription fees on time as per the agreed schedule</li>
          <li>Provide accurate and up-to-date billing information</li>
          <li>Follow agreed payment schedules and terms</li>
          <li>Contact our team promptly for any billing disputes or questions</li>
        </ul>
        <p>Failure to pay may result in limited access or temporary suspension of services. For billing inquiries, contact <a href="mailto:support@schoolmentor.ai" style={linkStyle}>support@schoolmentor.ai</a></p>
      </>
    ),
  },
  {
    id: "s6", num: 6, title: "Intellectual Property",
    body: (
      <>
        <p>All School Mentor software, branding, systems, technology, platform content, logos, and design elements remain the exclusive intellectual property of School Mentor unless otherwise stated in writing.</p>
        <p>Schools retain full ownership of their own institutional data, student records, and content uploaded to the platform. School Mentor does not claim ownership over school-generated content.</p>
        <p>Unauthorized reproduction, modification, distribution, or commercial use of School Mentor intellectual property is strictly prohibited.</p>
      </>
    ),
  },
  {
    id: "s7", num: 7, title: "Service Availability",
    body: (
      <>
        <p>School Mentor aims to provide reliable, high-availability services. However, we do not guarantee uninterrupted availability at all times. Temporary downtime may occur due to:</p>
        <ul>
          <li>Scheduled system maintenance and upgrades</li>
          <li>Technical updates and bug fixes</li>
          <li>Internet connectivity issues</li>
          <li>Third-party service disruptions outside our control</li>
        </ul>
        <p>We will make reasonable efforts to notify users in advance of scheduled maintenance and to minimize unplanned downtime.</p>
      </>
    ),
  },
  {
    id: "s8", num: 8, title: "Limitation of Liability",
    body: (
      <>
        <p>To the fullest extent permitted by applicable law, School Mentor shall not be liable for:</p>
        <ul>
          <li>Indirect, incidental, or consequential losses of any kind</li>
          <li>Data loss caused by user actions or negligence</li>
          <li>Internet or cloud service disruptions beyond our control</li>
          <li>Third-party service failures or outages</li>
          <li>Misuse or over-reliance on AI-generated content</li>
          <li>Unauthorized account access caused by weak password management or user negligence</li>
        </ul>
        <Highlight icon="ℹ️" text="Schools are responsible for verifying all critical operational and academic information before acting on it. School Mentor provides tools to assist, not replace, institutional decision-making." />
      </>
    ),
  },
  {
    id: "s9", num: 9, title: "Account Suspension or Termination",
    body: (
      <>
        <p>School Mentor reserves the right to suspend or terminate accounts involved in any of the following:</p>
        <ul>
          <li>Violations of these Terms and Conditions</li>
          <li>Illegal activities or criminal conduct</li>
          <li>Security threats or attempted breaches</li>
          <li>Misuse of platform services or Mentor AI</li>
        </ul>
        <p>Schools may also request account closure at any time, subject to any outstanding contractual or financial obligations. Upon closure, data will be handled in accordance with our Privacy Policy.</p>
      </>
    ),
  },
  {
    id: "s10", num: 10, title: "Changes and Contact",
    body: (
      <>
        <p>School Mentor may update features, pricing, policies, or these Terms and Conditions at any time. Updated terms will be published on the official website. Continued use of the platform after updates are published constitutes acceptance of the revised terms.</p>
        <p>School Mentor aims to operate according to applicable laws, educational standards, and internationally accepted digital privacy and security practices.</p>
        <ul>
          <li><strong style={{ color: "var(--sm-text)" }}>Website:</strong> <a href="https://www.schoolmentor.ai" target="_blank" rel="noreferrer" style={linkStyle}>www.schoolmentor.ai</a></li>
          <li><strong style={{ color: "var(--sm-text)" }}>Email:</strong> <a href="mailto:support@schoolmentor.ai" style={linkStyle}>support@schoolmentor.ai</a></li>
        </ul>
        <Highlight icon="💬" text="If you have any questions about these Terms and Conditions or need clarification on any point, our team is happy to help. We typically respond within 3 business days." />
      </>
    ),
  },
];

const TOC = [
  { id: "s1", num: 1, label: "Services" },
  { id: "s2", num: 2, label: "User Accounts" },
  { id: "s3", num: 3, label: "Acceptable Use" },
  { id: "s4", num: 4, label: "Mentor AI Disclaimer" },
  { id: "s5", num: 5, label: "Payments and Subscriptions" },
  { id: "s6", num: 6, label: "Intellectual Property" },
  { id: "s7", num: 7, label: "Service Availability" },
  { id: "s8", num: 8, label: "Limitation of Liability" },
  { id: "s9", num: 9, label: "Account Suspension or Termination" },
  { id: "s10", num: 10, label: "Changes and Contact" },
];


// ── Highlight box ─────────────────────────────────────────────────
function Highlight({ icon, text }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(21,101,192,.05),rgba(29,184,138,.04))",
      border: "1.5px solid rgba(21,101,192,.12)", borderRadius: 14,
      padding: "14px 18px", margin: "14px 0",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <span style={{ fontSize: 19, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <span style={{ fontSize: 13.5, color: "var(--sm-text)", lineHeight: 1.65, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────
function SectionCard({ section, visible }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      id={section.id}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)", border: `1px solid ${hov ? "rgba(21,101,192,.14)" : "var(--sm-border)"}`,
        borderRadius: 20, padding: "28px 32px", marginBottom: 16,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity .5s ease, transform .5s ease, box-shadow .3s ease, border-color .3s ease",
        boxShadow: hov ? "0 14px 40px rgba(21,101,192,.09)" : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 15 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: "linear-gradient(135deg,#1565C0,#1DB88A)",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800,
          boxShadow: "0 4px 12px rgba(21,101,192,.22)",
          transform: hov ? "scale(1.08) rotate(-6deg)" : "scale(1)",
          transition: "transform .3s ease",
        }}>
          {section.num}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--sm-text)", lineHeight: 1.2 }}>
          {section.title}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--sm-border)", marginBottom: 16 }} />

      {/* Body */}
      <div style={{ fontSize: 14, color: "var(--sm-text-muted)", lineHeight: 1.9 }}>
        <style>{`
          .tc-body p { margin-bottom: 13px; }
          .tc-body p:last-child { margin-bottom: 0; }
          .tc-body ul { list-style: none; padding: 0; margin: 10px 0 12px; }
          .tc-body ul li {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 7px 0; border-bottom: 1px solid var(--sm-border);
            font-size: 13.5px; color: var(--sm-text-muted); line-height: 1.65;
          }
          .tc-body ul li:last-child { border-bottom: none; padding-bottom: 0; }
          .tc-body ul li::before {
            content: ''; width: 7px; height: 7px; border-radius: 50%;
            flex-shrink: 0; margin-top: 7px;
            background: linear-gradient(135deg, #1565C0, #1DB88A);
          }
        `}</style>
        <div className="tc-body">{section.body}</div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export default function TermsAndConditions({ onBack }) {
  const [activeId, setActiveId] = useState("s1");
  const [visibleIds, setVisibleIds] = useState(new Set(["s1"]));
  const sectionRefs = useRef({});

  // Intersection observer for scroll animations & TOC highlight
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleIds(prev => new Set([...prev, entry.target.id]));
          setActiveId(entry.target.id);
        }
      });
    }, { threshold: 0.08, rootMargin: "-64px 0px -40% 0px" });

    document.querySelectorAll("[id^='s']").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--sm-bg)", color: "var(--sm-text)", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes tcShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes tcFadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tcOrbF    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,10px)} }
        @keyframes tcDot     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Sticky Nav ── */}


      {/* ── Hero ── */}
      <div style={{
        background: "linear-gradient(135deg,#1565C0 0%,#1178a8 55%,#1DB88A 100%)",
        padding: "60px 44px 68px", position: "relative", overflow: "hidden",
      }}>
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        {/* Orbs */}
        <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", top: -160, right: -80, background: "radial-gradient(circle,rgba(255,255,255,.08),transparent 65%)", animation: "tcOrbF 9s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", bottom: -110, left: -60, background: "radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)", animation: "tcOrbF 11s ease-in-out infinite reverse", pointerEvents: "none" }} />
        {/* Shimmer line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.15),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "tcShimmer 3.5s linear infinite" }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.28)",
            borderRadius: 100, padding: "6px 16px 6px 10px", marginBottom: 20,
            fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            color: "rgba(255,255,255,.92)", animation: "tcFadeUp .6s ease .05s both",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,.9)", animation: "tcDot 2s ease-in-out infinite", flexShrink: 0 }} />
            Legal Document
          </div>

          <h1 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: -1, marginBottom: 14, animation: "tcFadeUp .6s ease .12s both" }}>
            Terms &amp; Conditions
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.78)", lineHeight: 1.75, maxWidth: 600, margin: "0 auto", animation: "tcFadeUp .6s ease .2s both" }}>
            These Terms and Conditions govern the use of School Mentor ERP, Mobile Applications, Mentor AI, and all related services. By using School Mentor, users agree to these terms.
          </p>

          {/* Meta chips */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap", animation: "tcFadeUp .6s ease .28s both" }}>
            {["📅 May 2026", "🏢 School Mentor®", "⚖️ Legally Binding"].map((chip, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 100, padding: "5px 13px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.88)" }}>
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr",
        gap: 28, maxWidth: "clamp(1200px, 90vw, 1600px)", margin: "0 auto",
        padding: "32px 24px 60px", alignItems: "start",
      }}>

        {/* TOC Sidebar */}
        <aside style={{
          position: "sticky", top: 80,
          background: "var(--sm-surface)", border: "1px solid var(--sm-border)",
          borderRadius: 20, padding: "20px 16px",
          boxShadow: "0 4px 24px rgba(21,101,192,.06)",
          animation: "tcFadeUp .65s ease .3s both",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "var(--sm-text-muted)", paddingBottom: 12, borderBottom: "1px solid var(--sm-border)", marginBottom: 10 }}>
            Table of Contents
          </div>
          {TOC.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                onClick={(e) => { e.preventDefault(); scrollTo(item.id); }}
                href={`#${item.id}`}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "7px 9px", borderRadius: 10,
                  fontSize: 12, fontWeight: 600,
                  color: isActive ? "var(--sm-navy)" : "var(--sm-text-muted)",
                  background: isActive ? "rgba(21,101,192,.1)" : "transparent",
                  textDecoration: "none", transition: "all .2s ease",
                  marginBottom: 2, lineHeight: 1.35, cursor: "pointer",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, marginTop: 1,
                  background: isActive ? "var(--sm-navy)" : "rgba(21,101,192,.1)",
                  color: isActive ? "#fff" : "var(--sm-navy)",
                  transition: "all .2s ease",
                }}>
                  {item.num}
                </span>
                {item.label}
              </a>
            );
          })}
        </aside>

        {/* Content area */}
        <div style={{ minWidth: 0, animation: "tcFadeUp .6s ease .4s both" }}>
          {/* Updated badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(29,184,138,.08)", border: "1px solid rgba(29,184,138,.2)",
            borderRadius: 100, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, color: "#0D7A5F", marginBottom: 20,
          }}>
            ✓ Last Updated: May 2026
          </div>

          {/* Intro box */}
          <div style={{
            background: "linear-gradient(135deg,rgba(21,101,192,.05),rgba(29,184,138,.04))",
            border: "1.5px solid rgba(21,101,192,.11)", borderRadius: 16,
            padding: "16px 20px", marginBottom: 24,
            display: "flex", alignItems: "flex-start", gap: 13,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>📋</span>
            <div style={{ fontSize: 13.5, color: "var(--sm-text)", lineHeight: 1.7, fontWeight: 500 }}>
              By using School Mentor, users agree to these terms. Please read this document carefully. Questions? Contact us at{" "}
              <a href="mailto:support@schoolmentor.ai" style={linkStyle}>support@schoolmentor.ai</a>
            </div>
          </div>

          {/* Section cards */}
          {SECTIONS.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              visible={visibleIds.has(section.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        background: "#0d1b2e", padding: "22px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)" }}>© 2026 SchoolMentor®. All rights reserved.</div>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Privacy Policy", href: "#" },
            { label: "Website", href: "https://www.schoolmentor.ai", target: "_blank" },
          ].map((l) => (
            <a key={l.label} href={l.href} target={l.target} rel="noreferrer"
              style={{ fontSize: 13, color: "rgba(255,255,255,.5)", textDecoration: "none", transition: "color .2s ease" }}
              onMouseEnter={e => e.currentTarget.style.color = "#fff"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
