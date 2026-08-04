/* ════════════════════════════════════════════════════════════════════
   Schools Progress service — har branch ka setup/onboarding progress.

     GET .../api/AHM_School_Progress/branch-report?isActive=&launchSetup=
       → { success, message, count, data: [ {
             category, branchID, branchName, totalStaff, totalStudents,
             assignedTo,
             generalDetails    { principalName, principalPhone, totalStudents,
                                 totalStaff, studentSignUp, staffSignUp,
                                 createdAt },
             stateDetails      { schoolTab, classTab, studentTab, departmentTab,
                                 staffTab, syllabusTab, timeTableTab },
             compulsionDetails { staffContact, subjectAssigned, parentContact,
                                 previousDeus }
           } ] }

   Screen ke teen tabs sirf query params se bante hain (dono LAAZMI hain —
   ek bhi chhoot jaye to API 0 rows deti hai):
     Launch Setup → isActive=true,  launchSetup=0
     ERP          → isActive=true,  launchSetup=1
     Inactive     → isActive=false, dono launchSetup (jama kar ke)

   Mapping sirf `branchReportToRow()` me hai — wahi shape jo statusData ki
   demo rows deti thin, taake table/modals jaise hain waise chalte rahein.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError, buildQuery } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';

/* API boolean → wohi lafz jo UI ke StatusBadge/StatePill samajhte hain. */
const state = (v) => (v === true || v === 1 || String(v).toLowerCase() === 'true' ? 'Entered' : 'Not Entered');

const initials = (name) => String(name || '')
  .replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2)
  .toUpperCase() || 'SM';

/* createdAt "5/20/2026 4:11:12 PM" (aur ISO bhi) → "YYYY-MM-DD". */
function signupDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // M/D/YYYY
  if (md) {
    const [, m, d, y] = md;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s : parsed.toISOString().slice(0, 10);
}

/* assignedTo abhi ek id hai (0 = kisi ko nahi di gayi). Naam API me nahi aata,
   is liye 0 par "-- Unassigned --" aur baqi par "User #id" — koi naam ghadte
   nahi. Screen ka assign dropdown is value ko option me shaamil kar leta hai. */
const assignedName = (id) => (Number(id) > 0 ? `User #${Number(id)}` : '-- Unassigned --');

/** Ek API row → wohi row jo Schools Progress ka table/modal padhte hain. */
export function branchReportToRow(r) {
  const g  = r?.generalDetails || {};
  const st = r?.stateDetails || {};
  const cp = r?.compulsionDetails || {};

  const tabs = {
    school:    state(st.schoolTab),
    classes:   state(st.classTab),
    student:   state(st.studentTab),
    dept:      state(st.departmentTab),
    staff:     state(st.staffTab),
    syllabus:  state(st.syllabusTab),
    timetable: state(st.timeTableTab),
  };
  const comp = {
    staffContact:    state(cp.staffContact),
    parentContact:   state(cp.parentContact),
    subjectAssigned: state(cp.subjectAssigned),
    prevDues:        state(cp.previousDeus),
  };

  /* Data Status / colour API me nahi aate — inhi flags se nikaale jaate hain:
     saare setup tabs bhar gaye → Completed; saath me compulsion bhi poori
     ho to Green (Launch tab ka colour filter isi par chalta hai). */
  const tabsDone = Object.values(tabs).every((v) => v === 'Entered');
  const compDone = Object.values(comp).every((v) => v === 'Entered');

  const name = String(r?.branchName || '').trim() || 'Unnamed Branch';
  return {
    id:          Number(r?.branchID) || 0,
    name,
    initials:    initials(name),
    staff:       Number(r?.totalStaff ?? g.totalStaff ?? 0),
    students:    Number(r?.totalStudents ?? g.totalStudents ?? 0),
    status:      tabsDone ? 'Completed' : 'Inserted',
    color:       (tabsDone && compDone) ? 'Green' : 'Red',
    assigned:    assignedName(r?.assignedTo),
    principal:   g.principalName || '',
    contact:     g.principalPhone || '',
    stuSignup:   Number(g.studentSignUp || 0),
    staffSignup: Number(g.staffSignUp || 0),
    signupDate:  signupDate(g.createdAt),
    tabs,
    comp,
    /* ERP card par dikhne wale counters is API me nahi hain — 0 se shuru,
       taake card ghalat aankday na dikhaye. */
    logins: 0, workTime: '00:00:00', notes: 0, calls: 0, messages: 0,
    onboarding: { completed: 0, total: 15 },
    category: r?.category || '',
    raw: r,
  };
}

async function getJson(url, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(url, {
      headers: {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to load ${label} (${res.status})`, res.status);
  return res.json().catch(() => null);
}

/**
 * Ek group ki branches.
 * @param {{ isActive: boolean, launchSetup: 0|1 }} params
 * @returns {Promise<Array>} mapped rows
 */
export async function listBranchReport({ isActive, launchSetup }) {
  const url = `${SA_ADMIN_API_BASE}${EP.schoolProgress.branchReport()}`
    + buildQuery({ isActive: isActive ? 'true' : 'false', launchSetup: Number(launchSetup) ? 1 : 0 });
  const body = await getJson(url, 'school progress');
  const rows = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
  return rows.map(branchReportToRow).filter((r) => r.id);
}

/**
 * Screen ke teeno groups ek saath (chaar calls, sab parallel).
 * @returns {Promise<{ launch: Array, erp: Array, inactive: Array }>}
 */
export async function listSchoolProgress() {
  const [launch, erp, inactiveNew, inactiveErp] = await Promise.all([
    listBranchReport({ isActive: true,  launchSetup: 0 }),
    listBranchReport({ isActive: true,  launchSetup: 1 }),
    listBranchReport({ isActive: false, launchSetup: 0 }),
    listBranchReport({ isActive: false, launchSetup: 1 }),
  ]);
  /* Inactive dono taraf se aa sakti hain; id par de-dupe. */
  const seen = new Set();
  const inactive = [...inactiveNew, ...inactiveErp].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return { launch, erp, inactive };
}

const schoolProgressService = { listSchoolProgress, listBranchReport, branchReportToRow };
export default schoolProgressService;
