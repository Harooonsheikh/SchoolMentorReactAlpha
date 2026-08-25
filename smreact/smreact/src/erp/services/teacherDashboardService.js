// ══════════════════════════════════════════════════════════════════
//  Teacher Dashboard service — ek hi REAL API se poora dashboard:
//    GET /dashboard_for_teacher?userId={u}&branchId={b}&year={y}&month={m}
//  userId  → sessionStorage 'UserID' (login response ka id)
//  branchId→ sessionStorage 'branchID'; year/month default = current.
//  Response.data as-is (PascalCase) return hota hai — mapping
//  TeacherDashboard.jsx me hoti hai. Fail par error throw (caller {}
//  par gir jata hai taake dashboard crash na ho).
//
//  data ka shape:
//    Permissions[]        { SubMenuName, IsAccessible }
//    Notices[]            { ID, Topic, Details, AnnounceDate, imgPath, … }
//    TodaysSchedule[]     naam ke bawajood POORE HAFTE ke periods —
//                         { ID, GradeName, SectionName, Day, DayOrder,
//                           StartTime, EndTime, SubjectName, Teacher }
//    MyClasses[]          { GradeName, SectionName, SubjectName, TotalStudents }
//    LessonPlanSummary    { TotalLessonPlans, SubmittedLessonPlans, PendingLessonPlans }
//    NotebookSummary      { TotalUnits, SubmittedUnits, PendingUnits }
//    MyAttendance         { TotalPresent, TotalAbsent, TotalLeave }
//    FirstTermExams[]     active exam papers
//    PendingSyllabus[]    · PendingMarks[]
//    UpcomingActivities[]
//    StudentBirthdays[] · StaffBirthdays[]
//                         { PersonID, PersonName, PersonType,
//                           ClassOrDesignation, SectionName, BirthDate }
// ══════════════════════════════════════════════════════════════════
import { buildUrl, apiMessage } from '../../utils/apiConfig';

/* Current month (1-12) + year — API dono ko query params me leta hai. */
export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export async function getTeacherDashboard(month, year) {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  const userId = Number(sessionStorage.getItem('UserID'))
    || Number(sessionStorage.getItem('employee_ID')) || 0;
  const cur = currentMonthYear();
  const m = Number(month) || cur.month;
  const y = Number(year) || cur.year;
  const res = await fetch(
    buildUrl(`/dashboard_for_teacher?userId=${userId}&branchId=${branchId}&year=${y}&month=${m}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load teacher dashboard');
  }
  return json?.data || {};
}
