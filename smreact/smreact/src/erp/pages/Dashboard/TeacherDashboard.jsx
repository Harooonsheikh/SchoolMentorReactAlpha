import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import UniversalSearch from '../../shared/UniversalSearch';
import { DASH_CSS } from './Dashboard';
import { ADM_NEW_CSS } from './AdminDashboard';
import AnnouncementsModal from './AnnouncementsModal';
import { DASH_MODAL_CSS } from './dashModalCss';
import * as teacherDashboardService from '../../services/teacherDashboardService';
import { MODULE_COLOR } from './dashboardData';

const FIN_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* Upcoming-activity chip colour. API activity ka koi `type` nahi bhejti,
   is liye Admin Dashboard ki tarah ek hi (event) tone use hoti hai. */
const TEACHER_DASH_EVENT_COLOR = { bg: 'rgba(30, 58, 138, .12)', fg: '#1E40AF' };

function teacherDashInitials(name) {
  const clean = String(name || '').replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim();
  return clean.split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/* ─── Compact circular progress ring — sits beside the "X% done" pill
   in My Performance panel headers (Lesson Plans / Notebook Plans /
   My Attendance), echoing the same 0-36-viewBox trick as the Fee
   Analytics donut rings on the Admin Dashboard. */
function MiniRing({ pct, color = '#1E40AF', track = 'rgba(30,64,175,.15)' }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="dash-mini-ring" style={{ '--ring-color': color }}>
      <svg viewBox="0 0 36 36" width="100%" height="100%">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={track} strokeWidth="4" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray="100, 100"
          strokeDashoffset={100 - clamped}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="dash-mini-ring-pct">{clamped}%</div>
    </div>
  );
}

/* ─── Teacher search scope. ──────────────────────────────────────
   A teacher is intentionally walled off from modules that fall under
   admin/finance/HR/system. The Universal Search respects this via the
   `canAccess` predicate — any provider whose moduleId is NOT in this
   set is filtered out before its results ever reach the UI.

   Backend devs: replace this static set with the user's permissions
   blob from the auth service. Same callback signature, no UI change. */
const TEACHER_SEARCHABLE_MODULES = new Set([
  'academics',
  'examination',
  'paper_generator',
  'attendance',
  'timetable',
  'students',
  'appraisals',
  'school_sops',
  'teacher_trainings',
]);

/* ═══════════════════════════════════════════════════════════════════
   TEACHER DASHBOARD — premium personal workspace, REAL ERP data only.

   Every section maps to a real teacher-scope feature:
     • Today's Schedule  → Time Table module
     • My Classes        → Students module (filtered)
     • My Lesson Plans   → Academics / Submissions
     • My Homework       → Academics / Homework Diary
     • My Attendance     → Attendance module
     • Upcoming Activities → Academics / Activity Calendar
     • My Exam           → Examination module
     • My Appraisal      → Staff Appraisals module
     • My Notifications  → personal feed

   Module-aware: sections short-circuit if their module is disabled.
   ═══════════════════════════════════════════════════════════════════ */
export default function TeacherDashboard({ visibility, toast, navigate = () => {}, openActivityCalendar = () => {} }) {
  const { moduleActive, user, session, ownerName } = visibility;

  /* ─── REAL data — ek hi API se poora teacher dashboard ─────────
     GET /dashboard_for_teacher?userId&branchId&year&month
     null = loading; fail par {} taake koi section crash na ho.
     (Pehle yahan TEACHER_SCOPES ka mock chalta tha — hata diya.) */
  const [dash, setDash] = useState(null);
  useEffect(() => {
    let alive = true;
    const { month, year } = teacherDashboardService.currentMonthYear();
    teacherDashboardService.getTeacherDashboard(month, year)
      .then(d => { if (alive) setDash(d || {}); })
      .catch(() => { if (alive) setDash({}); });
    return () => { alive = false; };
  }, []);

  /* Safe accessors — har section 0 / [] fallback ke sath padhta hai. */
  const D = dash || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const stuBdays     = arr(D.StudentBirthdays);
  const staffBdays   = arr(D.StaffBirthdays);
  const upActivities = arr(D.UpcomingActivities);
  const notices      = arr(D.Notices);
  const num = (v) => Number(v) || 0;
  const pctOf = (n, d) => (num(d) > 0 ? Math.round((num(n) / num(d)) * 100) : 0);

  /* My Classes — API [{GradeName, SectionName, SubjectName, TotalStudents}].
     Ek hi class×section ke multiple subjects alag rows me aate hain, is liye
     "My Classes" count aur student total unique class×section par nikalte
     hain (warna 11 rows = 11 classes lagti thi aur students double count). */
  const myClassRows = arr(D.MyClasses).map((c, i) => ({
    id: `${c.GradeName || ''}_${c.SectionName || ''}_${c.SubjectName || ''}_${i}`,
    key: `${c.GradeName || ''}_${c.SectionName || ''}`,
    cls: `${c.GradeName || ''}${c.SectionName ? ` - ${c.SectionName}` : ''}`.trim() || '—',
    subject: c.SubjectName || '',
    students: num(c.TotalStudents),
  }));
  const uniqueSections = [...new Map(myClassRows.map(c => [c.key, c])).values()];
  const myClassCount = uniqueSections.length;
  const myStudentCount = uniqueSections.reduce((s, c) => s + c.students, 0);

  /* Lesson Plans / Notebook Plans / My Attendance — API summaries.
     Summary object na aaye to wo card render hi nahi hota. */
  const lp = D.LessonPlanSummary || null;
  const lessonPlanStats = lp ? {
    total: num(lp.TotalLessonPlans),
    submitted: num(lp.SubmittedLessonPlans),
    pending: num(lp.PendingLessonPlans),
  } : null;
  const nb = D.NotebookSummary || null;
  const notebookStats = nb ? {
    total: num(nb.TotalUnits),
    submitted: num(nb.SubmittedUnits),
    pending: num(nb.PendingUnits),
  } : null;
  const att = D.MyAttendance || null;
  const myAttendance = att ? (() => {
    const present = num(att.TotalPresent);
    const absent  = num(att.TotalAbsent);
    const leave   = num(att.TotalLeave);
    return { present, absent, leave, pct: pctOf(present, present + absent + leave) };
  })() : null;

  /* Exam Tasks — FirstTermExams / PendingSyllabus / PendingMarks.
     Field names defensive hain kyunke ye teeno arrays abhi khali
     aate hain; jo bhi key backend bhejta hai wo pick ho jayegi. */
  const examLabel = (e) => e.ExamName || e.TermName || e.Title || e.Name || '—';
  const clsLabel  = (x) => `${x.GradeName || x.ClassName || ''}${x.SectionName ? ` - ${x.SectionName}` : ''}`.trim() || '—';
  const examPapers = arr(D.FirstTermExams).map((e, i) => ({
    id: e.ExamID ?? e.ID ?? i,
    cls: clsLabel(e),
    subject: e.SubjectName || e.Subject || '',
    date: e.ExamDate || e.StartDate || e.Date || '',
  }));
  const firstExam = arr(D.FirstTermExams)[0] || null;
  /* Card hamesha render hota hai — exam na ho to khali state dikhti hai. */
  const currentExam = {
    name: firstExam ? examLabel(firstExam) : 'No active exam',
    dates: firstExam ? (firstExam.StartDate || firstExam.ExamDate || '—') : '—',
    papers: examPapers,
  };
  const mapPending = (list) => arr(list).map((x, i) => ({
    id: x.ID ?? x.SubjectID ?? i,
    cls: clsLabel(x),
    subject: x.SubjectName || x.Subject || '',
  }));
  const pendingSyllabusUploads = mapPending(D.PendingSyllabus);
  const pendingMarksUploads    = mapPending(D.PendingMarks);

  /* Expandable list state for the three Exam-Task cards. */
  const [openCard, setOpenCard] = useState(null);   // 'currentExam' | 'syllabus' | 'marks' | null

  /* Today's Schedule — naam ke bawajood `TodaysSchedule` POORE HAFTE ke
     periods deta hai (har row par `Day` + `DayOrder`), aur rows already
     is teacher par filtered hain. Is liye day-wise group kar ke wahi
     day-picker chalate hain; koi extra timetable call nahi. */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = DAY_NAMES[new Date().getDay()];
  const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* "08:40:00" → "08:40 AM" */
  const prettyTime = (t) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(t || ''));
    if (!m) return '';
    let h = Number(m[1]);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m[2]} ${ap}`;
  };

  const scheduleByDay = {};
  arr(D.TodaysSchedule).forEach((s, i) => {
    const day = WEEK_DAYS.includes(s.Day) ? s.Day : (WEEK_DAYS[Number(s.DayOrder)] || '');
    if (!day) return;
    (scheduleByDay[day] = scheduleByDay[day] || []).push({
      id: s.ID ?? `sch_${i}`,
      startTime: s.StartTime || '',
      time: `${prettyTime(s.StartTime)}${s.EndTime ? ` – ${prettyTime(s.EndTime)}` : ''}`,
      cls: clsLabel(s),
      subject: s.SubjectName || '',
    });
  });
  /* Start time se sort, phir period number derive (API period number
     nahi bhejti — sirf start/end time). */
  Object.values(scheduleByDay).forEach((list) => {
    list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    list.forEach((p, i) => { p.period = i + 1; });
  });

  const scheduledDays = WEEK_DAYS.filter(d => (scheduleByDay[d] || []).length > 0);
  const availableDays = scheduledDays.length ? scheduledDays : WEEK_DAYS;
  const [selectedDay, setSelectedDay] = useState(
    WEEK_DAYS.includes(todayDayName) ? todayDayName : 'Monday',
  );
  const daySchedule = scheduleByDay[selectedDay] || [];
  const todaySchedule = scheduleByDay[todayDayName] || [];

  const [birthdayTab, setBirthdayTab] = useState('all');
  const showStudentsBday = birthdayTab === 'all' || birthdayTab === 'students';
  const showTeachersBday = birthdayTab === 'all' || birthdayTab === 'teachers';

  /* Top-cards modal flags */
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showNoticeBoard,   setShowNoticeBoard]   = useState(false);
  const [showReminders,     setShowReminders]     = useState(false);

  /* Notice Board card + modal ab API ke Notices se. School Mentor
     Announcements aur Principal Reminders ke liye is API me abhi koi
     array nahi hai — dono empty-state dikhate hain (mock hata diya). */
  const noticeItems = notices.map((n, i) => ({
    id: n.ID ?? i,
    title: n.Topic || 'Notice',
    preview: n.Details || '',
    description: n.Details || '',
    date: n.AnnounceDate
      ? new Date(n.AnnounceDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    time: '',
    status: '',
    sender: 'Principal',
    category: 'Notice',
  }));
  const announcements        = [];
  const reminders            = [];
  const latestAnnouncement   = announcements[0] || null;
  const newAnnouncementCount = 0;
  const latestNotice         = noticeItems[0] || null;
  const newNoticeCount       = noticeItems.filter(n => n.status === 'new').length;
  const latestReminder       = reminders[0] || null;
  const newReminderCount     = 0;

  /* Appraisals — is API me nahi aate; section tab tak hidden rehta hai. */
  const appraisalList = [];   /* [{ id, period, status, score, by, date, pdf }] — API me abhi nahi */
  const EMPTY_APPRAISAL = { id: '', period: '—', status: 'Not available', score: null, by: '—', date: '—' };
  const [selectedAppraisalId, setSelectedAppraisalId] = useState(null);
  const selectedAppraisal = appraisalList.find(a => a.id === selectedAppraisalId) || appraisalList[0] || EMPTY_APPRAISAL;

  const NAV_LABELS = {
    acad: 'Academics', exam: 'Examination', att: 'Attendance', tt: 'Time Table',
    students: 'Students', appraisal: 'Staff Appraisals', sops: 'School SOPs', trainings: 'Teacher Trainings',
  };
  const openModule = (target) => {
    if (!target) return;
    navigate(target);
    toast(`Opening ${NAV_LABELS[target] || target.toUpperCase()}…`, 'info');
  };

  /* Greeting helpers */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  /* Birthday helpers — API item { PersonName, PersonType,
     ClassOrDesignation, SectionName, BirthDate }. BirthDate do
     formats me aata hai ("2004-08-08" aur "Aug 12 2026 12:00AM"),
     Date dono parse kar leta hai. */
  const realTodayDay = new Date().getDate();
  const bdayName  = (b) => b.PersonName || '—';
  const bdayMeta  = (b) => {
    const cod = String(b.ClassOrDesignation ?? '').trim();
    /* Staff par backend designation ka ID bhejta hai ("82"), naam nahi —
       numeric ho to uski jagah PersonType dikhate hain. */
    const label = cod && !/^\d+$/.test(cod) ? cod : '';
    return [label, b.SectionName].filter(Boolean).join(' · ') || (b.PersonType || '');
  };
  const bdayDay   = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? 0 : d.getDate(); };
  const bdayLabel = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }); };

  /* Current month/year label — banners aur activity headers ke liye. */
  const cmyLabel = (() => { const c = teacherDashboardService.currentMonthYear(); return `${FIN_MONTH_NAMES[c.month - 1]} ${c.year}`; })();

  /* Upcoming Activities helpers — API {Title, Description, StartAt}. */
  const actDateLabel = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const actDaysAway  = (iso) => { const d = new Date(iso); if (isNaN(d.getTime())) return 0; return Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000); };

  /* Greeting me asli logged-in user ka pehla naam. */
  const firstName = ((ownerName || user?.name || '').replace(/Dr\.|Mr\.|Ms\.|Mrs\./, '').trim().split(' ')[0]) || 'there';
  /* Abhi POORA teacher dashboard dikhta hai (sirf school-level module ON/OFF ke
     hisaab se). Jab per-teacher assignment API set ho jayegi, tab yahan canModule
     (user permissions) ki condition laga kar sirf ASSIGNED cards dikhayenge. */
  const showSchedule    = moduleActive('timetable');
  const showLessonPlans = moduleActive('academics');
  const showHomework    = moduleActive('academics');
  const showAttendance  = moduleActive('attendance');
  const showExam        = moduleActive('examination');
  const showAppraisal   = moduleActive('appraisals');

  return (
    <>
      <style>{DASH_CSS}</style>
      <style>{ADM_NEW_CSS}</style>
      <style>{TCH_CSS}</style>

      {/* ═════════ UNIVERSAL SEARCH BAR ═════════
            Permission-gated to teacher-accessible modules only:
            HR / Accounts / Fee / Inventory / Admission CRM / User
            Permissions / Settings / Launch Setup / Audit Logs results
            are filtered out before they reach the UI. */}
      <div className="adm-uvs-row">
        <UniversalSearch
          onNavigate={(target, params) => {
            navigate(target, params);
            toast(`Opening ${NAV_LABELS[target] || target.toUpperCase()}…`, 'info');
          }}
          canAccess={(moduleId) => TEACHER_SEARCHABLE_MODULES.has(moduleId)}
          sessionId={session?.id || null}
          toast={toast}
          placeholder="Search students, classes, lesson plans, exams, trainings…"
        />
      </div>

      {/* ═════════ HERO GREETING ═════════ */}
      <div className="dash-hero dash-hero--teacher">
        <div className="dash-hero-l">
          <div className="dash-hero-greet">
            <span className="dash-hero-wave">👋</span>
            {greeting}, {firstName}
          </div>
          <div className="dash-hero-sub">
            <b>{todayLabel}</b> · Session {session.label}. You have{' '}
            <b>{todaySchedule.length} class{todaySchedule.length === 1 ? '' : 'es'}</b> today.
            {showLessonPlans && lessonPlanStats && lessonPlanStats.pending > 0 && <> Don&apos;t forget — <b>{lessonPlanStats.pending} lesson plan{lessonPlanStats.pending > 1 ? 's' : ''}</b> still pending.</>}
          </div>
        </div>
        <div className="dash-hero-r">
          <div className="dash-hero-stat">
            <div className="dash-hero-stat-val">{myClassCount}</div>
            <div className="dash-hero-stat-lbl">My Classes</div>
          </div>
          <div className="dash-hero-stat">
            <div className="dash-hero-stat-val">{myStudentCount}</div>
            <div className="dash-hero-stat-lbl">My Students</div>
          </div>
          {showAttendance && myAttendance && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{myAttendance.pct}<small>%</small></div>
              <div className="dash-hero-stat-lbl">My Attendance</div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════ TOP CARDS ROW ═════════
            1. School Mentor Announcements
            2. Notice Board (Principal · via Mobile App)
            3. Principal Reminders
          1:1 with the Admin Dashboard top-cards chrome (adm-tc-* classes
          come from ADM_NEW_CSS, already injected above). */}
      <div className="adm-top-cards">

        {/* ── Card 1: School Mentor Announcements ── */}
        <div className="adm-tc adm-tc--announce">
          <div className="adm-tc-h">
            <div className="adm-tc-h-l">
              <div className="adm-tc-ic adm-tc-ic--brand">
                <i className="fa-solid fa-bullhorn" aria-hidden="true"></i>
              </div>
              <div>
                <div className="adm-tc-t">School Mentor Announcements</div>
                <div className="adm-tc-s">{latestAnnouncement ? latestAnnouncement.sender : 'School Mentor — HQ'}</div>
              </div>
            </div>
            {newAnnouncementCount > 0 && (
              <Tooltip text={`${newAnnouncementCount} unread message${newAnnouncementCount > 1 ? 's' : ''}`}>
                <span className="adm-tc-pill adm-tc-pill--new">
                  <span className="adm-tc-pill-dot" /> {newAnnouncementCount}
                </span>
              </Tooltip>
            )}
          </div>
          <div className="adm-tc-body">
            <div className="adm-tc-an-title">{latestAnnouncement ? latestAnnouncement.title : 'No announcements yet'}</div>
            <div className="adm-tc-an-preview">{latestAnnouncement ? latestAnnouncement.preview : 'New announcements from School Mentor will appear here.'}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestAnnouncement ? `${latestAnnouncement.date} · ${latestAnnouncement.time}` : '—'}
            </span>
            <Tooltip text="View all School Mentor announcements">
              <button
                type="button"
                className="adm-tc-btn"
                onClick={() => setShowAnnouncements(true)}
              >
                View Details <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Card 2: Notice Board (Principal · Mobile App) ── */}
        <div className="adm-tc adm-tc--green">
          <div className="adm-tc-h">
            <div className="adm-tc-h-l">
              <div className="adm-tc-ic adm-tc-ic--green">
                <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i>
              </div>
              <div>
                <div className="adm-tc-t">Notice Board</div>
                <div className="adm-tc-s">Principal · via Mobile App</div>
              </div>
            </div>
            {newNoticeCount > 0 && (
              <Tooltip text={`${newNoticeCount} new notice${newNoticeCount > 1 ? 's' : ''}`}>
                <span className="adm-tc-pill adm-tc-pill--green">
                  <span className="tch-tc-pill-dot" /> {newNoticeCount}
                </span>
              </Tooltip>
            )}
          </div>
          <div className="adm-tc-body">
            <div className="adm-tc-an-title">{latestNotice ? latestNotice.title : 'No notices yet'}</div>
            <div className="adm-tc-an-preview">{latestNotice ? latestNotice.preview : 'Notices posted by the Principal will appear here.'}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestNotice ? [latestNotice.date, latestNotice.time].filter(Boolean).join(' · ') || '—' : '—'}
            </span>
            <Tooltip text="View all Notice Board notices">
              <button
                type="button"
                className="adm-tc-btn"
                onClick={() => setShowNoticeBoard(true)}
              >
                View Details <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Card 3: Principal Reminders ── */}
        <div className="adm-tc adm-tc--amber">
          <div className="adm-tc-h">
            <div className="adm-tc-h-l">
              <div className="adm-tc-ic adm-tc-ic--amber">
                <i className="fa-solid fa-bell" aria-hidden="true"></i>
              </div>
              <div>
                <div className="adm-tc-t">Principal Reminders</div>
                <div className="adm-tc-s">{latestReminder ? latestReminder.sender : 'Principal'}</div>
              </div>
            </div>
            {newReminderCount > 0 && (
              <Tooltip text={`${newReminderCount} pending reminder${newReminderCount > 1 ? 's' : ''}`}>
                <span className="adm-tc-pill adm-tc-pill--amber">
                  <span className="tch-tc-pill-dot" /> {newReminderCount}
                </span>
              </Tooltip>
            )}
          </div>
          <div className="adm-tc-body">
            <div className="adm-tc-an-title">{latestReminder ? latestReminder.title : 'No reminders yet'}</div>
            <div className="adm-tc-an-preview">{latestReminder ? latestReminder.preview : 'Reminders from the Principal will appear here.'}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestReminder ? `${latestReminder.date} · ${latestReminder.time}` : '—'}
            </span>
            <Tooltip text="View all Principal reminders">
              <button
                type="button"
                className="adm-tc-btn"
                onClick={() => setShowReminders(true)}
              >
                View Details <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ═════════ TODAY'S SCHEDULE ═════════
          Day dropdown lets the teacher view any weekday's schedule.
          Data: dashboard_for_teacher ka TodaysSchedule (aaj ke liye),
          aur baaki dinon ke liye branch timetable se is teacher ke
          periods. The card list is internally scrollable so multiple
          classes fit without breaking the layout. */}
      {showSchedule && (
        <div className="dash-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>{' '}
              {selectedDay === todayDayName ? 'Today’s Schedule' : `${selectedDay}’s Schedule`}
            </div>
            <Tooltip text="Pick a day to view its schedule">
              <label className="tch-day-picker">
                <span className="tch-day-picker-lbl">Select Day</span>
                <select
                  className="tch-day-picker-sel"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  aria-label="Select a day of the week"
                >
                  {availableDays.map(d => (
                    <option key={d} value={d}>
                      {d}{d === todayDayName ? ' (Today)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </Tooltip>
          </div>
          <div className="tch-sched-scroll">
            {daySchedule.length === 0 ? (
              <div className="tch-sched-empty">
                <i className="fa-solid fa-mug-hot" aria-hidden="true"></i>
                <span>No classes scheduled for {selectedDay}.</span>
              </div>
            ) : (
              <div className="dash-sched">
                {daySchedule.map(s => (
                  <div key={s.id} className="dash-sched-card">
                    <span className="dash-sched-period">Period {s.period}</span>
                    <div className="dash-sched-time">
                      <i className="fa-solid fa-clock" aria-hidden="true"></i>
                      {s.time}
                    </div>
                    <div className="dash-sched-cls">{s.cls}</div>
                    <div className="dash-sched-topic">
                      <i className="fa-solid fa-book" aria-hidden="true"></i>
                      {s.subject}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════ MY CLASSES ═════════
          "Open Students" link removed. Upcoming Activities mid-section
          removed — the Activity Calendar grid still renders at the bottom
          of the dashboard, matching the Admin layout. */}
      <div className="dash-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <i className="fa-solid fa-school" aria-hidden="true"></i> My Classes
          </div>
        </div>
        <div className="dash-panel" style={{ '--panel-accent': '#7C3AED', '--panel-soft': 'rgba(124,58,237,.12)' }}>
          <div className="dash-rows">
            {myClassRows.length === 0 ? (
              <div className="tch-sched-empty">
                <i className="fa-solid fa-school" aria-hidden="true"></i>
                <span>No classes assigned to you yet.</span>
              </div>
            ) : myClassRows.map(c => (
              <Tooltip key={c.id} text={`Open ${c.cls}`}>
                <div className="dash-row" onClick={() => openModule('students')}>
                  <div className="dash-row-ic" style={{ background: 'rgba(124,58,237,.14)', color: '#6D28D9' }}>
                    <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                  </div>
                  <div className="dash-row-info">
                    <div className="dash-row-t">{c.cls}</div>
                    <div className="dash-row-s">{c.subject}</div>
                  </div>
                  <span className="dash-row-val dash-row-val--purple">{c.students} <span style={{fontSize:9,opacity:.7}}>STU</span></span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* ═════════ MY PERFORMANCE (LP / HW / Attendance) ═════════
          Sirf tab render hota hai jab API in teeno me se kisi ka summary
          object bheje (LessonPlanSummary / NotebookSummary / MyAttendance). */}
      {(lessonPlanStats || notebookStats || myAttendance) && (
      <div className="dash-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <i className="fa-solid fa-chart-simple" aria-hidden="true"></i> My Performance
          </div>
          <span className="dash-sec-sub">This month · scoped to my classes · click any card</span>
        </div>
        <div className="dash-grid-3">
          {showLessonPlans && lessonPlanStats && (() => {
            const lpTotal = lessonPlanStats.total;
            const lpSubmitted = lessonPlanStats.submitted;
            const lpPct = lpTotal ? Math.round((lpSubmitted / lpTotal) * 100) : 0;
            return (
              <Tooltip text="Open Academics → Lesson Plans">
                <div
                  className="dash-panel"
                  style={{ '--panel-accent': MODULE_COLOR.academics.stroke, '--panel-soft': MODULE_COLOR.academics.soft, cursor: 'pointer' }}
                  onClick={() => openModule('acad')}
                  role="button" tabIndex={0}
                >
                  <div className="dash-panel-h">
                    <div className="dash-panel-h-l">
                      <div className="dash-panel-h-ic"><i className="fa-solid fa-book-open" aria-hidden="true"></i></div>
                      <div>
                        <div className="dash-panel-h-t">Lesson Plans</div>
                        <div className="dash-panel-h-s">Across all my classes</div>
                      </div>
                    </div>
                    <div className="dash-panel-h-r">
                      <MiniRing pct={lpPct} color={MODULE_COLOR.academics.stroke} track={MODULE_COLOR.academics.soft} />
                      <span className="dash-panel-pill">{lpPct}% done</span>
                    </div>
                  </div>
                  <div className="dash-panel-body">
                    <div className="tch-statbox-grid">
                      <div className="tch-statbox tch-statbox--brand">
                        <div className="tch-statbox-lbl">Total Lesson Plans</div>
                        <div className="tch-statbox-val">{lpTotal}</div>
                      </div>
                      <div className="tch-statbox tch-statbox--green">
                        <div className="tch-statbox-lbl">Submitted</div>
                        <div className="tch-statbox-val">{lpSubmitted}</div>
                      </div>
                      <div className="tch-statbox tch-statbox--amber">
                        <div className="tch-statbox-lbl">Pending</div>
                        <div className="tch-statbox-val">{lessonPlanStats.pending}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dash-panel-body" style={{ paddingTop: 0 }}>
                    <div className="dash-bar">
                      <div className="dash-bar-h">
                        <span>Submission Progress</span>
                        <span className="dash-bar-val">{lpPct}%</span>
                      </div>
                      <div className="dash-bar-track">
                        <div className="dash-bar-fill" style={{ width: `${lpPct}%`, '--bar-from': '#1E40AF', '--bar-to': '#2563EB' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })()}

          {showHomework && notebookStats && (() => {
            const np = notebookStats;
            const npPct = np.total ? Math.round((np.submitted / np.total) * 100) : 0;
            return (
              <Tooltip text="Open Academics → Notebook Plans">
                <div
                  className="dash-panel"
                  style={{ '--panel-accent': MODULE_COLOR.academics.stroke, '--panel-soft': MODULE_COLOR.academics.soft, cursor: 'pointer' }}
                  onClick={() => openModule('acad')}
                  role="button" tabIndex={0}
                >
                  <div className="dash-panel-h">
                    <div className="dash-panel-h-l">
                      <div className="dash-panel-h-ic"><i className="fa-solid fa-pen-clip" aria-hidden="true"></i></div>
                      <div>
                        <div className="dash-panel-h-t">Notebook Plans</div>
                        <div className="dash-panel-h-s">Unit-wise notebook submissions</div>
                      </div>
                    </div>
                    <div className="dash-panel-h-r">
                      <MiniRing pct={npPct} color={MODULE_COLOR.academics.stroke} track={MODULE_COLOR.academics.soft} />
                      <span className="dash-panel-pill">{npPct}% done</span>
                    </div>
                  </div>
                  <div className="dash-panel-body">
                    <div className="tch-statbox-grid">
                      <div className="tch-statbox tch-statbox--brand">
                        <div className="tch-statbox-lbl">Total Units</div>
                        <div className="tch-statbox-val">{np.total}</div>
                      </div>
                      <div className="tch-statbox tch-statbox--green">
                        <div className="tch-statbox-lbl">Submitted</div>
                        <div className="tch-statbox-val">{np.submitted}</div>
                      </div>
                      <div className="tch-statbox tch-statbox--amber">
                        <div className="tch-statbox-lbl">Pending</div>
                        <div className="tch-statbox-val">{np.pending}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dash-panel-body" style={{ paddingTop: 0 }}>
                    <div className="dash-bar">
                      <div className="dash-bar-h">
                        <span>Submission Progress</span>
                        <span className="dash-bar-val">{npPct}%</span>
                      </div>
                      <div className="dash-bar-track">
                        <div className="dash-bar-fill" style={{ width: `${npPct}%`, '--bar-from': '#1E40AF', '--bar-to': '#2563EB' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })()}

          {showAttendance && myAttendance && (
            <Tooltip text="Open Attendance">
              <div
                className="dash-panel"
                style={{ '--panel-accent': MODULE_COLOR.attendance.stroke, '--panel-soft': MODULE_COLOR.attendance.soft, cursor: 'pointer' }}
                onClick={() => openModule('att')}
                role="button" tabIndex={0}
              >
              <div className="dash-panel-h">
                <div className="dash-panel-h-l">
                  <div className="dash-panel-h-ic"><i className="fa-solid fa-clipboard-check" aria-hidden="true"></i></div>
                  <div>
                    <div className="dash-panel-h-t">My Attendance</div>
                    <div className="dash-panel-h-s">This month</div>
                  </div>
                </div>
                <div className="dash-panel-h-r">
                  <MiniRing pct={myAttendance.pct} color={MODULE_COLOR.attendance.stroke} track={MODULE_COLOR.attendance.soft} />
                  <span className="dash-panel-pill">{myAttendance.pct}%</span>
                </div>
              </div>
              <div className="dash-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(21,128,61,.12)', color: '#15803D' }}>
                    <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Present</div>
                    <div className="dash-mini-val">{myAttendance.present}</div>
                  </div>
                </div>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(220,38,38,.12)', color: '#B91C1C' }}>
                    <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Absent</div>
                    <div className="dash-mini-val">{myAttendance.absent}</div>
                  </div>
                </div>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(217,119,6,.14)', color: '#92400E' }}>
                    <i className="fa-solid fa-house" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Leave</div>
                    <div className="dash-mini-val">{myAttendance.leave}</div>
                  </div>
                </div>
              </div>
              <div className="dash-panel-body" style={{ paddingTop: 0 }}>
                <div className="dash-bar">
                  <div className="dash-bar-h">
                    <span>Monthly</span>
                    <span className="dash-bar-val">{myAttendance.pct}%</span>
                  </div>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={{ width: `${myAttendance.pct}%`, '--bar-from': '#15803D', '--bar-to': '#16A34A' }} />
                  </div>
                </div>
              </div>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
      )}

      {/* ═════════ EXAM TASKS (moved from top) ═════════
            Current Exam · Pending Syllabus Uploads · Pending Marks Uploads
            Each card is scoped to this teacher's assigned class/section/subject.
            The two pending cards expand inline to list the affected classes. */}
      {showExam && (
        <div className="dash-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i> Exam Tasks
            </div>
            <span className="dash-sec-sub">Active exam reminders · scoped to my classes</span>
          </div>
          <div className="dash-priority">
            {/* CURRENT EXAM — expandable inline list of papers, same pattern
                as the two pending-uploads cards beside it. */}
            {currentExam && (
              <Tooltip text="Click to view exam papers assigned to me">
                <div
                  className={`dash-pri dash-pri--blue${openCard === 'currentExam' ? ' is-open' : ''}`}
                  role="button" tabIndex={0}
                  aria-expanded={openCard === 'currentExam'}
                  onClick={() => setOpenCard(openCard === 'currentExam' ? null : 'currentExam')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenCard(openCard === 'currentExam' ? null : 'currentExam');
                    }
                  }}
                >
                  <div className="dash-pri-h">
                    <div className="dash-pri-ic"><i className="fa-solid fa-clipboard-list" aria-hidden="true"></i></div>
                    <span className="dash-pri-tag">Active</span>
                  </div>
                  <div className="dash-pri-val" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                    {currentExam.name}
                  </div>
                  <div className="dash-pri-lbl">{currentExam.dates}</div>
                  <div className="dash-pri-cta">
                    {openCard === 'currentExam' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'currentExam' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'currentExam' && (
                    <div className="dash-pri-list">
                      {(currentExam.papers || []).length === 0 && (
                        <div className="dash-pri-list-row">
                          <i className="fa-solid fa-file-pen" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">No exam papers assigned</span>
                        </div>
                      )}
                      {(currentExam.papers || []).map(p => (
                        <div key={p.id} className="dash-pri-list-row">
                          <i className="fa-solid fa-file-pen" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">{p.cls} · {p.subject}</span>
                          <span className="dash-pri-list-sub">{p.date}</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="dash-pri-list-cta"
                        onClick={(e) => { e.stopPropagation(); openModule('exam'); }}
                      >
                        Open in Examination <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                      </button>
                    </div>
                  )}
                </div>
              </Tooltip>
            )}

            {/* PENDING SYLLABUS UPLOADS */}
            {pendingSyllabusUploads && (
              <Tooltip text="Click to view classes where syllabus is pending">
                <div
                  className={`dash-pri dash-pri--amber${openCard === 'syllabus' ? ' is-open' : ''}`}
                  role="button" tabIndex={0}
                  aria-expanded={openCard === 'syllabus'}
                  onClick={() => setOpenCard(openCard === 'syllabus' ? null : 'syllabus')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenCard(openCard === 'syllabus' ? null : 'syllabus');
                    }
                  }}
                >
                  <div className="dash-pri-h">
                    <div className="dash-pri-ic"><i className="fa-solid fa-book" aria-hidden="true"></i></div>
                    <span className="dash-pri-tag">Pending</span>
                  </div>
                  <div className="dash-pri-val">{pendingSyllabusUploads.length}</div>
                  <div className="dash-pri-lbl">Pending Syllabus Uploads</div>
                  <div className="dash-pri-cta">
                    {openCard === 'syllabus' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'syllabus' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'syllabus' && (
                    <div className="dash-pri-list">
                      {pendingSyllabusUploads.length === 0 && (
                        <div className="dash-pri-list-row">
                          <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">Nothing pending</span>
                        </div>
                      )}
                      {pendingSyllabusUploads.map(p => (
                        <div key={p.id} className="dash-pri-list-row">
                          <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">{p.cls}</span>
                          <span className="dash-pri-list-sub">{p.subject}</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="dash-pri-list-cta"
                        onClick={(e) => { e.stopPropagation(); openModule('acad'); }}
                      >
                        Upload syllabus in Academics <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                      </button>
                    </div>
                  )}
                </div>
              </Tooltip>
            )}

            {/* PENDING MARKS UPLOADS */}
            {pendingMarksUploads && (
              <Tooltip text="Click to view classes where marks are pending">
                <div
                  className={`dash-pri dash-pri--purple${openCard === 'marks' ? ' is-open' : ''}`}
                  role="button" tabIndex={0}
                  aria-expanded={openCard === 'marks'}
                  onClick={() => setOpenCard(openCard === 'marks' ? null : 'marks')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenCard(openCard === 'marks' ? null : 'marks');
                    }
                  }}
                >
                  <div className="dash-pri-h">
                    <div className="dash-pri-ic"><i className="fa-solid fa-pen-clip" aria-hidden="true"></i></div>
                    <span className="dash-pri-tag">Pending</span>
                  </div>
                  <div className="dash-pri-val">{pendingMarksUploads.length}</div>
                  <div className="dash-pri-lbl">Pending Marks Uploads</div>
                  <div className="dash-pri-cta">
                    {openCard === 'marks' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'marks' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'marks' && (
                    <div className="dash-pri-list">
                      {pendingMarksUploads.length === 0 && (
                        <div className="dash-pri-list-row">
                          <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">Nothing pending</span>
                        </div>
                      )}
                      {pendingMarksUploads.map(p => (
                        <div key={p.id} className="dash-pri-list-row">
                          <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                          <span className="dash-pri-list-cls">{p.cls}</span>
                          <span className="dash-pri-list-sub">{p.subject}</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="dash-pri-list-cta"
                        onClick={(e) => { e.stopPropagation(); openModule('exam'); }}
                      >
                        Upload marks in Examination <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                      </button>
                    </div>
                  )}
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* ═════════ MY APPRAISAL ═════════
          Open Appraisals button removed. Teacher picks an appraisal
          from the dropdown, views the summary inline, and downloads
          the appraisal PDF — all without leaving the dashboard.
          (My Notifications section removed entirely per spec.) */}
      {showAppraisal && (
        <div className="dash-sec">
          <div className="dash-sec-h">
            <div className="dash-sec-title">
              <i className="fa-solid fa-star-half-stroke" aria-hidden="true"></i> My Appraisal
            </div>
            <Tooltip text="Pick an appraisal period to view">
              <label className="tch-day-picker">
                <span className="tch-day-picker-lbl">Select Appraisal</span>
                <select
                  className="tch-day-picker-sel"
                  value={selectedAppraisalId || ''}
                  onChange={(e) => setSelectedAppraisalId(e.target.value)}
                  aria-label="Select an appraisal period"
                >
                  {appraisalList.length === 0 && <option value="">No appraisals yet</option>}
                  {appraisalList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.period} — {a.status}{a.score != null ? ` (${a.score}/100)` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </Tooltip>
          </div>
          <div
            className="dash-panel"
            style={{ '--panel-accent': MODULE_COLOR.appraisals.stroke, '--panel-soft': MODULE_COLOR.appraisals.soft }}
          >
            <div className="dash-panel-h">
              <div className="dash-panel-h-l">
                <div className="dash-panel-h-ic"><i className="fa-solid fa-trophy" aria-hidden="true"></i></div>
                <div>
                  <div className="dash-panel-h-t">{selectedAppraisal.period} · {selectedAppraisal.status}</div>
                  <div className="dash-panel-h-s">
                    Reviewed by {selectedAppraisal.by} · {selectedAppraisal.date}
                  </div>
                </div>
              </div>
              {selectedAppraisal.score != null && (
                <span className="dash-panel-pill">{selectedAppraisal.score}/100</span>
              )}
            </div>

            <div className="dash-panel-body">
              <div className="tch-statbox-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="tch-statbox tch-statbox--brand">
                  <div className="tch-statbox-lbl">Period</div>
                  <div className="tch-statbox-val" style={{ fontSize: 16 }}>{selectedAppraisal.period}</div>
                </div>
                <div className={`tch-statbox ${selectedAppraisal.status === 'Completed' ? 'tch-statbox--green' : 'tch-statbox--amber'}`}>
                  <div className="tch-statbox-lbl">Status</div>
                  <div className="tch-statbox-val" style={{ fontSize: 16 }}>{selectedAppraisal.status}</div>
                </div>
                <div className="tch-statbox tch-statbox--brand">
                  <div className="tch-statbox-lbl">Score</div>
                  <div className="tch-statbox-val">
                    {selectedAppraisal.score != null ? selectedAppraisal.score : '—'}
                  </div>
                </div>
              </div>
            </div>

            {selectedAppraisal.score != null && (
              <div className="dash-panel-body" style={{ paddingTop: 0 }}>
                <div className="dash-bar">
                  <div className="dash-bar-h">
                    <span>Performance</span>
                    <span className="dash-bar-val">{selectedAppraisal.score}/100</span>
                  </div>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={{ width: `${selectedAppraisal.score}%`, '--bar-from': '#B45309', '--bar-to': '#D97706' }} />
                  </div>
                </div>
              </div>
            )}

            <div className="dash-panel-body" style={{ paddingTop: 0 }}>
              <div className="tch-apr-actions">
                <Tooltip text="Open the appraisal in read-only view">
                  <button
                    type="button"
                    className="tch-apr-btn tch-apr-btn--ghost"
                    onClick={() => toast(selectedAppraisal.id ? `Viewing ${selectedAppraisal.period} appraisal…` : 'No appraisal available yet', 'info')}
                  >
                    <i className="fa-solid fa-eye" aria-hidden="true"></i> View Appraisal
                  </button>
                </Tooltip>
                <Tooltip text="Download a PDF copy of this appraisal">
                  <button
                    type="button"
                    className="tch-apr-btn tch-apr-btn--primary"
                    onClick={() => toast(selectedAppraisal.id ? `Downloading ${selectedAppraisal.pdf || selectedAppraisal.period + '.pdf'}…` : 'No appraisal available yet', selectedAppraisal.id ? 'success' : 'info')}
                  >
                    <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> Download PDF
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ STUDENT / TEACHER BIRTHDAYS THIS MONTH ═════════
          1:1 with the Admin Dashboard section (same chrome, same data shape). */}
      <div className="adm-divider" />
      <div className="dash-sec adm-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <span className="adm-h-ic adm-h-ic--cake"><i className="fa-solid fa-cake-candles" aria-hidden="true"></i></span>
            Birthdays This Month
          </div>
          <div className="adm-seg" role="tablist" aria-label="Birthday filter">
            {[
              { id: 'students', lbl: 'Students' },
              { id: 'teachers', lbl: 'Teachers' },
              { id: 'all',      lbl: 'All' },
            ].map(t => (
              <Tooltip key={t.id} text={`Show ${t.lbl.toLowerCase()} birthdays`}>
                <button
                  type="button"
                  className={`adm-seg-btn${birthdayTab === t.id ? ' on' : ''}`}
                  onClick={() => setBirthdayTab(t.id)}
                  role="tab"
                  aria-selected={birthdayTab === t.id}
                >{t.lbl}</button>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="adm-info-banner">
          <i className="fa-solid fa-calendar" aria-hidden="true"></i>
          <span>Showing birthdays for {cmyLabel}</span>
        </div>

        <div className="adm-bday-row">
          {showStudentsBday && (
            <div className="adm-bday-col">
              <div className="adm-side-tag">
                Students
                <span className="adm-pill-blue">{stuBdays.length}</span>
              </div>
              <div className="adm-bday-list">
                {stuBdays.length === 0 && (
                  <div className="adm-bday-meta">No student birthdays this month</div>
                )}
                {stuBdays.map((b, i) => {
                  const day = bdayDay(b.BirthDate);
                  const isToday = day === realTodayDay;
                  const isTomorrow = day === realTodayDay + 1;
                  return (
                    <div key={b.PersonID ?? i} className={`adm-bday-card${isToday ? ' today' : ''}`}>
                      <div className="adm-bday-av">{teacherDashInitials(bdayName(b))}</div>
                      <div className="adm-bday-info">
                        <div className="adm-bday-name">{bdayName(b)}</div>
                        <div className="adm-bday-meta">{bdayMeta(b)}</div>
                      </div>
                      {isToday ? (
                        <span className="adm-pill-green">Today! 🎂</span>
                      ) : isTomorrow ? (
                        <span className="adm-pill-amber">Tomorrow</span>
                      ) : (
                        <span className="adm-pill-blue">{bdayLabel(b.BirthDate)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showTeachersBday && (
            <div className="adm-bday-col">
              <div className="adm-side-tag">
                Teachers &amp; Staff
                <span className="adm-pill-blue">{staffBdays.length}</span>
              </div>
              <div className="adm-bday-list">
                {staffBdays.length === 0 && (
                  <div className="adm-bday-meta">No staff birthdays this month</div>
                )}
                {staffBdays.map((b, i) => {
                  const day = bdayDay(b.BirthDate);
                  const isToday = day === realTodayDay;
                  const isTomorrow = day === realTodayDay + 1;
                  return (
                    <div key={b.PersonID ?? i} className={`adm-bday-card${isToday ? ' today' : ''}`}>
                      <div className="adm-bday-av adm-bday-av--purple">{teacherDashInitials(bdayName(b))}</div>
                      <div className="adm-bday-info">
                        <div className="adm-bday-name">{bdayName(b)}</div>
                        <div className="adm-bday-meta">{bdayMeta(b)}</div>
                      </div>
                      {isToday ? (
                        <span className="adm-pill-green">Today! 🎂</span>
                      ) : isTomorrow ? (
                        <span className="adm-pill-amber">Tomorrow</span>
                      ) : (
                        <span className="adm-pill-blue">{bdayLabel(b.BirthDate)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════ UPCOMING ACTIVITIES ═════════
          Admin Dashboard jaisa hi section — data ab teacher API ke
          UpcomingActivities se aata hai. Har card Academics → Scheme
          of Studies → Calendar → Activity Calendar par le jata hai. */}
      <div className="adm-divider" />
      <div className="dash-sec adm-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <span className="adm-h-ic adm-h-ic--star"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i></span>
            Upcoming Activities
          </div>
          <span className="adm-h-meta">{cmyLabel}</span>
        </div>
        <div className="adm-info-banner">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>School events, exams, and important dates for this month.</span>
        </div>

        {upActivities.length === 0 ? (
          <div className="adm-info-banner">
            <i className="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
            <span>No upcoming activities scheduled.</span>
          </div>
        ) : (
        <div className="adm-act-grid">
          {upActivities.map((a, i) => {
            const c = TEACHER_DASH_EVENT_COLOR;
            const start = a.StartAt || a.StartDate || a.Date;
            const daysAway = actDaysAway(start);
            const daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : daysAway > 0 ? `In ${daysAway} days` : 'Past';
            const daysTone = daysAway <= 1 ? 'amber' : (daysAway <= 7 ? 'brand' : 'muted');
            const goActivityCalendar = () => {
              openActivityCalendar();
              toast('Opening Activity Calendar…', 'info');
            };
            return (
              <Tooltip key={a.ID ?? i} text="Open Academics → Activity Calendar">
                <div
                  className="adm-act-card clickable"
                  style={{ '--act-bar': c.fg }}
                  onClick={goActivityCalendar}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goActivityCalendar(); } }}
                >
                  <div className="adm-act-h">
                    <span className="adm-act-chip" style={{ background: c.bg, color: c.fg }}>
                      <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
                      {actDateLabel(start)}
                    </span>
                    <span className={`adm-act-days adm-act-days--${daysTone}`}>{daysLabel}</span>
                  </div>
                  <div className="adm-act-title">{a.Name || a.Title || '—'}</div>
                  <div className="adm-act-desc">{a.ActivityPurpose || a.Description || ''}</div>
                  <div className="adm-act-foot">
                    <span className="adm-act-mod">
                      <i className="fa-solid fa-calendar-plus" aria-hidden="true"></i>
                      Activity Calendar
                    </span>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
        )}
      </div>

      {/* ─── Top-card modals ─── */}
      {showAnnouncements && (
        <AnnouncementsModal
          announcements={announcements}
          onClose={() => setShowAnnouncements(false)}
          toast={toast}
        />
      )}
      {showNoticeBoard && (
        <TeacherSimpleListModal
          title="Notice Board"
          subtitle="Principal · via Mobile App"
          icon="fa-clipboard-list"
          items={noticeItems}
          onClose={() => setShowNoticeBoard(false)}
          toast={toast}
        />
      )}
      {showReminders && (
        <TeacherSimpleListModal
          title="Principal Reminders"
          subtitle="Personal reminders for you"
          icon="fa-bell"
          items={reminders}
          onClose={() => setShowReminders(false)}
          toast={toast}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TeacherSimpleListModal — generic timeline modal reused by the Notice
   Board + Principal Reminders top cards. Same chrome / shape as the
   AnnouncementsModal (up-modal + simple timeline list). Reads the same
   shape: { id, title, preview, description?, date, time, status, sender,
   category, priority? }.
   ═══════════════════════════════════════════════════════════════════ */
function TeacherSimpleListModal({ title, subtitle, icon, items, onClose, toast }) {
  const [list, setList] = useState(items);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const unread = list.filter(i => i.status === 'new').length;
  const markRead = (id) => setList(prev => prev.map(i => i.id === id ? { ...i, status: 'read' } : i));
  const markAllRead = () => {
    if (unread === 0) return;
    setList(prev => prev.map(i => ({ ...i, status: 'read' })));
    toast(`${title}: all marked as read`, 'success');
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--lg" style={{ maxHeight: '90vh' }}>
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title">{title}</div>
              <div className="up-modal-sub">
                <span>{subtitle} · {list.length} total</span>
                {unread > 0 && (
                  <span
                    className="up-badge up-badge--red"
                    style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', marginRight: 4 }} />
                    {unread} unread
                  </span>
                )}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="up-modal-body" style={{ background: 'var(--bg-muted, #F8FAFF)' }}>
          {list.length === 0 ? (
            <div className="up-empty">
              <div className="up-empty-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
              <div className="up-empty-t">No items this month</div>
              <div className="up-empty-s">You're all caught up. Check back later.</div>
            </div>
          ) : (
            <div className="tch-tl">
              {list.map(item => {
                const isUnread = item.status === 'new';
                return (
                  <div key={item.id} className={`tch-tl-card${isUnread ? ' is-new' : ''}`}>
                    <div className="tch-tl-h">
                      <div className="tch-tl-h-l">
                        <span className={`tch-tl-status${isUnread ? ' is-new' : ''}`}>
                          {isUnread ? 'Unread' : 'Read'}
                        </span>
                        <span className="tch-tl-category">{item.category}</span>
                        {item.priority && (
                          <span className={`tch-tl-priority tch-tl-priority--${item.priority}`}>
                            {item.priority}
                          </span>
                        )}
                      </div>
                      <div className="tch-tl-h-r">
                        <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
                        <span>{item.date}</span>
                        {item.time && (
                          <>
                            <span className="tch-tl-sep">·</span>
                            <i className="fa-solid fa-clock" aria-hidden="true"></i>
                            <span>{item.time}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="tch-tl-title">{item.title}</div>
                    <div className="tch-tl-desc">{item.description || item.preview}</div>
                    <div className="tch-tl-foot">
                      <span className="tch-tl-sender">
                        <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                        {item.sender}
                      </span>
                      {isUnread && (
                        <button
                          type="button"
                          className="tch-tl-mark"
                          onClick={() => markRead(item.id)}
                        >
                          Mark as read <i className="fa-solid fa-check" aria-hidden="true"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="up-modal-foot up-modal-foot--split">
          <div className="up-modal-foot-l">
            <span className="up-badge up-badge--blue">{list.length} total</span>
            {unread > 0 && <span className="up-badge up-badge--red">{unread} unread</span>}
            <span className="up-badge up-badge--gray">{list.length - unread} read</span>
          </div>
          <div className="up-modal-foot-r">
            <Tooltip text="Mark every item as read">
              <button
                type="button"
                className="up-btn up-btn-ghost"
                onClick={markAllRead}
                disabled={unread === 0}
              >
                <i className="fa-solid fa-check-double" aria-hidden="true"></i> Mark all read
              </button>
            </Tooltip>
            <button type="button" className="up-btn up-btn-primary" onClick={onClose}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> Done
            </button>
          </div>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   TCH_CSS — Teacher Dashboard scoped overrides + new compact stat
   boxes used inside the Lesson Plans + Notebook Plans cards. Adds
   dark-mode coverage for everything new.
   ═══════════════════════════════════════════════════════════════════ */
const TCH_CSS = `
/* Day picker / appraisal picker — same chrome, sits in the section
   header where the "Open …" link used to be. */
.tch-day-picker {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 6px 4px 12px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  transition: all .15s;
}
.tch-day-picker:hover { border-color: var(--border-med, #93C5FD); }
.tch-day-picker:focus-within {
  border-color: var(--brand-primary, #1E40AF);
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .15);
}
.tch-day-picker-lbl {
  font: 800 10.5px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: .5px;
  white-space: nowrap;
}
.tch-day-picker-sel {
  appearance: none; -webkit-appearance: none;
  border: none; outline: none;
  background: transparent;
  font: 700 12.5px/1 var(--dash-font);
  color: var(--text-primary);
  padding: 7px 26px 7px 8px;
  cursor: pointer;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%2364748B' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px;
  border-radius: 999px;
  max-width: 220px;
}

/* Scrollable wrapper for Today's Schedule list. Keeps a multi-class
   day from blowing the dashboard layout open. */
.tch-sched-scroll {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, .35) transparent;
}
.tch-sched-scroll::-webkit-scrollbar { width: 6px; }
.tch-sched-scroll::-webkit-scrollbar-track { background: transparent; }
.tch-sched-scroll::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, .35);
  border-radius: 999px;
}
.tch-sched-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, .55); }
.tch-sched-empty {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 40px 18px;
  background: var(--bg-card, #fff);
  border: 1px dashed var(--border-light, #E2E8F0);
  border-radius: var(--dash-radius);
  color: var(--text-muted, #64748B);
  font: 600 12.5px/1.4 var(--dash-font);
}
.tch-sched-empty i { color: var(--brand-primary, #1E40AF); font-size: 16px; opacity: .75; }

/* My Appraisal action buttons (View + Download PDF) */
.tch-apr-actions {
  display: flex; gap: 10px; flex-wrap: wrap;
  padding-top: 4px;
}
.tch-apr-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 16px;
  border-radius: 999px;
  font: 700 12.5px/1 var(--dash-font);
  cursor: pointer;
  transition: all .15s;
}
.tch-apr-btn i { font-size: 12px; }
.tch-apr-btn--ghost {
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  color: var(--text-primary);
}
.tch-apr-btn--ghost:hover {
  border-color: var(--brand-primary, #1E40AF);
  color: var(--brand-primary, #1E40AF);
  background: rgba(30, 64, 175, .04);
}
.tch-apr-btn--primary {
  background: linear-gradient(135deg, #B45309, #D97706);
  border: none;
  color: #fff;
}
.tch-apr-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(217, 119, 6, .28);
}

/* Compact 3-up stat boxes inside dash-panel-body. Replaces the .dash-mini
   pattern for Lesson Plans + Notebook Plans so the inner boxes can never
   overflow the parent card. */
.tch-statbox-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}
.tch-statbox {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--bg-muted, #F8FAFF);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 10px;
  min-width: 0;
  overflow: hidden;
}
.tch-statbox-lbl {
  font: 700 9.5px/1.2 var(--dash-font);
  color: var(--text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: .5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tch-statbox-val {
  font: 800 22px/1 var(--dash-font);
  color: var(--text-primary);
  letter-spacing: -0.4px;
  font-variant-numeric: tabular-nums;
}
.tch-statbox--brand { background: rgba(30, 64, 175, .06); border-color: rgba(30, 64, 175, .18); }
.tch-statbox--brand .tch-statbox-val { color: #1E40AF; }
.tch-statbox--green { background: rgba(22, 163, 74, .06); border-color: rgba(22, 163, 74, .22); }
.tch-statbox--green .tch-statbox-val { color: #15803D; }
.tch-statbox--amber { background: rgba(217, 119, 6, .07); border-color: rgba(217, 119, 6, .22); }
.tch-statbox--amber .tch-statbox-val { color: #B45309; }

/* Notice / Reminder pill dot — green / amber animated dots */
.tch-tc-pill-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
  animation: dashPulse 1.4s ease-in-out infinite;
}

/* Birthdays / Activities tightening — minor alignment polish */
.adm-bday-card {
  align-items: center;
  gap: 11px;
}
.adm-bday-av {
  width: 36px; height: 36px;
  font-size: 13px;
}
.adm-act-card {
  min-height: 0;
}

/* Timeline-style list for Notice Board / Principal Reminders modal */
.tch-tl { display: flex; flex-direction: column; gap: 10px; padding: 4px 4px 8px; }
.tch-tl-card {
  padding: 14px 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  transition: all .15s;
}
.tch-tl-card:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(15, 23, 42, .06); }
[data-theme="dark"] .tch-tl-card:hover { border-color: #2B3E66; box-shadow: 0 4px 12px rgba(0, 0, 0, .35); }
.tch-tl-card.is-new {
  border-color: rgba(220, 38, 38, .22);
  background: linear-gradient(135deg, rgba(220, 38, 38, .03), var(--bg-card, #fff));
}
.tch-tl-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-bottom: 8px; flex-wrap: wrap;
}
.tch-tl-h-l { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tch-tl-h-r {
  display: inline-flex; align-items: center; gap: 6px;
  font: 600 11px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
}
.tch-tl-h-r i { font-size: 10px; }
.tch-tl-sep { color: #CBD5E1; }
.tch-tl-status {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font: 800 10px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .5px;
  background: rgba(100, 116, 139, .14);
  color: #475569;
}
.tch-tl-status.is-new { background: rgba(220, 38, 38, .14); color: #B91C1C; }
.tch-tl-category {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font: 700 10.5px/1 var(--dash-font);
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
}
.tch-tl-priority {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font: 700 10px/1 var(--dash-font);
  text-transform: uppercase; letter-spacing: .4px;
}
.tch-tl-priority--high   { background: rgba(220, 38, 38, .14); color: #B91C1C; }
.tch-tl-priority--medium { background: rgba(217, 119, 6, .14); color: #B45309; }
.tch-tl-priority--low    { background: rgba(100, 116, 139, .14); color: #475569; }
.tch-tl-title {
  font: 800 15px/1.3 var(--dash-font);
  color: var(--text-primary);
  letter-spacing: -0.2px;
  margin-bottom: 6px;
}
.tch-tl-desc {
  font: 500 12.5px/1.6 var(--dash-font);
  color: var(--text-secondary, #475569);
}
.tch-tl-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light, #E2E8F0);
  flex-wrap: wrap;
}
.tch-tl-sender {
  display: inline-flex; align-items: center; gap: 5px;
  font: 600 11px/1 var(--dash-font);
  color: var(--text-muted, #64748B);
}
.tch-tl-sender i { color: #1E40AF; font-size: 10px; }
.tch-tl-mark {
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; padding: 0 10px;
  background: transparent;
  border: 1px solid rgba(30, 64, 175, .24);
  border-radius: 7px;
  font: 700 11px/1 var(--dash-font);
  color: #1E40AF;
  cursor: pointer; transition: all .15s;
}
.tch-tl-mark:hover { background: rgba(30, 64, 175, .08); border-color: #1E40AF; }
.tch-tl-mark i { font-size: 9px; }

/* ─── DARK MODE OVERRIDES (Teacher-only scope) ─── */
[data-theme="dark"] .tch-day-picker {
  background: var(--bg-card, #0E1628);
  border-color: var(--border-light, #1C2E50);
}
[data-theme="dark"] .tch-day-picker:hover { border-color: var(--border-med, #243858); }
[data-theme="dark"] .tch-day-picker:focus-within {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .22);
}
[data-theme="dark"] .tch-day-picker-lbl { color: var(--text-muted, #6B82A8); }
[data-theme="dark"] .tch-day-picker-sel {
  color: var(--text-primary, #E2E8F8);
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%236B82A8' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
[data-theme="dark"] .tch-day-picker-sel option {
  background: #0E1628;
  color: #E2E8F8;
}

[data-theme="dark"] .tch-sched-scroll {
  scrollbar-color: rgba(107, 130, 168, .45) transparent;
}
[data-theme="dark"] .tch-sched-scroll::-webkit-scrollbar-thumb { background: rgba(107, 130, 168, .45); }
[data-theme="dark"] .tch-sched-empty {
  background: var(--bg-card, #0E1628);
  border-color: var(--border-light, #1C2E50);
  color: var(--text-muted, #6B82A8);
}
[data-theme="dark"] .tch-sched-empty i { color: #93C5FD; }

[data-theme="dark"] .tch-apr-btn--ghost {
  background: var(--bg-card, #0E1628);
  border-color: var(--border-light, #1C2E50);
  color: var(--text-primary, #E2E8F8);
}
[data-theme="dark"] .tch-apr-btn--ghost:hover {
  border-color: #3B82F6;
  color: #93C5FD;
  background: rgba(59, 130, 246, .08);
}
[data-theme="dark"] .tch-apr-btn--primary {
  background: linear-gradient(135deg, #B45309, #F59E0B);
}

[data-theme="dark"] .tch-statbox {
  background: var(--bg-muted, #131F38);
  border-color: var(--border-light, #1C2E50);
}
[data-theme="dark"] .tch-statbox-lbl { color: var(--text-muted, #6B82A8); }
[data-theme="dark"] .tch-statbox-val { color: var(--text-primary, #E2E8F8); }
[data-theme="dark"] .tch-statbox--brand { background: rgba(96, 165, 250, .08); border-color: rgba(96, 165, 250, .22); }
[data-theme="dark"] .tch-statbox--brand .tch-statbox-val { color: #93C5FD; }
[data-theme="dark"] .tch-statbox--green { background: rgba(34, 197, 94, .08); border-color: rgba(34, 197, 94, .22); }
[data-theme="dark"] .tch-statbox--green .tch-statbox-val { color: #86EFAC; }
[data-theme="dark"] .tch-statbox--amber { background: rgba(245, 158, 11, .08); border-color: rgba(245, 158, 11, .22); }
[data-theme="dark"] .tch-statbox--amber .tch-statbox-val { color: #FCD34D; }

[data-theme="dark"] .tch-tl-card { background: #0E1628; border-color: #1F3158; }
[data-theme="dark"] .tch-tl-card.is-new {
  background: linear-gradient(135deg, rgba(248, 113, 113, .06), #0E1628);
  border-color: rgba(248, 113, 113, .22);
}
[data-theme="dark"] .tch-tl-status { background: rgba(148, 163, 184, .16); color: #94A3B8; }
[data-theme="dark"] .tch-tl-status.is-new { background: rgba(248, 113, 113, .14); color: #F87171; }
[data-theme="dark"] .tch-tl-category { background: rgba(96, 165, 250, .12); color: #60A5FA; }
[data-theme="dark"] .tch-tl-mark { color: #60A5FA; border-color: rgba(96, 165, 250, .24); }
[data-theme="dark"] .tch-tl-foot { border-top-color: #1C2E50; }
[data-theme="dark"] .tch-tl-priority--high   { background: rgba(248, 113, 113, .18); color: #FCA5A5; }
[data-theme="dark"] .tch-tl-priority--medium { background: rgba(245, 158, 11, .18); color: #FCD34D; }
[data-theme="dark"] .tch-tl-priority--low    { background: rgba(148, 163, 184, .16); color: #94A3B8; }

@keyframes dashPulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

/* ═════════ MOBILE RESPONSIVE — teacher dashboard surfaces ═════════ */
@media (max-width: 600px) {
  /* Override inline 3-col stat grid inside dash-panel-body.
     CSS !important beats inline non-!important styles, so the
     repeat(3,1fr) inline style collapses to single column on mobile. */
  .dash-panel-body[style*="grid-template-columns"],
  .dash-panel-body[style*="gridTemplateColumns"] {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
  }

  /* Section header rows (icon-title + day picker) stack */
  .dash-sec-h {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-bottom: 10px;
  }
  .dash-sec-title { font-size: 14px; }
  .dash-sec-sub { font-size: 11px; }

  /* Day / appraisal picker — full-width inside its row */
  .tch-day-picker {
    width: 100%;
    justify-content: space-between;
    padding: 4px 6px 4px 10px;
  }
  .tch-day-picker-sel {
    flex: 1;
    max-width: none;
    width: 100%;
    font-size: 12px;
  }

  /* Today's Schedule grid → horizontal scroll on mobile */
  .dash-sched {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: 78%;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 10px;
    padding-bottom: 6px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    scroll-snap-type: x mandatory;
  }
  .dash-sched::-webkit-scrollbar { display: none; }
  .dash-sched-card {
    scroll-snap-align: start;
    padding: 12px;
  }
  .tch-sched-scroll {
    max-height: none;
    padding-right: 0;
    margin-right: 0;
  }

  /* Exam Tasks 3 cards (.dash-priority) — 1 col */
  .dash-priority {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .dash-pri { padding: 14px; }
  .dash-pri-val { font-size: 28px; }
  .dash-pri-list-row { font-size: 11.5px; gap: 8px; }

  /* My Performance 3 cards (LP / Notebook / Attendance) — 1 col */
  .dash-grid-3 {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  /* My Classes rows — full width, tighten */
  .dash-rows .dash-row {
    padding: 11px 12px;
    gap: 10px;
  }
  .dash-row-ic {
    width: 32px;
    height: 32px;
    font-size: 13px;
    border-radius: 8px;
  }
  .dash-row-t { font-size: 12px; }
  .dash-row-s { font-size: 10.5px; }
  .dash-row-val { padding: 4px 9px; font-size: 11px; }

  /* My Appraisal action buttons — wrap + primary full width */
  .tch-apr-actions { gap: 8px; flex-wrap: wrap; }
  .tch-apr-btn {
    flex: 1 1 auto;
    justify-content: center;
    height: 38px;
    padding: 0 14px;
    font-size: 12px;
  }
  .tch-apr-btn--primary { width: 100%; flex-basis: 100%; }

  /* Tighten 3-col stat boxes inside Lesson Plan / Notebook Plan / Attendance cards */
  .tch-statbox-grid { gap: 6px; }
  .tch-statbox { padding: 9px 10px; }
  .tch-statbox-val { font-size: 18px; }
  .tch-statbox-lbl { font-size: 9px; }

  /* Timeline cards (Notice Board / Reminders modal) */
  .tch-tl-card { padding: 12px 14px; }
  .tch-tl-h { gap: 6px; }
  .tch-tl-title { font-size: 13.5px; }
  .tch-tl-desc { font-size: 12px; }
  .tch-tl-foot { gap: 6px; }
}
@media (max-width: 480px) {
  .dash-pri-val { font-size: 24px; }
  .dash-sched { grid-auto-columns: 86%; }
  .tch-statbox-val { font-size: 16px; }
  .tch-apr-btn { font-size: 11.5px; padding: 0 12px; }
}
`;
