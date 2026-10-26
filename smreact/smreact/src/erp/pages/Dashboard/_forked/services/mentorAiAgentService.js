import { buildMentorAiUrl } from '../../../../../utils/apiConfig'; // path apne folder ke hisaab se theek karo

/* Teeno paths ek jagah. Live par /ai prefix wala routing confirm kar lena. */
const AUTH_PATH = '/ai/api/auth/token/';
const CHAT_PATH = '/api/ask/chat/';
const LOGS_PATH = '/api/ask/logs/';

const K_ACCESS = 'mai_access_token';
const K_SESSION = 'mai_session_id';

const uuid = () =>
  (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

/* Login par call hota hai. Logout par alag se zaroori nahi: doLogout() ka
   sessionStorage.clear() ye dono keys khud hata deta hai. */
export function clearMentorAiSession() {
  try {
    sessionStorage.removeItem(K_ACCESS);
    sessionStorage.removeItem(K_SESSION);
  } catch { /* private mode */ }
}

/* Login ke baad pehli dafa uuid banti hai, phir logout/naye login tak wahi rehti hai. */
export function getMentorAiSessionId() {
  let id = sessionStorage.getItem(K_SESSION);
  if (!id) { id = uuid(); sessionStorage.setItem(K_SESSION, id); }
  return id;
}

/* Sirf principal / School Head ke liye `principal=true`; teacher ke liye field bheji hi nahi jati. */
const isPrincipal = () => /school\s*head|principal/i.test(sessionStorage.getItem('accountType') || '');

let tokenPromise = null; // do queries ek saath aayen to auth API ek hi dafa chale

function fetchAccessToken() {
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const fd = new FormData(); // Content-Type khud mat set karna (boundary browser lagata hai)
    fd.append('branch', sessionStorage.getItem('branchID') || '');
    fd.append('user', sessionStorage.getItem('UserID') || '');
    if (isPrincipal()) fd.append('principal', 'true');

    const res = await fetch(buildMentorAiUrl(AUTH_PATH), { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`AI auth failed (${res.status})`);
    const data = await res.json();
    if (!data?.access) throw new Error('AI auth: no access token returned');
    sessionStorage.setItem(K_ACCESS, data.access);
    return data.access;
  })().finally(() => { tokenPromise = null; });
  return tokenPromise;
}

const getAccessToken = async () => sessionStorage.getItem(K_ACCESS) || fetchAccessToken();

/* Authorization header lagata hai; 401 aaye to ek dafa naya token le kar retry. */
async function authed(url, init = {}) {
  const call = (access) => fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${access}` },
  });
  let res = await call(await getAccessToken());
  if (res.status === 401) {
    sessionStorage.removeItem(K_ACCESS);
    res = await call(await fetchAccessToken());
  }
  return res;
}

/* POST /api/ask/chat/ */
export async function askMentorAgent(message) {
  const branch = sessionStorage.getItem('branchID');
  const res = await authed(buildMentorAiUrl(CHAT_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      branch_id: Number(branch) || branch,
      message,
      net_token: sessionStorage.getItem('token'),   // ERP login token
      session_id: getMentorAiSessionId(),           // logout tak same
    }),
  });
  if (!res.ok) throw new Error(`Mentor AI request failed (${res.status})`);
  const data = await res.json();
  if (!data?.success) throw new Error('Mentor AI returned an unsuccessful response');
  return {
    kind: 'agent',
    query: message,
    text: data.response,
    sessionId: data.session_id,
    ms: data.response_time_ms,
  };
}

const titleFrom = (q) => {
  const t = String(q || '').trim();
  return t.length > 52 ? `${t.slice(0, 52)}…` : (t || 'New chat');
};

/* GET /api/ask/logs/?branch_id=… → panel ki history shape: [{ id, title, updatedAt, exchanges }]
   Har results item ek sawal-jawab hai; session_id se group hote hain. */
export async function fetchMentorAiHistory() {
  const branch = sessionStorage.getItem('branchID');
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await authed(buildMentorAiUrl(`${LOGS_PATH}?branch_id=${encodeURIComponent(branch)}&page=${page}`));
    if (!res.ok) throw new Error(`Mentor AI logs failed (${res.status})`);
    const json = await res.json();
    rows.push(...(json.results || []));
    totalPages = json.total_pages || 1;
    page += 1;
  } while (page <= totalPages && page <= 5);   // 5 pages (100 entries) ki hadd

  const sessions = new Map();
  rows.forEach((r) => {
    const sid = String(r.session_id);
    const ts = Date.parse(r.created_at || r.created || r.timestamp || r.updated_at || '') || 0;
    if (!sessions.has(sid)) sessions.set(sid, { id: sid, updatedAt: 0, rows: [] });
    const s = sessions.get(sid);
    s.rows.push(r);
    s.updatedAt = Math.max(s.updatedAt, ts);
  });

  return [...sessions.values()].map((s) => {
    s.rows.sort((a, b) => a.id - b.id);            // purana pehle
    return {
      id: s.id,
      title: titleFrom(s.rows[0].user_message),
      updatedAt: s.updatedAt,
      exchanges: s.rows.map((r) => ({
        id: `log-${r.id}`,
        query: r.user_message,
        status: 'done',
        steps: [],
        response: { kind: 'agent', query: r.user_message, text: r.agent_response, sessionId: r.session_id },
      })),
    };
  });
}