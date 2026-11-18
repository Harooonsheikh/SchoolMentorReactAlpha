import { buildUrl, activeSessionName, readStoredActiveSession } from '../../utils/apiConfig';
import { delay, clone } from './_http';
import * as hrService from './hrService';
import * as attendanceService from './attendanceService';
import {
  mockSubLpData, mockSubNbData, mockAcademicsClasses, mockAcademicsTeacherAssignments,
  mockTermBreakups, mockUnitsCatalog, mockTermBreakupAllocations,
} from '../mock/academicsReportsLessonPlans';
import {
  mockWeeklyOff, mockHolidays, mockStudentAttendanceClasses, mockStaffAttendance,
  mockPapers, mockTeacherResources,
} from '../mock/academicsReportsMock';

/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS → REPORTS SERVICE

   Same function names the demo's services/academicsService.js exposed to
   AcademicsReports / AcademicsTeacherPerformanceReport, so the ported
   components read the same way. Per data area:

     LIVE  (existing ERP endpoints, same ones Academics.js / LessonPlans.js use)
       getSession, getVacations   → /api/getsessionsummarybybranchid
       getActivities              → /api/getactivitycalendarbyid
       getTerms, getTermData      → /api/termscrud (get) + /api/getkeydatesybranchid
       getClassesWithSubjects     → /get-classlist-sectionlist-studentlist-by-branch
                                    + /api/LaunchSetup/get-subjects (textbooks)
       getHrEmployees             → hrService.getHrEmployees (join date, leaves)
       getWeeklyOff               → attendanceService.getWeeklyOffSetup

     MOCK  (no live service/endpoint with a matching shape yet)
       getSubLpData, getSubNbData, getAcademicsTeacherAssignments,
       getTermBreakups, getUnitsCatalog, getTermBreakupAllocations
                                  → mock/academicsReportsLessonPlans.js
       getStudentAttendance, getStaffAttendance, getHolidays, getAllPapers,
       getTeacherResources
                                  → mock/academicsReportsMock.js
   ═══════════════════════════════════════════════════════════════════ */

const authHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
  ...extra,
});
const branchId = () => Number(sessionStorage.getItem('branchID')) || 0;
const sessionYearId = () =>
  sessionStorage.getItem('changeSessionId')
  || sessionStorage.getItem('SessionID')
  || sessionStorage.getItem('sessionID')
  || '';
const rowsOf = (json) => (Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []));
const iso10 = (d) => (d ? String(d).slice(0, 10) : '');

/* ─── MOCK: lesson-plan / notebook-plan / teacher assignment data ─── */
export async function getSubLpData()          { await delay(); return clone(mockSubLpData); }
export async function getSubNbData()          { await delay(); return clone(mockSubNbData); }
export async function getUnitsCatalog()       { await delay(); return clone(mockUnitsCatalog); }
export async function getTermBreakupAllocations() { await delay(); return clone(mockTermBreakupAllocations); }
export async function getAcademicsClasses()           { await delay(); return clone(mockAcademicsClasses); }
export async function getAcademicsTeacherAssignments() { await delay(); return clone(mockAcademicsTeacherAssignments); }
export async function getTermBreakups()                { await delay(); return clone(mockTermBreakups); }

/* ─── MOCK: attendance snapshots / holidays / papers / results / worksheets ─── */
export async function getStudentAttendance() { await delay(); return clone(mockStudentAttendanceClasses); }
export async function getStaffAttendance()   { await delay(); return clone(mockStaffAttendance); }
export async function getHolidays()          { await delay(); return clone(mockHolidays); }
export async function getAllPapers()         { await delay(); return clone(mockPapers); }
export async function getTeacherResources()  { await delay(); return clone(mockTeacherResources); }

/* ─── LIVE: weekly-off days (Mon-indexed 0..6) ─── */
const DAYS_F = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export async function getWeeklyOff() {
  try {
    const response = await attendanceService.getWeeklyOffSetup();
    const data = Array.isArray(response?.data) ? response.data : [];
    return data.map(item => DAYS_F.indexOf(item.WeekDay ?? item.weekDay)).filter(i => i !== -1);
  } catch (e) {
    console.error('Academics reports: weekly-off load failed', e);
    return clone(mockWeeklyOff);
  }
}

/* ─── LIVE: HR employees (join date + leaves). Only real employees from the
   ERP are returned — demo teacher rows are NOT injected into live data. ─── */
export async function getHrEmployees() {
  let live = [];
  try { live = await hrService.getHrEmployees(); }
  catch (e) { console.error('Academics reports: HR employees load failed', e); }
  const norm = (e) => {
    const l = e.leaves || {};
    const n = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
    return { ...e, leaves: { ...l, annual: n(l.annual), casual: n(l.casual), sick: n(l.sick), maternity: n(l.maternity), balance: l.balance === '' || l.balance == null ? undefined : Number(l.balance) } };
  };
  return clone(live.map(norm));
}

/* ─── LIVE: academic session + vacations (one shared fetch) ─── */
function computeSession(base, vacations = []) {
  const wpw = Number(base.workingDaysPerWeek) || 0;
  const parseDate = (d) => {
    if (!d) return null;
    const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
    if (!y || !m || !day) return null;
    return new Date(Date.UTC(y, m - 1, day));
  };
  const s = parseDate(base.start);
  const e = parseDate(base.end);
  let totalDays = 0, grossWorkingDays = 0, weeklyHolidays = 0;
  if (s && e && e >= s) {
    totalDays = Math.round((e - s) / 86400000) + 1;
    grossWorkingDays = Math.round((totalDays / 7) * wpw);
    weeklyHolidays = totalDays - grossWorkingDays;
  }
  const vacDays = vacations.reduce((sum, v) => {
    const vs = parseDate(v.start), ve = parseDate(v.end);
    return sum + (vs && ve && ve >= vs ? Math.round((ve - vs) / 86400000) + 1 : 0);
  }, 0);
  const workingDays = Math.max(0, grossWorkingDays - vacDays);
  return {
    ...base, workingDaysPerWeek: wpw, totalOnDays: totalDays, workingDays,
    workingWeeks: wpw > 0 ? Number((workingDays / wpw).toFixed(2)) : 0,
    holidays: weeklyHolidays + vacDays, vacationDays: vacDays,
  };
}

let _summaryCache = { key: '', at: 0, promise: null };
function loadSessionSummary() {
  const sid = sessionYearId();
  const key = `${branchId()}|${sid}`;
  if (_summaryCache.promise && _summaryCache.key === key && Date.now() - _summaryCache.at < 15000) return _summaryCache.promise;
  const promise = (async () => {
    const active = readStoredActiveSession() || {};
    const year = activeSessionName() || '';
    const emptySession = {
      year, start: iso10(active.startDate), end: iso10(active.endDate),
      workingDaysPerWeek: 0, totalOnDays: 0, workingDays: 0, workingWeeks: 0, holidays: 0,
    };
    if (!sid) return { session: emptySession, vacations: [] };
    try {
      const res = await fetch(
        buildUrl(`/api/getsessionsummarybybranchid?branchID=${branchId()}&sessionID=${sid}&pageNo=1`),
        { method: 'GET', headers: authHeaders() },
      );
      const json = await res.json().catch(() => ({}));
      const rows = rowsOf(json);
      if (!rows.length) return { session: emptySession, vacations: [] };
      const palette = ['#1E40AF', '#22C55E', '#F59E0B', '#7C3AED', '#EF4444', '#0EA5E9'];
      const vacations = rows
        .filter(r => r.vacationName && r.vacationName !== 'string' && iso10(r.vacationStart) > '0001-01-01')
        .map((r, i) => ({
          id: r.detailID ?? i, name: r.vacationName,
          start: iso10(r.vacationStart), end: iso10(r.vacationEnd), color: palette[i % palette.length],
        }));
      const first = rows[0];
      const session = computeSession({
        id: first.id, year,
        start: iso10(first.sessionStart) || emptySession.start,
        end: iso10(first.sessionEnd) || emptySession.end,
        workingDaysPerWeek: Number(first.workingDaysPerWeek) || 0,
      }, vacations);
      return { session, vacations };
    } catch (e) {
      console.error('Academics reports: session summary load failed', e);
      return { session: emptySession, vacations: [] };
    }
  })();
  _summaryCache = { key, at: Date.now(), promise };
  return promise;
}

export async function getSession()   { return clone((await loadSessionSummary()).session); }
export async function getVacations() { return clone((await loadSessionSummary()).vacations); }

/* ─── LIVE: terms (name + dates) and the per-term calendar key-dates ─── */
async function fetchTerms() {
  const res = await fetch(buildUrl('/api/termscrud'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: 0, branchID: branchId(), term: 'string', sessionYearID: sessionYearId(), action: 'get' }),
  });
  return rowsOf(await res.json().catch(() => ({})));
}
export async function getTermData() {
  try {
    return (await fetchTerms()).map(t => ({
      id: t.id, name: t.term || '', start: iso10(t.startDate), end: iso10(t.endDate),
    }));
  } catch (e) {
    console.error('Academics reports: terms load failed', e);
    return [];
  }
}
export async function getTerms() {
  try {
    const [termList, kdRes] = await Promise.all([
      fetchTerms(),
      fetch(buildUrl(`/api/getkeydatesybranchid?branchID=${branchId()}&pageNo=1`), { method: 'GET', headers: authHeaders() })
        .then(r => r.json().catch(() => ({}))),
    ]);
    const keyDates = rowsOf(kdRes);
    return termList.map(t => ({
      id: t.id,
      label: t.term || 'Unnamed',
      entries: keyDates.filter(k => String(k.terms) === String(t.id)).map(k => ({ id: k.id, heading: k.head || '', date: k.value || '' })),
    }));
  } catch (e) {
    console.error('Academics reports: calendar load failed', e);
    return [];
  }
}

/* ─── LIVE: activity calendar ─── */
const ACT_COLORS = ['#1E40AF', '#16A34A', '#D97706', '#7C3AED', '#1E40AF', '#E11D48'];
const actStatus = (startAt, endAt) => {
  const now = new Date();
  const s = new Date(startAt), e = new Date(endAt);
  if (!isNaN(e) && e < now) return 'completed';
  if (!isNaN(s) && s <= now && (isNaN(e) || e >= now)) return 'ongoing';
  return 'upcoming';
};
export async function getActivities() {
  try {
    const res = await fetch(
      buildUrl(`/api/getactivitycalendarbyid?BranchID=${branchId()}&SessionYearID=${sessionYearId()}&pageNo=1`),
      { method: 'GET', headers: authHeaders() },
    );
    const rows = rowsOf(await res.json().catch(() => ({})));
    return rows.map((a, i) => {
      const rawStart = a.startAt || a.startDate || a.start || a.fromDate || a.activityDate || a.date || '';
      const rawEnd = a.endAt || a.endDate || a.end || a.toDate || a.activityDate || a.date || rawStart;
      return {
        id: a.id ?? a.ID ?? a.activityID ?? a.activityCalendarID ?? i,
        name: a.name || a.activityName || a.title || 'Activity',
        start: iso10(rawStart), end: iso10(rawEnd),
        color: ACT_COLORS[i % ACT_COLORS.length],
        status: actStatus(rawStart, rawEnd),
        purpose: a.activityPurpose || '',
        development: a.activityDevelopment || '',
        resource: a.resourseMaterial || '',
        /* Not exposed by this endpoint in the pages we checked — a creator
           name is used if the API ever returns one. */
        createdBy: a.createdByName || a.createdByEmployeeName || a.createdBy || '',
      };
    });
  } catch (e) {
    console.error('Academics reports: activities load failed', e);
    return [];
  }
}

/* ─── LIVE: classes (+ subjects with textbook titles) for the Academic
   Setup report. Replaces the demo's static CLASSES array. Classes come
   from the same endpoint Academics.js's getClassesData uses; textbooks
   from /api/LaunchSetup/get-subjects (book_Title), merged across
   sections of each class. ─── */
export async function getClassesWithSubjects() {
  if (!sessionStorage.getItem('sessionID') && !sessionStorage.getItem('SessionID') && !sessionStorage.getItem('changeSessionId')) return [];
  const bId = sessionStorage.getItem('branchID');
  const empId = sessionStorage.getItem('employee_ID');
  try {
    const res = await fetch(buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${bId}/${empId}`), { method: 'GET', headers: { Accept: '*/*' } });
    const json = await res.json();
    const classes = Array.isArray(json?.data) ? json.data : [];
    return await Promise.all(classes.map(async (c) => {
      const sections = Array.isArray(c.sections) && c.sections.length ? c.sections : [{ sectionID: 0 }];
      const perSection = await Promise.all(sections.map(async (s) => {
        try {
          const r = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${c.id}/${s.sectionID ?? 0}`), { method: 'GET', headers: { Accept: '*/*' } });
          const j = await r.json();
          return j?.success && Array.isArray(j.data) ? j.data : [];
        } catch { return []; }
      }));
      const byName = new Map();
      perSection.flat().forEach((sub) => {
        const name = (sub.subjectName || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const prev = byName.get(key);
        if (!prev || (!prev.book && sub.book_Title)) byName.set(key, { name, book: sub.book_Title || '' });
      });
      return { id: c.id, name: c.name, subjects: Array.from(byName.values()) };
    }));
  } catch (e) {
    console.error('Academics reports: classes load failed', e);
    return [];
  }
}
