/* Tech Module service — live API (TECH_TICKETS_API_README.md).

   One GET route (?action=…) for reads and one multipart POST route (form
   field `action`) for writes, under SA_ADMIN_API_BASE like every other
   super-admin module. The server returns its own Ticket shape; `toUi()` maps
   it to the shape the Tech Module screens already render, so the components
   stay unchanged. */
import { ApiError, buildQuery } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken, getSuperAdminIdentity } from '../config';
import EP from '../endpoints';
import { DEVELOPERS } from '../../techTicketsData';

const url = () => `${SA_ADMIN_API_BASE}${EP.techTickets.base()}`;
const authHeaders = () => {
  const token = getSuperAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function unwrap(res) {
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json);
  }
  return json?.data ?? null;
}

async function getTech(params = {}) {
  let res;
  try {
    res = await fetch(`${url()}${buildQuery(params)}`, { headers: { accept: '*/*', ...authHeaders() } });
  } catch (e) {
    throw new ApiError(e.message || 'Network error', 0);
  }
  return unwrap(res);
}

/* multipart/form-data — no Content-Type header, the browser sets the boundary. */
async function postTech(fields, files = []) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v != null && v !== '') fd.append(k, String(v)); });
  files.forEach((f) => { if (f?.file instanceof Blob) fd.append('attachments', f.file, f.name || f.file.name); });
  let res;
  try {
    res = await fetch(url(), { method: 'POST', headers: { accept: '*/*', ...authHeaders() }, body: fd });
  } catch (e) {
    throw new ApiError(e.message || 'Network error', 0);
  }
  return unwrap(res);
}

/* ── identity & lookups ─────────────────────────────────────────────── */

/* Users come from the Super Admin user list (Auth/get-all-users). Each row has
   firstName, lastName, user_Name, isActive, isAdmin. */
let usersCache = null;
async function users() {
  if (!usersCache) {
    let res;
    try {
      res = await fetch(`${SA_ADMIN_API_BASE}${EP.auth.allUsers()}`, { headers: { accept: '*/*', ...authHeaders() } });
    } catch (e) {
      throw new ApiError(e.message || 'Network error', 0);
    }
    const rows = (await unwrap(res)) || [];
    usersCache = rows.map((u) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      userName: u.user_Name || '',
      isActive: u.isActive === true,
      isAdmin: u.isAdmin === true,
    }));
  }
  return usersCache;
}

/** The logged-in Super Admin's user id (actorUserId on every write). */
async function actorId() {
  const id = Number(getSuperAdminIdentity().userId);
  if (id) return id;
  const admin = (await users()).find((u) => u.isAdmin);
  if (!admin) throw new ApiError('Could not find a Super Admin user for this action.', 400);
  return admin.id;
}

/** UI developer (server user id, or UI id/name) → server user id. */
async function developerUserId(devRef) {
  if (devRef !== '' && devRef != null && Number.isFinite(Number(devRef))) return Number(devRef);
  const name = DEVELOPERS.find((d) => d.id === devRef || d.name === devRef)?.name || devRef;
  const hit = (await users()).find((u) => String(u.name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
  if (!hit) throw new ApiError(`Developer "${name}" has no active user account on the server.`, 400);
  return hit.id;
}

/** UI school (picker object) → server AHM_Branch id, matched by name. */
async function schoolBranchId(school) {
  if (!school) throw new ApiError('Please select a school.', 400);
  if (Number.isFinite(Number(school.branchId))) return Number(school.branchId);
  const rows = (await getTech({ action: 'schools', search: school.name })) || [];
  const hit = rows.find((s) => String(s.branchName || '').trim().toLowerCase() === String(school.name).trim().toLowerCase());
  if (!hit) throw new ApiError(`"${school.name}" is not a school on the server.`, 400);
  return hit.branchId;
}

/* ── mapping: server Ticket → UI ticket ─────────────────────────────── */

const STAGE_LEGACY = {
  bugs_new_dev: 'reported', in_progress: 'in_progress', qa_review: 'fixed',
  ready_for_release: 'communicated', released: 'closed',
};

const JOURNEY_LABEL = {
  created: 'Reported',
  assigned: 'Assigned to developer — moved to In Progress',
  reassigned: 'Reassigned',
  dev_report_submitted: 'Developer Testing Report submitted',
  sent_for_qa: 'Sent for QA Testing',
  qa_rejected: 'Rejected by QA — returned to developer',
  qa_approved: 'Approved by QA — Ready for Release',
  released: 'Released',
};

const kb = (bytes) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '');
const attachmentType = (ct = '') => (ct.startsWith('image') ? 'image' : ct.startsWith('video') ? 'video' : 'document');

function toUiAttachment(a, i = 0) {
  return {
    id: `${a.path || a.fileName}-${i}`,
    name: a.fileName,
    type: attachmentType(a.contentType),
    size: kb(a.size),
    url: a.path ? `${SA_ADMIN_API_BASE}/SchoolMentorSuperAdminAPI/${a.path}` : null,
    uploadedAt: a.uploadedAt,
  };
}

export function toUi(t) {
  const dev = t.development || {};
  const qa = t.qa || {};
  const rel = t.release || {};
  const released = t.stage === 'released';
  const journey = Array.isArray(t.journey) ? t.journey : [];
  const qaReview = journey
    .filter((e) => e.action === 'qa_approved' || e.action === 'qa_rejected')
    .map((e, i) => ({
      id: `qa-${t.id}-${i}`,
      decision: e.action === 'qa_approved' ? 'approved' : 'rejected',
      comments: e.note || '',
      attachments: (e.attachments || []).map(toUiAttachment),
      reviewedBy: e.byName || 'QA Team',
      reviewedAt: e.at,
    }));
  return {
    id: t.id,
    ticketNumber: t.ticketNo,
    type: t.ticketType,
    platform: t.platform,
    subPlatform: t.subPlatform,
    module: t.module,
    source: t.source,
    stage: t.stage,
    status: STAGE_LEGACY[t.stage] || 'reported',
    title: t.title,
    description: t.description || '',
    expectedBehaviour: t.expectedBehaviour || '',
    actualBehaviour: t.actualBehaviour || '',
    school: t.school
      ? {
        id: t.school.branchId,
        name: t.school.branchName,
        branch: t.school.branchCode || '',
        contact: t.school.ownerName || '',
        phone: t.school.phone || '',
        loginId: t.school.loginId || null,
        password: t.school.loginPassword || null,
        isTestSchool: false,
      }
      : { id: null, name: '—', isTestSchool: false },
    reportedBy: { id: t.reportedBy?.userId ?? null, name: t.reportedBy?.name || '' },
    reportedAt: t.reportedAt,
    assignedTo: t.assignment?.assignedTo ? { id: t.assignment.assignedTo.userId, name: t.assignment.assignedTo.name } : null,
    assignedBy: t.assignment?.assignedBy ? { id: t.assignment.assignedBy.userId, name: t.assignment.assignedBy.name } : null,
    assignedAt: t.assignment?.assignedAt || null,
    startedAt: dev.workStartedAt || null,
    fixedAt: dev.devReportSubmittedAt || null,
    developerTestingReport: dev.devReportSubmittedAt
      ? {
        whatImplemented: dev.whatWasImplemented || '',
        whatTested: dev.whatWasTested || '',
        testingResults: dev.testingResults || '',
        limitations: dev.knownLimitations || '',
        attachments: (dev.attachments || []).map(toUiAttachment),
        submittedBy: dev.devReportSubmittedBy?.name || '',
        submittedAt: dev.devReportSubmittedAt,
      }
      : null,
    qaReview,
    releaseInfo: released
      ? {
        releasedBy: rel.releasedBy?.name || '',
        releasedAt: rel.releasedAt,
        approvedBy: qa.approvedBy?.name || 'QA Team',
        approvalDate: qa.approvedAt,
        testingComments: qa.comments || '',
        releaseNotes: rel.releaseNotes || '',
        deploymentComments: '',
        attachments: [],
        devTimeDays: Math.max(1, Math.round(dev.developmentDays || 0)),
      }
      : null,
    notifiedSupport: released,
    supportConversationId: rel.supportConversationId || null,
    activity: journey.map((e) => ({
      event: JOURNEY_LABEL[e.action] || e.action,
      person: e.byName || '',
      at: e.at,
      note: e.note || undefined,
    })),
    attachments: ((journey.find((e) => e.action === 'created')?.attachments) || []).map(toUiAttachment),
    priorReportCount: t.priorReportCount || 0,
    isRecurring: (t.priorReportCount || 0) > 0,
    recurrenceCount: t.priorReportCount || 0,
    relatedTicketIds: [],
    totalDays: t.totalDays,
    updatedAt: t.updatedAt,
  };
}

/* ── reads ─────────────────────────────────────────────────────────── */

/** GET ?action=list → UI tickets, newest first. */
export async function getTickets(filters = {}) {
  const rows = await getTech({ action: 'list', pageSize: 1000, ...filters });
  return (rows || []).map(toUi);
}

/** GET ?action=stats → the server's numbers for the stat cards (README §6). */
export async function getStats(from, to) {
  return getTech({ action: 'stats', from, to });
}

/** Active server users for the developer dropdowns. */
export async function getTechUsers() {
  return (await users()).filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name }));
}

/** GET ?action=schools&search= → raw server schools (the picker maps them). */
export async function getSchools(search = '') {
  return (await getTech({ action: 'schools', search })) || [];
}

/** GET ?action=get&id= → one UI ticket (with school login details). */
export async function getTicketById(id) {
  return toUi(await getTech({ action: 'get', id: Number(id) }));
}

/* Stats and workload are computed from the ticket list (the UI helpers in
   techTicketsData.js), so the existing dashboards keep their shape. The
   server's ?action=stats / ?action=workload routes are not used yet. */

/* ── writes ────────────────────────────────────────────────────────── */

/** POST action=create (multipart). */
export async function createTicketFromReport(payload) {
  const actor = await actorId();
  const assignedToUserId = payload.assignedTo ? await developerUserId(payload.assignedTo) : null;
  const created = await postTech({
    action: 'create',
    type: payload.type,
    platform: payload.platform,
    subPlatform: payload.subPlatform,
    module: payload.module,
    source: payload.source,
    schoolBranchId: await schoolBranchId(payload.school),
    title: payload.title,
    description: payload.description,
    expectedBehaviour: payload.expectedBehaviour,
    actualBehaviour: payload.actualBehaviour,
    assignedToUserId,
    actorUserId: actor,
  }, payload.attachments);
  return toUi(created);
}

/** POST action=assign — developer dropdown value (UI id or name). */
export async function assignTicket(id, developerRef, note) {
  return toUi(await postTech({
    action: 'assign', id: Number(id), assignedToUserId: await developerUserId(developerRef),
    actorUserId: await actorId(), note,
  }));
}

/** POST action=dev-report (multipart). */
export async function submitDeveloperTestingReport(id, report) {
  return toUi(await postTech({
    action: 'dev-report', id: Number(id), actorUserId: await actorId(),
    whatWasImplemented: report.whatImplemented, whatWasTested: report.whatTested,
    testingResults: report.testingResults, knownLimitations: report.limitations,
  }, report.attachments));
}

/** POST action=send-for-qa. */
export async function sendForQaTesting(id) {
  return toUi(await postTech({ action: 'send-for-qa', id: Number(id), actorUserId: await actorId() }));
}

/** POST action=qa-review (multipart). `attachments` are staged UI objects with `.file`. */
export async function submitQaReview(id, { decision, comments, attachments }) {
  return toUi(await postTech({
    action: 'qa-review', id: Number(id), actorUserId: await actorId(),
    decision, comments,
  }, attachments));
}

/** POST action=release. */
/* The release route has no fields for deployment comments or testing comments,
   so they are added to the release notes text. Attachments go with the request. */
export async function releaseTicket(id, payload = {}) {
  const notes = [
    payload.releaseNotes,
    payload.deploymentComments ? `Deployment: ${payload.deploymentComments}` : null,
    payload.testingComments ? `Final testing: ${payload.testingComments}` : null,
  ].filter(Boolean).join('\n');
  return toUi(await postTech({
    action: 'release', id: Number(id), actorUserId: await actorId(),
    releaseNotes: notes,
    supportConversationId: payload.supportConversationId,
  }, payload.attachments));
}
