import { useState, useEffect, useRef } from "react";
import Tab0_SchoolMentorERP from "./Tab0_SchoolMentorERP";
import Tab1_MobileApp from "./Tab1_MobileApp";
import Tab2_OperationalManuals from "./Tab2_OperationalManuals";
import Tab3_TeacherTrainings from "./Tab3_TeacherTrainings";
import Tab4_MentorAI from "./Tab4_MentorAI";
import Tab5_HeadOfficeSupport from "./Tab5_HeadOfficeSupport";

// ── SVG Icons ─────────────────────────────────────────────────────────────────

// App store links — replace these with your real store URLs
const STORE_LINKS = {
  appStore: "https://apps.apple.com/us/app/school-mentor/id6753690453",
  playStore: "https://play.google.com/store/apps/details?id=com.education.newschoolmentor",
};

// Social media links
const SOCIAL_LINKS = {
  Instagram: "https://www.instagram.com/schoolmentor2023/",
  Facebook: "https://www.facebook.com/schoolmentor2023",
  LinkedIn: "https://www.linkedin.com/company/school-mentor-ces/",
  YouTube: "https://www.youtube.com/@SchoolMentor1",
};

const Icons = {
  Apple: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  ),
  GooglePlay: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814 13.792 12 3.61 22.186a1.04 1.04 0 0 1-.61-.96V2.774c0-.397.244-.74.609-.96zM14.91 13.118l2.604 2.604-9.42 5.318 6.816-7.922zm0-2.236L8.094 2.96l9.42 5.318-2.604 2.604zM20.5 12c0 .47-.247.91-.65 1.146l-2.42 1.367-2.81-2.51 2.81-2.51 2.42 1.36c.403.236.65.677.65 1.147z" />
    </svg>
  ),
  Instagram: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  Facebook: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  LinkedIn: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
    </svg>
  ),
  YouTube: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  ),
  Mail: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Phone: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.19a16 16 0 0 0 5.72 5.72l1.28-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
    </svg>
  ),
  MapPin: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Globe: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  ArrowUpRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

// ── Data ──────────────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "Home", page: "home" },
  { label: "About Us", page: "about" },
  { label: "Pricing", page: "pricing" },
  { label: "FAQ's", page: "faq" },
  { label: "Success Stories", page: "success" },
  { label: "Contact Us", page: "contact" },
  { label: "Privacy Policy", page: "privacy" },
  { label: "Terms & Condition", page: "terms" },
];

const SERVICES = [
  { label: "School Mentor ERP", page: "erp" },
  { label: "School Mentor Mobile App", page: "mobile" },
  { label: "School Operational Manuals", page: "manuals" },
  { label: "Teachers Trainings", page: "trainings" },
  { label: "School Mentor AI", page: "ai" },
  { label: "Head Office Support", page: "headoffice" },
];

// Map service page key → Tab component
const SERVICE_COMPONENTS = {
  erp: Tab0_SchoolMentorERP,
  mobile: Tab1_MobileApp,
  manuals: Tab2_OperationalManuals,
  trainings: Tab3_TeacherTrainings,
  ai: Tab4_MentorAI,
  headoffice: Tab5_HeadOfficeSupport,
};

const SERVICE_PAGES = Object.keys(SERVICE_COMPONENTS);

const SOCIALS = [
  { Icon: Icons.Instagram, label: "Instagram", color: "#E4405F", href: SOCIAL_LINKS.Instagram },
  { Icon: Icons.Facebook, label: "Facebook", color: "#1877F2", href: SOCIAL_LINKS.Facebook },
  { Icon: Icons.LinkedIn, label: "LinkedIn", color: "#0A66C2", href: SOCIAL_LINKS.LinkedIn },
  { Icon: Icons.YouTube, label: "YouTube", color: "#FF0000", href: SOCIAL_LINKS.YouTube },
];

const OFFICES = [
  { flag: "🇵🇰", text: "Floors 3–5, Paradise Commercial, Bahria Phase–IV, Islamabad" },
  { flag: "🇦🇪", text: "J&P Signal, Industrial Area 6, Sharjah – UAE" },
  { flag: "🇺🇸", text: "2817 Eagandale Blvd, Eagan, MN 55121, USA" },
];

// ── useInView hook ────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ── Social Button ─────────────────────────────────────────────────────────────
function SocialBtn({ Icon, label, color, href }) {
  const [hov, setHov] = useState(false);
  const openLink = () => window.open(href, "_blank", "noopener,noreferrer");
  return (
    <button
      type="button"
      onClick={openLink}
      aria-label={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: hov ? color : "rgba(255,255,255,.06)",
        border: `1px solid ${hov ? color : "rgba(255,255,255,.1)"}`,
        borderRadius: 10, padding: "8px 14px",
        fontSize: 12.5, fontWeight: 600,
        color: hov ? "#fff" : "rgba(255,255,255,.6)",
        cursor: "pointer", fontFamily: "inherit",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hov ? `0 8px 20px ${color}55` : "none",
        transition: "all .25s ease",
      }}
    >
      <span style={{ display: "flex" }}>
        <Icon />
      </span>
      {label}
    </button>
  );
}

// ── Store Badge ───────────────────────────────────────────────────────────────
function StoreBadge({ Icon, top, bottom, href }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#000",
        border: `1px solid ${hov ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.18)"}`,
        borderRadius: 10, padding: "7px 14px",
        textDecoration: "none", cursor: "pointer",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hov ? "0 8px 20px rgba(0,0,0,.35)" : "none",
        transition: "all .25s ease",
      }}
    >
      <span style={{ color: "#fff", display: "flex", flexShrink: 0 }}>
        <Icon />
      </span>
      <span style={{ lineHeight: 1.15 }}>
        <span style={{ display: "block", fontSize: 8.5, letterSpacing: ".4px", color: "rgba(255,255,255,.7)", textTransform: "uppercase" }}>
          {top}
        </span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-.2px" }}>
          {bottom}
        </span>
      </span>
    </a>
  );
}

// ── Footer Link ───────────────────────────────────────────────────────────────
function FooterLink({ label, onClick, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      className="ft-link"
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13.5, color: hov ? "#fff" : "rgba(255,255,255,.5)",
        textDecoration: "none", marginBottom: 10,
        width: "fit-content", cursor: "pointer",
        transform: hov ? "translateX(4px)" : "translateX(0)",
        transition: "all .22s ease",
        animationDelay: delay,
      }}
    >
      <span style={{
        opacity: hov ? 1 : 0, color: "#1DB88A",
        transform: hov ? "scale(1)" : "scale(0)",
        transition: "all .2s ease",
        display: "flex", flexShrink: 0,
      }}>
        <Icons.ArrowUpRight />
      </span>
      {label}
    </a>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ Icon, label, value }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="ft-contact-row"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 16, cursor: "default" }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0, marginTop: 1,
        background: hov ? "rgba(29,184,138,.18)" : "rgba(255,255,255,.07)",
        border: `1px solid ${hov ? "rgba(29,184,138,.4)" : "rgba(255,255,255,.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: hov ? "#1DB88A" : "rgba(255,255,255,.5)",
        transition: "all .25s ease",
        transform: hov ? "scale(1.08)" : "scale(1)",
      }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: hov ? "#fff" : "rgba(255,255,255,.6)", lineHeight: 1.5, transition: "color .22s ease" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Column heading ────────────────────────────────────────────────────────────
function ColHead({ children }) {
  return (
    <div className="ft-colhead" style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "2.5px",
      textTransform: "uppercase", color: "rgba(255,255,255,.3)",
      marginBottom: 20, paddingBottom: 10,
      borderBottom: "1px solid rgba(255,255,255,.07)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {children}
    </div>
  );
}

// ── Bottom Link ───────────────────────────────────────────────────────────────
function BottomLink({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 12, textDecoration: "none", cursor: "pointer",
        color: hov ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.28)",
        transition: "color .22s ease",
      }}
    >
      {label}
    </a>
  );
}

// ── Service Modal ─────────────────────────────────────────────────────────────
function ServiceModal({ page, onClose }) {
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef(null);

  // Current index within SERVICES array
  const currentIndex = SERVICES.findIndex((s) => s.page === page);

  const goTo = (newPage) => {
    // Animate out, swap content, animate in
    setVisible(false);
    setTimeout(() => {
      onClose(newPage); // parent re-opens with new page
    }, 180);
  };

  const goPrev = () => {
    const prev = SERVICES[(currentIndex - 1 + SERVICES.length) % SERVICES.length];
    goTo(prev.page);
  };

  const goNext = () => {
    const next = SERVICES[(currentIndex + 1) % SERVICES.length];
    goTo(next.page);
  };

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex]);

  // Scroll to top when page changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [page]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const TabComponent = SERVICE_COMPONENTS[page];

  return (
    <>
      <style>{`
        @keyframes smBackdropIn  { from{opacity:0} to{opacity:1} }
        @keyframes smSlideIn     { from{opacity:0;transform:translateY(32px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes smSlideOut    { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(20px) scale(.97)} }
        @keyframes smDotPulse    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.6} }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(8,16,30,.78)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          animation: "smBackdropIn .25s ease both",
        }}
      />

      {/* Modal shell */}
      <div
        style={{
          position: "fixed", inset: "0 0 0 0",
          zIndex: 9001,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 1080,
            maxHeight: "calc(100vh - 32px)",
            borderRadius: 20,
            background: "var(--sm-surface)",
            boxShadow: "0 40px 100px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            pointerEvents: "auto",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(.97)",
            transition: "opacity .25s ease, transform .25s cubic-bezier(.22,.97,.47,1)",
          }}
        >
          {/* ── Top chrome bar ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px 12px 20px",
            background: "linear-gradient(135deg,#0c1a2e,#1a2e4a)",
            flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}>
            {/* Left: breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase", color: "rgba(255,255,255,.35)",
              }}>
                Services
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.75)",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1DB88A", animation: "smDotPulse 2s ease-in-out infinite" }} />
                {SERVICES[currentIndex]?.label}
              </div>
            </div>

            {/* Centre: tab pill navigation */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 100, padding: "4px 6px",
            }}>
              {SERVICES.map((s, i) => (
                <button
                  key={s.page}
                  onClick={() => goTo(s.page)}
                  title={s.label}
                  style={{
                    width: i === currentIndex ? 24 : 8,
                    height: 8, borderRadius: 100,
                    background: i === currentIndex
                      ? "linear-gradient(90deg,#1DB88A,#1565C0)"
                      : "rgba(255,255,255,.2)",
                    border: "none", cursor: "pointer",
                    padding: 0,
                    transition: "all .3s cubic-bezier(.22,.97,.47,1)",
                  }}
                />
              ))}
            </div>

            {/* Right: nav arrows + close */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Prev */}
              <NavBtn onClick={goPrev} title="Previous service">
                <Icons.ChevronLeft />
              </NavBtn>
              {/* Page counter */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.3)", minWidth: 36, textAlign: "center" }}>
                {currentIndex + 1} / {SERVICES.length}
              </div>
              {/* Next */}
              <NavBtn onClick={goNext} title="Next service">
                <Icons.ChevronRight />
              </NavBtn>
              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.1)", margin: "0 4px" }} />
              {/* Close */}
              <NavBtn onClick={handleClose} title="Close (Esc)" accent>
                <Icons.Close />
              </NavBtn>
            </div>
          </div>

          {/* ── Scrollable content area ── */}
          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: "auto", overflowX: "hidden",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(21,101,192,.3) transparent",
            }}
          >
            {TabComponent ? <TabComponent /> : (
              <div style={{ padding: 48, textAlign: "center", color: "var(--sm-text-muted)" }}>
                Component not found for "{page}"
              </div>
            )}
          </div>

          {/* ── Bottom nav bar ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 20px",
            background: "var(--sm-surface-alt)",
            borderTop: "1px solid var(--sm-border)",
            flexShrink: 0,
            gap: 8,
            flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SERVICES.map((s, i) => (
                <ServicePill
                  key={s.page}
                  label={s.label}
                  active={i === currentIndex}
                  onClick={() => goTo(s.page)}
                />
              ))}
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: "7px 18px", borderRadius: 10,
                background: "rgba(21,101,192,.08)",
                border: "1px solid rgba(21,101,192,.15)",
                color: "var(--sm-navy)", fontWeight: 700,
                fontSize: 12, cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .2s ease",
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(21,101,192,.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(21,101,192,.08)"; e.currentTarget.style.transform = "none"; }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Small chrome nav button
function NavBtn({ onClick, title, children, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hov
          ? (accent ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.12)")
          : "rgba(255,255,255,.06)",
        border: `1px solid ${hov
          ? (accent ? "rgba(239,68,68,.3)" : "rgba(255,255,255,.2)")
          : "rgba(255,255,255,.08)"}`,
        color: hov ? (accent ? "#f87171" : "#fff") : "rgba(255,255,255,.45)",
        cursor: "pointer", padding: 0,
        transition: "all .2s ease",
        transform: hov ? "scale(1.05)" : "scale(1)",
      }}
    >
      {children}
    </button>
  );
}

// Service pill in bottom nav
function ServicePill({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 100,
        background: active
          ? "linear-gradient(90deg,#1565C0,#1DB88A)"
          : (hov ? "rgba(21,101,192,.12)" : "rgba(21,101,192,.06)"),
        border: active
          ? "none"
          : `1px solid ${hov ? "rgba(21,101,192,.3)" : "rgba(21,101,192,.15)"}`,
        color: active ? "#fff" : (hov ? "var(--sm-navy)" : "var(--sm-text-muted)"),
        fontSize: 11, fontWeight: active ? 700 : 600,
        cursor: "pointer", fontFamily: "inherit",
        transition: "all .22s ease",
        transform: hov && !active ? "translateY(-1px)" : "none",
        boxShadow: active ? "0 4px 12px rgba(21,101,192,.25)" : "none",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={() => { }}
      onMouseLeave={() => { }}
    >
      {label}
    </button>
  );
}

// ── Main Footer ───────────────────────────────────────────────────────────────
export default function Footer({ setPage, onOpenService }) {
  const [ref, visible] = useInView();
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  // Internal modal state
  const [activeServicePage, setActiveServicePage] = useState(null);

  const go = (p) => {
    if (SERVICE_PAGES.includes(p)) {
      // If an external handler is provided, use it; otherwise manage internally
      if (typeof onOpenService === "function") {
        onOpenService(p);
      } else {
        setActiveServicePage(p);
      }
      return;
    }
    if (typeof setPage === "function") {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Handle modal close: if called with a new page string, re-open that tab
  const handleModalClose = (nextPage) => {
    if (typeof nextPage === "string" && SERVICE_PAGES.includes(nextPage)) {
      setActiveServicePage(nextPage);
    } else {
      setActiveServicePage(null);
    }
  };

  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 960;

  const gridCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1.5fr 1fr 1fr 1.4fr";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ftShimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ftDotBlink  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes ftFadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ftLineGrow  { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes ftFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>

      {/* ── Service Modal (rendered internally if no external handler) ── */}
      {activeServicePage && !onOpenService && (
        <ServiceModal
          page={activeServicePage}
          onClose={handleModalClose}
        />
      )}

      <footer
        ref={ref}
        style={{
          background: "#0c1a2e",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Gradient mesh background */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse at 10% 80%, rgba(21,101,192,.12) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 20%, rgba(29,184,138,.1) 0%, transparent 50%)
          `,
        }} />

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Animated top line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg,transparent,#1565C0,#1DB88A,#1565C0,transparent)",
          backgroundSize: "200% 100%",
          animation: "ftShimmer 3s linear infinite",
        }} />

        {/* Main content */}
        <div style={{ maxWidth: "clamp(1200px, 90vw, 1600px)", margin: "0 auto", padding: "clamp(32px, 4vw, 48px) clamp(16px, 2vw, 24px) 0" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            gap: isMobile ? 36 : 40,
          }}>

            {/* ── Brand column ── */}
            <div className="ft-col" style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity .7s ease .05s, transform .7s ease .05s",
            }}>
              {/* Logo */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -.5, lineHeight: 1 }}>
                  School
                  <span style={{ background: "linear-gradient(90deg,#1DB88A,#7fffd4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    Mentor
                  </span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)", fontWeight: 400 }}>®</span>
                </div>
                <div style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginTop: 4 }}>
                  Creating the Future
                </div>
              </div>

              {/* Tagline */}
              <p className="ft-tagline" style={{ fontSize: 13.5, color: "rgba(255,255,255,.45)", lineHeight: 1.7, marginBottom: 24, maxWidth: 230 }}>
                Empowering Schools, Connecting Futures. Pakistan's most trusted school management platform.
              </p>

              {/* Social buttons */}
              <div className="ft-social-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {SOCIALS.map((s, i) => (
                  <SocialBtn key={i} Icon={s.Icon} label={s.label} color={s.color} href={s.href} />
                ))}
              </div>

              {/* Download app badges */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 11 }}>
                  Get the App
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <StoreBadge Icon={Icons.Apple} top="Download on the" bottom="App Store" href={STORE_LINKS.appStore} />
                  <StoreBadge Icon={Icons.GooglePlay} top="Get it on" bottom="Google Play" href={STORE_LINKS.playStore} />
                </div>
              </div>

              {/* Shark Tank badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(29,184,138,.1)",
                border: "1px solid rgba(29,184,138,.25)",
                borderRadius: 100, padding: "6px 12px",
                fontSize: 11, fontWeight: 600, color: "rgba(29,184,138,.85)",
                animation: visible ? "ftFloat 4s ease-in-out 1s infinite" : "none",
              }}>
                <Icons.Star />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1DB88A", animation: "ftDotBlink 1.5s ease-in-out infinite", flexShrink: 0 }} />
                As Seen on Shark Tank Pakistan
              </div>
            </div>

            {/* ── Quick Links ── */}
            <div className="ft-col" style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity .7s ease .15s, transform .7s ease .15s",
            }}>
              <ColHead>Quick Links</ColHead>
              {QUICK_LINKS.map((l, i) => (
                <FooterLink key={i} label={l.label} onClick={() => go(l.page)} delay={`${i * 0.04}s`} />
              ))}
            </div>

            {/* ── Services ── */}
            <div className="ft-col" style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity .7s ease .25s, transform .7s ease .25s",
            }}>
              <ColHead>Services</ColHead>
              {SERVICES.map((s, i) => (
                <FooterLink key={i} label={s.label} onClick={() => go(s.page)} delay={`${i * 0.04}s`} />
              ))}
            </div>

            {/* ── Contact ── */}
            <div className="ft-col" style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity .7s ease .35s, transform .7s ease .35s",
            }}>
              <ColHead>Contact</ColHead>

              <ContactRow Icon={Icons.Mail} label="Email" value="admin@schoolmentor.app" />
              <ContactRow Icon={Icons.Phone} label="WhatsApp / Phone" value="+923700036867" />

              {/* Offices */}
              <div className="ft-contact-row" style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0, marginTop: 1,
                  background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,.5)",
                }}>
                  <Icons.MapPin />
                </div>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 8 }}>
                    Offices
                  </div>
                  {OFFICES.map((o, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 9, fontSize: 12, color: "rgba(255,255,255,.42)", lineHeight: 1.55 }}>
                      <span style={{ flexShrink: 0, fontSize: 14 }}>{o.flag}</span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Divider with glow */}
        <div style={{
          maxWidth: "clamp(1200px, 90vw, 1600px)", margin: "40px auto 0",
          padding: "0 clamp(18px, 4vw, 32px)",
        }}>
          <div style={{
            height: 1,
            background: "linear-gradient(90deg,transparent,rgba(255,255,255,.1) 20%,rgba(255,255,255,.1) 80%,transparent)",
          }} />
        </div>

        {/* Bottom bar */}
        <div style={{
          maxWidth: "clamp(1200px, 90vw, 1600px)", margin: "0 auto",
          padding: "clamp(16px, 2vw, 22px) clamp(16px, 2vw, 24px)",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: isMobile ? 12 : 0,
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Globe />
            © 2026 SchoolMentor®. All rights reserved.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {[
              { label: "Privacy Policy", page: "privacy" },
              { label: "Terms of Use", page: "terms" },
            ].map((l, i) => (
              <BottomLink key={i} label={l.label} onClick={() => go(l.page)} />
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
