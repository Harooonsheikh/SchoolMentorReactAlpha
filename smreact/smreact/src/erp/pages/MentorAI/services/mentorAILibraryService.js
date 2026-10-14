import mentorAiApi from './mentorAILibraryAdapter';
/* ═══════════════════════════════════════════════════════════════════
   Mentor AI Library — saved lesson plans, worksheets, designs, chats.

   Storage: the Mentor AI backend at LIBRARY_URL (REST, scoped to the
   signed-in user by the bearer token). Until that endpoint is deployed
   (the server answers 404/405/501), items are kept in this browser's
   localStorage under a key that includes the owner ID, so every
   account only ever sees its own items. `getLibraryBackend()` tells the
   UI which store is active so it can say so honestly.

   Backend contract (DRF-style):
     GET    /ai/api/library/             → [item] | { results: [item] }
     POST   /ai/api/library/             body { item_type, title, content, source_key }
     GET    /ai/api/library/:id/         → item
     PATCH  /ai/api/library/:id/         body { title }
     DELETE /ai/api/library/:id/
   item = { id, item_type, title, content, source_key, owner, created_at, updated_at }
   The server must set `owner` from request.user and filter every
   query by it.
   ═══════════════════════════════════════════════════════════════════ */

export const LIBRARY_URL = '/ai/api/library/';
export const LIBRARY_TYPES = ['lessonplan', 'worksheet', 'design', 'chat'];
const LOCAL_PREFIX = 'mentor_ai_library_v1:';
const CHANGE_EVENT = 'mentorai:library-changed';

let backend = null; // null (unknown) | 'api' | 'local'
const inflight = new Map();

export function getLibraryBackend() { return backend; }

export function getOwnerId() {
  try {
    const u = JSON.parse(localStorage.getItem('mentor_ai_user') || 'null');
    const id = u?.id ?? u?.user_id ?? u?.pk ?? u?.user;
    if (id != null && id !== '') return String(id);
  } catch { /* ignore */ }
  const uid = sessionStorage.getItem('UserID');
  const branch = sessionStorage.getItem('branchID');
  return uid ? `${branch || 'b'}:${uid}` : null;
}

export function onLibraryChange(cb) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}
function emitChange() { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); }

/* ─── normalisation ─── */
function normalize(raw) {
  if (!raw) return null;
  return {
    id: String(raw.id),
    type: raw.item_type || raw.type,
    title: raw.title || 'Untitled',
    content: typeof raw.content === 'string' ? safeParse(raw.content) : (raw.content ?? null),
    sourceKey: raw.source_key || raw.sourceKey || null,
    ownerId: raw.owner != null ? String(raw.owner) : (raw.ownerId ?? null),
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || raw.created_at || raw.createdAt || null,
  };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

function isMissingEndpoint(err) {
  const st = err?.response?.status;
  return st === 404 || st === 405 || st === 501;
}

/* ─── local store (per owner) ─── */
function localKey() {
  const owner = getOwnerId();
  if (!owner) throw new Error('You need to be signed in to use the Library.');
  return LOCAL_PREFIX + owner;
}
function readLocal() {
  try { return JSON.parse(localStorage.getItem(localKey()) || '[]'); } catch { return []; }
}
function writeLocal(items) {
  try {
    localStorage.setItem(localKey(), JSON.stringify(items));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
      throw new Error('Library storage on this device is full. Delete some items and try again.');
    }
    throw e;
  }
}

/* Run against the API; if the endpoint doesn't exist yet, switch to the
   local store for the rest of the session. */
async function withBackend(apiFn, localFn) {
  if (backend !== 'local') {
    try {
      const out = await apiFn();
      backend = 'api';
      return out;
    } catch (err) {
      if (!isMissingEndpoint(err)) throw friendly(err);
      if (backend !== 'local') console.warn('[Mentor AI Library] Server library endpoint not found — using this device\'s storage.');
      backend = 'local';
    }
  }
  return localFn();
}

function friendly(err) {
  const st = err?.response?.status;
  const data = err?.response?.data;
  const msg = (typeof data === 'string' ? '' : data?.detail || data?.error || data?.message) || '';
  if (st === 401) return new Error('Your Mentor AI session has expired. Please reload the page.');
  if (st === 403) return new Error(msg || 'You don\'t have access to this item.');
  if (!err?.response && (err?.request || err?.isAxiosError)) return new Error('Could not reach Mentor AI. Check your connection and try again.');
  return new Error(msg || err?.message || 'Library request failed.');
}

/* Stable hash of the content — used to recognise a repeat save. */
export function contentHash(value) {
  const s = JSON.stringify(value ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

/* ─── public API ─── */
const PAGE_LIMIT = 20;

/* Paginated list. Returns { items, total }.
   opts: { type, page = 1, limit = 20, search } */
export async function listLibraryPage({ type, page = 1, limit = PAGE_LIMIT, search } = {}) {
  const q = (search || '').trim().toLowerCase();
  return withBackend(
    async () => {
      const params = { page, page_size: limit, per_page: limit, limit, offset: (page - 1) * limit };      if (type) params.item_type = type;
      if (q) params.search = q;
      const { data } = await mentorAiApi.get(LIBRARY_URL, { params });
      if (Array.isArray(data)) {
        // server ignored pagination: filter + slice here
        const all = data.map(normalize).filter(Boolean)
          .filter(i => (!type || i.type === type) && (!q || i.title.toLowerCase().includes(q)));
        return { items: all.slice((page - 1) * limit, page * limit), total: all.length };
      }
      const rows = data?.results || data?.data || data?.items || [];
      const total = data?.count ?? data?.total ?? data?.pagination?.total ?? rows.length;
      // debug: remove after confirming
      console.log('[Library] page', page, 'rows', rows.length, 'total', total, 'raw keys', Object.keys(data || {}));      return { items: rows.map(normalize).filter(Boolean), total };
    },
    () => {
      const all = readLocal().map(normalize)
        .filter(i => (!type || i.type === type) && (!q || i.title.toLowerCase().includes(q)))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return { items: all.slice((page - 1) * limit, page * limit), total: all.length };
    },
  );
}

/* Every item (walks all pages). Used for duplicate detection on save. */
export async function listLibraryItems() {
  const out = [];
  let page = 1;
  for (;;) {
    const { items, total } = await listLibraryPage({ page, limit: 100 });
    out.push(...items);
    if (!items.length || out.length >= total || page >= 50) break;
    page += 1;
  }
  return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
export async function getLibraryItem(id) {
  return withBackend(
    async () => normalize((await mentorAiApi.get(`${LIBRARY_URL}${id}/`)).data),
    () => {
      const found = readLocal().find(i => String(i.id) === String(id));
      if (!found) throw new Error('This item no longer exists.');
      return normalize(found);
    },
  );
}

/* saveLibraryItem({ type, title, content, sourceKey })
   Resolves { item, duplicate } — duplicate=true when identical content
   from the same source was already saved (nothing new is written).
   Concurrent calls for the same content share one request, so a
   double-click can never create two items. */
export function saveLibraryItem({ type, title, content, sourceKey }) {
  if (!LIBRARY_TYPES.includes(type)) return Promise.reject(new Error(`Unknown library item type: ${type}`));
  if (content == null) return Promise.reject(new Error('Nothing to save yet.'));
  const key = `${sourceKey || type}#${contentHash(content)}`;
  if (inflight.has(key)) return inflight.get(key);

  const cleanTitle = String(title || '').trim().slice(0, 200) || 'Untitled';
  const job = (async () => {
    const existing = (await listLibraryItems()).find(i => i.type === type && i.sourceKey === key);
    if (existing) return { item: existing, duplicate: true };
    const item = await withBackend(
      async () => normalize((await mentorAiApi.post(LIBRARY_URL, {
        item_type: type, title: cleanTitle, content, source_key: key,
      })).data),
      () => {
        const now = new Date().toISOString();
        const row = {
          id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          item_type: type, title: cleanTitle, content, source_key: key,
          owner: getOwnerId(), created_at: now, updated_at: now,
        };
        writeLocal([row, ...readLocal()]);
        return normalize(row);
      },
    );
    emitChange();
    return { item, duplicate: false };
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

export async function renameLibraryItem(id, title) {
  const clean = String(title || '').trim().slice(0, 200);
  if (!clean) throw new Error('Title can\'t be empty.');
  const item = await withBackend(
    async () => normalize((await mentorAiApi.patch(`${LIBRARY_URL}${id}/`, { title: clean })).data),
    () => {
      const rows = readLocal();
      const row = rows.find(i => String(i.id) === String(id));
      if (!row) throw new Error('This item no longer exists.');
      row.title = clean;
      row.updated_at = new Date().toISOString();
      writeLocal(rows);
      return normalize(row);
    },
  );
  emitChange();
  return item;
}

export async function deleteLibraryItem(id) {
  await withBackend(
    async () => { await mentorAiApi.delete(`${LIBRARY_URL}${id}/`); },
    () => { writeLocal(readLocal().filter(i => String(i.id) !== String(id))); },
  );
  emitChange();
}

/* test hook */
export function __resetLibraryBackend() { backend = null; inflight.clear(); }
