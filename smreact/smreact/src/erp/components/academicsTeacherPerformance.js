import { nbUnitStatus } from './academicsReportsUnits';

/* ═══════════════════════════════════════════════════════════════════
   TEACHER PERFORMANCE & ACTIVITY REPORT — pure computation.

   Reads data from every module the spec asked for, via the
   services/mock already wired elsewhere in this app (see each
   section's comment for the exact source and, where relevant, the
   additive mock enrichment added alongside this file — e.g.
   mockActivities.createdBy, mockTermBreakups, the 5 new mockHrEmployees
   rows — every one of them documented in its own mock file).

   Design Studio usage, Syllabus Updates, Homework, Principal Tasks,
   parent chat engagement and Mentor AI usage have no real per-teacher
   tracking anywhere else in this app (confirmed by a thorough codebase
   search) — those sections read from src/the demo extras (removed from this port),
   dedicated mock/generated data for this report, keyed or generated
   from the same 5 real teacher names (same convention
   src/mock/performanceIntelligence.js already uses for this exact set
   of mobile-app-only concepts).
   ═══════════════════════════════════════════════════════════════════ */

const MON_IDX = (jsDay) => (jsDay + 6) % 7; // JS Date.getDay() (0=Sun) -> Mon-indexed (0=Mon..6=Sun)

/* Real working-day count between two ISO dates, excluding weekly-off
   days and any day inside a holiday/vacation range — used for
   "Total working days from the start of the session until today". */
function countWorkingDays(startIso, endIso, weeklyOff = [], offRanges = []) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  const inOffRange = (d) => offRanges.some(r => {
    const rs = new Date(r.start || r.from);
    const re = new Date(r.end || r.to);
    return !isNaN(rs) && !isNaN(re) && d >= rs && d <= re;
  });
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (weeklyOff.includes(MON_IDX(d.getDay()))) continue;
    if (inOffRange(d)) continue;
    count += 1;
  }
  return count;
}

function tenureLabel(joinIso) {
  if (!joinIso) return null;
  const join = new Date(joinIso);
  if (isNaN(join)) return null;
  const now = new Date();
  let years = now.getFullYear() - join.getFullYear();
  let months = now.getMonth() - join.getMonth();
  if (now.getDate() < join.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

export function computeTeacherPerformance(teacherName, {
  teacherAssignments = [], lpData = [], nbData = [], activities = [],
  termBreakups = [], resources = [], studentAttendanceClasses = [],
  staffAttendance = [], hrEmployees = [], papers = {},
  session = null, weeklyOff = [], holidays = [], vacations = [],
} = {}) {
  const pairs = teacherAssignments.filter(a => a.teacher === teacherName);
  const inScope = rec => pairs.some(p => p.class === rec.class && p.subject === rec.subject);
  const classes = Array.from(new Set(pairs.map(p => p.class)));
  const subjects = Array.from(new Set(pairs.map(p => p.subject)));

  /* ── Profile: joining date + tenure (HR employee record) ── */
  const hrEmployee = hrEmployees.find(e => `${e.firstName} ${e.lastName}`.trim() === teacherName);
  const joinDate = hrEmployee?.join || null;
  const tenure = tenureLabel(joinDate);

  /* ── 2a. Activity Planner — just the count, per the brief ── */
  const activitiesCreated = activities.filter(a => a.createdBy === teacherName).length;

  /* ── 2b. Term Breakups — grouped by subject + term, unit count only ── */
  const teacherBreakups = termBreakups.filter(b => b.teacher === teacherName);
  const breakupSubjects = Array.from(new Set(teacherBreakups.map(b => b.subject)));
  const breakupGroups = [];
  teacherBreakups.forEach(b => {
    let g = breakupGroups.find(x => x.subject === b.subject && x.term === b.term);
    if (!g) { g = { subject: b.subject, term: b.term, units: 0, unitNames: [] }; breakupGroups.push(g); }
    g.units += 1;
    g.unitNames.push(b.unitName);
  });

  /* ── 3. Academic Planning & Content Creation ── */
  const tLp = lpData.filter(inScope);
  const tNb = nbData.filter(inScope);
  const tWorksheets = resources.filter(r => r.category === 'worksheet' && r.uploadedBy === teacherName);
  const nbSubmitted = tNb.filter(u => nbUnitStatus(u) === 'submitted').length;

  /* ── 4A. Attendance — assigned class(es), real working days so far
     this session, and a marking-gap stand-in for marked/pending (see
     the demo extras (removed from this port) header comment — there is no real
     per-day attendance history anywhere in this app). ── */
  const workingDaysSoFar = session
    ? countWorkingDays(session.start, new Date().toISOString().slice(0, 10), weeklyOff, [...holidays, ...vacations])
    : 0;
  const assignedAttendanceClasses = studentAttendanceClasses.filter(c => c.teacher === teacherName).map(c => `${c.cls} (${c.sec})`);

  /* ── 4B. Teacher's own personal attendance + leave ── */
  const staffRow = staffAttendance.find(s => s.name === teacherName);
  let personalAttendance = { available: false, reason: 'No personal attendance record linked to this teacher.' };
  if (staffRow) {
    personalAttendance = { available: true, status: staffRow.status, inTime: staffRow.inTime, outTime: staffRow.outTime, marked: staffRow.marked };
  }
  let leave = { available: false, reason: 'No HR employee record linked to this teacher.' };
  if (hrEmployee?.leaves) {
    const l = hrEmployee.leaves;
    const entitlement = (l.annual || 0) + (l.casual || 0) + (l.sick || 0) + (l.maternity || 0);
    const balance = l.balance ?? entitlement;
    leave = { available: true, entitlement, taken: Math.max(0, entitlement - balance), balance };
  }

  /* ── 10. Question Paper Generation ── */
  const allPapers = Object.values(papers || {}).flat();
  const teacherPapers = allPapers.filter(p => p.teacher === teacherName);

  return {
    teacher: teacherName,
    classes, subjects,
    joinDate, tenure,

    /* 1. profile summary */
    summary: {
      lpTotal: tLp.length,
      lpSubmitted: tLp.filter(r => r.status === 'submitted').length,
      nbTotal: tNb.length,
      nbSubmitted,
      activitiesCreated,
      papersGenerated: teacherPapers.length,
    },

    /* 2. Activity Planner & Term Breakups */
    activityPlanner: { available: true, activitiesCreated },
    termBreakups: {
      available: true,
      entriesCreated: teacherBreakups.length,
      subjectsCovered: breakupSubjects.length,
      unitsWithEntries: teacherBreakups.length,
      groups: breakupGroups,
    },

    /* 3. Academic Planning & Content Creation */
    content: {
      lpTotal: tLp.length,
      nbTotal: tNb.length,
      worksheetsTotal: tWorksheets.length,
    },
    lpSubmissions: {
      total: tLp.length,
      submitted: tLp.filter(r => r.status === 'submitted').length,
      pending: tLp.filter(r => r.status !== 'submitted').length,
    },
    nbSubmissions: {
      total: tNb.length,
      submitted: nbSubmitted,
      pending: tNb.length - nbSubmitted,
    },

    /* 4. Attendance */
    studentAttendanceMarking: {
      available: true,
      assignedClasses: assignedAttendanceClasses,
      workingDaysSoFar,
    },
    personalAttendance,
    leave,

    /* Question Paper Generation */
    paperGeneration: { available: true, total: teacherPapers.length, papers: teacherPapers },

  };
}
