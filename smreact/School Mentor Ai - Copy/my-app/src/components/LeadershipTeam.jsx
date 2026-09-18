import { useState, useRef, useEffect } from "react";
import sirAthar from '../assets/sirAthar.jpeg';
//import NomanImg from '../assets/.jpeg';
import sirHaroon from '../assets/sirHaroon.jpeg';
import mamRomana from '../assets/mamRomana.jpeg';
import SirIslahudin from '../assets/SirIslahudin.jpeg';
import mamAsifa from '../assets/mamAsifa.jpeg';
import noman from '../assets/noman.jpg';
import drMudasir from '../assets/Dr Mudasir.jpeg';
import hamzaImg from '../assets/Hamzu.jpeg';
import drAmirGhafoor from '../assets/Dramirgafoor.jpeg';
import manzoorImg from '../assets/Manzoor.jpeg';
import zaheerImg from '../assets/Zaheer.jpeg';
import ijazImg from '../assets/Ijaz.jpeg';
// ─────────────────────────────────────────────────────────────────
// Replace this import with your actual image path e.g.:
// import NomanImg from "./assets/Mr__Noman_1.png";
// Then set photo: NomanImg in the TIERS data below.
// ─────────────────────────────────────────────────────────────────
// ← swap with your import

// ── Data ──────────────────────────────────────────────────────────
const TIERS = [
  {
    id: "core",
    badge: "Core Team",
    label: "Founders & C-Suite",
    accentClass: "core",
    accentColor: "#1D4ED8",
    lineGradient: "linear-gradient(90deg,rgba(21,101,192,.25),transparent)",
    badgeStyle: { background: "rgba(21,101,192,.1)", color: "#1D4ED8", border: "1px solid rgba(21,101,192,.2)", dot: "#1D4ED8" },
    members: [
      { id: "ijaz", name: "Ijaz Haider", role: "Patron-in-Chief", c1: "#2563EB", c2: "#3B82F6", photo: ijazImg, bio: ["Ijaz Haider is a US-based serial entrepreneur with extensive experience in business development, technology, and organizational leadership. As Director and Patron-in-Chief of School Mentor, he provides strategic guidance and visionary leadership to support the organization’s long-term mission. Passionate about transforming education in Pakistan and beyond, he actively contributes his global business insights and technology expertise to strengthen innovation, scalability, and sustainable growth while helping educational institutions adopt modern systems and future-ready solutions."] },
      { id: "athar", name: "Mian Athar Bashir", role: "Chairman & Co-Founder", c1: "#1D4ED8", c2: "#3B82F6", photo: sirAthar, bio: ["Athar Bashir is a serial entrepreneur and finance professional with international experience across New Zealand and Australia. As Co-Founder and CFO of School Mentor, he plays a key role in strategic planning, financial management, and long-term organizational growth.", "Driven by a shared vision to uplift Pakistan's education sector, he is committed to helping schools adopt standardized systems, modern technologies, and innovative solutions that improve operational efficiency and institutional sustainability across Pakistan and beyond."] },
      { id: "noman", name: "Noman Afzal", role: "CEO & Co-Founder", c1: "#1D4ED8", c2: "#3B82F6", photo: noman, bio: ["Noman Afzal is a young Pakistani entrepreneur with over 12 years of experience in establishing and managing educational institutions. He previously co-founded one of Pakistan’s leading franchise school networks with more than 100 branches nationwide. As CEO and Co-Founder of School Mentor, he is leading the mission to standardize and strengthen educational institutions through technology, AI-powered solutions, professional training, operational manuals, and centralized systems designed for sustainable educational excellence in Pakistan and beyond."] },
      { id: "islahudin", name: "Dr. Islahudin", role: "COO & Director Academics", c1: "#3B82F6", c2: "#1D4ED8", photo: SirIslahudin, bio: ["Dr. Islahudin holds a PhD in Physics from Massey University, New Zealand, and serves as the Chief Operating Officer and Director Academics at School Mentor. He oversees academic quality, operational excellence, and product evaluation processes within the organization. With a strong background in scientific research, quality assurance, and analytical problem-solving, he plays a critical role in reviewing and refining systems, tools, and educational products before implementation to ensure high standards and effective outcomes."] },
    ],
  },
  {
    id: "board",
    badge: "Board of Consultants",
    label: "Advisory & Governance",
    accentColor: "#6d28d9",
    lineGradient: "linear-gradient(90deg,rgba(109,40,217,.25),transparent)",
    badgeStyle: { background: "rgba(109,40,217,.1)", color: "#6d28d9", border: "1px solid rgba(109,40,217,.2)", dot: "#6d28d9" },
    members: [
      { id: "ghafoor", name: "Prof. Dr. Aamir Ghafoor", role: "Consultant - STEM, Science Education & Academic Innovation", c1: "#6d28d9", c2: "#db2777", photo: drAmirGhafoor, bio: ["Prof. Dr. Aamir Ghafoor is a distinguished academician, researcher, and professor with extensive expertise in higher education, research leadership, quality assurance, and scientific innovation. With international academic exposure and a strong background in research and university-level teaching, he brings valuable insights into educational excellence and evidence-based academic development.", "As an International Research & Academic Excellence Consultant at School Mentor, he advises the organization on academic quality frameworks, teacher professional development, research-driven educational practices, STEM education, and institutional improvement strategies. His guidance supports School Mentor in developing innovative solutions that align with global educational standards while promoting excellence in teaching, learning, and school improvement."] },
      { id: "muddser", name: "Dr. M. Altaf, PhD", role: "Global Education Systems Consultant", c1: "#6d28d9", c2: "#4338ca", photo: drMudasir, bio: ["Dr. M. Altaf, DSc, PhD is a distinguished education and research professional based in New Zealand, with extensive experience in higher education, academic leadership, research, quality assurance, and institutional development. As an International Academic & Education Systems Consultant at School Mentor, he provides strategic guidance on aligning educational practices with international standards, particularly for the Australian and New Zealand education markets. He advises on academic excellence, curriculum innovation, teacher development, quality frameworks, and the adaptation of School Mentor's products and services to meet global educational requirements and emerging trends."] },
      { id: "zaheer", name: "Zaheer Tariq", role: "Enterprise Technology Consultant", c1: "#6d28d9", c2: "#4338ca", photo: zaheerImg, bio: ["Zaheer Tariq is a globally recognized Technology Architect and Digital Transformation Leader with over 15 years of experience designing, developing, and delivering enterprise-scale technology solutions. Based in the United States, he is a Sitecore Technology MVP, Certified AI Professional, Microsoft Certified Solutions Developer (MCSD), Microsoft Certified Trainer (MCT), and Certified Scrum Master (CSM), with extensive expertise in enterprise architecture, cloud technologies, artificial intelligence, digital experience platforms, and large-scale system integrations.", "As an Enterprise Technology & Digital Transformation Consultant at School Mentor, Zaheer provides strategic guidance on technology architecture, platform scalability, AI adoption, cloud infrastructure, cybersecurity, and product innovation. His expertise supports School Mentor in building world-class educational technology solutions that are secure, scalable, future-ready, and aligned with international best practices."] },
    ],
  },
  {
    id: "mgmt",
    badge: "Management Team",
    label: "Department Heads",
    accentColor: "#3B82F6",
    lineGradient: "linear-gradient(90deg,rgba(37,99,235,.25),transparent)",
    badgeStyle: { background: "rgba(37,99,235,.1)", color: "#1D4ED8", border: "1px solid rgba(37,99,235,.2)", dot: "#3B82F6" },
    members: [
      {
        id: "yousuf", name: "Haroon Sheikh", role: "Chief Product Officer (CPO)", c1: "#2563EB", c2: "#3B82F6", photo: sirHaroon, bio: ["Haroon is the Chief Product Officer at School Mentor, leading product strategy, development, and innovation. A seasoned full-stack engineer with over 10 years of professional experience, including his time at Systems Limited, Haroon brings a rare combination of deep technical expertise and product leadership to the EdTech space.", "He has been instrumental in designing and engineering digital solutions that solve real-world operational and academic challenges faced by educational institutions. His full-stack background covering everything from modern frontend frameworks to scalable backend systems and cloud infrastructure empowers him to drive both vision and execution.", "With a strong focus on usability, scalability, and user experience, Haroon works closely with technical and operational teams to ensure School Mentor delivers practical, modern, and impactful systems that empower schools to achieve greater efficiency and educational excellence."]
      },
      { id: "mansoor", name: "Manzoor Hussain", role: "Head of AI & Innovation", c1: "#3B82F6", c2: "#1D4ED8", photo: manzoorImg, bio: ["Manzoor Hussain is an accomplished technology leader with over seven years of experience in software engineering, artificial intelligence, machine learning, and enterprise application development. With extensive expertise in Python, Django, Django REST Framework, AI-powered solutions, cloud technologies, and modern software architecture, he has successfully designed and delivered scalable, secure, and high-performance applications across the education, finance, eCommerce, and enterprise sectors.", "As the Head of AI & Innovation at School Mentor, Manzoor Ahmad leads the organization's AI vision, product innovation, and technology transformation initiatives. He oversees the development of intelligent educational solutions, including AI-powered teaching assistants, automated lesson planning, assessment generation, content creation, and advanced educational analytics. His leadership ensures that School Mentor remains at the forefront of educational technology by leveraging artificial intelligence and automation to empower schools, educators, and educational leaders."] },
      { id: "Asifa Sabir", name: "Asifa Sabir", role: "Chief Marketing Officer (CMO)", c1: "#2563EB", c2: "#3B82F6", photo: mamAsifa, bio: ["Asifa Sabir is an educator by background and a strategist by practice, Asifa understands the challenges schools face because she has experienced them firsthand. As Chief Marketing Officer at School Mentor, she leads the marketing and communication strategy behind Pakistan’s complete school operating system. Through impactful campaigns, meaningful storytelling, and strategic digital outreach, she connects principals, teachers, school owners, and administrators with innovative solutions that empower schools to manage smarter, train better, and grow confidently in today’s evolving education landscape."] },
      { id: "romana", name: "Romana Shabir", role: "Head of Customer Success & Support", c1: "#2563EB", c2: "#3B82F6", photo: mamRomana, bio: ["Romana Shabir is the Head of Customer Success & Support and customer relations, onboarding, and support operations.  Previously served as Head of Sales for over two years, where she played a key role in expanding the company’s reach and building strong relationships with educational institutions.Romana combines relationship management and communication expertise with strategic leadership. Her dedication to service excellence continues to support School Mentor’s growth and strengthen its impact in the education sector."] },
      { id: "Hamza", name: "Hamza Iftikhar", role: "Chief Administrative Officer (CAO)", c1: "#2563EB", c2: "#3B82F6", photo: hamzaImg, bio: ["Hamza Iftikhar leads administrative operations at School Mentor and serves as a key coordination link between Sales, Customer Support, Operations, and Technical Teams. He ensures smooth internal communication, supports customer success initiatives, and helps maintain operational excellence across the organization."] },

    ],
  },
];

// ── Responsive hook ───────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

// ── Avatar: profile photo floating above card (no bulky ring) ─────
function Avatar({ member, hovered, mobile }) {
  const gradId = `ring_${member.id}`;
  const size = mobile ? 112 : 152;
  const top = mobile ? -46 : -62;
  return (
    <div style={{
      position: "absolute", top, left: "50%",
      transform: "translateX(-50%)", zIndex: 2,
    }}>
      {/* Profile photo is the focus — clean thin border + soft floating shadow */}
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "var(--sm-surface)",
        border: "4px solid var(--sm-surface)",
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: hovered
          ? "0 18px 40px rgba(15,23,42,.24), 0 0 0 1px var(--sm-border)"
          : "0 10px 26px rgba(15,23,42,.16), 0 0 0 1px var(--sm-border)",
        transition: "transform .35s cubic-bezier(.22,.97,.47,1), box-shadow .35s ease",
        transform: hovered ? "translateY(-6px) scale(1.04)" : "translateY(0) scale(1)",
        willChange: "transform",
      }}>
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", borderRadius: "50%", display: "block" }}
          />
        ) : (
          // Placeholder silhouette for members without a photo (keeps tier accent)
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: `linear-gradient(135deg,${member.c1}1f,${member.c2}1f)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 44 44" fill="none" width={mobile ? 44 : 56} height={mobile ? 44 : 56}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor={member.c1} />
                  <stop offset="1" stopColor={member.c2} />
                </linearGradient>
              </defs>
              <circle cx="22" cy="16" r="9" fill={`url(#${gradId})`} />
              <ellipse cx="22" cy="36" rx="14" ry="9" fill={`url(#${gradId})`} opacity={0.8} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────
function MemberCard({ member, tier, isActive, onClick, animDelay, mobile }) {
  const [hov, setHov] = useState(false);

  // Board tier keeps its intentional purple accent; others use the unified blue system.
  const hoverShadow = "0 16px 36px -16px var(--sm-shadow)";

  const hoverBorder = tier.id === "board" ? "rgba(109,40,217,.3)" : "var(--sm-navy)";

  const topBarGrad = {
    core: "var(--sm-navy)",
    board: "linear-gradient(90deg,#6d28d9,#db2777)",
    mgmt: "var(--sm-navy)",
  }[tier.id];

  const isHovOrActive = hov || isActive;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${isHovOrActive ? hoverBorder : "var(--sm-border)"}`,
        borderRadius: 18,
        padding: mobile ? "92px 14px 20px" : "118px 18px 22px",
        width: "100%",
        boxSizing: "border-box",
        cursor: "pointer",
        textAlign: "center",
        position: "relative",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "transform .35s cubic-bezier(.22,.97,.47,1), box-shadow .35s ease, border-color .3s ease",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: (hov || isActive) ? hoverShadow : "0 1px 2px rgba(17,24,39,.04)",
        animation: `ltFadeUp .6s ease ${animDelay}s both`,
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        borderRadius: "18px 18px 0 0",
        background: topBarGrad,
        opacity: isHovOrActive ? 1 : 0,
        transition: "opacity .3s ease",
      }} />

      {/* Floating avatar */}
      <Avatar member={member} hovered={hov} mobile={mobile} />

      {/* Name */}
      <div style={{ fontSize: mobile ? 14 : 17, fontWeight: 700, color: "var(--sm-text)", marginBottom: mobile ? 5 : 7, lineHeight: 1.3 }}>
        {member.name}
      </div>

      {/* Role */}
      <div style={{ fontSize: mobile ? 12 : 13, fontWeight: 500, color: tier.accentColor, lineHeight: 1.5 }}>
        {member.role}
      </div>

      {/* Hint */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        marginTop: 14, fontSize: 10, color: "var(--sm-text-muted)", fontWeight: 500,
        opacity: hov ? 1 : 0,
        transform: hov ? "translateY(0)" : "translateY(4px)",
        transition: "opacity .25s ease, transform .25s ease",
      }}>
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sm-gray300)" }} />
        View Bio
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sm-gray300)" }} />
      </div>
    </div>
  );
}

// ── Bio panel ─────────────────────────────────────────────────────
function BioPanel({ member, tier, onClose }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      background: "var(--sm-surface)", border: "1.5px solid var(--sm-border)",
      borderRadius: isMobile ? 16 : 22,
      padding: isMobile ? "20px 16px" : "30px 36px",
      position: "relative", marginTop: 10,
      animation: "ltBioSlide .4s ease both",
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 14, right: 14,
          width: 34, height: 34, borderRadius: "50%",
          border: "1px solid var(--sm-border)", background: "var(--sm-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 18, color: "var(--sm-text-muted)", padding: 0,
          transition: "all .2s ease", flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--sm-hover)"; e.currentTarget.style.color = "var(--sm-text)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--sm-surface)"; e.currentTarget.style.color = "var(--sm-text-muted)"; }}
      >×</button>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: isMobile ? 14 : 20,
        marginBottom: isMobile ? 16 : 22,
        paddingBottom: isMobile ? 14 : 20,
        paddingRight: 40,
        borderBottom: "1px solid var(--sm-border)",
      }}>
        <div style={{
          width: isMobile ? 60 : 80,
          height: isMobile ? 60 : 80,
          borderRadius: "50%", flexShrink: 0, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg,${member.c1},${member.c2})`,
          padding: 2,
        }}>
          {member.photo ? (
            <img src={member.photo} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", borderRadius: "50%", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "var(--sm-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 44 44" fill="none" width={isMobile ? 36 : 44} height={isMobile ? 36 : 44}>
                <defs>
                  <linearGradient id={`bio_${member.id}`} x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor={member.c1} /><stop offset="1" stopColor={member.c2} />
                  </linearGradient>
                </defs>
                <circle cx="22" cy="16" r="9" fill={`url(#bio_${member.id})`} />
                <ellipse cx="22" cy="36" rx="14" ry="9" fill={`url(#bio_${member.id})`} opacity={0.8} />
              </svg>
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 16 : 21, fontWeight: 700, color: "var(--sm-text)", wordBreak: "break-word" }}>{member.name}</div>
          <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: tier.accentColor, marginTop: 4, lineHeight: 1.4 }}>{member.role}</div>
        </div>
      </div>

      {/* Bio text */}
      <div style={{ fontSize: isMobile ? 13 : 14, color: "var(--sm-text-muted)", lineHeight: 1.85 }}>
        {member.bio.map((para, i) => (
          <p key={i} style={{ marginTop: i > 0 ? 12 : 0 }}>{para}</p>
        ))}
      </div>
    </div>
  );
}

// ── Mobile Slider (native swipe/drag + dots, no arrows) ───────────
function MobileSlider({ tier, activeId, onCardClick }) {
  const [idx, setIdx] = useState(0);
  const total = tier.members.length;
  const trackRef = useRef(null);

  // Distance from one card's start to the next (card width + flex gap).
  const stepWidth = () => {
    const el = trackRef.current;
    const card = el?.querySelector(".lt-slide-card");
    return (card ? card.offsetWidth : Math.min(250, window.innerWidth * 0.8 - 60)) + 18;
  };

  // Keep the active dot in sync as the user swipes/drags the track.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / stepWidth());
    setIdx(Math.max(0, Math.min(total - 1, i)));
  };

  // Dot tap → smooth-scroll the matching card into view.
  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * stepWidth(), behavior: "smooth" });
    setIdx(i);
  };

  return (
    <div style={{ position: "relative", padding: "0 16px", paddingTop: 50 }}>
      {/* Native horizontal scroll-snap track — swipe anywhere to navigate */}
      <div
        ref={trackRef}
        className="lt-mobile-track"
        onScroll={handleScroll}
        style={{
          display: "flex", gap: 18,
          padding: "70px 4px 4px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {tier.members.map((m, i) => (
          <div key={m.id} className="lt-slide-card" style={{ flexShrink: 0, width: "min(250px, calc(80vw - 60px))", scrollSnapAlign: "start" }}>
            <MemberCard
              member={m}
              tier={tier}
              isActive={activeId === m.id}
              onClick={() => onCardClick(m.id)}
              animDelay={i * 0.05}
              mobile={true}
            />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
        {tier.members.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to member ${i + 1}`}
            style={{
              width: i === idx ? 24 : 7,
              height: 7, borderRadius: i === idx ? 4 : "50%",
              background: i === idx ? "var(--sm-navy)" : "var(--sm-border)",
              border: "none", padding: 0, cursor: "pointer",
              transition: "all .28s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tier section ──────────────────────────────────────────────────
function TierSection({ tier }) {
  const [activeId, setActiveId] = useState(null);
  const isMobile = useIsMobile();

  const handleCard = (id) => {
    setActiveId(prev => prev === id ? null : id);
  };

  const activeMember = tier.members.find(m => m.id === activeId) || null;

  return (
    <div style={{ maxWidth: "clamp(1200px, 93vw, 1850px)", margin: "0 auto 48px", minWidth: 0 }}>
      {/* Tier label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 14px", borderRadius: 100,
          fontSize: 10, fontWeight: 700, letterSpacing: "1px",
          textTransform: "uppercase", flexShrink: 0,
          ...tier.badgeStyle,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: tier.badgeStyle.dot }} />
          {tier.badge}
        </div>
        <div style={{ flex: 1, height: 1, background: tier.lineGradient }} />
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sm-text-muted)" }}>
          {tier.label}
        </div>
      </div>

      {/* Bio panel */}
      {activeMember && (
        <div style={{ overflow: "hidden", marginBottom: 12, animation: "ltBioOpen .45s cubic-bezier(.22,.97,.47,1)" }}>
          <BioPanel member={activeMember} tier={tier} onClose={() => setActiveId(null)} />
        </div>
      )}

      {/* Desktop grid — auto-fit so cards always reflow cleanly; rowGap leaves
          room for the avatar that floats ~62px above each card (no overlap). */}
      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(248px, 296px))", justifyContent: "center", columnGap: 26, rowGap: 96, paddingTop: 82 }}>
          {tier.members.map((m, i) => (
            <MemberCard
              key={m.id}
              member={m}
              tier={tier}
              isActive={activeId === m.id}
              onClick={() => handleCard(m.id)}
              animDelay={0.05 + i * 0.05}
              mobile={false}
            />
          ))}
        </div>
      )}

      {/* Mobile slider */}
      {isMobile && (
        <MobileSlider tier={tier} activeId={activeId} onCardClick={handleCard} />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export default function LeadershipTeam() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ltFadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ltBioSlide  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ltBioOpen   { from{max-height:0;opacity:0} to{max-height:700px;opacity:1} }
        .lt-mobile-track::-webkit-scrollbar { display: none; }
      `}</style>

      <section style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--sm-surface-alt)", padding: "clamp(28px,4vw,40px) clamp(16px,2vw,24px) clamp(36px,5vw,56px)" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2.5px", textTransform: "uppercase", color: "var(--sm-navy)", marginBottom: 10 }}>
            The people behind the platform
          </div>
          <h2 style={{ fontSize: "clamp(22px,5vw,34px)", fontWeight: 800, color: "var(--sm-text)", lineHeight: 1.15, marginBottom: 12, letterSpacing: "-.5px" }}>
            Meet Our{" "}
            <span style={{ color: "var(--sm-navy)" }}>
              Leadership Team
            </span>
          </h2>
          <p style={{ fontSize: 15, color: "var(--sm-text-muted)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Experienced educators and technologists driving Pakistan's school transformation
          </p>
        </div>

        {/* Tiers */}
        {TIERS.map(tier => <TierSection key={tier.id} tier={tier} />)}
      </section>
    </>
  );
}
