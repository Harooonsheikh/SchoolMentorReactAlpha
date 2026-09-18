import { useState, useRef, useEffect, useCallback } from "react";

import { pathForPage } from "../lib/routes";
import favicon from '../assets/favicon.png';
import Login from './Login.jsx';
import SignUp from './SignUp.jsx';
import Tab0_SchoolMentorERP from './Tab0_SchoolMentorERP.jsx';
import Tab1_MobileApp from './Tab1_MobileApp.jsx';
import Tab2_OperationalManuals from './Tab2_OperationalManuals.jsx';
import Tab3_TeacherTrainings from './Tab3_TeacherTrainings.jsx';
import Tab4_MentorAI from './Tab4_MentorAI.jsx';
import Tab5_HeadOfficeSupport from './Tab5_HeadOfficeSupport.jsx';

const NAV_LINKS = [
  { label: "Home", page: "home" },
  { label: "About Us", page: "about" },
  { label: "Pricing", page: "pricing" },
  { label: "Success Stories", page: "success" },
  { label: "Blogs", page: "blog" },
  { label: "Contact Us", page: "contact" },
];

const SERVICES = [
  { icon: <i className="fa-solid fa-desktop" />, label: "School Mentor ERP", sub: "Complete school management", bg: "rgba(21,101,192,.1)", page: "erp" },
  { icon: <i className="fa-solid fa-mobile-screen-button" />, label: "School Mentor Mobile App", sub: "iOS & Android for all stakeholders", bg: "rgba(37,99,235,.1)", page: "mobile" },
  { icon: <i className="fa-solid fa-clipboard-list" />, label: "School Operational Manuals", sub: "Standardized SOPs", bg: "rgba(124,58,237,.1)", page: "manuals" },
  { icon: <i className="fa-solid fa-graduation-cap" />, label: "Teachers Trainings", sub: "Monthly professional development", bg: "rgba(245,158,11,.1)", page: "trainings" },
  { icon: <i className="fa-solid fa-wand-magic-sparkles" />, label: "School Mentor AI", sub: "AI-powered teaching assistant", bg: "linear-gradient(135deg,rgba(21,101,192,.12),rgba(37,99,235,.12))", page: "ai" },
  { icon: <i className="fa-solid fa-building" />, label: "Head Office Support", sub: "Centralized management support", bg: "rgba(239,68,68,.1)", page: "headoffice" },
];

function useClickOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function useIsMobile(breakpoint = 1024) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < breakpoint);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [breakpoint]);
  return m;
}

function LoaderBar(props) {
  const active = props.active;
  return (
    <div style={{
      height: 3,
      background: "linear-gradient(90deg,#1D4ED8,#3B82F6,#1D4ED8)",
      backgroundSize: "200% 100%",
      animation: active ? "navLoader 2.4s ease-in-out infinite" : "none",
      opacity: active ? 1 : 0,
      transition: "opacity .4s ease",
    }} />
  );
}

function Logo(props) {
  const onClick = props.onClick;
  const [hov, setHov] = useState(false);
  const isMobile = useIsMobile();
  const isPhone = useIsMobile(420);
  const isMobile768 = useIsMobile(769);
  const imgW = isPhone ? 46 : isMobile768 ? 56 : isMobile ? 44 : 50;
  const titleSize = isPhone ? 14 : isMobile ? 15.5 : 17;
  const subSize = isPhone ? 8 : isMobile ? 8.5 : 9;
  const gap = isPhone ? 7 : isMobile ? 9 : 10;
  const marginR = isPhone ? 6 : isMobile ? 8 : 12;
  const tagName = "a";
  const LogoTag = tagName;
  return (
    <LogoTag
      href="/"
      aria-label="School Mentor home"
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
    </LogoTag>
  );
}

function NavLink(props) {
  const label = props.label;
  const active = props.active;
  const onClick = props.onClick;
  // A real href keeps the primary navigation crawlable — Googlebot follows
  // hrefs, not onClick handlers, so without this the internal link graph is
  // invisible and pages like /blog are never discovered.
  const href = props.href;
  const [hov, setHov] = useState(false);
  const NavTag = "a";
  return (
    <NavTag
      href={href}
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", padding: "7px 13px",
        fontSize: 14, fontWeight: active ? 700 : 600, whiteSpace: "nowrap",
        color: active || hov ? "var(--sm-navy)" : "var(--sm-text-muted)",
        background: active ? "rgba(21,101,192,.09)" : hov ? "rgba(21,101,192,.06)" : "transparent",
        borderRadius: 9, textDecoration: "none", cursor: "pointer",
        transition: "all .25s ease",
      }}
    >
      {label}
      {active && (
        <div style={{
          position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
          width: 5, height: 5, borderRadius: "50%",
          background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
        }} />
      )}
    </NavTag>
  );
}

function ServicesDropdown(props) {
  const setPage = props.setPage;
  const onOpenService = props.onOpenService;
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const updatePos = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(340, vw - margin * 2);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, vw - width - margin));
    const top = r.bottom + 10;
    const maxHeight = Math.max(180, vh - top - margin);
    setPos({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, updatePos]);

  const handleSelect = (page) => {
    setOpen(false);
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
        onClick={() => { if (!open) updatePos(); setOpen(o => !o); }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: "relative", padding: "7px 13px",
          fontSize: 14, fontWeight: 600, color: (open || hov) ? "var(--sm-navy)" : "var(--sm-text-muted)",
          borderRadius: 9, background: (open || hov) ? "rgba(21,101,192,.06)" : "transparent",
          border: "1.5px solid transparent",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          transition: "all .25s ease",
        }}
      >
        <div style={{ position: "absolute", inset: -3, borderRadius: 12, border: "1.5px solid rgba(21,101,192,.2)", animation: "svcPulse 2.5s ease-out infinite", pointerEvents: "none" }} />
        Services
        <span style={{ background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>6</span>
        <span style={{ fontSize: 10, color: "var(--sm-text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s ease" }}>▾</span>
      </button>

      <div
        className="svc-modal-scroll"
        style={{
          position: "fixed",
          top: pos ? pos.top : 0,
          left: pos ? pos.left : 0,
          width: pos ? pos.width : "min(340px, calc(100vw - 24px))",
          maxHeight: pos ? pos.maxHeight : "calc(100vh - 100px)",
          overflowY: "auto",
          background: "var(--sm-surface)",
          border: "1px solid var(--sm-border)", borderRadius: 20,
          boxShadow: "0 20px 60px rgba(21,101,192,.15)",
          padding: 12, zIndex: 1100,
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transform: open ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: open ? "all" : "none",
          transition: "opacity .25s ease, transform .25s ease, visibility .25s",
        }}
      >
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sm-text-muted)", padding: "4px 10px 10px", borderBottom: "1px solid var(--sm-border)", marginBottom: 8 }}>
          Our Services
        </div>
        {SERVICES.map((s, i) => <ServiceItem key={i} s={s} onClick={() => handleSelect(s.page)} />)}
      </div>
    </div>
  );
}

function ServiceItem(props) {
  const s = props.s;
  const onClick = props.onClick;
  const [hov, setHov] = useState(false);
  const SvcTag = "a";
  return (
    <SvcTag
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14, background: hov ? "var(--sm-hover)" : "transparent", textDecoration: "none", transition: "background .22s ease", cursor: "pointer" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, background: s.bg, color: "var(--sm-navy)", transform: hov ? "scale(1.1) rotate(-5deg)" : "scale(1)", transition: "transform .25s ease" }}>
        {s.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--sm-text)", lineHeight: 1.2 }}>{s.label}</div>
        <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 2 }}>{s.sub}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--sm-navy)", opacity: hov ? 1 : 0, transform: hov ? "translateX(0)" : "translateX(-6px)", transition: "all .22s ease", marginLeft: "auto" }}>›</span>
    </SvcTag>
  );
}

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

function ThemeToggle(props) {
  const compact = props.compact || false;
  const [theme, toggle] = useTheme();
  const [hov, setHov] = useState(false);
  const isDark = theme === "dark";
  return (
    <button
      className="nav-theme-toggle"
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
      <span style={{ fontSize: 16, lineHeight: 1 }}>{isDark ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}</span>
    </button>
  );
}

function WaBtn(props) {
  const full = props.full === undefined ? true : props.full;
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

function DemoBtn(props) {
  const full = props.full === undefined ? true : props.full;
  const [hov, setHov] = useState(false);
  return (
    <a
      href="https://demo.schoolmentor.ai/"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: full ? "9px 16px" : "9px 12px",
        borderRadius: 11, background: "linear-gradient(135deg,#1DB88A,#0D7A5F)",
        color: "#fff", fontSize: 14, fontWeight: 700,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        textDecoration: "none", whiteSpace: "nowrap",
        boxShadow: hov ? "0 8px 24px rgba(13,122,95,.4)" : "0 4px 16px rgba(13,122,95,.25)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        filter: hov ? "brightness(1.08)" : "brightness(1)",
        transition: "all .25s ease",
      }}
    >
      {full ? "Book Demo" : <i className="fa-solid fa-calendar-check" />}
    </a>
  );
}

function LoginBtn(props) {
  const full = props.full === undefined ? true : props.full;
  const [hov, setHov] = useState(false);
  const LinkTag = "a";
  return (
    <LinkTag
      href="https://erp.schoolmentor.ai/"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: full ? "9px 16px" : "9px 12px",
        borderRadius: 11, background: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
        color: "#fff", fontSize: 14, fontWeight: 700,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        textDecoration: "none", whiteSpace: "nowrap",
        boxShadow: hov ? "0 8px 24px rgba(21,101,192,.4)" : "0 4px 16px rgba(21,101,192,.25)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        filter: hov ? "brightness(1.08)" : "brightness(1)",
        transition: "all .25s ease",
      }}
    >
      {full ? "Login" : <i className="fa-solid fa-user" />}
    </LinkTag>
  );
}

function Hamburger(props) {
  const open = props.open;
  const onClick = props.onClick;
  return (
    <button
      onClick={onClick}
      aria-label="Toggle menu"
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
        width: 44, height: 44, padding: 9,
        borderRadius: 10, border: "none",
        background: "rgba(21,101,192,.07)", cursor: "pointer",
        marginLeft: "auto",
      }}
    >
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 22, height: 2.5, background: "#1D4ED8", borderRadius: 2,
          transition: "all .3s ease", transformOrigin: "center",
          ...(open && i === 0 ? { transform: "translateY(7.5px) rotate(45deg)" } : {}),
          ...(open && i === 1 ? { opacity: 0, transform: "scaleX(0)" } : {}),
          ...(open && i === 2 ? { transform: "translateY(-7.5px) rotate(-45deg)" } : {}),
        }} />
      ))}
    </button>
  );
}

function MobileDrawer(props) {
  const open = props.open;
  const onClose = props.onClose;
  const setPage = props.setPage;
  const activePage = props.activePage;
  const onOpenSignup = props.onOpenSignup;
  const onOpenService = props.onOpenService;
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const MobileLoginTag = "a";

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
        <MobLink label="Home" href={pathForPage("home")} active={activePage === "home"} onClick={() => go("home")} />

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
            <span style={{ background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>6</span>
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

        {NAV_LINKS.filter(l => l.page !== "home").map(l => (
          <MobLink key={l.page} label={l.label} href={pathForPage(l.page)} active={activePage === l.page} onClick={() => go(l.page)} />
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, padding: "0 4px" }}>
          <button
            onClick={() => window.open("https://wa.me/923700036867", "_blank")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(37,211,102,.3)" }}>
            WhatsApp
          </button>
          <MobileLoginTag
            href="https://erp.schoolmentor.ai/"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", boxShadow: "0 4px 16px rgba(21,101,192,.25)" }}>
            Login
          </MobileLoginTag>
        </div>
        <div style={{ padding: "10px 4px 0" }}>
          <a
            href="https://demo.schoolmentor.ai/"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#1DB88A,#0D7A5F)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", boxShadow: "0 4px 16px rgba(13,122,95,.25)" }}>
            <i className="fa-solid fa-calendar-check" /> Book Demo
          </a>
        </div>
        <div style={{ padding: "10px 4px 0" }}>
          <button
            onClick={() => { onClose(); onOpenSignup(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 13, borderRadius: 13, background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(21,101,192,.25)" }}>
            <i className="fa-solid fa-pen" /> Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

function MobLink(props) {
  const label = props.label;
  const active = props.active;
  const onClick = props.onClick;
  const href = props.href;
  const [hov, setHov] = useState(false);
  const MTag = "a";
  return (
    <MTag
      href={href}
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
      {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)" }} />}
    </MTag>
  );
}

function MobServiceItem(props) {
  const s = props.s;
  const onClick = props.onClick;
  const [pressed, setPressed] = useState(false);
  const MSTag = "a";
  return (
    <MSTag
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
    </MSTag>
  );
}

export default function Navbar(props) {
  const loading = props.loading === undefined ? true : props.loading;
  const page = props.page === undefined ? "home" : props.page;
  const setPage = props.setPage;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showService, setShowService] = useState(null);
  const isMobile = useIsMobile();

  const toggleMobile = useCallback(() => setMobileOpen(o => !o), []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowService(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const openSignup = () => { setShowLogin(false); setShowSignup(true); setMobileOpen(false); };
    window.addEventListener("sm:open-signup", openSignup);
    return () => window.removeEventListener("sm:open-signup", openSignup);
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
          maxWidth: 1440, margin: "0 auto",
          padding: isMobile ? "0 16px" : "0 24px", height: 68, gap: 4,
        }}>
          <Logo onClick={() => go("home")} />

          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}>
              <NavLink label="Home" href={pathForPage("home")} active={page === "home"} onClick={() => go("home")} />
              <ServicesDropdown setPage={setPage} onOpenService={(p) => setShowService(p)} />
              {NAV_LINKS.filter(l => l.page !== "home").map(l => (
                <NavLink key={l.page} label={l.label} href={pathForPage(l.page)} active={page === l.page} onClick={() => go(l.page)} />
              ))}
            </div>
          )}

          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
              <ThemeToggle compact={isCompact} />
              <DemoBtn full={!isCompact} />
              <LoginBtn full={!isCompact} />
            </div>
          )}

          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <ThemeToggle compact />
              <Hamburger open={mobileOpen} onClick={toggleMobile} />
            </div>
          )}
        </div>
      </nav>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        setPage={setPage}
        activePage={page}
        onOpenSignup={() => setShowSignup(true)}
        onOpenService={(p) => setShowService(p)}
      />

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
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
            <Login onSignUp={() => { setShowLogin(false); setShowSignup(true); }} />
          </div>
        </div>
      )}

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
              width: "100%", maxWidth: 1160,
              maxHeight: "92vh",
              display: "flex", flexDirection: "column",
              borderRadius: 24,
              boxShadow: "0 32px 80px rgba(0,0,0,.35)",
              animation: "loginModalIn .3s ease",
              position: "relative",
              overflow: "hidden",
              background: "var(--sm-surface)",
            }}>
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
              ><i className="fa-solid fa-xmark" aria-hidden="true" /></button>

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
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
            <SignUp onLogin={() => { setShowSignup(false); window.location.href = "https://erp.schoolmentor.ai/"; }} />
          </div>
        </div>
      )}
    </>
  );
}