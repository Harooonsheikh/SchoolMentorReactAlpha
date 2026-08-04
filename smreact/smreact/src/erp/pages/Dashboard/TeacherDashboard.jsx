import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import UniversalSearch from '../../shared/UniversalSearch';
import { DASH_CSS } from './Dashboard';
import { ADM_NEW_CSS } from './AdminDashboard';
import AnnouncementsModal from './AnnouncementsModal';
import { DASH_MODAL_CSS } from './dashModalCss';
import {
  TEACHER_SCOPES, MODULE_COLOR,
  SCHOOL_MENTOR_ANNOUNCEMENTS, NOTICE_BOARD_NOTICES, PRINCIPAL_REMINDERS,
} from './dashboardData';

/* Shared mock data copied 1:1 from AdminDashboard so the Birthdays
   and Upcoming Activities sections render identically on the Teacher
   Dashboard. Kept inline (rather than imported from AdminDashboard)
   so the Admin file stays untouched per the spec. When a backend
   lands, both dashboards will read from the same service. */
const TEACHER_DASH_STUDENT_BIRTHDAYS = [
  { name: 'Ayaan Raza',     grade: 'Grade 2',  date: '01 May', dob: 1  },
  { name: 'Sara Ahmed',     grade: 'Grade 5',  date: '04 May', dob: 4  },
  { name: 'Hassan Ali',     grade: 'Grade 7',  date: '08 May', dob: 8  },
  { name: 'Zara Khan',      grade: 'Grade 3',  date: '12 May', dob: 12 },
  { name: 'Bilal Tariq',    grade: 'Grade 8',  date: '15 May', dob: 15 },
  { name: 'Maha Siddiqui',  grade: 'Grade 1',  date: '18 May', dob: 18 },
  { name: 'Usman Farooq',   grade: 'Grade 6',  date: '22 May', dob: 22 },
  { name: 'Nadia Malik',    grade: 'Grade 4',  date: '25 May', dob: 25 },
  { name: 'Hamza Irfan',    grade: 'Grade 9',  date: '28 May', dob: 28 },
  { name: 'Fatima Saleem',  grade: 'Grade 10', date: '31 May', dob: 31 },
];
const TEACHER_DASH_TEACHER_BIRTHDAYS = [
  { name: 'Mr. Usman Khalid',   role: 'Math Teacher',     date: '05 May', dob: 5  },
  { name: 'Ms. Ayesha Raza',    role: 'Science Teacher',  date: '13 May', dob: 13 },
  { name: 'Dr. Hira Noor',      role: 'English Teacher',  date: '19 May', dob: 19 },
  { name: 'Mr. Bilal Ahmed',    role: 'HR Officer',       date: '24 May', dob: 24 },
  { name: 'Ms. Sana Mirza',     role: 'Coordinator',      date: '30 May', dob: 30 },
];
const TEACHER_DASH_TODAY_DAY = 31;
const TEACHER_DASH_ACTIVITIES = [
  { id: 1, date: '01 Jun 2026', title: 'Final Term Exams Begin',
    desc: 'Final term examinations start for all classes Grade 1–10.',
    category: 'Examination',   type: 'exam',     module: 'exam',     daysAway: 1 },
  { id: 2, date: '03 Jun 2026', title: 'PTM — All Classes',
    desc: 'Parent-Teacher Meeting for Q3 result discussion.',
    category: 'School Event',  type: 'event',    module: 'students', daysAway: 3 },
  { id: 3, date: '05 Jun 2026', title: 'World Environment Day Activity',
    desc: 'Tree plantation drive and environment awareness program.',
    category: 'School Event',  type: 'event',    module: null,        daysAway: 5 },
  { id: 4, date: '10 Jun 2026', title: 'Sports Day',
    desc: 'Annual sports day with inter-house competitions.',
    category: 'School Event',  type: 'event',    module: null,        daysAway: 10 },
  { id: 5, date: '15 Jun 2026', title: 'Result Cards Distribution',
    desc: 'Final term result cards distributed to parents.',
    category: 'Examination',   type: 'exam',     module: 'exam',     daysAway: 15 },
  { id: 6, date: '20 Jun 2026', title: 'Summer Vacation Begins',
    desc: 'School closes for summer vacation until August 2026.',
    category: 'Holiday',       type: 'holiday',  module: null,        daysAway: 20 },
  { id: 7, date: '25 Jun 2026', title: 'Staff Training Day',
    desc: 'Professional development session for all teaching staff.',
    category: 'HR',            type: 'event',    module: 'hr',       daysAway: 25 },
  { id: 8, date: '30 Jun 2026', title: 'Monthly Fee Deadline',
    desc: 'Last date for submission of July 2026 fee challans.',
    category: 'Fee',           type: 'deadline', module: 'fee',      daysAway: 30 },
];
const TEACHER_DASH_TYPE_COLOR = {
  exam:     { bg: 'rgba(220, 38, 38, .12)', fg: '#DC2626' },
  event:    { bg: 'rgba(30, 58, 138, .12)', fg: '#1E40AF' },
  holiday:  { bg: 'rgba(22, 163, 74, .12)', fg: '#16A34A' },
  deadline: { bg: 'rgba(217, 119, 6, .14)', fg: '#D97706' },
};
function teacherDashInitials(name) {
  const clean = name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim();
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
  const { moduleActive, user, session } = visibility;
  const scope = TEACHER_SCOPES[user?.id];

  /* Expandable list state for the three Exam-Task cards
     (now includes the Current Exam card). */
  const [openCard, setOpenCard] = useState(null);   // 'currentExam' | 'syllabus' | 'marks' | null

  /* Today's Schedule day selector. Default to the actual day name. */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = DAY_NAMES[new Date().getDay()];
  const scheduleByDay = (scope && scope.scheduleByDay) || {};
  const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .filter(d => scheduleByDay[d] && scheduleByDay[d].length > 0);
  const defaultDay = availableDays.includes(todayDayName)
    ? todayDayName
    : (availableDays[0] || 'Monday');
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const daySchedule = scheduleByDay[selectedDay] || [];

  /* My Appraisal selector (period). Default to most recent entry. */
  const appraisalList = (scope && scope.appraisals) || [];
  const [selectedAppraisalId, setSelectedAppraisalId] = useState(appraisalList[0]?.id || null);
  const selectedAppraisal = appraisalList.find(a => a.id === selectedAppraisalId) || appraisalList[0] || null;
  const [birthdayTab, setBirthdayTab] = useState('all');
  const showStudentsBday = birthdayTab === 'all' || birthdayTab === 'students';
  const showTeachersBday = birthdayTab === 'all' || birthdayTab === 'teachers';

  /* Top-cards modal flags */
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showNoticeBoard,   setShowNoticeBoard]   = useState(false);
  const [showReminders,     setShowReminders]     = useState(false);

  const latestAnnouncement     = SCHOOL_MENTOR_ANNOUNCEMENTS[0];
  const newAnnouncementCount   = SCHOOL_MENTOR_ANNOUNCEMENTS.filter(a => a.status === 'new').length;
  const latestNotice           = NOTICE_BOARD_NOTICES[0];
  const newNoticeCount         = NOTICE_BOARD_NOTICES.filter(n => n.status === 'new').length;
  const latestReminder         = PRINCIPAL_REMINDERS[0];
  const newReminderCount       = PRINCIPAL_REMINDERS.filter(r => r.status === 'new').length;

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

  /* Empty state for non-teacher accounts impersonated as 'teacher'. */
  if (!scope) {
    return (
      <>
        <style>{DASH_CSS}</style>
        <div className="dash-empty">
          <i className="fa-solid fa-chalkboard-user" aria-hidden="true"></i>
          No class assignments found for <b>{user?.name || 'this user'}</b>.<br />
          Switch to <b>Xi</b> or <b>Pi</b> from the &quot;View as&quot; picker above to see a populated Teacher dashboard.
        </div>
      </>
    );
  }

  const firstName = user.name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./, '').trim().split(' ')[0];
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
            <b>{scope.todaySchedule.length} classes</b> today.
            {showLessonPlans && scope.lessonPlans.pending > 0 && <> Don&apos;t forget — <b>{scope.lessonPlans.pending} lesson plan{scope.lessonPlans.pending > 1 ? 's' : ''}</b> still pending.</>}
            {showHomework && scope.homework.pending > 0 && <> Also <b>{scope.homework.pending} homework</b> awaiting review.</>}
          </div>
        </div>
        <div className="dash-hero-r">
          <div className="dash-hero-stat">
            <div className="dash-hero-stat-val">{scope.classes.length}</div>
            <div className="dash-hero-stat-lbl">My Classes</div>
          </div>
          <div className="dash-hero-stat">
            <div className="dash-hero-stat-val">{scope.classes.reduce((s, c) => s + c.students, 0)}</div>
            <div className="dash-hero-stat-lbl">My Students</div>
          </div>
          {showAttendance && (
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{scope.attendance.pct}<small>%</small></div>
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
                <div className="adm-tc-s">{latestAnnouncement.sender}</div>
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
            <div className="adm-tc-an-title">{latestAnnouncement.title}</div>
            <div className="adm-tc-an-preview">{latestAnnouncement.preview}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestAnnouncement.date} · {latestAnnouncement.time}
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
            <div className="adm-tc-an-title">{latestNotice.title}</div>
            <div className="adm-tc-an-preview">{latestNotice.preview}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestNotice.date} · {latestNotice.time}
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
                <div className="adm-tc-s">{latestReminder.sender}</div>
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
            <div className="adm-tc-an-title">{latestReminder.title}</div>
            <div className="adm-tc-an-preview">{latestReminder.preview}</div>
          </div>
          <div className="adm-tc-foot">
            <span className="adm-tc-meta">
              <i className="fa-solid fa-clock" aria-hidden="true"></i>
              {latestReminder.date} · {latestReminder.time}
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
          The card list is internally scrollable so multiple classes
          fit without breaking the layout. */}
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
                    <div className="dash-sched-room">
                      <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
                      Room {s.room}
                    </div>
                    <div className="dash-sched-topic">
                      <i className="fa-solid fa-book" aria-hidden="true"></i>
                      {s.topic}
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
            {scope.classes.map(c => (
              <Tooltip key={c.id} text={`Open ${c.cls}`}>
                <div className="dash-row" onClick={() => openModule('students')}>
                  <div className="dash-row-ic" style={{ background: 'rgba(124,58,237,.14)', color: '#6D28D9' }}>
                    <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>
                  </div>
                  <div className="dash-row-info">
                    <div className="dash-row-t">{c.cls}</div>
                    <div className="dash-row-s">{c.subject} · Room {c.room}</div>
                  </div>
                  <span className="dash-row-val dash-row-val--purple">{c.students} <span style={{fontSize:9,opacity:.7}}>STU</span></span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* ═════════ MY PERFORMANCE (LP / HW / Attendance) ═════════ */}
      <div className="dash-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <i className="fa-solid fa-chart-simple" aria-hidden="true"></i> My Performance
          </div>
          <span className="dash-sec-sub">This month · scoped to my classes · click any card</span>
        </div>
        <div className="dash-grid-3">
          {showLessonPlans && (() => {
            const lpTotal = scope.lessonPlans.approved + scope.lessonPlans.submitted + scope.lessonPlans.pending;
            const lpSubmitted = scope.lessonPlans.submitted + scope.lessonPlans.approved;
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
                        <div className="tch-statbox-val">{scope.lessonPlans.pending}</div>
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

          {showHomework && scope.notebookPlans && (() => {
            const np = scope.notebookPlans;
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

          {showAttendance && (
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
                  <MiniRing pct={scope.attendance.pct} color={MODULE_COLOR.attendance.stroke} track={MODULE_COLOR.attendance.soft} />
                  <span className="dash-panel-pill">{scope.attendance.pct}%</span>
                </div>
              </div>
              <div className="dash-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(21,128,61,.12)', color: '#15803D' }}>
                    <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Present</div>
                    <div className="dash-mini-val">{scope.attendance.present}</div>
                  </div>
                </div>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(220,38,38,.12)', color: '#B91C1C' }}>
                    <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Absent</div>
                    <div className="dash-mini-val">{scope.attendance.absent}</div>
                  </div>
                </div>
                <div className="dash-mini">
                  <div className="dash-mini-ic" style={{ background: 'rgba(217,119,6,.14)', color: '#92400E' }}>
                    <i className="fa-solid fa-house" aria-hidden="true"></i>
                  </div>
                  <div className="dash-mini-info">
                    <div className="dash-mini-lbl">Leave</div>
                    <div className="dash-mini-val">{scope.attendance.leave}</div>
                  </div>
                </div>
              </div>
              <div className="dash-panel-body" style={{ paddingTop: 0 }}>
                <div className="dash-bar">
                  <div className="dash-bar-h">
                    <span>Monthly</span>
                    <span className="dash-bar-val">{scope.attendance.pct}%</span>
                  </div>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={{ width: `${scope.attendance.pct}%`, '--bar-from': '#15803D', '--bar-to': '#16A34A' }} />
                  </div>
                </div>
              </div>
              </div>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ═════════ EXAM TASKS (moved from top) ═════════
            Current Exam · Pending Syllabus Uploads · Pending Marks Uploads
            Each card is scoped to this teacher's assigned class/section/subject.
            The two pending cards expand inline to list the affected classes. */}
      {showExam && (scope.currentExam || scope.pendingSyllabusUploads || scope.pendingMarksUploads) && (
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
            {scope.currentExam && (
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
                    {scope.currentExam.name}
                  </div>
                  <div className="dash-pri-lbl">{scope.currentExam.dates}</div>
                  <div className="dash-pri-cta">
                    {openCard === 'currentExam' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'currentExam' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'currentExam' && (scope.currentExam.papers || []).length > 0 && (
                    <div className="dash-pri-list">
                      {scope.currentExam.papers.map(p => (
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
            {scope.pendingSyllabusUploads && (
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
                  <div className="dash-pri-val">{scope.pendingSyllabusUploads.length}</div>
                  <div className="dash-pri-lbl">Pending Syllabus Uploads</div>
                  <div className="dash-pri-cta">
                    {openCard === 'syllabus' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'syllabus' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'syllabus' && scope.pendingSyllabusUploads.length > 0 && (
                    <div className="dash-pri-list">
                      {scope.pendingSyllabusUploads.map(p => (
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
            {scope.pendingMarksUploads && (
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
                  <div className="dash-pri-val">{scope.pendingMarksUploads.length}</div>
                  <div className="dash-pri-lbl">Pending Marks Uploads</div>
                  <div className="dash-pri-cta">
                    {openCard === 'marks' ? 'Hide list' : 'View list'}{' '}
                    <i className={`fa-solid ${openCard === 'marks' ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true"></i>
                  </div>
                  {openCard === 'marks' && scope.pendingMarksUploads.length > 0 && (
                    <div className="dash-pri-list">
                      {scope.pendingMarksUploads.map(p => (
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
      {showAppraisal && selectedAppraisal && (
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
                    onClick={() => toast(`Viewing ${selectedAppraisal.period} appraisal…`, 'info')}
                  >
                    <i className="fa-solid fa-eye" aria-hidden="true"></i> View Appraisal
                  </button>
                </Tooltip>
                <Tooltip text="Download a PDF copy of this appraisal">
                  <button
                    type="button"
                    className="tch-apr-btn tch-apr-btn--primary"
                    onClick={() => toast(`Downloading ${selectedAppraisal.pdf || selectedAppraisal.period + '.pdf'}…`, 'success')}
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
          <span>Showing birthdays for May 2026</span>
        </div>

        <div className="adm-bday-row">
          {showStudentsBday && (
            <div className="adm-bday-col">
              <div className="adm-side-tag">
                Students
                <span className="adm-pill-blue">{TEACHER_DASH_STUDENT_BIRTHDAYS.length}</span>
              </div>
              <div className="adm-bday-list">
                {TEACHER_DASH_STUDENT_BIRTHDAYS.map(b => {
                  const isToday = b.dob === TEACHER_DASH_TODAY_DAY;
                  const isTomorrow = b.dob === TEACHER_DASH_TODAY_DAY + 1;
                  return (
                    <div key={b.name} className={`adm-bday-card${isToday ? ' today' : ''}`}>
                      <div className="adm-bday-av">{teacherDashInitials(b.name)}</div>
                      <div className="adm-bday-info">
                        <div className="adm-bday-name">{b.name}</div>
                        <div className="adm-bday-meta">{b.grade}</div>
                      </div>
                      {isToday ? (
                        <span className="adm-pill-green">Today! 🎂</span>
                      ) : isTomorrow ? (
                        <span className="adm-pill-amber">Tomorrow</span>
                      ) : (
                        <span className="adm-pill-blue">{b.date}</span>
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
                <span className="adm-pill-blue">{TEACHER_DASH_TEACHER_BIRTHDAYS.length}</span>
              </div>
              <div className="adm-bday-list">
                {TEACHER_DASH_TEACHER_BIRTHDAYS.map(b => {
                  const isToday = b.dob === TEACHER_DASH_TODAY_DAY;
                  const isTomorrow = b.dob === TEACHER_DASH_TODAY_DAY + 1;
                  return (
                    <div key={b.name} className={`adm-bday-card${isToday ? ' today' : ''}`}>
                      <div className="adm-bday-av adm-bday-av--purple">{teacherDashInitials(b.name)}</div>
                      <div className="adm-bday-info">
                        <div className="adm-bday-name">{b.name}</div>
                        <div className="adm-bday-meta">{b.role}</div>
                      </div>
                      {isToday ? (
                        <span className="adm-pill-green">Today! 🎂</span>
                      ) : isTomorrow ? (
                        <span className="adm-pill-amber">Tomorrow</span>
                      ) : (
                        <span className="adm-pill-blue">{b.date}</span>
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
          1:1 with the Admin Dashboard section. Clicking any card lands on
          Academics → Scheme of Studies → Calendar → Activity Calendar via
          the openActivityCalendar callback that the parent already passes
          to both dashboards. */}
      <div className="adm-divider" />
      <div className="dash-sec adm-sec">
        <div className="dash-sec-h">
          <div className="dash-sec-title">
            <span className="adm-h-ic adm-h-ic--star"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i></span>
            Upcoming Activities
          </div>
          <span className="adm-h-meta">May 2026</span>
        </div>
        <div className="adm-info-banner">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>School events, exams, and important dates for this month.</span>
        </div>

        <div className="adm-act-grid">
          {TEACHER_DASH_ACTIVITIES.map(a => {
            const c = TEACHER_DASH_TYPE_COLOR[a.type] || TEACHER_DASH_TYPE_COLOR.event;
            const daysLabel = a.daysAway === 1 ? 'Tomorrow' : `In ${a.daysAway} days`;
            const daysTone = a.daysAway === 1 ? 'amber' : (a.daysAway <= 7 ? 'brand' : 'muted');
            const goActivityCalendar = () => {
              openActivityCalendar();
              toast('Opening Activity Calendar…', 'info');
            };
            return (
              <Tooltip key={a.id} text="Open Academics → Activity Calendar">
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
                      {a.date}
                    </span>
                    <span className={`adm-act-days adm-act-days--${daysTone}`}>{daysLabel}</span>
                  </div>
                  <div className="adm-act-title">{a.title}</div>
                  <div className="adm-act-desc">{a.desc}</div>
                  <div className="adm-act-foot">
                    <span className="adm-act-cat" style={{ background: c.bg, color: c.fg }}>{a.category}</span>
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
      </div>

      {/* ─── Top-card modals ─── */}
      {showAnnouncements && (
        <AnnouncementsModal
          onClose={() => setShowAnnouncements(false)}
          toast={toast}
        />
      )}
      {showNoticeBoard && (
        <TeacherSimpleListModal
          title="Notice Board"
          subtitle="Principal · via Mobile App"
          icon="fa-clipboard-list"
          items={NOTICE_BOARD_NOTICES}
          onClose={() => setShowNoticeBoard(false)}
          toast={toast}
        />
      )}
      {showReminders && (
        <TeacherSimpleListModal
          title="Principal Reminders"
          subtitle="Personal reminders for you"
          icon="fa-bell"
          items={PRINCIPAL_REMINDERS}
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
                        <span className="tch-tl-sep">·</span>
                        <i className="fa-solid fa-clock" aria-hidden="true"></i>
                        <span>{item.time}</span>
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
