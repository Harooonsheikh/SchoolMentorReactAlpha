import { useState, useRef, useEffect, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────
const TABS = [
  {
    id: 0,
    icon: "🖥️", sidebarName: "School Mentor ERP", sidebarSub: "12 Core Modules",
    badgeSub: "Module 1 of 6",
    titlePrefix: "SchoolMentor", accent: "ERP", tm: true,
    desc: "Custom-built to cater to the real-time, on-ground needs of schools covering everything from academic operations and student data to HR, finance, and communication. Integrates with 3 dedicated mobile apps and includes a complete implementation plan.",
    ppLabel: "Available on", ppVal: "Web · Android · iOS", ppIcons: ["🌐", "🖥️", "🤖", "🍎"],
    stats: [{ v: "12", l: "Modules" }, { v: "749+", l: "Schools" }, { v: "3", l: "Mobile Apps" }, { v: "24/7", l: "Support" }],
    floatCards: [{ i: "🎓", v: "12", l: "ERP Modules" }, { i: "📱", v: "3 Apps", l: "Mobile Platforms" }, { i: "⚡", v: "100%", l: "Automated" }],
    secPill: "ERP Modules", secH2: ["All ", "12 Modules", " Included"],
    ctaTitle: "Ready to automate your school?", ctaSub: "Join 749+ schools across Pakistan already using SchoolMentor ERP.",
    modules: [
      { n: "01", icon: "📚", name: "Academics", desc: "Manage lesson plans, submissions, schemes of studies, academic calendars, student performance statistics, class activities, homework, and all curriculum-related workflows." },
      { n: "02", icon: "📝", name: "Examination", desc: "Handle exams with date sheets, syllabus management, result generation, report cards, question paper generator, grading system, and examination analytics." },
      { n: "03", icon: "🗓️", name: "Timetable Management", desc: "Create and manage smart class timetables, teacher schedules, substitutions, and daily routine planning with ease." },
      { n: "04", icon: "💰", name: "Fee Management", desc: "Complete fee system with challans, discounts, fee collection, due tracking, banking integrations, financial reporting, and automated notifications." },
      { n: "05", icon: "👥", name: "Human Resources (HR)", desc: "Manage staff attendance, payroll, leaves, performance records, hiring workflows, and employee profiles from one place." },
      { n: "06", icon: "🧾", name: "Accounts & Finance", desc: "Track school income, expenses, vouchers, ledgers, reports, and complete financial operations with full transparency." },
      { n: "07", icon: "🔐", name: "User Permissions", desc: "Advanced role-based access control to manage permissions for admins, principals, teachers, accountants, and all staff members." },
      { n: "08", icon: "📋", name: "Logs & Activity Tracking", desc: "Track all system activities, user logs, updates, actions, and operational history for better transparency and monitoring." },
      { n: "09", icon: "📖", name: "SOPs & Manuals", desc: "Access complete operational manuals, SOPs, implementation guides, and video tutorials for smooth operations and staff training." },
      { n: "10", icon: "🏫", name: "Branch Switching", desc: "Multi-branch module allowing users to seamlessly switch between different schools or campuses from a single account." },
      { n: "11", icon: "📢", name: "Communication & Notifications", desc: "Send announcements, notices, SMS, app notifications, WhatsApp alerts, and updates to parents, teachers, and students instantly." },
      { n: "12", icon: "📊", name: "Reports & Analytics", desc: "Generate powerful reports and insights related to academics, finance, attendance, examinations, and overall school performance." },
    ],
  },
  {
    id: 1,
    icon: "📱", sidebarName: "Mobile App", sidebarSub: "3 Apps for All Stakeholders",
    badgeSub: "Module 2 of 6",
    titlePrefix: "SchoolMentor", accent: "Mobile App", tm: false,
    desc: "An integrated mobile ecosystem with 3 dedicated apps for Principals, Teachers, and Parents plus built-in chat, video learning, gamification, and AI keeping every stakeholder connected in real time.",
    ppLabel: "Available on", ppVal: "Android · iOS", ppIcons: ["🤖", "🍎"],
    stats: [{ v: "3", l: "Apps" }, { v: "8", l: "Features" }, { v: "Live", l: "Sync" }, { v: "AI", l: "Integrated" }],
    floatCards: [{ i: "📱", v: "3", l: "Dedicated Apps" }, { i: "🔔", v: "Live", l: "Notifications" }, { i: "✦", v: "AI", l: "Integrated" }],
    secPill: "Mobile Ecosystem", secH2: ["", "8 Features", " in the Mobile Ecosystem"],
    ctaTitle: "Stay connected with your school, anywhere.", ctaSub: "Download SchoolMentor apps for Principals, Teachers & Parents on Android & iOS.",
    modules: [
      { n: "01", icon: "🏫", name: "Principal & Admin Mobile App", desc: "Complete school management at your fingertips with real-time academics, attendance, meetings, tasks, reports, notifications, calendars, fee updates, staff management, approvals, and overall school operations." },
      { n: "02", icon: "👩‍🏫", name: "Teacher Mobile App", desc: "Manage daily teaching operations including attendance, lesson plans, lesson implementation, homework, submissions, notebooks, academic calendars, leave applications, notices, meetings, tasks, and classroom activities." },
      { n: "03", icon: "👨‍👧", name: "Parent Mobile App", desc: "Stay connected with your child's school through attendance updates, fee alerts, results, homework, notices, meetings, academic progress, leave management, complaints, calendars, PDF notes, and real-time communication." },
      { n: "04", icon: "🔔", name: "Push Notifications System", desc: "Instantly send important alerts, notices, reminders, meeting updates, fee notifications, attendance alerts, and announcements to all stakeholders in real time." },
      { n: "05", icon: "💬", name: "Built-in Chat System", desc: "Secure in-app communication platform with no third-party dependency, allowing seamless communication between principals, teachers, parents, and management teams." },
      { n: "06", icon: "🎬", name: "E-Tube Video Platform", desc: "Integrated educational video browsing platform where students, teachers, and parents can access learning content, tutorials, training videos, and educational resources." },
      { n: "07", icon: "🎮", name: "Gamified Learning Platform", desc: "Interactive online quiz games and engagement activities designed to improve student participation, learning outcomes, and classroom motivation." },
      { n: "08", icon: "✦", name: "Mentor AI Integration", desc: "AI-powered assistant integrated directly into the mobile apps for smart communication, lesson planning, academic support, content generation, and intelligent school assistance." },
    ],
  },
  {
    id: 2,
    icon: "📋", sidebarName: "Operational Manuals", sidebarSub: "100+ Ready-to-Use Manuals",
    badgeSub: "Module 3 of 6",
    titlePrefix: "School Operational", accent: "Manuals", tm: false,
    desc: "100+ ready-to-use operational manuals covering every school department from academics and HR to safety and digital systems. Standardizing processes, ensuring compliance, and empowering staff across all operations.",
    ppLabel: "Format", ppVal: "Digital · Printable · Video", ppIcons: ["📄", "💻", "🎥"],
    stats: [{ v: "100+", l: "Manuals" }, { v: "8", l: "Categories" }, { v: "Ready", l: "To Use" }, { v: "Video", l: "Tutorials" }],
    floatCards: [{ i: "📋", v: "100+", l: "Manuals" }, { i: "🗂️", v: "8", l: "Categories" }, { i: "✅", v: "Ready", l: "To Use" }],
    secPill: "Manual Categories", secH2: ["", "8 Categories", " of Ready-to-Use Manuals"],
    ctaTitle: "Standardize every school operation.", ctaSub: "100+ ready-to-use manuals covering every department — available digitally, in print, and via video.",
    modules: [
      { n: "01", icon: "🎓", name: "Academic Operations Manuals", desc: "Complete academic workflow documentation covering lesson planning, schemes of work, academic calendars, classroom management, and curriculum delivery standards." },
      { n: "02", icon: "📝", name: "Examination & Assessment Manuals", desc: "Standardized procedures for exam scheduling, date sheets, result processing, question paper management, grading, and assessment quality control." },
      { n: "03", icon: "👥", name: "Administration & HR Manuals", desc: "Staff hiring, onboarding, appraisal systems, leave management, payroll procedures, record keeping, and all HR administrative workflows." },
      { n: "04", icon: "💰", name: "Accounts & Fee Management Manuals", desc: "Fee collection procedures, challan management, discount policies, budgeting standards, accounts management, audit trails, and financial reporting guidelines." },
      { n: "05", icon: "📢", name: "Parent Communication & Engagement Manuals", desc: "Parent engagement protocols, notice issuance, complaint handling, meeting procedures, social media guidelines, and community communication standards." },
      { n: "06", icon: "🖥️", name: "Digital Systems & ERP Usage Manuals", desc: "Step-by-step guides for using SchoolMentor ERP, mobile apps, and all digital tools with video tutorials for staff, teachers, and administrators." },
      { n: "07", icon: "🎨", name: "School Décor Plans", desc: "Professionally designed school environment and décor guidelines covering classroom layouts, display boards, common areas, and campus visual identity standards." },
      { n: "08", icon: "🏥", name: "Student Health & Safety Manuals", desc: "Complete health and safety protocols including first aid procedures, emergency response, hygiene standards, incident reporting, and campus safety guidelines." },
    ],
  },
  {
    id: 3,
    icon: "👩‍🏫", sidebarName: "Teacher Training Workshops", sidebarSub: "Monthly Development Program",
    badgeSub: "Module 4 of 6",
    titlePrefix: "Teacher", accent: "Trainings", tm: false,
    desc: "Interactive and engaging online training sessions designed for all school stakeholders. Every month, expert trainers are onboarded on different topics to equip schools with modern skills, professional strategies, practical implementation methods, online quizzes, and E-Certifications.",
    ppLabel: "Mode", ppVal: "Online · Monthly · Live", ppIcons: ["🎥", "💻", "🏆"],
    stats: [{ v: "12", l: "Per Year" }, { v: "8", l: "Tracks" }, { v: "E-Cert", l: "Certified" }, { v: "Monthly", l: "Sessions" }],
    floatCards: [{ i: "🎓", v: "E-Cert", l: "Certified" }, { i: "🧑‍🏫", v: "Expert", l: "Trainers" }, { i: "📅", v: "Monthly", l: "Sessions" }],
    secPill: "Training Tracks", secH2: ["", "8 Monthly", " Development Training Tracks"],
    ctaTitle: "Invest in your school's biggest asset — your people.", ctaSub: "Monthly expert-led training sessions with online quizzes and E-Certifications for all school staff.",
    modules: [
      { n: "01", icon: "🎓", name: "Academic Excellence Training", desc: "Equip teachers and academic staff with best practices in curriculum delivery, lesson quality, student assessment, and academic standard-setting." },
      { n: "02", icon: "🏫", name: "Administration & School Operations", desc: "Train admin and management teams on efficient school operations, documentation, scheduling, compliance, and institutional management." },
      { n: "03", icon: "🧠", name: "Modern Pedagogy & Teaching Strategies", desc: "Outcome-based teaching, differentiated instruction, active learning methodologies, and student-centered classroom approaches for today's educators." },
      { n: "04", icon: "💻", name: "EdTech & AI Integration in Education", desc: "Using digital tools, AI assistants, learning management systems, and technology to transform classroom engagement and learning outcomes." },
      { n: "05", icon: "🎨", name: "Creative Teaching Methodologies", desc: "Gamification, project-based learning, collaborative activities, storytelling techniques, and innovative strategies to inspire and engage students." },
      { n: "06", icon: "📣", name: "School Marketing & Admissions Growth", desc: "Practical strategies for school branding, social media marketing, community outreach, admission campaigns, and student enrollment growth." },
      { n: "07", icon: "🌟", name: "Character Building & Student Development", desc: "Programs focused on values education, leadership development, life skills, student discipline, and holistic personal growth." },
      { n: "08", icon: "🧘", name: "Psychological Wellbeing & Classroom Management", desc: "Mental health awareness, stress management, positive classroom environment, behavioral strategies, and teacher wellbeing practices." },
    ],
  },
  {
    id: 4,
    icon: "✦", sidebarName: "Mentor AI", sidebarSub: "4 Smart AI Tools",
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
  },
  {
    id: 5,
    icon: "🏢", sidebarName: "Dedicated Head Office Support", sidebarSub: "6 Days a Week, Always There",
    badgeSub: "Module 6 of 6",
    titlePrefix: "Head Office", accent: "Support", tm: false,
    desc: "Professional support system designed to help schools grow with continuous guidance, innovation, research, branding support, and operational assistance — just like a professionally managed school network or franchise system.",
    ppLabel: "Availability", ppVal: "6 Days a Week · Call · WhatsApp · Email", ppIcons: ["📞", "💬", "📧"],
    stats: [{ v: "24h", l: "Response" }, { v: "6×", l: "Days/Week" }, { v: "98%", l: "Satisfaction" }, { v: "Free", l: "Onboarding" }],
    floatCards: [{ i: "⚡", v: "24h", l: "Response Time" }, { i: "😊", v: "98%", l: "Satisfaction" }, { i: "🚀", v: "Free", l: "Onboarding" }],
    secPill: "Support Services", secH2: ["", "4 Dedicated", " Head Office Support Services"],
    ctaTitle: "We're with you every step of the way.", ctaSub: "Dedicated Head Office team providing onboarding, training, technical support, and growth guidance — 6 days a week.",
    modules: [
      { n: "01", icon: "🚀", name: "School Onboarding & Setup", desc: "Complete onboarding support including ERP setup, implementation guidance, data migration, and full operational activation for your school from day one." },
      { n: "02", icon: "🎓", name: "Staff Training & Capacity Building", desc: "Professional training sessions for principals, teachers, accountants, and management teams to ensure smooth system adoption and effective school operations." },
      { n: "03", icon: "🔧", name: "Technical Support & Help Desk", desc: "Dedicated technical support and help desk assistance available 6 days a week for troubleshooting, issue resolution, and operational guidance." },
      { n: "04", icon: "📈", name: "Research, Branding & Growth Support", desc: "Continuous research, new developments, marketing guidance, branding support, and growth strategies provided by the School Mentor Head Office team." },
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
        border: isMobile ? `1.5px solid ${active ? "var(--sm-navy)" : on ? "rgba(21,101,192,.2)" : "var(--sm-border)"}` : "none",
        background: active
          ? isMobile
            ? "linear-gradient(135deg,rgba(21,101,192,.1),rgba(29,184,138,.06))"
            : "rgba(21,101,192,.08)"
          : on
            ? "rgba(21,101,192,.05)"
            : isMobile ? "var(--sm-surface)" : "transparent",
        transform: on && isMobile ? "translateY(-2px)" : on && !isMobile ? "translateX(3px)" : "none",
        boxShadow: active && isMobile ? "0 6px 20px rgba(21,101,192,.16)" : on && isMobile ? "0 4px 14px rgba(21,101,192,.1)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}
    >
      {/* Active left bar (desktop only) */}
      {!isMobile && (
        <div style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%",
          width: 3, borderRadius: "0 3px 3px 0",
          background: "linear-gradient(180deg,#1565C0,#1DB88A)",
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
          ? "linear-gradient(135deg,#1565C0,#1DB88A)"
          : on ? "rgba(21,101,192,.1)" : isMobile ? "var(--sm-surface-alt)" : "var(--sm-surface-alt)",
        border: active ? "none" : `1.5px solid ${isMobile ? "transparent" : "var(--sm-border)"}`,
        boxShadow: active ? "0 4px 14px rgba(21,101,192,.3)" : on ? "0 4px 12px rgba(21,101,192,.15)" : isMobile ? "0 2px 6px rgba(0,0,0,.06)" : "none",
        transform: on && !active ? "scale(1.06)" : "scale(1)",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
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
          background: active ? "linear-gradient(135deg,#1565C0,#1DB88A)" : "var(--sm-surface-alt)",
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
  return (
    <div style={{
      background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)",
      borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(6px)",
      animation: `sosFloat ${4 + index}s ease-in-out ${index * 0.8}s infinite`,
      transition: "box-shadow .3s ease, background .3s ease",
      cursor: "default",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,.18)"; e.currentTarget.style.background = "rgba(255,255,255,.22)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}
    >
      <div style={{ fontSize: 20, marginBottom: 6 }}>{card.i}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{card.v}</div>
      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{card.l}</div>
      <div style={{ height: 2.5, borderRadius: 2, background: "rgba(255,255,255,.2)", marginTop: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#a8f0d8,#c8ecff)", animation: "sosBarGrow 1.5s ease .5s both" }} />
      </div>
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────
function ModuleCard({ mod, index, isMobile }) {
  const [hov, setHov] = useState(false);
  const dir = index % 2 === 0 ? "Left" : "Right";
  const anim = isMobile ? `sosCardIn${dir} .45s cubic-bezier(.22,.97,.47,1) ${0.04 + index * 0.08}s both` : `sosCardIn .5s ease ${0.04 + index * 0.04}s both`;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--sm-surface)",
        border: `1.5px solid ${hov ? "rgba(21,101,192,.28)" : "var(--sm-border)"}`,
        borderRadius: 18, padding: "20px 16px",
        position: "relative", overflow: "hidden", cursor: "pointer",
        animation: anim,
        transform: hov ? "translateY(-6px) scale(1.015)" : "translateY(0) scale(1)",
        boxShadow: hov ? "0 20px 48px rgba(21,101,192,.14), 0 0 0 3px rgba(21,101,192,.07)" : "none",
        transition: "transform .35s cubic-bezier(.22,.97,.47,1), box-shadow .35s ease, border-color .3s ease",
        // Mobile: fixed card width for slider
        ...(isMobile ? { flex: "0 0 78vw", maxWidth: 300, minWidth: 260, scrollSnapAlign: "start" } : {}),
      }}
    >
      {/* Top gradient bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg,#1565C0,#1DB88A)",
        borderRadius: "18px 18px 0 0",
        transform: hov ? "scaleX(1)" : "scaleX(0)",
        transformOrigin: "left",
        transition: "transform .35s cubic-bezier(.22,.97,.47,1)",
      }} />

      {/* Bottom radial glow */}
      <div style={{
        position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)",
        width: "80%", height: 60, borderRadius: "50%",
        background: "radial-gradient(ellipse,rgba(29,184,138,.12),transparent 70%)",
        opacity: hov ? 1 : 0, transition: "opacity .35s ease",
        pointerEvents: "none",
      }} />

      {/* Num badge */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        width: 22, height: 22, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9.5, fontWeight: 800,
        background: hov ? "linear-gradient(135deg,#1565C0,#1DB88A)" : "var(--sm-surface-alt)",
        color: hov ? "#fff" : "var(--sm-text-muted)",
        border: hov ? "none" : "1px solid var(--sm-border)",
        transform: hov ? "scale(1.1)" : "scale(1)",
        boxShadow: hov ? "0 0 12px rgba(21,101,192,.35)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}>
        {mod.n}
      </div>

      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 13,
        background: hov ? "linear-gradient(135deg,rgba(21,101,192,.18),rgba(29,184,138,.14))" : "linear-gradient(135deg,rgba(21,101,192,.1),rgba(29,184,138,.08))",
        border: "1px solid rgba(21,101,192,.12)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21,
        marginBottom: 12,
        animation: hov ? "sosIconBounce .5s ease" : "none",
        boxShadow: hov ? "0 6px 18px rgba(21,101,192,.2)" : "none",
        transition: "background .3s ease, box-shadow .3s ease",
      }}>
        {mod.icon}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 800, color: hov ? "var(--sm-navy)" : "var(--sm-text)", marginBottom: 6, lineHeight: 1.2, transition: "color .2s ease" }}>
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
            background: i === active ? "linear-gradient(135deg,#1565C0,#1DB88A)" : "var(--sm-border)",
            border: i === active ? "none" : "2px solid rgba(21,101,192,.18)",
            boxShadow: i === active ? "0 3px 10px rgba(21,101,192,.35)" : "0 1px 4px rgba(0,0,0,.12)",
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
        flex: 1, padding: "17px 28px", borderRadius: 12,
        fontSize: 13.5, fontWeight: solid ? 800 : 700,
        fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: solid ? "#fff" : hov ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.14)",
        color: solid ? "#1565C0" : "#fff",
        border: solid ? "none" : `1.5px solid ${hov ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.35)"}`,
        boxShadow: solid ? (hov ? "0 14px 32px rgba(0,0,0,.2)" : "0 6px 20px rgba(0,0,0,.15)") : (hov ? "0 8px 24px rgba(0,0,0,.15)" : "none"),
        transform: active ? "scale(.97)" : hov ? "translateY(-3px) scale(1.02)" : "none",
        transition: "all .3s cubic-bezier(.22,.97,.47,1)",
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function SchoolOperatingSystem() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeDot, setActiveDot] = useState(0);
  const [fading, setFading] = useState(false);
  const isMobile = useIsMobile();
  const gridRef = useRef(null);
  const sidebarListRef = useRef(null);
  const activeTabRef = useRef(null);

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

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (isMobile && activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
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
        @keyframes sosShimmer    {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes sosFadeUp     {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosFloat      {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes sosOrbFloat   {0%,100%{transform:translate(0,0)}50%{transform:translate(14px,10px)}}
        @keyframes sosBlink      {0%,100%{opacity:1}50%{opacity:0}}
        @keyframes sosDotPulse   {0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
        @keyframes sosCardIn     {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sosCardInLeft {from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sosCardInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sosBarGrow    {from{width:0}to{width:100%}}
        @keyframes sosIconBounce {0%,100%{transform:scale(1)}40%{transform:scale(1.18) rotate(-8deg)}70%{transform:scale(.94) rotate(4deg)}}
        @keyframes sosGlowPulse  {0%,100%{box-shadow:0 0 0 0 rgba(21,101,192,0)}50%{box-shadow:0 0 0 6px rgba(21,101,192,.12)}}
        .sos-mc { animation-fill-mode: both; }
        .sos-grid::-webkit-scrollbar { display: none; }
        .sos-sidebar-list::-webkit-scrollbar { display: none; }
        .sos-sidebar-list.desktop { overflow-y: auto; }
        .sos-sidebar-list.desktop::-webkit-scrollbar { display: none; }
        .sos-main::-webkit-scrollbar { width: 5px; }
        .sos-main::-webkit-scrollbar-track { background: var(--sm-surface-alt); }
        .sos-main::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#1565C0,#1DB88A); border-radius: 10px; min-height: 40px; }
        .sos-main::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg,#0d47a1,#17a078); }
      `}</style>

      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex", height: "100vh", overflow: "hidden",
        flexDirection: isMobile ? "column" : "row",
        background: "var(--sm-surface-alt)",
        borderRadius: 24,
        border: "1px solid var(--sm-border)",
        boxShadow: "0 36px 90px rgba(21,101,192,.24), 0 14px 36px rgba(0,0,0,.14)",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: isMobile ? "100%" : 290,
          minWidth: isMobile ? 0 : 290,
          background: "var(--sm-surface)",
          borderRight: isMobile ? "none" : "1px solid var(--sm-border)",
          borderBottom: isMobile ? "none" : "none",
          display: "flex", flexDirection: "column",
          position: isMobile ? "sticky" : "relative",
          top: 0, zIndex: 100,
          height: isMobile ? "auto" : "100%",
          overflow: "hidden",
          boxShadow: isMobile ? "0 2px 0 var(--sm-border), 0 4px 24px rgba(21,101,192,.07)" : "none",
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
              School <span style={{ background: "linear-gradient(90deg,#1565C0,#1DB88A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Operating System</span>
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
              overflowY: isMobile ? "visible" : "scroll",
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
              <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#1565C0,#1DB88A)", width: progress, transition: "width .5s cubic-bezier(.22,.97,.47,1)" }} />
            </div>
          )}

          {/* Desktop footer progress */}
          {!isMobile && (
            <div style={{ padding: "16px 22px 20px", borderTop: "1px solid var(--sm-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--sm-text-muted)", marginBottom: 8 }}>
                <span>Progress</span><span>{activeTab + 1} / 6</span>
              </div>
              <div style={{ height: 5, background: "var(--sm-border)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#1565C0,#1DB88A)", width: progress, transition: "width .5s cubic-bezier(.22,.97,.47,1)" }} />
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className={isMobile ? "" : "sos-main"} style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: isMobile ? "visible" : "auto",
          overflowX: "hidden",
          scrollbarWidth: isMobile ? "auto" : "thin",
          scrollbarColor: isMobile ? "auto" : "var(--sm-navy) var(--sm-surface-alt)",
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(8px)" : "translateY(0)",
          transition: "opacity .2s ease, transform .2s ease",
        }}>

          {/* HERO */}
          <div style={{
            background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
            padding: isMobile ? "28px 18px 36px" : "40px 44px 48px",
            position: "relative",
          }}>
            {/* Grid overlay */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
            {/* Orbs */}
            <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", top: -180, right: -100, background: "radial-gradient(circle,rgba(255,255,255,.07),transparent 65%)", pointerEvents: "none", animation: "sosOrbFloat 9s ease-in-out infinite" }} />
            <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", bottom: -120, left: -60, background: "radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)", pointerEvents: "none", animation: "sosOrbFloat 11s ease-in-out infinite reverse" }} />
            {/* Shimmer */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.8),rgba(255,255,255,.2),rgba(255,255,255,.8),transparent)", backgroundSize: "200% 100%", animation: "sosShimmer 3.5s linear infinite" }} />

            <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 200px", gap: 28, alignItems: "start" }}>
              <div>
                {/* Badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 100, padding: "6px 14px 6px 10px", marginBottom: 20, animation: "sosFadeUp .5s ease .05s both" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.9)", animation: "sosDotPulse 2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.9)" }}>School Operating System</span>
                  <div style={{ width: 1, height: 13, background: "rgba(255,255,255,.3)" }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.75)" }}>{tab.badgeSub}</span>
                </div>

                {/* Title */}
                <h1 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 12, animation: "sosFadeUp .55s ease .12s both" }}>
                  {tab.titlePrefix}{" "}
                  <em style={{ fontStyle: "normal", background: "linear-gradient(90deg,#a8f0d8,#c8ecff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{tab.accent}</em>
                  {tab.tm && <sup style={{ fontSize: 14, verticalAlign: "super", WebkitTextFillColor: "rgba(255,255,255,.5)", fontWeight: 400 }}>™</sup>}
                  <span style={{ display: "inline-block", width: 3, height: ".85em", background: "#a8f0d8", marginLeft: 4, verticalAlign: "middle", animation: "sosBlink .75s step-end infinite" }} />
                </h1>

                {/* Desc */}
                <p style={{ fontSize: isMobile ? 13 : 14, color: "rgba(255,255,255,.78)", lineHeight: 1.75, maxWidth: 580, marginBottom: 24, animation: "sosFadeUp .55s ease .2s both" }}>
                  {tab.desc}
                </p>

                {/* Platform pill */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 100, padding: "9px 18px", marginBottom: 24, flexWrap: "wrap", animation: "sosFadeUp .55s ease .28s both" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 1 }}>{tab.ppLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{tab.ppVal}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {tab.ppIcons.map((ico, i) => (
                      <div key={i} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", transition: "all .25s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.18)"; e.currentTarget.style.transform = "scale(1.1) rotate(-5deg)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}
                      >{ico}</div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "wrap", animation: "sosFadeUp .55s ease .36s both" }}>
                  {tab.stats.map((s, i) => (
                    <div key={i}
                      style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: isMobile ? "9px 13px" : "10px 16px", cursor: "default", transition: "all .3s ease" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px) scale(1.03)"; e.currentTarget.style.background = "rgba(255,255,255,.22)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".8px", marginTop: 2 }}>{s.l}</div>
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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(21,101,192,.09)", border: "1px solid rgba(21,101,192,.18)", borderRadius: 100, padding: "5px 14px", flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--sm-navy)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sm-navy)", animation: "sosDotPulse 2s ease-in-out infinite" }} />
                {tab.secPill}
              </div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "var(--sm-text)" }}>
                {tab.secH2[0]}
                <span style={{ background: "linear-gradient(90deg,#1565C0,#1DB88A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{tab.secH2[1]}</span>
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
            background: "linear-gradient(135deg,#1565C0 0%,#1178a8 50%,#1DB88A 100%)",
            padding: isMobile ? "24px 16px" : "28px 44px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: 20, flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{tab.ctaTitle}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>{tab.ctaSub}</div>
            </div>
            <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 1, width: isMobile ? "100%" : "auto" }}>
              <CtaBtn solid onClick={() => { window.open("https://mail.google.com/mail/?view=cm&fs=1&to=riizvi06@gmail.com&su=Free%20Demo%20Request&body=Hi%2C%20I%20want%20to%20book%20a%20free%20demo.", "_blank"); }}> Book a Free Demo</CtaBtn>
              <CtaBtn onClick={() => window.open("https://wa.me/923700036867", "_blank")}> Talk to an Expert</CtaBtn>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
