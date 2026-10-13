import mentorAiApi from './mentorAiApi';
import { parsePlansResponse } from './lessonPlanMapper';
import { normalizeWorksheet } from './mentorAIWorksheetService';
import { normalizeDesignPost } from './mentorraistudioservice';

/* ═══════════════════════════════════════════════════════════════════
   Library adapter.

   mentorAILibraryService.js talks to a REST "library" at
   /ai/api/library/. The Mentor AI backend has no such endpoint — it
   already stores every generated lesson plan, worksheet and design
   under the signed-in user. This adapter answers the Library's calls
   from those existing endpoints:

     GET    /ai/api/library/        → /ai/api/lesson-plans/?lessonplan_type=classwork
                                      /api/worksheets/
                                      /api/design-studio/
     GET    /ai/api/library/:id/    → the matching detail endpoint
     POST   /ai/api/library/        → nothing to send (already stored)
     PATCH  /ai/api/library/:id/    → title kept on this device (no endpoint)
     DELETE /ai/api/library/:id/    → DELETE on the item; if the server has
                                      no such endpoint, hidden on this device

   Item ids:  lessonplan:<documentId>:<planNo>  |  worksheet:<id>  |  design:<id>
   It mimics an axios instance: resolves { data }, rejects with
   { response: { status } } so the service's own error handling works.
   ═══════════════════════════════════════════════════════════════════ */

const BASE = '/ai/api/library/';
const LP_LIST = '/ai/api/lesson-plans/';
const WS_LIST = '/api/worksheets/';
const DS_LIST = '/api/design-studio/';

/* ─── helpers ─── */
function fail(status, detail) {
  const e = new Error(detail || `Request failed (${status})`);
  e.response = { status, data: { detail } };
  return e;
}
function rowsOf(d) {
  if (Array.isArray(d)) return d;
  return d?.results || d?.data || d?.items || d?.worksheets || d?.posts || d?.lesson_plans || [];
}
function ownerId() {
  try {
    const u = JSON.parse(localStorage.getItem('mentor_ai_user') || 'null');
    const id = u?.id ?? u?.user_id ?? u?.pk ?? u?.user;
    if (id != null && id !== '') return String(id);
  } catch { /* ignore */ }
  const uid = sessionStorage.getItem('UserID');
  return uid ? `${sessionStorage.getItem('branchID') || 'b'}:${uid}` : 'anon';
}
function readMap(name) {
  try { return JSON.parse(localStorage.getItem(`mentor_ai_lib_${name}:${ownerId()}`) || '{}'); } catch { return {}; }
}
function writeMap(name, value) {
  try { localStorage.setItem(`mentor_ai_lib_${name}:${ownerId()}`, JSON.stringify(value)); } catch { /* quota — ignore */ }
}
const isMissing = (err) => [404, 405, 501].includes(err?.response?.status);

/* ─── row → library item (server shape the service expects) ─── */
function lessonPlanItems(row) {
  const docId = row.document_id ?? row.id ?? row.lesson_plan_id;
  if (docId == null) return [];
  const created = row.created_at || row.createdAt || null;
  const updated = row.updated_at || row.updatedAt || created;
  const toContent = (p) => ({
    plan: {
      title: p.title, cls: p.cls, section: p.section, subject: p.subject, unit: p.unit,
      duration: p.duration, version: p.version || 1, sections: p.sections,
    },
  });
  let plans = [];
  try { plans = parsePlansResponse(row, { documentId: docId }).plans; } catch { /* list row carries no plan bodies */ }
  if (plans.length) {
    return plans.map((p, i) => ({
      id: `lessonplan:${docId}:${i + 1}`, item_type: 'lessonplan', title: p.title,
      content: toContent(p), source_key: `lessonplan:${docId}:${i + 1}`, created_at: created, updated_at: updated,
    }));
  }
  const unit = row.unit_name || '';
  return [{
    id: `lessonplan:${docId}:1`, item_type: 'lessonplan',
    title: row.title || row.lesson_plan_title || unit || `Lesson plan ${docId}`,
    content: { plan: { title: row.title || unit, cls: row.grade || '', subject: row.subject || '', unit, duration: Number(row.time_duration) || undefined, sections: [] } },
    source_key: `lessonplan:${docId}:1`, created_at: created, updated_at: updated,
  }];
}

function worksheetItem(raw) {
  const row = { ...(raw?.worksheet || raw) };
  if (row.id == null) row.id = row.worksheet_id;
  if (row?.id == null) return null;
  const w = normalizeWorksheet({ ...row, cls: row.cls || row.grade_label, subject: row.subject || row.subject_label });
  if (!w.pageContent.length && !w.pdfUrl) return null;            // still generating / failed
  const created = row.created_at || row.createdAt || null;
  return {
    id: `worksheet:${row.id}`, item_type: 'worksheet',
    title: row.title || row.topic || [row.subject_label, row.grade_label && `Grade ${row.grade_label}`, 'worksheet'].filter(Boolean).join(' '),
    content: { worksheet: w }, source_key: `worksheet:${row.id}`,
    created_at: created, updated_at: row.updated_at || created,
  };
}

function designItem(raw) {
  const row = { ...(raw?.post || raw) };
  if (row.id == null) row.id = row.design_post_id;
  if (row?.id == null) return null;
  const post = normalizeDesignPost(row);
  if (!post.imageUrl && !post.pdfUrl) return null;                 // still generating / failed
  return {
    id: `design:${row.id}`, item_type: 'design', title: post.headline || 'Design post',
    content: { post }, source_key: `design:${row.id}`,
    created_at: row.created_at || null, updated_at: row.updated_at || row.created_at || null,
  };
}

function decorate(items) {
  const hidden = new Set(readMap('hidden').ids || []);
  const titles = readMap('titles');
  return items.filter(i => !hidden.has(i.id)).map(i => (titles[i.id] ? { ...i, title: titles[i.id] } : i));
}

/* ─── operations ─── */
async function listAll() {
  const [lp, ws, ds] = await Promise.allSettled([
    mentorAiApi.get(LP_LIST, { params: { lessonplan_type: 'classwork' } }),
    mentorAiApi.get(WS_LIST),
    mentorAiApi.get(DS_LIST),
  ]);
  if ([lp, ws, ds].every(r => r.status === 'rejected')) throw lp.reason;   // surfaces 401 / network / 404
  const out = [];
  if (lp.status === 'fulfilled') rowsOf(lp.value.data).forEach(r => out.push(...lessonPlanItems(r)));
  if (ws.status === 'fulfilled') rowsOf(ws.value.data).forEach(r => { const i = worksheetItem(r); if (i) out.push(i); });
  if (ds.status === 'fulfilled') rowsOf(ds.value.data).forEach(r => { const i = designItem(r); if (i) out.push(i); });
  return decorate(out);
}

async function getOne(id) {
  const [type, key, no] = String(id).split(':');
  if (!type || !key) throw fail(404, 'Unknown library item.');
  if (type === 'lessonplan') {
    const { data } = await mentorAiApi.get(`${LP_LIST}${key}/`);
    const plans = parsePlansResponse(data, { documentId: key }).plans;
    const p = plans[Number(no) - 1] || plans[0];
    const created = data?.created_at || null;
    return decorate([{
      id, item_type: 'lessonplan', title: p.title,
      content: { plan: { title: p.title, cls: p.cls, section: p.section, subject: p.subject, unit: p.unit, duration: p.duration, version: p.version || 1, sections: p.sections } },
      source_key: id, created_at: created, updated_at: data?.updated_at || created,
    }])[0];
  }
  if (type === 'worksheet') {
    const { data } = await mentorAiApi.get(`${WS_LIST}${key}/`);
    const item = worksheetItem(data?.worksheet || data?.data || data);
    if (!item) throw fail(404, 'This worksheet has no content yet.');
    return decorate([item])[0];
  }
  if (type === 'design') {
    const { data } = await mentorAiApi.get(`${DS_LIST}${key}/`);
    const item = designItem(data?.post || data?.data || data);
    if (!item) throw fail(404, 'This design has no image yet.');
    return decorate([item])[0];
  }
  throw fail(404, 'Unknown library item.');
}

async function removeOne(id) {
  const [type, key] = String(id).split(':');
  const url = { lessonplan: `${LP_LIST}${key}/`, worksheet: `${WS_LIST}${key}/`, design: `${DS_LIST}${key}/` }[type];
  if (!url) throw fail(404, 'Unknown library item.');
  try {
    await mentorAiApi.delete(url);
  } catch (err) {
    if (!isMissing(err)) throw err;
    /* Server has no delete for this item → hide it on this device. */
  }
  const h = readMap('hidden');
  writeMap('hidden', { ids: [...new Set([...(h.ids || []), String(id)])] });
}

/* Save → real API call. Marks the item as kept on the server (PATCH), or, if
   the server doesn't allow PATCH, at least confirms it exists (GET). */
async function syncToServer(body) {
  const [type, key] = String(body.source_key || '').split('#')[0].split(':');
  if (!/^\d+$/.test(key || '')) return;                 // not stored yet (e.g. "worksheet:new")
  const url = { worksheet: `${WS_LIST}${key}/`, design: `${DS_LIST}${key}/`, lessonplan: `${LP_LIST}${key}/` }[type];
  if (!url) return;
  let patched = false;
  if (type !== 'lessonplan') {                           // never write to lesson plans
    try {
      await mentorAiApi.patch(url, { saved_to_library: true, library_title: body.title });
      patched = true;
    } catch (err) {
      const st = err?.response?.status;
      if (!st || ![400, 403, 404, 405, 501].includes(st)) throw err;
    }
  }
  if (!patched) {
    try { await mentorAiApi.get(url); } catch (err) {
      if (err?.response?.status === 404) throw fail(400, 'This item was not found on the server, so it could not be saved.');
      throw err;
    }
  }
}

/* ─── axios-like surface used by mentorAILibraryService ─── */
const idFrom = (url) => String(url).replace(BASE, '').replace(/\/$/, '');

const libraryApi = {
  async get(url) {
    const id = idFrom(url);
    return { data: id ? await getOne(id) : await listAll() };
  },
  async post(url, body = {}) {
    /* Everything generated is already stored server-side; just echo it back
       so the Library refreshes and the Save button shows "Saved". */
    await syncToServer(body);
    const now = new Date().toISOString();
    return {
      data: {
        id: String(body.source_key || '').split('#')[0] || `${body.item_type}:saved-${Date.now()}`,
        item_type: body.item_type, title: body.title, content: body.content,
        source_key: body.source_key, created_at: now, updated_at: now,
      },
    };
  },
  async patch(url, body = {}) {
    const id = idFrom(url);
    const titles = readMap('titles');
    titles[id] = String(body.title || '').slice(0, 200);
    writeMap('titles', titles);
    const item = await getOne(id);
    return { data: { ...item, title: titles[id], updated_at: new Date().toISOString() } };
  },
  async delete(url) {
    await removeOne(idFrom(url));
    return { data: null };
  },
};

export default libraryApi;
