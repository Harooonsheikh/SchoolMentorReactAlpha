import { useState, useEffect, useRef } from "react";
import { pathForPage } from "../lib/routes";
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
  Apple: () => <i className="fa-brands fa-apple" style={{ fontSize: 22 }} />,
  GooglePlay: () => <i className="fa-brands fa-google-play" style={{ fontSize: 19 }} />,
  Instagram: () => <i className="fa-brands fa-instagram" style={{ fontSize: 16 }} />,
  Facebook: () => <i className="fa-brands fa-facebook-f" style={{ fontSize: 16 }} />,
  LinkedIn: () => <i className="fa-brands fa-linkedin-in" style={{ fontSize: 16 }} />,
  YouTube: () => <i className="fa-brands fa-youtube" style={{ fontSize: 16 }} />,
  Mail: () => <i className="fa-solid fa-envelope" style={{ fontSize: 15 }} />,
  Phone: () => <i className="fa-solid fa-phone" style={{ fontSize: 15 }} />,
  MapPin: () => <i className="fa-solid fa-location-dot" style={{ fontSize: 15 }} />,
  Globe: () => <i className="fa-solid fa-globe" style={{ fontSize: 15 }} />,
  Star: () => <i className="fa-solid fa-star" style={{ fontSize: 13 }} />,
  ArrowUpRight: () => <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 11 }} />,
  Close: () => <i className="fa-solid fa-xmark" style={{ fontSize: 18 }} />,
  ChevronLeft: () => <i className="fa-solid fa-chevron-left" style={{ fontSize: 16 }} />,
  ChevronRight: () => <i className="fa-solid fa-chevron-right" style={{ fontSize: 16 }} />,
};

// ── Data ──────────────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "Home", page: "home" },
  { label: "About Us", page: "about" },
  { label: "Pricing", page: "pricing" },
  // { label: "Blog", page: "blog" },   // blog disabled for now
  { label: "Success Stories", page: "success" },
  { label: "Contact Us", page: "contact" },
  { label: "Privacy Policy", page: "privacy" },
  { label: "Terms & Condition", page: "terms" },
];

// Blog disabled for now. Restore this list and the "From the Blog" column below
// when the blog is switched back on.
/*
const BLOG_LINKS = [
  { label: "School Software Buyer's Guide", page: "blog/school-management-software-pakistan" },
  { label: "School ERP Price in Pakistan", page: "blog/school-erp-price-in-pakistan" },
  { label: "Fee Management for Schools", page: "blog/fee-management-system-for-schools" },
  { label: "Digitize Your School in 90 Days", page: "blog/digitize-your-school-pakistan" },
  { label: "AI in Pakistani Classrooms", page: "blog/ai-in-education-pakistan" },
  { label: "All Articles", page: "blog" },
];
*/

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

const flagStyle = {
  width: 20, height: 14, borderRadius: 2, objectFit: "cover",
  boxShadow: "0 0 0 1px rgba(255,255,255,.15)",
};
const OFFICES = [
  { flag: <img src="https://flagcdn.com/pk.svg" alt="Pakistan" style={flagStyle} />, text: "Floors 3–5, Paradise Commercial, Bahria Phase–IV, Islamabad" },
  { flag: <img src="https://flagcdn.com/ae.svg" alt="UAE" style={flagStyle} />, text: "J&P Signal, Industrial Area 6, Sharjah – UAE" },
  { flag: <img src="https://flagcdn.com/us.svg" alt="USA" style={flagStyle} />, text: "2817 Eagandale Blvd, Eagan, MN 55121, USA" },
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
      className="ft-social"
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
      className="ft-store"
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
        <span className="ft-store-top" style={{ display: "block", fontSize: 8.5, letterSpacing: ".4px", color: "rgba(255,255,255,.7)", textTransform: "uppercase" }}>
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
function FooterLink({ label, onClick, delay, href }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      className="ft-link"
      href={href}
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
        opacity: hov ? 1 : 0, color: "#3B82F6",
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
        background: hov ? "rgba(37,99,235,.18)" : "rgba(255,255,255,.07)",
        border: `1px solid ${hov ? "rgba(37,99,235,.4)" : "rgba(255,255,255,.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: hov ? "#3B82F6" : "rgba(255,255,255,.5)",
        transition: "all .25s ease",
        transform: hov ? "scale(1.08)" : "scale(1)",
      }}>
        <Icon />
      </div>
      <div>
        <div className="ft-microlabel" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 3 }}>
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
      className="ft-bottomlink"
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
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", animation: "smDotPulse 2s ease-in-out infinite" }} />
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
                      ? "linear-gradient(90deg,#3B82F6,#1D4ED8)"
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
              <i className="fa-solid fa-xmark" aria-hidden="true" /> Close
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
          ? "linear-gradient(90deg,#1D4ED8,#3B82F6)"
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

  // Tracks: brand / Quick Links / Services / Contact.
  // The 1.15fr "From the Blog" track is dropped while the blog is disabled.
  const gridCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1.4fr 1fr 1fr 1.3fr";

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
            radial-gradient(ellipse at 90% 20%, rgba(37,99,235,.1) 0%, transparent 50%)
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
          background: "linear-gradient(90deg,transparent,#1D4ED8,#3B82F6,#1D4ED8,transparent)",
          backgroundSize: "200% 100%",
          animation: "ftShimmer 3s linear infinite",
        }} />

        {/* Main content */}
        <div style={{ maxWidth: "clamp(1200px, 93vw, 1850px)", margin: "0 auto", padding: "clamp(32px, 4vw, 48px) clamp(16px, 2vw, 24px) 0" }}>
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
                  <span style={{ background: "linear-gradient(90deg,#3B82F6,#93C5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    Mentor
                  </span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)", fontWeight: 400 }}>®</span>
                </div>
                <div className="ft-brandline" style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginTop: 4 }}>
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
                <div className="ft-microlabel" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 11 }}>
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
                background: "rgba(37,99,235,.1)",
                border: "1px solid rgba(37,99,235,.25)",
                borderRadius: 100, padding: "6px 12px",
                fontSize: 11, fontWeight: 600, color: "rgba(37,99,235,.85)",
                animation: visible ? "ftFloat 4s ease-in-out 1s infinite" : "none",
              }}>
                <Icons.Star />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", animation: "ftDotBlink 1.5s ease-in-out infinite", flexShrink: 0 }} />
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
                <FooterLink key={i} label={l.label} href={pathForPage(l.page)} onClick={() => go(l.page)} delay={`${i * 0.04}s`} />
              ))}
            </div>

            {/* ── From the Blog ── (disabled for now)
            <div className="ft-col" style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: "opacity .7s ease .2s, transform .7s ease .2s",
            }}>
              <ColHead>From the Blog</ColHead>
              {BLOG_LINKS.map((l, i) => (
                <FooterLink key={i} label={l.label} href={pathForPage(l.page)} onClick={() => go(l.page)} delay={`${i * 0.04}s`} />
              ))}
            </div>
            */}

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
                  <div className="ft-microlabel" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 8 }}>
                    Offices
                  </div>
                  {OFFICES.map((o, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 9, fontSize: 12, color: "rgba(255,255,255,.42)", lineHeight: 1.55 }}>
                      <span style={{ flexShrink: 0, display: "flex", marginTop: 2 }}>{o.flag}</span>
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
          maxWidth: "clamp(1200px, 93vw, 1850px)", margin: "40px auto 0",
          padding: "0 clamp(18px, 4vw, 32px)",
        }}>
          <div style={{
            height: 1,
            background: "linear-gradient(90deg,transparent,rgba(255,255,255,.1) 20%,rgba(255,255,255,.1) 80%,transparent)",
          }} />
        </div>

        {/* Bottom bar */}
        <div style={{
          maxWidth: "clamp(1200px, 93vw, 1850px)", margin: "0 auto",
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
