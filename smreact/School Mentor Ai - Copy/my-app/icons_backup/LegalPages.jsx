import { useState, useEffect, useRef, useCallback } from "react";

// ── Shared data ───────────────────────────────────────────────────
const CONTACT_INFO = {
  website: "https://www.schoolmentor.ai",
  email: "support@schoolmentor.ai",
};

// ── Helper components ─────────────────────────────────────────────
function BulletList({ items }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 12px" }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "7px 0",
          borderBottom: i < items.length - 1 ? "1px solid var(--sm-border)" : "none",
          fontSize: 13.5, color: "var(--sm-text-muted)", lineHeight: 1.65,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 7,
            background: "linear-gradient(135deg,#1565C0,#1DB88A)",
            display: "inline-block",
          }} />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

function HighlightBox({ icon, children }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(21,101,192,.05),rgba(29,184,138,.04))",
      border: "1.5px solid rgba(21,101,192,.12)",
      borderRadius: 14, padding: "14px 18px", margin: "14px 0",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <span style={{ fontSize: 19, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ fontSize: 13.5, color: "var(--sm-text)", lineHeight: 1.65, fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
}

function SecBody({ children }) {
  return (
    <div style={{ fontSize: 14, color: "var(--sm-text-muted)", lineHeight: 1.9 }}>
      {children}
    </div>
  );
}

function SecPara({ children }) {
  return <p style={{ marginBottom: 13 }}>{children}</p>;
}

// ── PRIVACY POLICY content ────────────────────────────────────────
const PP_SECTIONS = [
  {
    id: "s1", title: "Information We Collect",
    content: (
      <SecBody>
        <SecPara>School Mentor may collect the following types of information to provide its services:</SecPara>
        <BulletList items={[
          "<strong style='color:var(--sm-text);font-weight:700'>School Information:</strong> School name, campus details, branding assets, and official contact information",
          "<strong style='color:var(--sm-text);font-weight:700'>User Information:</strong> Principal, teacher, parent, and student records",
          "<strong style='color:var(--sm-text);font-weight:700'>Contact Details:</strong> Phone numbers of schools, staff, parents, and authorized users",
          "<strong style='color:var(--sm-text);font-weight:700'>Email Addresses:</strong> Optional, used for communication, notifications, and support",
          "<strong style='color:var(--sm-text);font-weight:700'>Bank Account Details:</strong> Official school bank information for fee collection, challan generation, banking integrations, and payment operations",
          "<strong style='color:var(--sm-text);font-weight:700'>Academic Information:</strong> Attendance, examinations, lesson plans, homework, results, submissions, calendars, and academic reports",
          "<strong style='color:var(--sm-text);font-weight:700'>Technical Information:</strong> Device details, browser data, IP addresses, activity logs, and usage analytics",
          "<strong style='color:var(--sm-text);font-weight:700'>AI Content:</strong> Text, images, PDFs, worksheets, and educational material uploaded through Mentor AI features",
        ]} />
      </SecBody>
    ),
  },
  {
    id: "s2", title: "How We Use Information",
    content: (
      <SecBody>
        <SecPara>School Mentor uses collected information to deliver and improve its platform. We use your data to:</SecPara>
        <BulletList items={[
          "Provide ERP, mobile app, and Mentor AI services",
          "Manage school operations and academic workflows",
          "Generate AI-based educational content",
          "Improve system performance and user experience",
          "Provide technical support and onboarding services",
          "Send notifications, alerts, and important updates",
          "Improve security, monitoring, and operational efficiency",
        ]} />
        <HighlightBox icon="✅">
          <strong>We do not sell personal data to third parties.</strong> Your information is used solely to operate and improve the School Mentor platform.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s3", title: "Data Security",
    content: (
      <SecBody>
        <SecPara>School Mentor applies reasonable and industry-standard security measures to protect all user data:</SecPara>
        <BulletList items={[
          "Secure cloud infrastructure with redundancy",
          "Access controls and role-based user permissions",
          "Activity logs and monitoring",
          "Backup and recovery systems",
          "Encrypted communication where applicable",
        ]} />
        <HighlightBox icon="🔐">
          Only authorized users are allowed to access institutional data. All access is governed by strict permission levels set by school administrators.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s4", title: "Data Ownership",
    content: (
      <SecBody>
        <SecPara>All school-related data belongs to the respective school or institution. School Mentor acts solely as a technology service provider and processes information on behalf of schools.</SecPara>
        <SecPara>Schools retain full ownership and control over their institutional data at all times. Upon account termination, schools may request export or deletion of their data.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s5", title: "Mentor AI Usage",
    content: (
      <SecBody>
        <SecPara>Mentor AI may process uploaded educational content to generate AI-powered outputs including:</SecPara>
        <BulletList items={[
          "Lesson plans aligned to your curriculum",
          "Customized worksheets for any class or topic",
          "Question banks and exam papers",
          "Social media content for school promotion",
          "Academic support material and summaries",
        ]} />
        <HighlightBox icon="⚠️">
          Users should review all AI-generated content before official use. School Mentor is not responsible for decisions made solely based on AI outputs.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s6", title: "Communication",
    content: (
      <SecBody>
        <SecPara>School Mentor may send communications to users as part of normal platform operations:</SecPara>
        <BulletList items={[
          "SMS notifications for attendance, fees, and announcements",
          "Emails for support, onboarding, and billing",
          "Push notifications via mobile apps",
          "In-app alerts and announcements",
        ]} />
        <SecPara>All communications relate to school operations, platform updates, support activities, and important service notifications.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s7", title: "Third-Party Services",
    content: (
      <SecBody>
        <SecPara>School Mentor may use trusted third-party service providers to support platform operations. These providers may process limited information strictly to support platform functionality:</SecPara>
        <BulletList items={[
          "Cloud hosting and infrastructure providers",
          "Payment gateways for fee collection",
          "Analytics platforms for usage insights",
          "Communication systems for SMS and email delivery",
          "AI processing services for Mentor AI features",
        ]} />
        <SecPara>All third-party providers operate under strict confidentiality agreements with School Mentor.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s8", title: "International Usage",
    content: (
      <SecBody>
        <SecPara>School Mentor may serve schools globally. User data may be processed on secure cloud infrastructure located in different regions according to operational requirements.</SecPara>
        <SecPara>Regardless of where data is processed, it remains subject to the same high standards of security and privacy described in this policy.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s9", title: "User Responsibilities",
    content: (
      <SecBody>
        <SecPara>While School Mentor takes every measure to protect your data, users also play an important role:</SecPara>
        <BulletList items={[
          "Maintaining strong password security and not sharing credentials",
          "Managing user permissions and access levels within their school account",
          "Using the platform lawfully and in accordance with these policies",
          "Reviewing AI-generated content before official use or publication",
        ]} />
      </SecBody>
    ),
  },
  {
    id: "s10", title: "Updates and Contact",
    content: (
      <SecBody>
        <SecPara>School Mentor may update this Privacy Policy from time to time. Updated versions will be published on the official website with a revised date. Continued use of the platform constitutes acceptance of the revised policy.</SecPara>
        <BulletList items={[
          `<strong style='color:var(--sm-text);font-weight:700'>Website:</strong> <a href="${CONTACT_INFO.website}" target="_blank" style="color:var(--sm-navy);font-weight:600">${CONTACT_INFO.website}</a>`,
          `<strong style='color:var(--sm-text);font-weight:700'>Email:</strong> <a href="mailto:${CONTACT_INFO.email}" style="color:var(--sm-navy);font-weight:600">${CONTACT_INFO.email}</a>`,
        ]} />
        <HighlightBox icon="💬">
          For any privacy concerns, data requests, or questions, please reach out to our team. We aim to respond to all inquiries within 3 business days.
        </HighlightBox>
      </SecBody>
    ),
  },
];

// ── TERMS & CONDITIONS content ────────────────────────────────────
const TC_SECTIONS = [
  {
    id: "s1", title: "Services",
    content: (
      <SecBody>
        <SecPara>School Mentor provides a comprehensive educational technology platform including the following services:</SecPara>
        <BulletList items={[
          "School ERP with 12 core management modules",
          "Mobile Applications for principals, teachers, and parents",
          "Mentor AI for lesson planning, worksheets, and content generation",
          "Operational Manuals and SOPs",
          "Teacher Training Systems with monthly workshops",
          "Communication and Notification Tools",
          "Academic and Examination Management",
        ]} />
        <SecPara>Services may be updated, improved, or expanded over time. We will notify users of significant changes to core features.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s2", title: "User Accounts",
    content: (
      <SecBody>
        <SecPara>Schools are responsible for managing their platform access. This includes:</SecPara>
        <BulletList items={[
          "Creating authorized user accounts for all staff and stakeholders",
          "Managing user permissions and role-based access levels",
          "Protecting login credentials and enforcing password policies",
          "Monitoring platform usage within their institution",
        ]} />
        <HighlightBox icon="🔐">
          Users must not share accounts without proper authorization. School Mentor is not liable for unauthorized access resulting from a school's failure to manage credentials appropriately.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s3", title: "Acceptable Use",
    content: (
      <SecBody>
        <SecPara>By using School Mentor, users agree to use the platform responsibly and lawfully. Users agree not to:</SecPara>
        <BulletList items={[
          "Use the platform for any unlawful purpose or in violation of applicable regulations",
          "Upload harmful, illegal, misleading, or offensive content",
          "Attempt unauthorized access to any system, account, or data",
          "Disrupt or interfere with platform operations or other users",
          "Misuse School Mentor intellectual property, branding, or technology",
          "Use Mentor AI for unlawful, harmful, or deceptive purposes",
        ]} />
        <SecPara>Violations may result in immediate account suspension or termination without prior notice.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s4", title: "Mentor AI Disclaimer",
    content: (
      <SecBody>
        <SecPara>Mentor AI provides AI-generated assistance and content generation tools to support school operations and teaching activities. Users understand and acknowledge that:</SecPara>
        <BulletList items={[
          "AI-generated responses and content may not always be fully accurate or complete",
          "Schools and teachers should review all AI-generated outputs before official use",
          "School Mentor is not responsible for decisions made solely based on AI-generated content",
          "AI outputs are tools to assist educators, not replacements for professional judgment",
        ]} />
        <HighlightBox icon="⚠️">
          Always review AI-generated content for accuracy, appropriateness, and curriculum alignment before publishing or distributing it.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s5", title: "Payments and Subscriptions",
    content: (
      <SecBody>
        <SecPara>Some School Mentor services require paid subscriptions. Schools agree to the following payment terms:</SecPara>
        <BulletList items={[
          "Pay all applicable subscription fees on time as per the agreed schedule",
          "Provide accurate and up-to-date billing information",
          "Follow agreed payment schedules and terms",
          "Contact our team promptly for any billing disputes or questions",
        ]} />
        <SecPara>Failure to pay may result in limited access or temporary suspension of services. For billing inquiries, contact <a href={`mailto:${CONTACT_INFO.email}`} style={{ color: "var(--sm-navy)", fontWeight: 600 }}>{CONTACT_INFO.email}</a></SecPara>
      </SecBody>
    ),
  },
  {
    id: "s6", title: "Intellectual Property",
    content: (
      <SecBody>
        <SecPara>All School Mentor software, branding, systems, technology, platform content, logos, and design elements remain the exclusive intellectual property of School Mentor unless otherwise stated in writing.</SecPara>
        <SecPara>Schools retain full ownership of their own institutional data, student records, and content uploaded to the platform. School Mentor does not claim ownership over school-generated content.</SecPara>
        <SecPara>Unauthorized reproduction, modification, distribution, or commercial use of School Mentor intellectual property is strictly prohibited.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s7", title: "Service Availability",
    content: (
      <SecBody>
        <SecPara>School Mentor aims to provide reliable, high-availability services. However, we do not guarantee uninterrupted availability at all times. Temporary downtime may occur due to:</SecPara>
        <BulletList items={[
          "Scheduled system maintenance and upgrades",
          "Technical updates and bug fixes",
          "Internet connectivity issues",
          "Third-party service disruptions outside our control",
        ]} />
        <SecPara>We will make reasonable efforts to notify users in advance of scheduled maintenance and to minimize unplanned downtime.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s8", title: "Limitation of Liability",
    content: (
      <SecBody>
        <SecPara>To the fullest extent permitted by applicable law, School Mentor shall not be liable for:</SecPara>
        <BulletList items={[
          "Indirect, incidental, or consequential losses of any kind",
          "Data loss caused by user actions or negligence",
          "Internet or cloud service disruptions beyond our control",
          "Third-party service failures or outages",
          "Misuse or over-reliance on AI-generated content",
          "Unauthorized account access caused by weak password management or user negligence",
        ]} />
        <HighlightBox icon="ℹ️">
          Schools are responsible for verifying all critical operational and academic information before acting on it. School Mentor provides tools to assist, not replace, institutional decision-making.
        </HighlightBox>
      </SecBody>
    ),
  },
  {
    id: "s9", title: "Account Suspension or Termination",
    content: (
      <SecBody>
        <SecPara>School Mentor reserves the right to suspend or terminate accounts involved in any of the following:</SecPara>
        <BulletList items={[
          "Violations of these Terms and Conditions",
          "Illegal activities or criminal conduct",
          "Security threats or attempted breaches",
          "Misuse of platform services or Mentor AI",
        ]} />
        <SecPara>Schools may also request account closure at any time, subject to any outstanding contractual or financial obligations. Upon closure, data will be handled in accordance with our Privacy Policy.</SecPara>
      </SecBody>
    ),
  },
  {
    id: "s10", title: "Changes and Contact",
    content: (
      <SecBody>
        <SecPara>School Mentor may update features, pricing, policies, or these Terms and Conditions at any time. Updated terms will be published on the official website. Continued use of the platform after updates are published constitutes acceptance of the revised terms.</SecPara>
        <SecPara>School Mentor aims to operate according to applicable laws, educational standards, and internationally accepted digital privacy and security practices.</SecPara>
        <BulletList items={[
          `<strong style='color:var(--sm-text);font-weight:700'>Website:</strong> <a href="${CONTACT_INFO.website}" target="_blank" style="color:var(--sm-navy);font-weight:600">${CONTACT_INFO.website}</a>`,
          `<strong style='color:var(--sm-text);font-weight:700'>Email:</strong> <a href="mailto:${CONTACT_INFO.email}" style="color:var(--sm-navy);font-weight:600">${CONTACT_INFO.email}</a>`,
        ]} />
        <HighlightBox icon="💬">
          If you have any questions about these Terms and Conditions or need clarification on any point, our team is happy to help. We typically respond within 3 business days.
        </HighlightBox>
      </SecBody>
    ),
  },
];

// ── PAGE CONFIG ───────────────────────────────────────────────────
const PAGES = {
  privacy: {
    navTitle: "Privacy Policy",
    badgeLabel: "Privacy Document",
    title: "Privacy Policy",
    subtitle: "School Mentor values the privacy and security of schools, students, parents, teachers, and all users of our platform. This policy explains how we collect, use, store, and protect your information.",
    heroGradient: "linear-gradient(135deg,#0D7A5F 0%,#1DB88A 55%,#1565C0 100%)",
    metaChips: ["📅 May 2026", "🔒 Data Protected", "🛡️ No Data Selling"],
    sections: PP_SECTIONS,
    accentRgb: "29,184,138",
    accentDark: "#0D7A5F",
    otherPage: "terms",
    otherLabel: "Terms of Use",
  },
  terms: {
    navTitle: "Terms & Conditions",
    badgeLabel: "Legal Document",
    title: "Terms & Conditions",
    subtitle: "These Terms and Conditions govern the use of School Mentor ERP, Mobile Applications, Mentor AI, and all related services. By using School Mentor, users agree to these terms.",
    heroGradient: "linear-gradient(135deg,#1565C0 0%,#1178a8 55%,#1DB88A 100%)",
    metaChips: ["📅 May 2026", "🏢 School Mentor®", "⚖️ Legally Binding"],
    sections: TC_SECTIONS,
    accentRgb: "21,101,192",
    accentDark: "#1565C0",
    otherPage: "privacy",
    otherLabel: "Privacy Policy",
  },
};

// ── Hooks ─────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    let t;
    const h = () => { clearTimeout(t); t = setTimeout(() => setW(window.innerWidth), 150); };
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("resize", h); clearTimeout(t); };
  }, []);
  return w;
}

// ── Section card ──────────────────────────────────────────────────
function SectionCard({ section, index, accentDark }) {
  const [hov, setHov] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "rgba(21,101,192,.14)" : "var(--sm-border)"}`,
        borderRadius: 20, padding: "28px 32px", marginBottom: 16,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? "0 14px 40px rgba(21,101,192,.09)" : "0 2px 10px rgba(21,101,192,.04)",
        transition: "all .3s ease",
        opacity: visible ? 1 : 0,
        animation: visible ? `lgSecIn .5s ease ${index * 0.06}s both` : "none",
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
          {index + 1}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--sm-text)", lineHeight: 1.2 }}>
          {section.title}
        </div>
      </div>
      {/* Divider */}
      <div style={{ height: 1, background: "var(--sm-border)", marginBottom: 16 }} />
      {/* Content */}
      {section.content}
    </div>
  );
}

// ── TOC item ──────────────────────────────────────────────────────
function TocItem({ title, index, active, accentDark, accentRgb, onClick }) {
  const [hov, setHov] = useState(false);
  const on = active || hov;
  return (
    <a
      href={`#s${index + 1}`}
      onClick={(e) => { e.preventDefault(); onClick(index); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "7px 9px", borderRadius: 10,
        fontSize: 12, fontWeight: 600,
        color: on ? accentDark : "var(--sm-text-muted)",
        background: on ? `rgba(${accentRgb},.09)` : "transparent",
        textDecoration: "none", marginBottom: 2, lineHeight: 1.35,
        transition: "all .2s ease", cursor: "pointer",
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 800, marginTop: 1,
        background: on ? accentDark : `rgba(${accentRgb},.1)`,
        color: on ? "#fff" : accentDark,
        transition: "all .2s ease",
      }}>
        {index + 1}
      </span>
      {title}
    </a>
  );
}

// ── Legal Page Layout ─────────────────────────────────────────────
function LegalPage({ pageKey, onNavigate }) {
  const page = PAGES[pageKey];
  const [activeSec, setActiveSec] = useState(0);
  const width = useWindowWidth();
  const isMobile = width <= 600;
  const isTablet = width <= 780;

  // Scroll to section
  const scrollToSection = useCallback((index) => {
    const el = document.getElementById(`s${index + 1}`);
    if (el) {
      const offset = 90;
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActiveSec(index);
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const secs = page.sections.map((_, i) => document.getElementById(`s${i + 1}`));
      let found = 0;
      secs.forEach((el, i) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) found = i;
        }
      });
      setActiveSec(found);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [page.sections]);

  // Reset scroll on page change
  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveSec(0);
  }, [pageKey]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes lgShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes lgFadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lgOrbF    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,10px)} }
        @keyframes lgDot     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }
        @keyframes lgSecIn   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--sm-bg)", minHeight: "100vh", color: "var(--sm-text)" }}>

        {/* ── NAV ── */}
        <nav style={{
          background: "var(--sm-surface)", borderBottom: "1px solid var(--sm-border)",
          padding: `0 ${isMobile ? 14 : 40}px`, height: isMobile ? 58 : 64,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 2px 12px rgba(21,101,192,.07)",
          animation: "lgFadeUp .4s ease both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#1565C0,#1DB88A)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              boxShadow: "0 4px 12px rgba(21,101,192,.25)",
            }}>🎓</div>
            <div>
              <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: "var(--sm-text)" }}>
                <span style={{ fontWeight: 400 }}>School</span>
                <span style={{ color: "#1DB88A" }}>Mentor</span>
              </div>
              {!isMobile && <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 500, letterSpacing: ".5px" }}>Creating the Future</div>}
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate("home")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: isMobile ? "6px 12px" : "8px 16px", borderRadius: 10,
              fontSize: isMobile ? 12 : 13, fontWeight: 600, color: "var(--sm-navy)",
              background: "rgba(21,101,192,.07)", border: "1px solid rgba(21,101,192,.15)",
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              transition: "all .25s ease",
            }}
            onMouseEnter={e => { e.target.style.background = "rgba(21,101,192,.14)"; e.target.style.transform = "translateX(-3px)"; }}
            onMouseLeave={e => { e.target.style.background = "rgba(21,101,192,.07)"; e.target.style.transform = "none"; }}
          >
            ← Back to Home
          </button>
        </nav>

        {/* ── HERO ── */}
        <div style={{ background: page.heroGradient, padding: isMobile ? "40px 16px 50px" : "60px 44px 68px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", top: -160, right: -80, background: "radial-gradient(circle,rgba(255,255,255,.08),transparent 65%)", animation: "lgOrbF 9s ease-in-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", bottom: -110, left: -60, background: "radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)", animation: "lgOrbF 11s ease-in-out infinite reverse", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.15),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "lgShimmer 3.5s linear infinite" }} />

          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 100, padding: "6px 16px 6px 10px", marginBottom: 20, fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.92)", animation: "lgFadeUp .6s ease .05s both" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,.9)", animation: "lgDot 2s ease-in-out infinite", flexShrink: 0, display: "inline-block" }} />
              {page.badgeLabel}
            </div>
            <h1 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: -1, marginBottom: 14, animation: "lgFadeUp .6s ease .12s both" }}>
              {page.title}
            </h1>
            <p style={{ fontSize: isMobile ? 14 : 15, color: "rgba(255,255,255,.78)", lineHeight: 1.75, maxWidth: 600, margin: "0 auto", animation: "lgFadeUp .6s ease .2s both" }}>
              {page.subtitle}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap", animation: "lgFadeUp .6s ease .28s both" }}>
              {page.metaChips.map((c, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 100, padding: "5px 13px", fontSize: isMobile ? 11 : 12, fontWeight: 600, color: "rgba(255,255,255,.88)" }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── PAGE BODY ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "260px 1fr",
          gap: isTablet ? 0 : 28,
          maxWidth: "clamp(1200px, 90vw, 1600px)", margin: "0 auto",
          padding: isMobile ? "20px 14px 48px" : isTablet ? "24px 20px 56px" : "32px 24px 60px",
          alignItems: "start",
        }}>

          {/* TOC Sidebar */}
          <aside style={{
            ...(isTablet ? {
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: "4px 10px",
              background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 16,
              padding: "16px", marginBottom: 20,
              boxShadow: "0 4px 20px rgba(21,101,192,.06)",
            } : {
              position: "sticky", top: 78,
              background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 20,
              padding: "20px 16px",
              boxShadow: "0 4px 24px rgba(21,101,192,.06)",
              animation: "lgFadeUp .65s ease .3s both",
            }),
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
              color: "var(--sm-text-muted)", paddingBottom: 12, borderBottom: "1px solid var(--sm-border)", marginBottom: 10,
              ...(isTablet ? { gridColumn: "1 / -1", marginBottom: 6 } : {}),
            }}>
              Table of Contents
            </div>
            {page.sections.map((s, i) => (
              <TocItem
                key={s.id} title={s.title} index={i}
                active={activeSec === i}
                accentDark={page.accentDark}
                accentRgb={page.accentRgb}
                onClick={scrollToSection}
              />
            ))}
          </aside>

          {/* Content */}
          <div style={{ minWidth: 0, animation: "lgFadeUp .6s ease .4s both" }}>
            {/* Updated badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(29,184,138,.08)", border: "1px solid rgba(29,184,138,.2)", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#0D7A5F", marginBottom: 20 }}>
              ✓ Last Updated: May 2026
            </div>

            {/* Intro box */}
            <div style={{ background: "linear-gradient(135deg,rgba(21,101,192,.05),rgba(29,184,138,.04))", border: "1.5px solid rgba(21,101,192,.11)", borderRadius: 16, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 13 }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>📋</span>
              <div style={{ fontSize: 13.5, color: "var(--sm-text)", lineHeight: 1.7, fontWeight: 500 }}>
                By using School Mentor, users agree to these terms. Please read this document carefully. Questions? Contact us at{" "}
                <a href={`mailto:${CONTACT_INFO.email}`} style={{ color: "var(--sm-navy)", fontWeight: 700 }}>{CONTACT_INFO.email}</a>
              </div>
            </div>

            {/* Section cards */}
            {page.sections.map((s, i) => (
              <div id={s.id} key={s.id}>
                <SectionCard section={s} index={i} accentDark={page.accentDark} />
              </div>
            ))}

            {/* Bottom nav link */}
            <div style={{ marginTop: 8, textAlign: "center", padding: "24px 0 8px", borderTop: "1px solid var(--sm-border)" }}>
              <span style={{ fontSize: 13, color: "var(--sm-text-muted)" }}>Also read our{" "}</span>
              <button
                onClick={() => onNavigate && onNavigate(page.otherPage)}
                style={{ background: "none", border: "none", color: "var(--sm-navy)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                {page.otherLabel}
              </button>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: "#0d1b2e", padding: isMobile ? "18px 16px" : "22px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)" }}>© 2026 SchoolMentor®. All rights reserved.</div>
          <div style={{ display: "flex", gap: 20 }}>
            <button onClick={() => onNavigate && onNavigate(page.otherPage)} style={{ background: "none", border: "none", fontSize: 13, color: "rgba(255,255,255,.5)", cursor: "pointer", fontFamily: "inherit", transition: "color .2s ease" }} onMouseEnter={e => e.target.style.color="#fff"} onMouseLeave={e => e.target.style.color="rgba(255,255,255,.5)"}>{page.otherLabel}</button>
            <a href={CONTACT_INFO.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "rgba(255,255,255,.5)", textDecoration: "none", transition: "color .2s ease" }} onMouseEnter={e => e.target.style.color="#fff"} onMouseLeave={e => e.target.style.color="rgba(255,255,255,.5)"}>Website</a>
          </div>
        </div>

      </div>
    </>
  );
}

// ── Main export — handles which page to show ──────────────────────
export default function LegalPages({ initialPage = "privacy", onNavigate }) {
  const [page, setPage] = useState(initialPage);

  const handleNavigate = (dest) => {
    if (dest === "privacy" || dest === "terms") {
      setPage(dest);
    } else if (onNavigate) {
      onNavigate(dest);
    }
  };

  return <LegalPage pageKey={page} onNavigate={handleNavigate} />;
}

// ── Individual page exports for routing ──────────────────────────
export function PrivacyPage({ onNavigate }) {
  return <LegalPage pageKey="privacy" onNavigate={onNavigate} />;
}
export function TermsPage({ onNavigate }) {
  return <LegalPage pageKey="terms" onNavigate={onNavigate} />;
}
