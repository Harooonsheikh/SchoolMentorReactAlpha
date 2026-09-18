import { useState, useRef, useEffect, useCallback } from "react";

import favicon from '../assets/favicon.png';
import Login from './Login.jsx';
import SignUp from './SignUp.jsx';
import Tab0_SchoolMentorERP from './Tab0_SchoolMentorERP.jsx';
import Tab1_MobileApp from './Tab1_MobileApp.jsx';
import Tab2_OperationalManuals from './Tab2_OperationalManuals.jsx';
import Tab3_TeacherTrainings from './Tab3_TeacherTrainings.jsx';
import Tab4_MentorAI from './Tab4_MentorAI.jsx';
import Tab5_HeadOfficeSupport from './Tab5_HeadOfficeSupport.jsx';


// ── Data ──────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Home", page: "home" },
  { label: "About Us", page: "about" },
  { label: "Pricing", page: "pricing" },
  { label: "Success Stories", page: "success" },
  { label: "FAQ's", page: "faq" },
  { label: "Contact", page: "contact" },
];

const SERVICES = [
  { icon: "🖥️", label: "School Mentor ERP", sub: "Complete school management", bg: "rgba(21,101,192,.1)", page: "erp" },
  { icon: "📱", label: "School Mentor Mobile App", sub: "iOS & Android for all stakeholders", bg: "rgba(29,184,138,.1)", page: "mobile" },
  { icon: "📋", label: "School Operational Manuals", sub: "Standardized SOPs", bg: "rgba(124,58,237,.1)", page: "manuals" },
  { icon: "🎓", label: "Teachers Trainings", sub: "Monthly professional development", bg: "rgba(245,158,11,.1)", page: "trainings" },
  { icon: "✦", label: "School Mentor AI", sub: "AI-powered teaching assistant", bg: "linear-gradient(135deg,rgba(21,101,192,.12),rgba(29,184,138,.12))", page: "ai" },
  { icon: "🏢", label: "Head Office Support", sub: "Centralized management support", bg: "rgba(239,68,68,.1)", page: "headoffice" },
];

// ── Hooks ─────────────────────────────────────────────────────────
function useClickOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function useIsMobile(breakpoint = 900) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < breakpoint);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [breakpoint]);
  return m;
}

// ── Loader bar ────────────────────────────────────────────────────
function LoaderBar({ active }) {
  return (
    <div style={{
      height: 3,
      background: "linear-gradient(90deg,#1565C0,#1DB88A,#1565C0)",
      backgroundSize: "200% 100%",
      animation: active ? "navLoader 2.4s ease-in-out infinite" : "none",
      opacity: active ? 1 : 0,
      transition: "opacity .4s ease",
    }} />
  );
}

// ── Logo ──────────────────────────────────────────────────────────
function Logo({ onClick }) {
  const [hov, setHov] = useState(false);
  const isMobile = useIsMobile();
  const isPhone = useIsMobile(420);
  const imgW = isPhone ? 36 : isMobile ? 44 : 50;
  const titleSize = isPhone ? 14 : isMobile ? 15.5 : 17;
  const subSize = isPhone ? 8 : isMobile ? 8.5 : 9;
  const gap = isPhone ? 7 : isMobile ? 9 : 10;
  const marginR = isPhone ? 6 : isMobile ? 8 : 12;
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap, textDecoration: "none", flexShrink: 0, marginRight: marginR, cursor: "pointer" }}
    >
      <div style={{ width: imgW, background: "var(--sm-surface)" }}>
        <img src={favicon} alt="ERP" style={{ width: "100%" }} />
      </div>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: titleSize, fontWeight: 800, color: "var(--sm-text)", letterSpacing: "-.3px" }}>
          <span style={{ fontWeight: 400 }}>School</span>
          <span style={{ color: "var(--sm-teal)" }}>Mentor</span>
        </div>
        <div style={{ fontSize: subSize, color: "var(--sm-text-muted)", fontWeight: 500, letterSpacing: ".5px" }}>Creating the Future</div>
      </div>
    </a>
  );
}

// ── Desktop nav link ──────────────────────────────────────────────
function NavLink({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", padding: "7px 11px",
        fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
        color: active || hov ? "var(--sm-navy)" : "var(--sm-text-muted)",
        background: hov ? "rgba(21,101,192,.06)" : "transparent",
        borderRadius: 9, textDecoration: "none", cursor: "pointer",
        transition: "all .25s ease",
      }}
    >
      {label}
      {active && (
        <div style={{
          position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
          width: 5, height: 5, borderRadius: "50%",
          background: "linear-gradient(135deg,#1565C0,#1DB88A)",
        }} />
      )}
    </a>
  );
}

// ── Services dropdown ─────────────────────────────────────────────
function ServicesDropdown({ setPage, onOpenService }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const handleSelect = (page) => {
    setOpen(false);
    // Pages with dedicated modal components
    const servicePages = ["erp", "mobile", "manuals", "trainings", "ai", "headoffice"];
    if (servicePages.includes(page)) {
      onOpenService(page);
    } else if (typeof setPage === "function") {
      setPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: "relative", padding: "7px 11px",
          fontSize: 14, fontWeight: 600, color: (open || hov) ? "var(--sm-navy)" : "var(--sm-text-muted)",
          borderRadius: 9, background: (open || hov) ? "rgba(21,101,192,.06)" : "transparent",
          border: "1.5px solid transparent",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          transition: "all .25s ease",
        }}
      >
        {/* Pulse ring */}
        <div style={{ position: "absolute", inset: -3, borderRadius: 12, border: "1.5px solid rgba(21,101,192,.2)", animation: "svcPulse 2.5s ease-out infinite", pointerEvents: "none" }} />
        Services
        <span style={{ background: "linear-gradient(135deg,#1565C0,#1DB88A)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>6</span>
        <span style={{ fontSize: 10, color: "var(--sm-text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s ease" }}>▾</span>
      </button>

      {/* Dropdown */}
      <div style={{
        position: "absolute", top: "calc(100% + 10px)", left: "50%",
        transform: open ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-8px)",
        width: "min(340px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 100px)", overflowY: "auto",
        background: "var(--sm-surface)",
        border: "1px solid var(--sm-border)", borderRadius: 20,
        boxShadow: "0 20px 60px rgba(21,101,192,.15)",
        padding: 12, zIndex: 300,
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "all" : "none",
        transition: "opacity .25s ease, transform .25s ease, visibility .25s",
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sm-text-muted)", padding: "4px 10px 10px", borderBottom: "1px solid var(--sm-border)", marginBottom: 8 }}>
          Our Services
        </div>
        {SERVICES.map((s, i) => <ServiceItem key={i} s={s} onClick={() => handleSelect(s.page)} />)}
      </div>
    </div>
  );
}

function ServiceItem({ s, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14, background: hov ? "var(--sm-hover)" : "transparent", textDecoration: "none", transition: "background .22s ease", cursor: "pointer" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, background: s.bg, transform: hov ? "scale(1.1) rotate(-5deg)" : "scale(1)", transition: "transform .25s ease" }}>
        {s.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--sm-text)", lineHeight: 1.2 }}>{s.label}</div>
        <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 2 }}>{s.sub}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--sm-navy)", opacity: hov ? 1 : 0, transform: hov ? "translateX(0)" : "translateX(-6px)", transition: "all .22s ease", marginLeft: "auto" }}>›</span>
    </a>
  );
}

// ── Theme toggle (light/dark) ─────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof document !== "undefined") {
      try {
        const saved = localStorage.getItem("sm-theme");
        if (saved === "dark" || saved === "light") return saved;
      } catch (e) { }
      return document.documentElement.getAttribute("data-theme") || "light";
    }
    return "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("sm-theme", theme); } catch (e) { }
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

function ThemeToggle({ compact = false }) {
  const [theme, toggle] = useTheme();
  const [hov, setHov] = useState(false);
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: compact ? "8px 8px" : "8px 10px",
        borderRadius: 11,
        background: hov ? "rgba(120,120,128,.26)" : "rgba(120,120,128,.16)",
        color: "var(--sm-navy)",
        fontSize: 15, fontWeight: 700,
        border: "1.5px solid rgba(120,120,128,.25)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all .25s ease", whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}

// ── WhatsApp button ───────────────────────────────────────────────
function WaBtn({ full = true }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => window.open("https://wa.me/923700036867", "_blank")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: full ? "9px 16px" : "9px 12px",
        borderRadius: 11, background: "linear-gradient(135deg,#25D366,#128C7E)",
        color: "#fff", fontSize: 14, fontWeight: 700,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        boxShadow: hov ? "0 8px 24px rgba(37,211,102,.4)" : "0 4px 16px rgba(37,211,102,.3)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        filter: hov ? "brightness(1.05)" : "brightness(1)",
        transition: "all .25s ease", position: "relative", whiteSpace: "nowrap",
      }}
    >
      {full && "WhatsApp"}
      <span style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "waPulse 1.8s ease-out infinite" }} />
    </button>
  );
}

// ── Login button ──────────────────────────────────────────────────
function LoginBtn({ full = true, onOpenLogin, onOpenSignup }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: full ? "9px 16px" : "9px 12px",
          borderRadius: 11, background: "linear-gradient(135deg,#1DB88A,#1565C0)",
          color: "#fff", fontSize: 14, fontWeight: 700,
          border: "none", cursor: "pointer", fontFamily: "inherit",
          boxShadow: hov ? "0 8px 24px rgba(21,101,192,.4)" : "0 4px 16px rgba(21,101,192,.25)",
          transform: hov ? "translateY(-2px)" : "translateY(0)",
          filter: hov ? "brightness(1.08)" : "brightness(1)",
          transition: "all .25s ease", whiteSpace: "nowrap",
        }}
      >
        {full && "Login / Signup"}
        <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s ease" }}>▾</span>
      </button>

      <div style={{
        position: "absolute", top: "calc(100% + 10px)", right: 0,
        width: 180, background: "var(--sm-surface)",
        border: "1px solid var(--sm-border)", borderRadius: 16,
        boxShadow: "0 20px 60px rgba(21,101,192,.15)",
        padding: 8, zIndex: 300,
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        transform: open ? "translateY(0)" : "translateY(-8px)",
        pointerEvents: open ? "all" : "none",
        transition: "opacity .25s ease, transform .25s ease, visibility .25s",
      }}>
        {/* ✅ Login opens Login modal, Signup opens SignUp modal */}
        <LoginItem icon="👤" label="Login" onClick={() => { setOpen(false); onOpenLogin(); }} />
        <LoginItem icon="✏️" label="Signup" onClick={() => { setOpen(false); onOpenSignup(); }} />
      </div>
    </div>
  );
}

function LoginItem({ icon, label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 11, fontSize: 14, fontWeight: 600, color: hov ? "var(--sm-navy)" : "var(--sm-text)", background: hov ? "var(--sm-hover)" : "transparent", textDecoration: "none", transition: "all .2s ease", cursor: "pointer" }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 8, background: hov ? "rgba(21,101,192,.15)" : "rgba(21,101,192,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, transform: hov ? "scale(1.1)" : "scale(1)", transition: "all .25s ease" }}>{icon}</span>
      {label}
    </a>
  );
}

// ── Hamburger icon ────────────────────────────────────────────────
function Hamburger({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Toggle menu"
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
        width: 40, height: 40, padding: 8,
        borderRadius: 10, border: "none",
        background: "rgba(21,101,192,.07)", cursor: "pointer",
        marginLeft: "auto",
      }}
    >
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 22, height: 2.5, background: "#1565C0", borderRadius: 2,
          transition: "all .3s ease", transformOrigin: "center",
          ...(open && i === 0 ? { transform: "translateY(7.5px) rotate(45deg)" } : {}),
          ...(open && i === 1 ? { opacity: 0, transform: "scaleX(0)" } : {}),
          ...(open && i === 2 ? { transform: "translateY(-7.5px) rotate(-45deg)" } : {}),
        }} />
      ))}
    </button>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────
function MobileDrawer({ open, onClose, setPage, activePage, onOpenLogin, onOpenSignup, onOpenService }) {
  const [svcOpen, setSvcOpen] = useState(false);

  const go = (p) => {
    const servicePages = ["erp", "mobile", "manuals", "trainings", "ai", "headoffice"];
    if (servicePages.includes(p)) {
      onClose();
      onOpenService(p);
      return;
    }
    if (typeof setPage === "function") {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    onClose();
  };

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, top: 71,
        background: "rgba(26,46,74,.4)",
        backdropFilter: "blur(3px)",
        zIndex: 999, overflowY: "auto",
        animation: "drawerOverlay .25s ease",
      }}
    >
      <div style={{
        background: "var(--sm-surface)", borderRadius: "0 0 24px 24px",
        padding: "12px 14px 28px",
        boxShadow: "0 20px 60px rgba(21,101,192,.15)",
        animation: "drawerIn .3s ease",
      }}>
        {/* Home */}
        <MobLink label="Home" active={activePage === "Home"} onClick={() => go("home")} />

        {/* Services accordion */}
        <button
          onClick={() => setSvcOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 14px", borderRadius: 12, width: "100%",
            fontSize: 15, fontWeight: 700, color: "var(--sm-navy)",
            background: "rgba(21,101,192,.07)", border: "1.5px solid rgba(21,101,192,.15)",
            cursor: "pointer", fontFamily: "inherit", marginBottom: 2,
            transition: "all .2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Services
            <span style={{ background: "linear-gradient(135deg,#1565C0,#1DB88A)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>6</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--sm-text-muted)", transform: svcOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s ease" }}>▾</span>
        </button>

        <div style={{
          maxHeight: svcOpen ? 600 : 0,
          opacity: svcOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height .35s ease, opacity .25s ease",
        }}>
          <div style={{ padding: "6px 4px 8px" }}>
            {SERVICES.map((s, i) => (
              <MobServiceItem key={i} s={s} onClick={() => go(s.page)} />
            ))}
          </div>
        </div>

        {[
          { label: "About Us", page: "about" },
          { label: "Pricing", page: "pricing" },
          { label: "Success Stories", page: "success" },
          { label: "FAQ's", page: "faq" },
          { label: "Contact", page: "contact" },
        ].map(l => (
          <MobLink key={l.page} label={l.label} active={activePage === l.page} onClick={() => go(l.page)} />
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, padding: "0 4px" }}>
          <button
            onClick={() => window.open("https://wa.me/923700036867", "_blank")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(37,211,102,.3)" }}>
            WhatsApp
          </button>
          {/* ✅ Mobile Login button */}
          <button
            onClick={() => { onClose(); onOpenLogin(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#1DB88A,#1565C0)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(21,101,192,.25)" }}>
            Login
          </button>
        </div>
        {/* ✅ Mobile Signup button */}
        <div style={{ padding: "10px 4px 0" }}>
          <button
            onClick={() => { onClose(); onOpenSignup(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#1565C0,#1DB88A)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(21,101,192,.25)" }}>
            ✏️ Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

function MobLink({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 14px", borderRadius: 12, marginBottom: 2,
        fontSize: 15, fontWeight: 600,
        color: active || hov ? "var(--sm-navy)" : "var(--sm-text)",
        background: active || hov ? "var(--sm-hover)" : "transparent",
        textDecoration: "none", transition: "all .2s ease", cursor: "pointer",
      }}
    >
      {label}
      {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#1565C0,#1DB88A)" }} />}
    </a>
  );
}

function MobServiceItem({ s, onClick }) {
  const [pressed, setPressed] = useState(false);
  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 12px", borderRadius: 12,
        background: pressed ? "#e8f1ff" : "transparent",
        textDecoration: "none", marginBottom: 2, cursor: "pointer",
        transition: "background .15s ease, transform .15s ease",
        transform: pressed ? "scale(.98)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, background: s.bg, flexShrink: 0,
      }}>{s.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--sm-text)", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
        <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sub}</div>
      </div>
      <span style={{ fontSize: 14, color: "var(--sm-navy)", flexShrink: 0 }}>›</span>
    </a>
  );
}


// ── Main Navbar export ────────────────────────────────────────────
export default function Navbar({ loading = true, page = "home", setPage }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showService, setShowService] = useState(null); // e.g. "erp", "ai", etc.
  const isMobile = useIsMobile();

  const toggleMobile = useCallback(() => setMobileOpen(o => !o), []);

  // Close service modal on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowService(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = (p) => {
    if (typeof setPage === "function") {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isCompact = typeof window !== "undefined" && window.innerWidth < 1100 && !isMobile;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes navLoader    { 0%{background-position:-200% 0;opacity:1} 60%{background-position:200% 0;opacity:1} 80%{opacity:.4} 100%{background-position:200% 0;opacity:0} }
        @keyframes svcPulse     { 0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(1.08)} }
        @keyframes waPulse      { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.2);opacity:0} }
        @keyframes drawerIn     { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes drawerOverlay{ from{opacity:0} to{opacity:1} }
        @keyframes loginModalIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes svcModalIn { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
        .svc-modal-scroll::-webkit-scrollbar { width: 6px; }
        .svc-modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .svc-modal-scroll::-webkit-scrollbar-thumb { background: rgba(21,101,192,.3); border-radius: 10px; }
        .svc-modal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(21,101,192,.55); }
        * { box-sizing: border-box; }
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 1000, background: "var(--sm-surface)", boxShadow: "0 1px 0 rgba(0,0,0,.07)" }}>
        <LoaderBar active={loading} />

        <div style={{
          display: "flex", alignItems: "center",
          maxWidth: "100%", margin: "0 auto",
          padding: "0 24px", height: 68, gap: 4,
        }}>
          {/* Logo */}
          <Logo onClick={() => go("home")} />

          {/* Desktop links */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
              <NavLink label="Home" active={page === "home"} onClick={() => go("home")} />
              <ServicesDropdown setPage={setPage} onOpenService={(p) => setShowService(p)} />
              {NAV_LINKS.filter(l => l.page !== "home").map(l => (
                <NavLink key={l.page} label={l.label} active={page === l.page} onClick={() => go(l.page)} />
              ))}
            </div>
          )}

          {/* Desktop right buttons */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
              <ThemeToggle compact={isCompact} />
              {/* ✅ Pass onOpenLogin to LoginBtn */}
              <LoginBtn full={!isCompact} onOpenLogin={() => setShowLogin(true)} onOpenSignup={() => setShowSignup(true)} />
            </div>
          )}

          {/* Hamburger area (mobile shows theme toggle + menu) */}
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <ThemeToggle compact />
              <Hamburger open={mobileOpen} onClick={toggleMobile} />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        setPage={setPage}
        activePage={page}
        onOpenLogin={() => setShowLogin(true)} // ✅ Pass onOpenLogin to drawer
        onOpenSignup={() => setShowSignup(true)} // ✅ Pass onOpenSignup to drawer
        onOpenService={(p) => setShowService(p)} // ✅ Pass onOpenService to drawer
      />

      {/* ✅ Login Modal Overlay */}
      {showLogin && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(26,46,74,.55)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, overflowY: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: 500, animation: "loginModalIn .35s ease", position: "relative" }}>
            <button
              onClick={() => setShowLogin(false)}
              style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.9)", border: "1px solid var(--sm-border)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sm-text-muted)", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
              ✕
            </button>
            {/* onSignUp switches to SignUp modal */}
            <Login onSignUp={() => { setShowLogin(false); setShowSignup(true); }} />
          </div>
        </div>
      )}

      {/* ✅ Service Modal Overlay */}
      {showService && (() => {
        const SERVICE_MAP = {
          erp: <Tab0_SchoolMentorERP />,
          mobile: <Tab1_MobileApp />,
          manuals: <Tab2_OperationalManuals />,
          trainings: <Tab3_TeacherTrainings />,
          ai: <Tab4_MentorAI />,
          headoffice: <Tab5_HeadOfficeSupport />,
        };
        const content = SERVICE_MAP[showService];
        if (!content) return null;
        return (
          <div
            onClick={(e) => e.target === e.currentTarget && setShowService(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 2000,
              background: "rgba(26,46,74,.65)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "24px 16px",
            }}
          >
            <div style={{
              width: "100%", maxWidth: 1000,
              maxHeight: "90vh",
              display: "flex", flexDirection: "column",
              borderRadius: 24,
              boxShadow: "0 32px 80px rgba(0,0,0,.35)",
              animation: "loginModalIn .3s ease",
              position: "relative",
              overflow: "hidden",
              background: "var(--sm-surface)",
            }}>
              {/* Sticky close button */}
              <button
                onClick={() => setShowService(null)}
                style={{
                  position: "absolute", top: 14, right: 14, zIndex: 20,
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(255,255,255,.92)",
                  border: "1px solid var(--sm-border)",
                  fontSize: 17, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--sm-text-muted)", fontFamily: "inherit",
                  boxShadow: "0 2px 10px rgba(0,0,0,.15)",
                }}
              >✕</button>

              {/* Scrollable content */}
              <div
                className="svc-modal-scroll"
                style={{
                  overflowY: "auto",
                  overflowX: "hidden",
                  flex: 1,
                  borderRadius: 24,
                }}
              >
                {content}
              </div>
            </div>
          </div>
        );
      })()}
      {showSignup && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowSignup(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(26,46,74,.55)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, overflowY: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, animation: "loginModalIn .35s ease", position: "relative" }}>
            <button
              onClick={() => setShowSignup(false)}
              style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.9)", border: "1px solid var(--sm-border)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sm-text-muted)", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
              ✕
            </button>
            {/* onLogin switches to Login modal */}
            <SignUp onLogin={() => { setShowSignup(false); setShowLogin(true); }} />
          </div>
        </div>
      )}
    </>
  );
}
