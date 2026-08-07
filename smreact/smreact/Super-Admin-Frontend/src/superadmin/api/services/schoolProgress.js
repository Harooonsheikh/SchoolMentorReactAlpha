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
import { SA_ADMIN_API_BASE, getSuperAdminIdentity, getSuperAdminToken } from '../config';
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

/* ═══════════════════ FOLLOW-UP / ONBOARDING CARD ═══════════════════
   POST .../api/AHM_School_Progress/followup/onboarding-card-action
     body: { action, id, branchID, headType, subHeadType, commentDetail,
             date, userId }

   Ek hi route dono cards ke liye — farq sirf head/sub-head ka:
     Follow-up Card  → headType 'Follow-up Card',  subHeadType 'Notes' |
                       'Calls' | 'Messages' (jo sub-tab khula ho)
     Onboarding Card → headType 'Onboarding Card', subHeadType module ka
                       naam (Academics, Examination, …)
   ═══════════════════════════════════════════════════════════════════ */
export const CARD_HEADS = {
  followup:   'Follow-up Card',
  onboarding: 'Onboarding Card',
};

/* NOTE: is route par naye record ka action "insert" NAHI, `add` hai — API
   khud batati hai: "Invalid action. Valid actions: get, add, update, delete."
   (live check kiya gaya). Baqi teen wahi hain. */
export const CARD_ACTIONS = { add: 'add', get: 'get', update: 'update', delete: 'delete' };

/* `get` PascalCase keys deta hai: ID, BranchID, HeadType, SubHeadType,
   CommentDetail, Date, CreatedBy, CreatedAt, ModifiedBy, ModifiedAt. */
export function cardRowToUi(r) {
  return {
    id:          Number(r?.ID ?? r?.id) || 0,
    branchId:    Number(r?.BranchID ?? r?.branchID) || 0,
    headType:    String(r?.HeadType ?? r?.headType ?? ''),
    subHeadType: String(r?.SubHeadType ?? r?.subHeadType ?? ''),
    comment:     String(r?.CommentDetail ?? r?.commentDetail ?? ''),
    date:        String(r?.Date ?? r?.date ?? ''),
    createdAt:   String(r?.CreatedAt ?? r?.createdAt ?? ''),
    createdBy:   Number(r?.CreatedBy ?? r?.createdBy) || 0,
    raw: r,
  };
}

/* Ek hi POST — sirf `action` badalta hai. */
async function cardAction(fields, label) {
  const token = getSuperAdminToken();
  const body = {
    action:        fields.action,
    id:            Number(fields.id) || 0,
    branchID:      Number(fields.branchId) || 0,
    headType:      fields.headType || '',
    subHeadType:   fields.subHeadType || '',
    commentDetail: fields.commentDetail || '',
    date:          fields.date || '',
    userId:        Number(getSuperAdminIdentity().userId) || 0,
  };
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.schoolProgress.cardAction()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Could not ${label}`, res.status);
  }
  return json;
}

/**
 * Save (Save Note / Call / Message / Onboarding Save).
 * `id` diya ho to update, warna add.
 */
export function saveCardAction({ branchId, headType, subHeadType, commentDetail, date, id = 0 } = {}) {
  const isEdit = Number(id) > 0;
  return cardAction(
    { action: isEdit ? CARD_ACTIONS.update : CARD_ACTIONS.add, id, branchId, headType, subHeadType, commentDetail, date },
    isEdit ? 'update this entry' : 'save this entry',
  );
}

/** Ek branch ke saare cards (dono heads) — mapped. */
export async function listCardActions({ branchId, headType = '', subHeadType = '' } = {}) {
  const json = await cardAction(
    { action: CARD_ACTIONS.get, id: 0, branchId, headType, subHeadType },
    'load cards',
  );
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(cardRowToUi).filter((r) => r.id);
}

/** Ek entry hatao. */
export function deleteCardAction(id, branchId) {
  return cardAction(
    { action: CARD_ACTIONS.delete, id, branchId },
    'delete this entry',
  );
}

/* ═══════════════════ TRAINING CARD (participation) ═══════════════════
   POST .../api/AHM_School_Progress/training-session-action
     body: { action, id, branchID, numberOfParticipants, trainingDate,
             participantNames, certificateNotes,
             descriptionCoordinationNotes, userId }
   Wahi chaar actions: get | add | update | delete (yahan bhi "insert" nahi).
   `get` PascalCase rows deta hai. ═══════════════════════════════════ */

export function trainingRowToUi(r) {
  return {
    id:           Number(r?.ID ?? r?.id) || 0,
    branchId:     Number(r?.BranchID ?? r?.branchID) || 0,
    participants: Number(r?.NumberOfParticipants ?? r?.numberOfParticipants) || 0,
    date:         String(r?.TrainingDate ?? r?.trainingDate ?? '').slice(0, 10),
    names:        String(r?.ParticipantNames ?? r?.participantNames ?? ''),
    certs:        String(r?.CertificateNotes ?? r?.certificateNotes ?? ''),
    desc:         String(r?.DescriptionCoordinationNotes ?? r?.descriptionCoordinationNotes ?? ''),
    createdAt:    String(r?.CreatedAt ?? r?.createdAt ?? ''),
    raw: r,
  };
}

async function trainingAction(fields, label) {
  const token = getSuperAdminToken();
  const body = {
    action:   fields.action,
    id:       Number(fields.id) || 0,
    branchID: Number(fields.branchId) || 0,
    numberOfParticipants: Number(fields.participants) || 0,
    trainingDate:                 fields.date  || '',
    participantNames:             fields.names || '',
    certificateNotes:             fields.certs || '',
    descriptionCoordinationNotes: fields.desc  || '',
    userId: Number(getSuperAdminIdentity().userId) || 0,
  };
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.schoolProgress.trainingAction()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Could not ${label}`, res.status);
  }
  return json;
}

/** Save Participation Details — id ho to update, warna add. */
export function saveTrainingSession({ branchId, participants, date, names, certs, desc, id = 0 } = {}) {
  const isEdit = Number(id) > 0;
  return trainingAction(
    { action: isEdit ? CARD_ACTIONS.update : CARD_ACTIONS.add, id, branchId, participants, date, names, certs, desc },
    isEdit ? 'update participation details' : 'save participation details',
  );
}

/** Ek branch ke training sessions. */
export async function listTrainingSessions(branchId) {
  const json = await trainingAction({ action: CARD_ACTIONS.get, id: 0, branchId }, 'load training sessions');
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(trainingRowToUi).filter((r) => r.id);
}

/** Ek session hatao. */
export function deleteTrainingSession(id, branchId) {
  return trainingAction({ action: CARD_ACTIONS.delete, id, branchId }, 'delete this session');
}

/* ═══════════════════ SCHOOL ENQUIRIES (bug tracker) ═══════════════════
   POST .../api/AHM_School_Progress/school-enquiries-bugs-action
     body: { action, id, branchID, module, developer, bugDetail, date,
             isSolved, userId }

   `isSolved` hi bug ki list tay karta hai:
     false → Open (unsolved)      true → Resolved (solved)

   Wahi chaar actions: get | add | update | delete.
   Do baatein live check se:
     • `get` ke liye branchID LAAZMI hai (0 bheja to "BranchID is required").
     • module/developer/bugDetail/date model par [Required] hain — inhe kabhi
       chhodna nahi, warna 400 aata hai; khali string chal jati hai (delete
       aur get me isi liye "" bhejte hain).
   `get` PascalCase rows deta hai: ID, BranchID, Module, Developer, BugDetail,
   Date, IsSolved, CreatedBy, CreatedAt, ModifiedBy, ModifiedAt.
   ═══════════════════════════════════════════════════════════════════ */

/* Screen ka status lafz ↔ API ka boolean. */
export const ENQUIRY_STATUS = { open: 'open', resolved: 'resolved' };
const solvedFlag = (v) => (v === true || v === 1 || String(v).toLowerCase() === 'true');

/** Ek API row → wohi shape jo enquiry cards padhte hain. */
export function enquiryRowToUi(r) {
  const solved = solvedFlag(r?.IsSolved ?? r?.isSolved);
  const by = Number(r?.CreatedBy ?? r?.createdBy) || 0;
  return {
    id:        Number(r?.ID ?? r?.id) || 0,
    branchId:  Number(r?.BranchID ?? r?.branchID) || 0,
    module:    String(r?.Module ?? r?.module ?? ''),
    developer: String(r?.Developer ?? r?.developer ?? ''),
    detail:    String(r?.BugDetail ?? r?.bugDetail ?? ''),
    /* Date input aur badge dono YYYY-MM-DD par chalte hain. */
    date:      String(r?.Date ?? r?.date ?? '').slice(0, 10),
    isSolved:  solved,
    status:    solved ? ENQUIRY_STATUS.resolved : ENQUIRY_STATUS.open,
    /* API sirf CreatedBy id deti hai — naam nahi, is liye naam ghadte nahi. */
    user:      by > 0 ? `User #${by}` : '—',
    createdBy: by,
    createdAt: String(r?.CreatedAt ?? r?.createdAt ?? ''),
    raw: r,
  };
}

async function enquiryAction(fields, label) {
  const token = getSuperAdminToken();
  const body = {
    action:    fields.action,
    id:        Number(fields.id) || 0,
    branchID:  Number(fields.branchId) || 0,
    module:    fields.module    || '',
    developer: fields.developer || '',
    bugDetail: fields.bugDetail || '',
    date:      fields.date      || '',
    isSolved:  Boolean(fields.isSolved),
    userId:    Number(getSuperAdminIdentity().userId) || 0,
  };
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.schoolProgress.enquiryAction()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError((json && (json.message || json.Message)) || `Could not ${label}`, res.status);
  }
  return json;
}

/** Add Inquiry / Update — `id` diya ho to update, warna add. */
export function saveEnquiry({ branchId, module, developer, bugDetail, date, isSolved = false, id = 0 } = {}) {
  const isEdit = Number(id) > 0;
  return enquiryAction(
    { action: isEdit ? CARD_ACTIONS.update : CARD_ACTIONS.add, id, branchId, module, developer, bugDetail, date, isSolved },
    isEdit ? 'update this enquiry' : 'save this enquiry',
  );
}

/** Ek branch ke saare bugs (open + resolved) — mapped. */
export async function listEnquiries(branchId) {
  if (!Number(branchId)) return [];      // API branchID ke baghair get nahi karti
  const json = await enquiryAction({ action: CARD_ACTIONS.get, id: 0, branchId }, 'load enquiries');
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(enquiryRowToUi).filter((r) => r.id);
}

/** Mark Resolved / Reopen — poora record dobara bhejna hota hai (update). */
export function setEnquirySolved(bug, isSolved) {
  return enquiryAction(
    {
      action: CARD_ACTIONS.update,
      id: bug?.id, branchId: bug?.branchId,
      module: bug?.module, developer: bug?.developer, bugDetail: bug?.detail, date: bug?.date,
      isSolved,
    },
    isSolved ? 'mark this bug resolved' : 'reopen this bug',
  );
}

/** Ek bug hatao. */
export function deleteEnquiry(id, branchId) {
  return enquiryAction({ action: CARD_ACTIONS.delete, id, branchId }, 'delete this enquiry');
}

const schoolProgressService = {
  listSchoolProgress, listBranchReport, branchReportToRow,
  saveCardAction, listCardActions, deleteCardAction, cardRowToUi,
  saveTrainingSession, listTrainingSessions, deleteTrainingSession, trainingRowToUi,
  saveEnquiry, listEnquiries, setEnquirySolved, deleteEnquiry, enquiryRowToUi,
  CARD_HEADS, CARD_ACTIONS, ENQUIRY_STATUS,
};
export default schoolProgressService;
