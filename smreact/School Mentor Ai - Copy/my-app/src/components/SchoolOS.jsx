import { useState, useRef, useEffect, useCallback } from "react";
import { openDemoForm } from "./DemoRequestModal.jsx";

// ── Data ──────────────────────────────────────────────────────────
const TABS = [
  {
    id: 0,
    icon: <i className="fa-solid fa-desktop" />, sidebarName: "School Mentor ERP", sidebarSub: "18 Core Modules",
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
  },
  {
    id: 1,
    icon: <i className="fa-solid fa-mobile-screen-button" />, sidebarName: "Mobile App", sidebarSub: "3 Apps for All Stakeholders",
    badgeSub: "Module 2 of 6",
    titlePrefix: "SchoolMentor", accent: "Mobile App", tm: false,
    desc: "An integrated mobile ecosystem with 3 dedicated apps for Principals, Teachers, and Parents plus built-in chat, video learning, gamification, and AI keeping every stakeholder connected in real time.",
    ppLabel: "Available on", ppVal: "Android · iOS", ppIcons: [<i className="fa-brands fa-android" />, <i className="fa-brands fa-apple" />],
    stats: [{ v: "3", l: "Apps" }, { v: "8", l: "Features" }, { v: "Live", l: "Sync" }, { v: "AI", l: "Integrated" }],
    floatCards: [{ i: <i className="fa-solid fa-mobile-screen-button" />, v: "3", l: "Dedicated Apps" }, { i: <i className="fa-solid fa-bell" />, v: "Live", l: "Notifications" }, { i: <i className="fa-solid fa-wand-magic-sparkles" />, v: "AI", l: "Integrated" }],
    secPill: "Mobile Ecosystem", secH2: ["", "8 Features", " in the Mobile Ecosystem"],
    ctaTitle: "Stay connected with your school, anywhere.", ctaSub: "Download SchoolMentor apps for Principals, Teachers & Parents on Android & iOS.",
    modules: [
      { n: "01", icon: <i className="fa-solid fa-school" />, name: "Principal & Admin Mobile App", desc: "Complete school management at your fingertips with real-time academics, attendance, meetings, tasks, reports, notifications, calendars, fee updates, staff management, approvals, and overall school operations." },
      { n: "02", icon: <i className="fa-solid fa-chalkboard-user" />, name: "Teacher Mobile App", desc: "Manage daily teaching operations including attendance, lesson plans, lesson implementation, homework, submissions, notebooks, academic calendars, leave applications, notices, meetings, tasks, and classroom activities." },
      { n: "03", icon: <i className="fa-solid fa-user-group" />, name: "Parent Mobile App", desc: "Stay connected with your child's school through attendance updates, fee alerts, results, homework, notices, meetings, academic progress, leave management, complaints, calendars, PDF notes, and real-time communication." },
      { n: "04", icon: <i className="fa-solid fa-bell" />, name: "Push Notifications System", desc: "Instantly send important alerts, notices, reminders, meeting updates, fee notifications, attendance alerts, and announcements to all stakeholders in real time." },
      { n: "05", icon: <i className="fa-solid fa-comment-dots" />, name: "Built-in Chat System", desc: "Secure in-app communication platform with no third-party dependency, allowing seamless communication between principals, teachers, parents, and management teams." },
      { n: "06", icon: <i className="fa-solid fa-film" />, name: "E-Tube Video Platform", desc: "Integrated educational video browsing platform where students, teachers, and parents can access learning content, tutorials, training videos, and educational resources." },
      { n: "07", icon: <i className="fa-solid fa-gamepad" />, name: "Gamified Learning Platform", desc: "Interactive online quiz games and engagement activities designed to improve student participation, learning outcomes, and classroom motivation." },
      { n: "08", icon: <i className="fa-solid fa-wand-magic-sparkles" />, name: "Mentor AI Integration", desc: "AI-powered assistant integrated directly into the mobile apps for smart communication, lesson planning, academic support, content generation, and intelligent school assistance." },
    ],
  },
  {
    id: 2,
    icon: <i className="fa-solid fa-clipboard-list" />, sidebarName: "Operational Manuals", sidebarSub: "100+ Ready-to-Use Manuals",
    badgeSub: "Module 3 of 6",
    titlePrefix: "School Operational", accent: "Manuals", tm: false,
    desc: "100+ ready-to-use operational manuals covering every school department from academics and HR to safety and digital systems. Standardizing processes, ensuring compliance, and empowering staff across all operations.",
    ppLabel: "Format", ppVal: "Digital · Printable · Video", ppIcons: [<i className="fa-solid fa-file-lines" />, <i className="fa-solid fa-laptop" />, <i className="fa-solid fa-video" />],
    stats: [{ v: "100+", l: "Manuals" }, { v: "8", l: "Categories" }, { v: "Ready", l: "To Use" }, { v: "Video", l: "Tutorials" }],
    floatCards: [{ i: <i className="fa-solid fa-clipboard-list" />, v: "100+", l: "Manuals" }, { i: <i className="fa-solid fa-folder-open" />, v: "8", l: "Categories" }, { i: <i className="fa-solid fa-circle-check" />, v: "Ready", l: "To Use" }],
    secPill: "Manual Categories", secH2: ["", "8 Categories", " of Ready-to-Use Manuals"],
    ctaTitle: "Standardize every school operation.", ctaSub: "100+ ready-to-use manuals covering every department — available digitally, in print, and via video.",
    modules: [
      { n: "01", icon: <i className="fa-solid fa-graduation-cap" />, name: "Academic Operations Manuals", desc: "Complete academic workflow documentation covering lesson planning, schemes of work, academic calendars, classroom management, and curriculum delivery standards." },
      { n: "02", icon: <i className="fa-solid fa-file-pen" />, name: "Examination & Assessment Manuals", desc: "Standardized procedures for exam scheduling, date sheets, result processing, question paper management, grading, and assessment quality control." },
      { n: "03", icon: <i className="fa-solid fa-users" />, name: "Administration & HR Manuals", desc: "Staff hiring, onboarding, appraisal systems, leave management, payroll procedures, record keeping, and all HR administrative workflows." },
      { n: "04", icon: <i className="fa-solid fa-money-bill-wave" />, name: "Accounts & Fee Management Manuals", desc: "Fee collection procedures, challan management, discount policies, budgeting standards, accounts management, audit trails, and financial reporting guidelines." },
      { n: "05", icon: <i className="fa-solid fa-bullhorn" />, name: "Parent Communication & Engagement Manuals", desc: "Parent engagement protocols, notice issuance, complaint handling, meeting procedures, social media guidelines, and community communication standards." },
      { n: "06", icon: <i className="fa-solid fa-desktop" />, name: "Digital Systems & ERP Usage Manuals", desc: "Step-by-step guides for using SchoolMentor ERP, mobile apps, and all digital tools with video tutorials for staff, teachers, and administrators." },
      { n: "07", icon: <i className="fa-solid fa-palette" />, name: "School Décor Plans", desc: "Professionally designed school environment and décor guidelines covering classroom layouts, display boards, common areas, and campus visual identity standards." },
      { n: "08", icon: <i className="fa-solid fa-house-medical" />, name: "Student Health & Safety Manuals", desc: "Complete health and safety protocols including first aid procedures, emergency response, hygiene standards, incident reporting, and campus safety guidelines." },
    ],
  },
  {
    id: 3,
    icon: <i className="fa-solid fa-chalkboard-user" />, sidebarName: "Teacher Training Workshops", sidebarSub: "Monthly Development Program",
    badgeSub: "Module 4 of 6",
    titlePrefix: "Teacher", accent: "Trainings", tm: false,
    desc: "Interactive and engaging online training sessions designed for all school stakeholders. Every month, expert trainers are onboarded on different topics to equip schools with modern skills, professional strategies, practical implementation methods, online quizzes, and E-Certifications.",
    ppLabel: "Mode", ppVal: "Online · Monthly · Live", ppIcons: [<i className="fa-solid fa-video" />, <i className="fa-solid fa-laptop" />, <i className="fa-solid fa-trophy" />],
    stats: [{ v: "12", l: "Per Year" }, { v: "8", l: "Tracks" }, { v: "E-Cert", l: "Certified" }, { v: "Monthly", l: "Sessions" }],
    floatCards: [{ i: <i className="fa-solid fa-graduation-cap" />, v: "E-Cert", l: "Certified" }, { i: <i className="fa-solid fa-chalkboard-user" />, v: "Expert", l: "Trainers" }, { i: <i className="fa-solid fa-calendar-days" />, v: "Monthly", l: "Sessions" }],
    secPill: "Training Tracks", secH2: ["", "8 Monthly", " Development Training Tracks"],
    ctaTitle: "Invest in your school's biggest asset — your people.", ctaSub: "Monthly expert-led training sessions with online quizzes and E-Certifications for all school staff.",
    modules: [
      { n: "01", icon: <i className="fa-solid fa-graduation-cap" />, name: "Academic Excellence Training", desc: "Equip teachers and academic staff with best practices in curriculum delivery, lesson quality, student assessment, and academic standard-setting." },
      { n: "02", icon: <i className="fa-solid fa-school" />, name: "Administration & School Operations", desc: "Train admin and management teams on efficient school operations, documentation, scheduling, compliance, and institutional management." },
      { n: "03", icon: <i className="fa-solid fa-brain" />, name: "Modern Pedagogy & Teaching Strategies", desc: "Outcome-based teaching, differentiated instruction, active learning methodologies, and student-centered classroom approaches for today's educators." },
      { n: "04", icon: <i className="fa-solid fa-laptop" />, name: "EdTech & AI Integration in Education", desc: "Using digital tools, AI assistants, learning management systems, and technology to transform classroom engagement and learning outcomes." },
      { n: "05", icon: <i className="fa-solid fa-palette" />, name: "Creative Teaching Methodologies", desc: "Gamification, project-based learning, collaborative activities, storytelling techniques, and innovative strategies to inspire and engage students." },
      { n: "06", icon: <i className="fa-solid fa-bullhorn" />, name: "School Marketing & Admissions Growth", desc: "Practical strategies for school branding, social media marketing, community outreach, admission campaigns, and student enrollment growth." },
      { n: "07", icon: <i className="fa-solid fa-star" />, name: "Character Building & Student Development", desc: "Programs focused on values education, leadership development, life skills, student discipline, and holistic personal growth." },
      { n: "08", icon: <i className="fa-solid fa-spa" />, name: "Psychological Wellbeing & Classroom Management", desc: "Mental health awareness, stress management, positive classroom environment, behavioral strategies, and teacher wellbeing practices." },
    ],
  },
  {
    id: 4,
    icon: <i className="fa-solid fa-wand-magic-sparkles" />, sidebarName: "Mentor AI", sidebarSub: "4 Smart AI Tools",
    badgeSub: "Module 5 of 6",
    titlePrefix: "Mentor", accent: "AI", tm: false,
    desc: "An intelligent AI-powered suite built directly into SchoolMentor helping teachers, admins, and school staff save hours every day with smart lesson planning, content generation, worksheet creation, and professional social media management.",
    ppLabel: "Powered by", ppVal: "AI-Powered · Cloud · Integrated", ppIcons: [<i className="fa-solid fa-wand-magic-sparkles" />, <i className="fa-brands fa-android" />, <i className="fa-solid fa-cloud" />],
    stats: [{ v: "4", l: "AI Tools" }, { v: "Smart", l: "Assistant" }, { v: "Instant", l: "Generation" }, { v: "Custom", l: "Branding" }],
    floatCards: [{ i: <i className="fa-solid fa-wand-magic-sparkles" />, v: "AI", l: "Powered" }, { i: <i className="fa-solid fa-bolt" />, v: "Instant", l: "Generation" }, { i: <i className="fa-solid fa-palette" />, v: "Custom", l: "Branding" }],
    secPill: "AI Features", secH2: ["", "4 Powerful", " Mentor AI Tools"],
    ctaTitle: "Save hours every day with Mentor AI.", ctaSub: "Smart AI tools for lesson planning, worksheets, question banks, and social media — all in one place.",
    modules: [
      { n: "01", icon: <i className="fa-solid fa-comment-dots" />, name: "AI Assistant", desc: "Smart AI-powered chat assistant for teachers and school staff to help with academic planning, communication, ideas, and daily school operations — always available, always intelligent." },
      { n: "02", icon: <i className="fa-solid fa-book-open" />, name: "Lesson Plans & Question Bank", desc: "Scan any publisher's book and instantly generate lesson plans, question banks, answers, and full academic content through Mentor AI — curriculum-aligned and ready to use." },
      { n: "03", icon: <i className="fa-solid fa-file-pen" />, name: "AI Worksheet Generator", desc: "Generate fully customized worksheets for any class, subject, or topic with your school logo, school name, and personalized formatting automatically applied." },
      { n: "04", icon: <i className="fa-solid fa-mobile-screen-button" />, name: "Social Media Content Studio", desc: "Create professional social media posts for your school using your own logos, team pictures, branding, and school content — powered by Mentor AI for polished, on-brand results." },
    ],
  },
  {
    id: 5,
    icon: <i className="fa-solid fa-building" />, sidebarName: "Dedicated Head Office Support", sidebarSub: "6 Days a Week, Always There",
    badgeSub: "Module 6 of 6",
    titlePrefix: "Head Office", accent: "Support", tm: false,
    desc: "Professional support system designed to help schools grow with continuous guidance, innovation, research, branding support, and operational assistance — just like a professionally managed school network or franchise system.",
    ppLabel: "Availability", ppVal: "6 Days a Week · Call · WhatsApp · Email", ppIcons: [<i className="fa-solid fa-phone" />, <i className="fa-solid fa-comment-dots" />, <i className="fa-solid fa-envelope" />],
    stats: [{ v: "24h", l: "Response" }, { v: "6×", l: "Days/Week" }, { v: "98%", l: "Satisfaction" }, { v: "Free", l: "Onboarding" }],
    floatCards: [{ i: <i className="fa-solid fa-bolt" />, v: "24h", l: "Response Time" }, { i: <i className="fa-solid fa-face-smile" />, v: "98%", l: "Satisfaction" }, { i: <i className="fa-solid fa-rocket" />, v: "Free", l: "Onboarding" }],
    secPill: "Support Services", secH2: ["", "4 Dedicated", " Head Office Support Services"],
    ctaTitle: "We're with you every step of the way.", ctaSub: "Dedicated Head Office team providing onboarding, training, technical support, and growth guidance — 6 days a week.",
    modules: [
      { n: "01", icon: <i className="fa-solid fa-rocket" />, name: "School Onboarding & Setup", desc: "Complete onboarding support including ERP setup, implementation guidance, data migration, and full operational activation for your school from day one." },
      { n: "02", icon: <i className="fa-solid fa-graduation-cap" />, name: "Staff Training & Capacity Building", desc: "Professional training sessions for principals, teachers, accountants, and management teams to ensure smooth system adoption and effective school operations." },
      { n: "03", icon: <i className="fa-solid fa-screwdriver-wrench" />, name: "Technical Support & Help Desk", desc: "Dedicated technical support and help desk assistance available 6 days a week for troubleshooting, issue resolution, and operational guidance." },
      { n: "04", icon: <i className="fa-solid fa-chart-line" />, name: "Research, Branding & Growth Support", desc: "Continuous research, new developments, marketing guidance, branding support, and growth strategies provided by the School Mentor Head Office team." },
    ],
  },
];

// ── Hooks ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= 760 : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 760);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── Sidebar item ──────────────────────────────────────────────────
function SidebarItem({ tab, active, onClick, isMobile }) {
  const [hov, setHov] = useState(false);
  const on = active || hov;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        gap: isMobile ? 6 : 12,
        padding: isMobile ? "10px 8px 10px" : "13px 12px",
        borderRadius: isMobile ? 14 : 14,
        cursor: "pointer",
        position: "relative",
        marginBottom: isMobile ? 0 : 4,
        flex: isMobile ? "0 0 82px" : "unset",
        width: isMobile ? 82 : "auto",
        minHeight: isMobile ? 80 : "auto",
        border: isMobile ? `1px solid ${active ? "var(--sm-navy)" : on ? "var(--sm-gray300)" : "var(--sm-border)"}` : "none",
        background: active
          ? "var(--sm-teal-light)"
          : on
            ? "var(--sm-hover)"
            : isMobile ? "var(--sm-surface)" : "transparent",
        transform: on && isMobile ? "translateY(-2px)" : on && !isMobile ? "translateX(3px)" : "none",
        boxShadow: active && isMobile ? "0 8px 20px -10px var(--sm-shadow)" : on && isMobile ? "0 4px 14px -10px var(--sm-shadow)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}
    >
      {/* Active left bar (desktop only) */}
      {!isMobile && (
        <div style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%",
          width: 3, borderRadius: "0 3px 3px 0",
          background: "var(--sm-navy)",
          opacity: active ? 1 : 0, transition: "opacity .25s ease",
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: isMobile ? 40 : 40,
        height: isMobile ? 40 : 40,
        borderRadius: 12, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isMobile ? 18 : 18,
        background: active
          ? "var(--sm-navy)"
          : on ? "var(--sm-teal-light)" : "var(--sm-surface-alt)",
        border: active ? "1px solid var(--sm-navy)" : `1px solid ${isMobile ? "transparent" : "var(--sm-border)"}`,
        boxShadow: "none",
        transform: on && !active ? "scale(1.06)" : "scale(1)",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
        color: active ? "#fff" : "var(--sm-navy)",
      }}>
        {tab.icon}
      </div>

      {/* Text */}
      <div style={{ flex: isMobile ? "unset" : 1, textAlign: isMobile ? "center" : "left", minWidth: 0 }}>
        <div style={{
          fontSize: isMobile ? 9.5 : 13,
          fontWeight: 700,
          color: active ? "var(--sm-navy)" : "var(--sm-text-muted)",
          lineHeight: 1.3,
          wordBreak: isMobile ? "break-word" : "normal",
          whiteSpace: isMobile ? "normal" : "nowrap",
          overflow: isMobile ? "visible" : "hidden",
          textOverflow: isMobile ? "unset" : "ellipsis",
          transition: "color .2s ease",
        }}>
          {tab.sidebarName}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 10.5, color: "var(--sm-text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tab.sidebarSub}
          </div>
        )}
      </div>

      {/* Number badge (desktop only) */}
      {!isMobile && (
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9.5, fontWeight: 800,
          background: active ? "var(--sm-navy)" : "var(--sm-surface-alt)",
          color: active ? "#fff" : "var(--sm-text-muted)",
          border: active ? "none" : "1px solid var(--sm-border)",
          transition: "all .25s ease",
        }}>
          {tab.id + 1}
        </div>
      )}
    </div>
  );
}

// ── Float card ────────────────────────────────────────────────────
function FloatCard({ card, index }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      background: "var(--sm-surface)", border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
      borderRadius: 16, padding: "14px 16px",
      boxShadow: hov ? "0 12px 28px -14px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
      transition: "box-shadow .3s ease, border-color .3s ease, transform .3s ease",
      transform: hov ? "translateY(-3px)" : "none",
      cursor: "default",
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ fontSize: 20, marginBottom: 6, color: "var(--sm-navy)" }}>{card.i}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>{card.v}</div>
      <div style={{ fontSize: 9.5, color: "var(--sm-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{card.l}</div>
      <div style={{ height: 2.5, borderRadius: 2, background: "var(--sm-border)", marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, background: "var(--sm-navy)", width: "100%" }} />
      </div>
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────
function ModuleCard({ mod, index, isMobile, animate = true }) {
  const [hov, setHov] = useState(false);
  const dir = index % 2 === 0 ? "Left" : "Right";
  const anim = !animate ? "none" : isMobile ? `sosCardIn${dir} .45s cubic-bezier(.22,.97,.47,1) ${0.04 + index * 0.08}s both` : `sosCardIn .5s ease ${0.04 + index * 0.04}s both`;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        borderRadius: 16, padding: "22px 18px",
        position: "relative", overflow: "hidden", cursor: "pointer",
        animation: anim,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? "0 16px 36px -16px var(--sm-shadow)" : "0 1px 2px rgba(17,24,39,.04)",
        transition: "transform .3s cubic-bezier(.22,.97,.47,1), box-shadow .3s ease, border-color .3s ease",
        // Mobile: fixed card width for slider
        ...(isMobile ? { flex: "0 0 78vw", maxWidth: 300, minWidth: 260, scrollSnapAlign: "start" } : {}),
      }}
    >
      {/* Num badge */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        width: 22, height: 22, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9.5, fontWeight: 800,
        background: hov ? "var(--sm-navy)" : "var(--sm-surface-alt)",
        color: hov ? "#fff" : "var(--sm-text-muted)",
        border: hov ? "1px solid var(--sm-navy)" : "1px solid var(--sm-border)",
        transition: "all .3s ease",
      }}>
        {mod.n}
      </div>

      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 13,
        background: "var(--sm-teal-light)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21,
        marginBottom: 14,
        color: "var(--sm-navy)",
      }}>
        {mod.icon}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--sm-text)", marginBottom: 6, lineHeight: 1.2 }}>
        {mod.name}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--sm-text-muted)", lineHeight: 1.6 }}>{mod.desc}</div>
    </div>
  );
}

// ── Scroll dots ───────────────────────────────────────────────────
function ScrollDots({ count, active, onDotClick }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "12px 16px 4px", minHeight: 32 }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          style={{
            width: i === active ? 28 : 10,
            height: 10, borderRadius: i === active ? 5 : "50%",
            background: i === active ? "var(--sm-navy)" : "var(--sm-border)",
            border: i === active ? "none" : "2px solid var(--sm-border)",
            boxShadow: "none",
            cursor: "pointer", padding: 0, flexShrink: 0,
            transition: "all .35s cubic-bezier(.22,.97,.47,1)",
          }}
        />
      ))}
    </div>
  );
}

// ── CTA button ────────────────────────────────────────────────────
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
        flex: 1, padding: "15px 28px", borderRadius: 10,
        fontSize: 13.5, fontWeight: solid ? 700 : 600,
        fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: solid ? (hov ? "var(--sm-navy-dark)" : "var(--sm-navy)") : (hov ? "var(--sm-hover)" : "var(--sm-surface)"),
        color: solid ? "#fff" : "var(--sm-text)",
        border: solid ? "1px solid var(--sm-navy)" : `1px solid ${hov ? "var(--sm-navy)" : "var(--sm-border)"}`,
        boxShadow: "none",
        transform: active ? "translateY(1px)" : hov ? "translateY(-2px)" : "none",
        transition: "all .25s ease",
      }}
    >
      {children}
    </button>
  );
}

// ── Mobile accordion: expanded panel body ─────────────────────────
function MobileAccordionBody({ tab: t }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / t.modules.length;
    setActive(Math.max(0, Math.min(Math.round(el.scrollLeft / itemW), t.modules.length - 1)));
  };
  const scrollToDot = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / t.modules.length;
    el.scrollTo({ left: i * itemW, behavior: "smooth" });
    setActive(i);
  };

  return (
    <>
      {/* Condensed hero */}
      <div style={{ borderRadius: 16, overflow: "hidden", position: "relative", background: "var(--sm-surface)", border: "1px solid var(--sm-border)", padding: "18px 16px", marginBottom: 16 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "5px 12px 5px 9px", marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)" }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--sm-navy)" }}>{t.badgeSub}</span>
          </div>
          {/* Title */}
          <h3 style={{ fontSize: 22, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1.12, letterSpacing: -0.6, margin: "0 0 8px" }}>
            {t.titlePrefix}{" "}
            <em style={{ fontStyle: "normal", color: "var(--sm-navy)" }}>{t.accent}</em>
            {t.tm && <sup style={{ fontSize: 11, color: "var(--sm-text-muted)", fontWeight: 400 }}>™</sup>}
          </h3>
          {/* Desc */}
          <p style={{ fontSize: 12.5, color: "var(--sm-text-muted)", lineHeight: 1.7, margin: 0 }}>{t.desc}</p>
          {/* Platform pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--sm-surface-alt)", border: "1px solid var(--sm-border)", borderRadius: 14, padding: "9px 14px", marginTop: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 8.5, color: "var(--sm-text-muted)", fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 1 }}>{t.ppLabel}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sm-text)" }}>{t.ppVal}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {t.ppIcons.map((ico, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: 8, background: "var(--sm-teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--sm-navy)" }}>{ico}</div>
              ))}
            </div>
          </div>
          {/* Stats */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {t.stats.map((s, i) => (
              <div key={i} style={{ background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 11, padding: "8px 12px" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 8.5, color: "var(--sm-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".7px", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modules heading */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "5px 12px", fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--sm-navy)" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sm-navy)" }} />
          {t.secPill}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--sm-text)" }}>
          {t.secH2[0]}<span style={{ color: "var(--sm-navy)" }}>{t.secH2[1]}</span>{t.secH2[2]}
        </div>
      </div>

      {/* Module cards — slider */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="sos-grid"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingBottom: 4,
        }}
      >
        {t.modules.map((mod, i) => (
          <div key={i} style={{ flex: "0 0 80%", maxWidth: 300, scrollSnapAlign: "center" }}>
            <ModuleCard mod={mod} index={i} isMobile={false} animate={false} />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 14, flexWrap: "wrap" }}>
        {t.modules.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToDot(i)}
            aria-label={`Go to module ${i + 1}`}
            style={{
              width: i === active ? 24 : 8,
              height: 8,
              borderRadius: i === active ? 4 : "50%",
              background: i === active ? "var(--sm-navy)" : "var(--sm-border)",
              border: i === active ? "none" : "1.5px solid var(--sm-gray300)",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
              transition: "all .35s cubic-bezier(.22,.97,.47,1)",
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 18, borderRadius: 16, overflow: "hidden", position: "relative", background: "var(--sm-surface-alt)", border: "1px solid var(--sm-border)", padding: "20px 16px" }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--sm-text)", marginBottom: 5 }}>{t.ctaTitle}</div>
          <div style={{ fontSize: 12, color: "var(--sm-text-muted)", marginBottom: 14, lineHeight: 1.6 }}>{t.ctaSub}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <CtaBtn solid onClick={() => { openDemoForm("School OS"); }}> Book a Free Demo</CtaBtn>
            <CtaBtn onClick={() => window.open("https://wa.me/923700036867", "_blank")}> Talk to an Expert</CtaBtn>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Mobile accordion ──────────────────────────────────────────────
function MobileAccordion({ openIdx, onToggle }) {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: "var(--sm-surface-alt)",
      borderRadius: 18,
      border: "1px solid var(--sm-border)",
      overflow: "hidden",
      boxShadow: "0 16px 40px -20px var(--sm-shadow)",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--sm-border)", background: "var(--sm-surface)" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "var(--sm-text-muted)", marginBottom: 5 }}>Complete</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--sm-text)" }}>
          School <span style={{ color: "var(--sm-navy)" }}>Operating System</span>
        </div>
      </div>

      {TABS.map((t, i) => {
        const open = openIdx === i;
        return (
          <div key={t.id} style={{
            borderBottom: i < TABS.length - 1 ? "1px solid var(--sm-border)" : "none",
            background: open ? "var(--sm-surface-alt)" : "var(--sm-surface)",
            transition: "background .3s ease",
          }}>
            {/* Row header */}
            <button
              onClick={() => onToggle(i)}
              aria-expanded={open}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "13px 14px", background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                background: open ? "var(--sm-navy)" : "var(--sm-surface-alt)",
                border: open ? "none" : "1.5px solid var(--sm-border)",
                color: open ? "#fff" : "var(--sm-navy)",
                boxShadow: "none",
                transition: "all .3s cubic-bezier(.22,.97,.47,1)",
              }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: open ? "var(--sm-navy)" : "var(--sm-text)", lineHeight: 1.25 }}>{t.sidebarName}</div>
                <div style={{ fontSize: 11, color: "var(--sm-text-muted)", marginTop: 2 }}>{t.sidebarSub}</div>
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: open ? "var(--sm-teal-light)" : "var(--sm-surface-alt)",
                border: "1px solid var(--sm-border)",
                color: "var(--sm-navy)", fontSize: 12,
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .35s cubic-bezier(.22,.97,.47,1), background .3s ease",
              }}>
                {/* Chevron points down when collapsed, rotates to up when expanded */}
                <i className="fa-solid fa-chevron-down" />
              </div>
            </button>

            {/* Collapsible body (animated via grid-template-rows) */}
            <div style={{
              display: "grid",
              gridTemplateRows: open ? "1fr" : "0fr",
              transition: "grid-template-rows .4s cubic-bezier(.22,.97,.47,1)",
            }}>
              <div style={{ overflow: "hidden" }}>
                <div style={{ padding: "2px 14px 18px" }}>
                  <MobileAccordionBody tab={t} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function SchoolOperatingSystem() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeDot, setActiveDot] = useState(0);
  const [fading, setFading] = useState(false);
  const [openIdx, setOpenIdx] = useState(-1); // mobile accordion: open panel (-1 = all closed by default)
  const isMobile = useIsMobile();

  const togglePanel = useCallback((i) => setOpenIdx((p) => (p === i ? -1 : i)), []);
  const gridRef = useRef(null);
  const sidebarListRef = useRef(null);
  const activeTabRef = useRef(null);

  // The section flows naturally in the page — no wheel hijack, no internal
  // scroll lock. The desktop panel grows to fit its content and the page
  // scrolls through it normally (sidebar is sticky so the nav stays in view).

  const tab = TABS[activeTab];
  const progress = ((activeTab + 1) / 6 * 100).toFixed(2) + "%";

  // Switch tab with fade
  const switchTab = useCallback((idx) => {
    if (idx === activeTab) return;
    setFading(true);
    setTimeout(() => {
      setActiveTab(idx);
      setActiveDot(0);
      setFading(false);
      if (gridRef.current) gridRef.current.scrollLeft = 0;
    }, 180);
  }, [activeTab]);

  // Center the active tab inside the horizontal strip on mobile.
  // We scroll the strip horizontally (scrollLeft) rather than calling
  // scrollIntoView — scrollIntoView would scroll the *page* vertically to
  // this section, which made the home page jump down to the OS section on
  // load. We also skip the very first run so nothing moves on initial mount.
  const didInitTabScroll = useRef(false);
  useEffect(() => {
    if (!isMobile) { didInitTabScroll.current = false; return; }
    if (!didInitTabScroll.current) { didInitTabScroll.current = true; return; }
    const strip = sidebarListRef.current;
    const pill = activeTabRef.current;
    if (!strip || !pill) return;
    const stripRect = strip.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const left =
      strip.scrollLeft +
      (pillRect.left - stripRect.left) -
      (strip.clientWidth - pill.clientWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [activeTab, isMobile]);

  // Track scroll dots
  const handleGridScroll = useCallback(() => {
    if (!gridRef.current || !isMobile) return;
    const { scrollLeft, scrollWidth } = gridRef.current;
    const idx = Math.round(scrollLeft / (scrollWidth / tab.modules.length));
    setActiveDot(Math.min(idx, tab.modules.length - 1));
  }, [isMobile, tab.modules.length]);

  const scrollToCard = (idx) => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll(".sos-mc");
    if (cards[idx]) cards[idx].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActiveDot(idx);
  };

  const gridCols = isMobile
    ? undefined
    : tab.modules.length <= 4 ? "repeat(2,1fr)"
      : tab.modules.length <= 6 ? "repeat(3,1fr)"
        : "repeat(4,1fr)";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes sosFadeUp     {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosCardIn     {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosCardInLeft {from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sosCardInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
        .sos-mc { animation-fill-mode: both; }
        .sos-grid::-webkit-scrollbar { display: none; }
        .sos-sidebar-list::-webkit-scrollbar { display: none; }
        .sos-sidebar-list.desktop { overflow-y: auto; }
        .sos-sidebar-list.desktop::-webkit-scrollbar { display: none; }
        .sos-main::-webkit-scrollbar { width: 5px; }
        .sos-main::-webkit-scrollbar-track { background: var(--sm-surface-alt); }
        .sos-main::-webkit-scrollbar-thumb { background: var(--sm-gray300); border-radius: 10px; min-height: 40px; }
        .sos-main::-webkit-scrollbar-thumb:hover { background: var(--sm-navy); }
      `}</style>

      {isMobile ? (
        <MobileAccordion openIdx={openIdx} onToggle={togglePanel} />
      ) : (
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex",
        overflow: "visible",
        flexDirection: "row",
        alignItems: "flex-start",
        background: "var(--sm-surface-alt)",
        borderRadius: 24,
        border: "1px solid var(--sm-border)",
        boxShadow: "0 24px 60px -28px var(--sm-shadow), 0 8px 24px -16px var(--sm-shadow)",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: isMobile ? "100%" : 290,
          minWidth: isMobile ? 0 : 290,
          background: "var(--sm-surface)",
          borderRight: isMobile ? "none" : "1px solid var(--sm-border)",
          borderBottom: isMobile ? "none" : "none",
          display: "flex", flexDirection: "column",
          position: "sticky",
          top: isMobile ? 0 : 80,
          alignSelf: "flex-start",
          zIndex: 100,
          height: "auto",
          maxHeight: isMobile ? "auto" : "calc(100vh - 96px)",
          overflow: "hidden",
          boxShadow: "none",
        }}>

          {/* Header */}
          <div style={{
            padding: isMobile ? "10px 16px 0" : "24px 22px 16px",
            borderBottom: isMobile ? "none" : "1px solid var(--sm-border)",
            display: isMobile ? "flex" : "block",
            alignItems: "center", justifyContent: "space-between",
          }}>
            {!isMobile && <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "var(--sm-text-muted)", marginBottom: 6 }}>Complete</div>}
            <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 800, color: "var(--sm-text)" }}>
              School <span style={{ color: "var(--sm-navy)" }}>Operating System</span>
            </div>
          </div>

          {/* Tab list */}
          <div
            ref={sidebarListRef}
            className={`sos-sidebar-list${!isMobile ? " desktop" : ""}`}
            style={{
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              padding: isMobile ? "10px 12px 0" : "12px 6px 12px 12px",
              gap: 6, flex: 1,
              overflowX: isMobile ? "auto" : "visible",
              overflowY: isMobile ? "visible" : "auto",
              alignItems: isMobile ? "center" : "stretch",
              scrollbarWidth: isMobile ? "none" : "thin",
              scrollbarColor: isMobile ? "transparent transparent" : "var(--sm-navy) var(--sm-surface-alt)",
            }}
          >
            {TABS.map((t, i) => (
              <div key={t.id} ref={activeTab === i ? activeTabRef : null}>
                <SidebarItem
                  tab={t} active={activeTab === i}
                  onClick={() => switchTab(i)}
                  isMobile={isMobile}
                />
              </div>
            ))}
          </div>

          {/* Mobile progress bar */}
          {isMobile && (
            <div style={{ height: 3, background: "var(--sm-border)", margin: "8px 12px 0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "var(--sm-navy)", width: progress, transition: "width .5s cubic-bezier(.22,.97,.47,1)" }} />
            </div>
          )}

          {/* Desktop footer progress */}
          {!isMobile && (
            <div style={{ padding: "16px 22px 20px", borderTop: "1px solid var(--sm-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--sm-text-muted)", marginBottom: 8 }}>
                <span>Progress</span><span>{activeTab + 1} / 6</span>
              </div>
              <div style={{ height: 5, background: "var(--sm-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "var(--sm-navy)", width: progress, transition: "width .5s cubic-bezier(.22,.97,.47,1)" }} />
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main
          className={isMobile ? "" : "sos-main"}
          style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: "relative",
          overflowY: "visible",
          overflowX: "clip",
          scrollbarWidth: isMobile ? "auto" : "thin",
          scrollbarColor: isMobile ? "auto" : "var(--sm-navy) var(--sm-surface-alt)",
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(8px)" : "translateY(0)",
          transition: "opacity .2s ease, transform .2s ease",
        }}>

          {/* HERO */}
          <div style={{
            background: "var(--sm-surface)",
            borderBottom: "1px solid var(--sm-border)",
            padding: isMobile ? "28px 18px 36px" : "44px 44px 48px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 200px", gap: 28, alignItems: "start" }}>
              <div>
                {/* Badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "6px 14px 6px 10px", marginBottom: 20, animation: "sosFadeUp .5s ease .05s both" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sm-navy)" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--sm-navy)" }}>School Operating System</span>
                  <div style={{ width: 1, height: 13, background: "var(--sm-border)" }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--sm-text-muted)" }}>{tab.badgeSub}</span>
                </div>

                {/* Title */}
                <h1 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 900, color: "var(--sm-text)", lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 12, animation: "sosFadeUp .55s ease .12s both" }}>
                  {tab.titlePrefix}{" "}
                  <em style={{ fontStyle: "normal", color: "var(--sm-navy)" }}>{tab.accent}</em>
                  {tab.tm && <sup style={{ fontSize: 14, verticalAlign: "super", color: "var(--sm-text-muted)", fontWeight: 400 }}>™</sup>}
                </h1>

                {/* Desc */}
                <p style={{ fontSize: isMobile ? 13 : 14, color: "var(--sm-text-muted)", lineHeight: 1.75, maxWidth: 580, marginBottom: 24, animation: "sosFadeUp .55s ease .2s both" }}>
                  {tab.desc}
                </p>

                {/* Platform pill */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "9px 18px", marginBottom: 24, flexWrap: "wrap", animation: "sosFadeUp .55s ease .28s both" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 1 }}>{tab.ppLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sm-text)" }}>{tab.ppVal}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {tab.ppIcons.map((ico, i) => (
                      <div key={i} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--sm-teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "var(--sm-navy)", cursor: "pointer", transition: "background .25s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--sm-hover)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--sm-teal-light)"; }}
                      >{ico}</div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "wrap", animation: "sosFadeUp .55s ease .36s both" }}>
                  {tab.stats.map((s, i) => (
                    <div key={i}
                      style={{ background: "var(--sm-surface)", border: "1px solid var(--sm-border)", borderRadius: 12, padding: isMobile ? "9px 13px" : "10px 16px", cursor: "default", transition: "all .3s ease" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 28px -14px var(--sm-shadow)"; e.currentTarget.style.borderColor = "var(--sm-navy)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--sm-border)"; }}
                    >
                      <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, color: "var(--sm-text)", lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: "var(--sm-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Float cards (desktop only) */}
              {!isMobile && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "sosFadeUp .55s ease .2s both" }}>
                  {tab.floatCards.map((c, i) => <FloatCard key={i} card={c} index={i} />)}
                </div>
              )}
            </div>
          </div>

          {/* MODULES */}
          <div style={{ padding: isMobile ? "22px 0 36px" : "32px 44px 48px", background: "var(--sm-surface-alt)" }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, padding: isMobile ? "0 16px" : 0, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--sm-teal-light)", border: "1px solid var(--sm-border)", borderRadius: 100, padding: "5px 14px", flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)" }} />
                {tab.secPill}
              </div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "var(--sm-text)" }}>
                {tab.secH2[0]}
                <span style={{ color: "var(--sm-navy)" }}>{tab.secH2[1]}</span>
                {tab.secH2[2]}
              </div>
              {!isMobile && <div style={{ flex: 1, height: 1, background: "var(--sm-border)" }} />}
            </div>

            {/* Cards grid / slider */}
            <div
              ref={gridRef}
              className="sos-grid"
              onScroll={isMobile ? handleGridScroll : undefined}
              style={{
                display: isMobile ? "flex" : "grid",
                flexDirection: isMobile ? "row" : undefined,
                gridTemplateColumns: isMobile ? undefined : gridCols,
                gap: isMobile ? 12 : 14,
                padding: isMobile ? "4px 16px 16px" : 0,
                overflowX: isMobile ? "auto" : "visible",
                scrollSnapType: isMobile ? "x mandatory" : undefined,
                WebkitOverflowScrolling: isMobile ? "touch" : undefined,
                scrollbarWidth: "none",
              }}
            >
              {tab.modules.map((mod, i) => (
                <div key={`${activeTab}-${i}`} className="sos-mc">
                  <ModuleCard mod={mod} index={i} isMobile={isMobile} />
                </div>
              ))}
            </div>

            {/* Scroll dots (mobile) */}
            {isMobile && (
              <ScrollDots count={tab.modules.length} active={activeDot} onDotClick={scrollToCard} />
            )}
          </div>

          {/* CTA STRIP */}
          <div style={{
            background: "var(--sm-surface)",
            borderTop: "1px solid var(--sm-border)",
            padding: isMobile ? "24px 16px" : "32px 44px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: 20, flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--sm-text)", marginBottom: 4 }}>{tab.ctaTitle}</div>
              <div style={{ fontSize: 13, color: "var(--sm-text-muted)" }}>{tab.ctaSub}</div>
            </div>
            <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 1, width: isMobile ? "100%" : "auto" }}>
              <CtaBtn solid onClick={() => { openDemoForm("School OS"); }}> Book a Free Demo</CtaBtn>
              <CtaBtn onClick={() => window.open("https://wa.me/923700036867", "_blank")}> Talk to an Expert</CtaBtn>
            </div>
          </div>
        </main>
      </div>
      )}
    </>
  );
}
