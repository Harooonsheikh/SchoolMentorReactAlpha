import { buildUrl, isViewOnlyAccount } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   USER TIME SPEND — POST /manage-usertimespend

   Poore ERP par screen-wise time track karta hai. Har module kholne
   par start, module chhorne / tab band / logout par end. Payload:

     { action, branchID, userID, screenName, startTime, endTime,
       timeSpend, date, type: "erp", ipAddress }

   UI isay silently fire karta hai — fail hone par user ko kuch nahi
   dikhta (ye analytics hai, koi save-action nahi).
   ═══════════════════════════════════════════════════════════════════ */

const ENDPOINT = '/manage-usertimespend';
const TYPE = 'erp';
const ACTION = 'INSERT';
const MIN_MS = 2000;
const HEARTBEAT_MS = 5 * 60 * 1000;
const IP_KEY = 'sm_client_ip';
const IP_URL = 'https://api.ipify.org?format=json';

let current = null;
let heartbeatId = null;
let listenersInstalled = false;
let ipPromise = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function formatDateLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTimeLocal(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function snapshotIdentity() {
  try {
    return {
      userID: Number(sessionStorage.getItem('UserID')) || 0,
      branchID: Number(sessionStorage.getItem('branchID')) || 0,
      token: sessionStorage.getItem('token') || '',
    };
  } catch {
    return { userID: 0, branchID: 0, token: '' };
  }
}

function readCachedIp() {
  try {
    return sessionStorage.getItem(IP_KEY) || '';
  } catch {
    return '';
  }
}

function canTrack() {
  try {
    if (isViewOnlyAccount()) return false;
  } catch { /* ignore */ }
  const id = snapshotIdentity();
  return !!(id.userID && id.branchID);
}

/** Public IP ek dafa nikaalo aur session me cache karo. Fail → khali string. */
export function prefetchClientIp() {
  const cached = readCachedIp();
  if (cached) return Promise.resolve(cached);
  if (ipPromise) return ipPromise;
  ipPromise = (async () => {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
      const res = await fetch(IP_URL, { signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      const json = await res.json().catch(() => null);
      const ip = String(json?.ip || '').trim();
      if (ip) {
        try { sessionStorage.setItem(IP_KEY, ip); } catch { /* ignore */ }
      }
      return ip;
    } catch {
      return readCachedIp();
    } finally {
      ipPromise = null;
    }
  })();
  return ipPromise;
}

function elapsedMs(sess) {
  if (!sess) return 0;
  const running = sess.visible ? (Date.now() - sess.startedAt) : 0;
  return sess.accumulatedMs + running;
}

function pauseSession() {
  if (!current || !current.visible) return;
  current.accumulatedMs += Date.now() - current.startedAt;
  current.visible = false;
}

function resumeSession() {
  if (!current || current.visible) return;
  current.startedAt = Date.now();
  current.visible = true;
}

function postTimeSpend(payload, { keepalive } = {}) {
  const url = buildUrl(ENDPOINT);
  const token = payload._token || '';
  const body = { ...payload };
  delete body._token;
  const headers = {
    Accept: '*/*',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    keepalive: !!keepalive,
  }).catch(() => null);
}

async function sendSession(sess, { keepalive } = {}) {
  if (!sess) return;
  const ms = elapsedMs(sess);
  if (ms < MIN_MS) return;
  if (!sess.userID || !sess.branchID) return;
  const now = new Date();
  let ip = readCachedIp();
  if (!ip && !keepalive) ip = await prefetchClientIp();
  const payload = {
    action: ACTION,
    branchID: sess.branchID,
    userID: sess.userID,
    screenName: sess.screenName,
    startTime: sess.startTime,
    endTime: formatTimeLocal(now),
    timeSpend: formatDuration(ms),
    date: sess.date,
    type: TYPE,
    ipAddress: ip || '',
    _token: sess.token,
  };
  await postTimeSpend(payload, { keepalive });
}

function clearHeartbeat() {
  if (heartbeatId) {
    clearInterval(heartbeatId);
    heartbeatId = null;
  }
}

function beginSession(screenName) {
  const name = String(screenName || '').trim();
  if (!name || !canTrack()) {
    current = null;
    clearHeartbeat();
    return;
  }
  const id = snapshotIdentity();
  const now = new Date();
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  current = {
    screenName: name,
    date: formatDateLocal(now),
    startTime: formatTimeLocal(now),
    startedAt: Date.now(),
    accumulatedMs: 0,
    visible: !hidden,
    userID: id.userID,
    branchID: id.branchID,
    token: id.token,
  };
  prefetchClientIp();
  clearHeartbeat();
  heartbeatId = setInterval(() => {
    if (!current || !current.visible) return;
    if (elapsedMs(current) < HEARTBEAT_MS) return;
    const nameNow = current.screenName;
    const sess = current;
    current = null;
    sendSession(sess, { keepalive: true });
    beginSession(nameNow);
  }, 30000);
}

/** Nayi screen shuru. Pehli wali chal rahi ho to usay pehle save karo. */
export function startUserTimeSpend(screenName) {
  const name = String(screenName || '').trim();
  if (current && current.screenName === name) return;
  if (current) {
    const sess = current;
    current = null;
    clearHeartbeat();
    sendSession(sess, { keepalive: true });
  }
  if (name) beginSession(name);
}

/** Jo screen abhi open hai uska time abhi save karo (logout / unmount / pagehide). */
export function flushUserTimeSpend({ keepalive = true } = {}) {
  if (!current) return Promise.resolve();
  const sess = current;
  current = null;
  clearHeartbeat();
  return sendSession(sess, { keepalive });
}

export function stopUserTimeSpend() {
  return flushUserTimeSpend({ keepalive: true });
}

function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') pauseSession();
  else resumeSession();
}

function onPageHide() {
  flushUserTimeSpend({ keepalive: true });
}

/** visibility + unload listeners — ERP mount par ek dafa. */
export function installUserTimeSpendListeners() {
  if (typeof window === 'undefined') return () => {};
  if (listenersInstalled) return () => {};
  listenersInstalled = true;
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onPageHide);
  prefetchClientIp();
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onPageHide);
    listenersInstalled = false;
  };
}
