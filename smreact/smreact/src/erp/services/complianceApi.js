import { buildUrl, resolveMediaUrl  } from '../../../src/utils/apiConfig';
import {
  DAILY_AREA_OPTIONS, MONTHLY_CATEGORY_OPTIONS, ALL_STAFF,
  DAILY_TEMPLATES, WEEKLY_TEMPLATES, MONTHLY_TEMPLATES, STATUS,
} from '../mock/compliance'; 

const BASE = '/api/AHM_Branch_Compliance_Area';

const authHeaders = () => {
  const token = sessionStorage.getItem('token') || '';
  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};


/* Response se asli error message nikalna (400 validation errors samet) */
async function readJson(res, label) {
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* plain text */ }

  if (!res.ok || json?.success === false) {
    const detail = json?.message
      || (json?.errors ? Object.values(json.errors).flat().join(' | ') : '')
      || json?.title
      || text.slice(0, 200);
    console.error(`${label} failed`, res.status, text);
    throw new Error(`${label} (${res.status}): ${detail || 'request failed'}`);
  }
  return json;
}

export const getBranchId = () => Number(sessionStorage.getItem('branchID')) || 0;

/* GET area-list */
export async function getAreas(branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-list?branchId=${branchId}`), {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('area-list failed');
  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  return Array.isArray(data) ? data : [];
}

/* POST area-add-list — body: { items: [{ id, branchId, name, type }] }
   `items` mein string (sirf naam) ya { name, type } dono chal jate hain */
export async function addAreas(items, branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-add-list`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      items: items.map((it) => {
        const name = typeof it === 'string' ? it : it.name;
        return { id: 0, branchId, name, type: typeof it === 'string' ? seedTypeOf(name) : (it.type || seedTypeOf(name)) };
      }),
    }),
  });
  if (!res.ok) throw new Error('area-add-list failed');
  return res.json().catch(() => null);
}

/* Module khulte hi: jo areas backend mein nahi hain sirf wohi save karo.
   Match naam + type dono par hota hai (ek naam daily aur weekly dono mein ho sakta hai). */
let seedPromise = null; // module level: dono effect calls ek hi kaam share karenge

export function ensureAreas(defaultNames) {
  if (!seedPromise) {
    seedPromise = (async () => {
      const branchId = getBranchId();
      let areas = await getAreas(branchId);
      const existing = new Set(areas.map((a) => `${areaTypeOf(a)}|${norm(a.name)}`));
      const missing = defaultNames
        .map((n) => (typeof n === 'string' ? { name: n, type: seedTypeOf(n) } : n))
        .filter((s) => !existing.has(`${s.type}|${norm(s.name)}`));

      if (missing.length) {
        await addAreas(missing, branchId);
        areas = await getAreas(branchId);
      }
      return areas;
    })().catch((err) => {
      seedPromise = null; // fail ho to dobara try ho sake
      throw err;
    });
  }
  return seedPromise;
}

/* POST area-action — action: 'insert'. type: 'daily' | 'weekly' | 'monthly' */
export async function addArea(name, type = 'daily', branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-action`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      action: 'insert',
      data: { id: 0, branchId, name: name.trim(), type: AREA_TYPES.includes(type) ? type : 'daily' },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || 'area-action failed');
  }
  return json;
}

/* GET branch ke employees — Assigned To dropdown ke liye
   returns [{ id, name }] */
export async function getBranchEmployees(branchId = getBranchId()) {
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchId}`), {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res, 'get-employees-by-branch');
  const data = json?.data ?? json;
  return (Array.isArray(data) ? data : [])
    .map(e => ({
      id: Number(e.id) || 0,
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.fullName || e.name || `Employee #${e.id}`,
    }))
    .filter(e => e.id > 0);
}

/////////

/* ── Area naam helpers ── */
export const norm = (s) => String(s || '').trim().toLowerCase();
export const WEEKLY_AREA_NAME = 'Weekly Review';

/* -- Check (Daily / Weekly / Monthly) helpers --
   Backend har task ki MOJOODA check state rakhta hai (status, remarks,
   remarksPic, checkDate) - per-date history ka koi endpoint nahi hai.
   Is liye page jo period chuna hua hai us se checkDate match kare to hi
   wo status dikhata hai, warna task us period ke liye "Not Checked" hai. */
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/* Asli aaj ki tareekh (local, UTC shift ke bina) */
export const todayIso = () => isoOf(new Date());

/* Us hafte ka Monday */
export const weekKeyOf = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return todayIso();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
};
export const monthKeyOf = (iso) => String(iso).slice(0, 7);
export const shiftWeekKey = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return isoOf(d);
};
export const shiftMonthKey = (key, delta) => {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

/* Backend ki checkDate (date ya date-time) -> 'YYYY-MM-DD' */
export function checkDateIso(v) {
  const str = String(v || '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? '' : isoOf(d);
}

/* Status string ko STATUS keys par normalize karna ('Not Checked',
   'not-checked', khali - sab not_checked) */
const STATUS_KEYS = Object.values(STATUS);
export function normStatus(v) {
  const k = String(v || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_KEYS.includes(k) ? k : STATUS.NOT_CHECKED;
}

/* checkDate chuni hui period ke andar hai? */
export function inPeriod(checkIso, frequency, periodKey) {
  if (!periodKey) return true;
  if (!checkIso) return false;
  if (frequency === 'weekly') return weekKeyOf(checkIso) === periodKey;
  if (frequency === 'monthly') return monthKeyOf(checkIso) === periodKey;
  return checkIso === periodKey;
}

export const SEED_AREA_NAMES = [
  ...DAILY_AREA_OPTIONS.map(a => a.label),
  ...MONTHLY_CATEGORY_OPTIONS.map(a => a.label),
  WEEKLY_AREA_NAME,
];

/* ── Area type (daily / weekly / monthly) ──
   Backend ab har area ke saath `type` save karta hai. Purane records jin
   ka type khali hai un ka type naam se andaza lagate hain: monthly ki
   fixed categories -> monthly, "Weekly Review" -> weekly, baqi -> daily. */
export const AREA_TYPES = ['daily', 'weekly', 'monthly'];
const MONTHLY_NAMES = new Set(MONTHLY_CATEGORY_OPTIONS.map(a => norm(a.label)));

/* Default (seed) naam ka type */
export function seedTypeOf(name) {
  const n = norm(name);
  if (n === norm(WEEKLY_AREA_NAME)) return 'weekly';
  if (MONTHLY_NAMES.has(n)) return 'monthly';
  return 'daily';
}

/* Backend area ka type — `type` valid ho to wahi, warna naam se */
export function areaTypeOf(a) {
  const t = norm(a?.type);
  return AREA_TYPES.includes(t) ? t : seedTypeOf(a?.name);
}

/* Sirf ek type ke areas */
export const areasOfType = (areas, type) => (areas || []).filter(a => areaTypeOf(a) === type);

/* Daily dropdown mein sirf daily type ke areas */
export const isDailyArea = (a) => areaTypeOf(a) === 'daily';

/* ── Seed ke liye local dummy tasks ── */
const SEED_TEMPLATES = [...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...MONTHLY_TEMPLATES];
const LOCAL_DASH = new Map(SEED_TEMPLATES.map(t => [t.label, t.dashArea]));

const areaNameOf = (t) =>
  t.frequency === 'weekly' ? WEEKLY_AREA_NAME : t.areaLabel;

/* ── GET task-list ── */
export async function getTasks(branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/task-list?branchId=${branchId}`), {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('task-list failed');
  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  return Array.isArray(data) ? data : [];
}

/* ── POST task-add-list (JSON) ── */
export async function addTasks(items) {
  const res = await fetch(buildUrl(`${BASE}/task-add-list`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return readJson(res, 'task-add-list');
}

/* ── POST task-action (multipart/form-data) ──
   Content-Type khud set NAHI karna, browser boundary ke saath lagata hai. */
export async function taskAction(action, task, branchId = getBranchId()) {
  const fd = new FormData();
  fd.append('Action', action);
  fd.append('Id', task.backendId ?? 0);
  fd.append('BranchId', branchId);
  fd.append('AreaId', task.areaId ?? 0);
  fd.append('Type', task.frequency);
  fd.append('Task', task.label);
  fd.append('DueDay', task.dueDay || '');
  if (Number(task.assignedTo) > 0) fd.append('AssignedTo', task.assignedTo);
  fd.append('IsVerification', !!task.verificationRequired);
  fd.append('IsEvidenceRequired', task.evidenceAllowed !== false);
  fd.append('IsActive', task.active !== false);
  fd.append('Status', normStatus(task.status));
  fd.append('Remarks', task.remarks || '');

  /* Check state - Setup se edit/toggle hone par bhi yeh fields jaisi ki
     waisi wapas jati hain, ta ke mark kiya hua status ya evidence gum
     na ho. Nayi photo (data URL / File) ho to file upload hoti hai,
     warna purana path hi wapas bhej dete hain. */
  if (task.checkDate) fd.append('CheckDate', task.checkDate);
  if (Number(task.verifiedBy) > 0) fd.append('VerifiedBy', task.verifiedBy);
  const pic = await toFile(task.photo);
  if (pic) fd.append('RemarksPicFile', pic, pic.name || 'evidence.jpg');
  else fd.append('RemarksPic', task.remarksPic || '');
  const me = currentUser();
  if (me.name) fd.append(action === 'insert' ? 'CreatedBy' : 'ModifiedBy', me.name);

  const token = sessionStorage.getItem('token') || '';
  const res = await fetch(buildUrl(`${BASE}/task-action`), {
    method: 'POST',
    headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  return readJson(res, 'task-action');
}

/* ── Module khulte hi: task list khali ho to dummy tasks seed karo ── */
let taskSeedPromise = null;

export function ensureTasks(areas) {
  if (!taskSeedPromise) {
    taskSeedPromise = (async () => {
      const branchId = getBranchId();
      let tasks = await getTasks(branchId); 

      const have = new Set(tasks.map(t => `${norm(t.type)}|${norm(t.task)}`));
      /* type + naam se area id (sab se purana record) — ek naam alag
         types mein ho to bhi task sahi area mein jaye */
      const idByKey = new Map();
      [...areas].sort((a, b) => Number(a.id) - Number(b.id)).forEach(a => {
        const key = `${areaTypeOf(a)}|${norm(a.name)}`;
        if (!idByKey.has(key)) idByKey.set(key, a.id);
      });

      const items = SEED_TEMPLATES
        .map(t => ({
          id: 0,
          branchId,
          areaId: idByKey.get(`${t.frequency}|${norm(areaNameOf(t))}`),
          areaName: areaNameOf(t),
          type: t.frequency,
          task: t.label,
          dueDay: t.frequency === 'weekly' ? (t.dueDay || 'Friday') : '',
          assignedToName: t.assignedStaff,
          isVerification: !!t.verificationRequired,
          isEvidenceRequired: true,
          isActive: true,
          status: STATUS.NOT_CHECKED,
          remarks: '',
        }))
        .filter(i => i.areaId && !have.has(`${i.type}|${norm(i.task)}`));

      if (items.length) {
        await addTasks(items);
        tasks = await getTasks(branchId);
      }
      return tasks;
    })().catch((err) => { taskSeedPromise = null; throw err; });
  }
  return taskSeedPromise;
}

/* ── Backend row -> Setup page ka template shape ── */
export function toTemplate(t, areaMap = new Map()) {
  const frequency = norm(t.type) || 'daily';
  const areaName = t.areaName || areaMap.get(t.areaId) || '';
  /* Weekly ki apni (custom) category — "Weekly Review" ke ilawa koi bhi
     weekly area. Ye apne naam ke group / dashboard area mein dikhti hai. */
  const customWeekly = frequency === 'weekly' && !!areaName && norm(areaName) !== norm(WEEKLY_AREA_NAME);
  const opts = frequency === 'monthly' ? MONTHLY_CATEGORY_OPTIONS
    : frequency === 'daily' ? DAILY_AREA_OPTIONS : [];
  const local = opts.find(o => norm(o.label) === norm(areaName));
  /* Custom area ko NAAM se key karo, id se nahi — backend mein ek hi naam
     ke do area records hon to bhi ek hi group bane */
  const customKey = areaName ? `area-${norm(areaName)}` : `area-${t.areaId}`;

  return {
    id: String(t.id),
    backendId: t.id,
    areaId: t.areaId,
    frequency,
    area: frequency === 'weekly' ? (customWeekly ? customKey : 'weekly')
      : (local?.id ?? customKey),
    areaLabel: frequency === 'weekly' ? (customWeekly ? areaName : WEEKLY_AREA_NAME) : (areaName || 'Other'),
    dashArea: customWeekly ? customKey
      : (LOCAL_DASH.get(t.task) ?? local?.dashArea ?? 'administration'),
    label: t.task,
    assignedStaff: t.assignedToName || '',
    assignedTo: t.assignedTo ?? 0,
    dueDay: t.dueDay || 'Friday',
    /* Backend: isEvidenceRequired. Purane rows par null aaye to default true */
    evidenceAllowed: t.isEvidenceRequired !== false,
    verificationRequired: !!t.isVerification,
    active: t.isActive !== false,
    custom: !LOCAL_DASH.has(t.task),
    restrictedToPermission: local?.id === 'finance' ? 'cmp.finance' : null,
    status: normStatus(t.status),
    remarks: t.remarks || '',
    remarksPic: t.remarksPic || '',
    checkDate: checkDateIso(t.checkDate),
    /* Task kab add hua — Daily/Weekly/Monthly tabs isi se chuni hui
       date / week / month ke tasks dikhate hain */
    createdDate: checkDateIso(t.createdDate ?? t.createdAt ?? t.createdOn ?? t.createdDateTime ?? t.insertDate ?? t.entryDate),
    verifiedBy: Number(t.verifiedBy) || 0,
    verifiedByName: t.verifiedByName || '',
  };
}

/* -- Backend row -> Daily/Weekly/Monthly ka checklist "instance" shape
   (ChecklistGroup / ChecklistRow jo expect karte hain). `periodKey`
   diya ho to status sirf usi period ka dikhta hai. -- */
export function toInstance(t, { areaMap = new Map(), employeeNames = new Map(), periodKey = null } = {}) {
  const tpl = toTemplate(t, areaMap);
  const current = inPeriod(tpl.checkDate, tpl.frequency, periodKey);
  const verifierName = tpl.verifiedByName || employeeNames.get(tpl.verifiedBy) || '';
  return {
    ...tpl,
    /* id mein period bhi hai — date/week/month badalne par ChecklistRow
       dobara mount ho (warna purane period ka remark textarea mein reh
       jata hai). Backend ke liye asli id `backendId` hai. */
    id: periodKey ? `${tpl.id}@${periodKey}` : tpl.id,
    taskId: tpl.id,
    /* ChecklistRow aur filterInstances naam par chalte hain; employee id
       alag (assignedToId) rakhi hai ta ke save par wahi wapas jaye */
    assignedTo: tpl.assignedStaff || employeeNames.get(Number(tpl.assignedTo)) || '-',
    assignedToId: Number(tpl.assignedTo) || 0,
    status: current ? tpl.status : STATUS.NOT_CHECKED,
    remark: current ? tpl.remarks : '',
    evidence: current ? (resolveMediaUrl(tpl.remarksPic) || null) : null,
    verifiedById: current ? tpl.verifiedBy : 0,
    verifiedBy: current && tpl.verifiedBy ? (verifierName || 'Verified') : null,
    periodKey,
  };
}

/* -- Ek check ka status / remark / evidence / verification save karna --
   `instance` toInstance ka output hai, `patch` ChecklistRow se aata hai
   ({ status, remark, evidence } ya { verifiedBy }). `checkDate` wo din
   hai jis period ko user dekh raha hai. */
export function saveTaskCheck(instance, patch = {}) {
  const photo = patch.evidence !== undefined ? patch.evidence : instance.evidence;
  const freshPhoto = photo instanceof Blob || (typeof photo === 'string' && photo.startsWith('data:'));
  const verifiedBy = patch.verifiedBy !== undefined ? (Number(patch.verifiedBy) || 0) : (instance.verifiedById || 0);

  return taskAction('update', {
    backendId: instance.backendId,
    areaId: instance.areaId,
    frequency: instance.frequency,
    label: instance.label,
    dueDay: instance.dueDay,
    assignedTo: instance.assignedToId ?? instance.assignedTo,
    verificationRequired: instance.verificationRequired,
    evidenceAllowed: instance.evidenceAllowed,   // status save par Setup wali value na badle
    active: instance.active,
    status: patch.status ?? instance.status,
    remarks: patch.remark !== undefined ? patch.remark : (instance.remark || ''),
    checkDate: patch.checkDate || instance.checkDate || todayIso(),
    verifiedBy,
    /* nayi photo -> file jayegi; purani rahe to wahi path; hata di to khali */
    remarksPic: freshPhoto ? '' : (photo ? (instance.remarksPic || '') : ''),
    photo,
  });
}

/* ═══════════ PROBLEMS & FOLLOW-UPS ═══════════ */

const firstOf = (o, ...keys) => {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== '') return o[k];
  return '';
};
/* Sirf id (number) aaye to naam ki jagah '—' dikhao */
const nameLabel = (v) => (v === '' || v == null || /^\d+$/.test(String(v))) ? '—' : String(v);

const PROBLEM_STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Verified and Closed'];
const statusKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const normProblemStatus = (s) => {
  const k = statusKey(s);
  if (k === 'verified' || k === 'closed') return 'Verified and Closed';
  return PROBLEM_STATUSES.find(x => statusKey(x) === k) || 'Open';
};


const flag = (v) => v === true || v === 'true' || v === 1;

export function toProblem(r) {
  const reportDate = firstOf(r, 'reportProblemDateTime', 'reportDate', 'createdAt');
  const reportedBy = nameLabel(firstOf(r, 'reportedByName', 'reportedBy'));
  const remarks = firstOf(r, 'resolvedRemarks', 'resolutionRemarks', 'resolveRemarks', 'remarks');

  /* Status flags se: verify > resolve > progress > open */
  const status = flag(r.isVerify) ? 'Verified and Closed'
    : flag(r.isResolved) ? 'Resolved'
    : flag(r.isProgress) ? 'In Progress'
    : normProblemStatus(r.status);

  /* Activity history flags aur un ke datetime se */
  const history = [];
  if (reportDate) history.push({ date: reportDate, by: reportedBy, action: 'Reported the problem.' });
  if (flag(r.isProgress) && r.isProgressDateTime) {
    history.push({ date: r.isProgressDateTime, by: nameLabel(firstOf(r, 'isProgressEmployeeName')), action: 'Marked In Progress.' });
  }
  if (flag(r.isResolved) && r.markResolvedDateTime) {
    history.push({
      date: r.markResolvedDateTime,
      by: nameLabel(firstOf(r, 'isResolvedEmployeeName')),
      action: `Marked Resolved${remarks ? ` — ${remarks}` : '.'}`,
    });
  }
  if (flag(r.isVerify) && r.isVerifyDateTime) {
    history.push({ date: r.isVerifyDateTime, by: nameLabel(firstOf(r, 'isVerifiedUserName', 'isVerifyEmployeeName')), action: 'Verified and closed.' });
  }

  return {
    id: firstOf(r, 'id', 'problemId'),
    title: firstOf(r, 'problemTitle', 'title'),
    description: firstOf(r, 'problemDescription', 'description'),
    category: firstOf(r, 'problemCategory', 'category'),
    location: firstOf(r, 'location'),
    priority: firstOf(r, 'priority') || 'Medium',
    reportedBy,
    assignedTo: nameLabel(firstOf(r, 'assignToName', 'assignedToName', 'assignedTo', 'assignTo')),
    reportDate,
    dueDate: String(firstOf(r, 'dueDate')).slice(0, 10),
    status,
    photo: resolveMediaUrl(firstOf(r, 'problemPicUrl', 'problemPic', 'photo')),
    resolutionRemarks: remarks,
    history,
  };
}

/* Login user ki id/naam — in sessionStorage keys ke naam apne app ke
   hisab se check kar lein (DevTools > Application > Session Storage). */
const currentUser = () => ({
  id: Number(sessionStorage.getItem('employee_ID') || sessionStorage.getItem('UserID')) || 0,
  name: sessionStorage.getItem('userName') || sessionStorage.getItem('UserName')
    || sessionStorage.getItem('displayName') || '',
});

/* Daily/Weekly/Monthly tabs ko verify aur problem-report ke liye chahiye */
export const getCurrentUser = currentUser;

async function postForm(path, fd) {
  const token = sessionStorage.getItem('token') || '';
  const res = await fetch(buildUrl(`${BASE}/${path}`), {
    method: 'POST',
    headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  return readJson(res, path);
}

/* Modal ki photo (data URL ya File) -> File */
async function toFile(photo) {
  if (!photo) return null;
  if (photo instanceof Blob) return photo;
  if (typeof photo === 'string' && photo.startsWith('data:')) {
    const blob = await (await fetch(photo)).blob();
    return new File([blob], `problem-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`, { type: blob.type });
  }
  return null;
}

/* GET problem-list */
export async function getProblems(branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/problem-list?branchId=${branchId}`), {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res, 'problem-list');
  const data = json?.data ?? json;
  return (Array.isArray(data) ? data : []).map(toProblem);
}

/* POST problem-report (multipart/form-data) */
export async function reportProblem(p, branchId = getBranchId()) {
  const me = currentUser();
  const fd = new FormData();
  fd.append('BranchId', branchId);
  fd.append('ProblemTitle', p.title);
  fd.append('ProblemDescription', p.description || '');
  fd.append('ProblemCategory', p.category);
  fd.append('Location', p.location || '');
  fd.append('Priority', p.priority);
  if (p.dueDate) fd.append('DueDate', p.dueDate);
  fd.append('ReportProblemDateTime', new Date().toISOString());
  if (me.id) fd.append('ReportedBy', me.id);
  if (me.name) fd.append('CreatedBy', me.name);
  if (Number(p.assignTo) > 0) fd.append('AssignTo', p.assignTo);   // real employee id ho tabhi

  const file = await toFile(p.photo);
  if (file) fd.append('ProblemPicFile', file, file.name || 'problem.jpg');
  return postForm('problem-report', fd);
}


/* POST problem-progress | problem-resolve | problem-verify  (application/json) */
export async function problemStep(step, problem, { remarks = '' } = {}) {
  const me = currentUser();
  const now = new Date().toISOString();
  const id = Number(problem.id);

  const bodies = {
    progress: { id, isProgress: true, isProgressEmployee: me.id, isProgressDateTime: now, modifiedBy: me.name },
    resolve:  { id, isResolved: true, isResolvedEmployee: me.id, resolvedRemarks: remarks, markResolvedDateTime: now, modifiedBy: me.name },
    verify:   { id, isVerify: true, isVerifiedUser: me.id, isVerifyDateTime: now, modifiedBy: me.name },
  };

  const res = await fetch(buildUrl(`${BASE}/problem-${step}`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(bodies[step]),
  });
  return readJson(res, `problem-${step}`);
}

/* DELETE problem-delete/{id} — id path mein jati hai, body nahi */
export async function deleteProblem(problem) {
  const id = Number(problem?.id);
  if (!id) throw new Error('Could not delete: problem id is missing.');
  const res = await fetch(buildUrl(`${BASE}/problem-delete/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return readJson(res, 'problem-delete');
}



