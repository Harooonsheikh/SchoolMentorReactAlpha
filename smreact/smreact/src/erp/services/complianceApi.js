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

/* POST area-add-list — body: { items: [{ id, branchId, name }] } */
export async function addAreas(names, branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-add-list`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      items: names.map((name) => ({ id: 0, branchId, name })),
    }),
  });
  if (!res.ok) throw new Error('area-add-list failed');
  return res.json().catch(() => null);
}

/* Module khulte hi: jo areas backend mein nahi hain sirf wohi save karo */
let seedPromise = null; // module level: dono effect calls ek hi kaam share karenge

export function ensureAreas(defaultNames) {
  if (!seedPromise) {
    seedPromise = (async () => {
      const branchId = getBranchId();
      let areas = await getAreas(branchId);
      const existing = new Set(areas.map((a) => a.name));
      const missing = defaultNames.filter((n) => !existing.has(n));

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

/* POST area-action — action: 'insert' */
export async function addArea(name, branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-action`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      action: 'insert',
      data: { id: 0, branchId, name: name.trim() },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || 'area-action failed');
  }
  return json;
}

/////////

/* ── Area naam helpers ── */
export const norm = (s) => String(s || '').trim().toLowerCase();
export const WEEKLY_AREA_NAME = 'Weekly Review';

export const SEED_AREA_NAMES = [
  ...DAILY_AREA_OPTIONS.map(a => a.label),
  ...MONTHLY_CATEGORY_OPTIONS.map(a => a.label),
  WEEKLY_AREA_NAME,
];

const RESERVED = new Set([...MONTHLY_CATEGORY_OPTIONS.map(a => a.label), WEEKLY_AREA_NAME].map(norm));
/* Daily dropdown mein monthly categories aur Weekly Review nahi dikhani */
export const isDailyArea = (a) => !RESERVED.has(norm(a.name));

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
  fd.append('IsActive', task.active !== false);
  fd.append('Status', task.status || STATUS.NOT_CHECKED);
  fd.append('Remarks', task.remarks || '');

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
      const idByName = new Map(areas.map(a => [norm(a.name), a.id]));

      const items = SEED_TEMPLATES
        .map(t => ({
          id: 0,
          branchId,
          areaId: idByName.get(norm(areaNameOf(t))),
          areaName: areaNameOf(t),
          type: t.frequency,
          task: t.label,
          dueDay: t.frequency === 'weekly' ? (t.dueDay || 'Friday') : '',
          assignedToName: t.assignedStaff,
          isVerification: !!t.verificationRequired,
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
  const opts = frequency === 'monthly' ? MONTHLY_CATEGORY_OPTIONS : DAILY_AREA_OPTIONS;
  const local = opts.find(o => norm(o.label) === norm(areaName));

  return {
    id: String(t.id),
    backendId: t.id,
    areaId: t.areaId,
    frequency,
    area: frequency === 'weekly' ? 'weekly' : (local?.id ?? `area-${t.areaId}`),
    areaLabel: frequency === 'weekly' ? WEEKLY_AREA_NAME : (areaName || 'Other'),
    dashArea: LOCAL_DASH.get(t.task) ?? local?.dashArea ?? 'administration',
    label: t.task,
    assignedStaff: t.assignedToName || '',
    assignedTo: t.assignedTo ?? 0,
    dueDay: t.dueDay || 'Friday',
    evidenceAllowed: true,                       // backend mein is ka field nahi hai
    verificationRequired: !!t.isVerification,
    active: t.isActive !== false,
    custom: !LOCAL_DASH.has(t.task),
    restrictedToPermission: local?.id === 'finance' ? 'cmp.finance' : null,
    status: t.status,
    remarks: t.remarks,
  };
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
  name: sessionStorage.getItem('userName') || sessionStorage.getItem('UserName') || '',
});

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