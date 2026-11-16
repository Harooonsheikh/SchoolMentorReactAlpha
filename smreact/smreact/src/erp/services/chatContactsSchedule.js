// ══════════════════════════════════════════════════════════════════
//  get-chat-contacts ka schedule (ERP ek hi jagah se chalata hai).
//
//    • ERP login par  → 1 dafa (startChatContactsSchedule)
//    • har 2 minute   → 1 dafa
//    • naya message aaye (unread barhe) → foran 1 dafa
//    • chat khule ya message bheja jaye (noteChatActivity) → foran 1 dafa
//    • us ke baad     → aakhri activity (bheja / aaya / khula) ke 30 second baad 1 dafa
//      (har nayi activity par ye 30s dobara shuru ho jata hai)
//
//  App.js (notification / badge) aur Chat.jsx (sidebar) dono isi ka jawab
//  subscribe karte hain — API call alag se nahi hoti.
//  Note: server push nahi hai, is liye "naya message" us waqt pata chalta hai
//  jab koi run unread barha hua dekhe (zyada se zyada 2 minute ki deri).
// ══════════════════════════════════════════════════════════════════
import { fetchChatContacts } from './chatService';

export const CONTACTS_EVERY_MS = 2 * 60 * 1000;   // har 2 minute
export const CONTACTS_AFTER_MSG_MS = 30 * 1000;   // aakhri naye message ke 30 second baad

let session = null;   // { branchId, userId, prev, busy, interval, follow }
const listeners = new Set();

/** Har run ka jawab: fn(rows, { added: [{ contact, added }] }). Unsubscribe fn wapas. */
export function subscribeChatContacts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function scheduleAfterMessage() {
  if (!session) return;
  clearTimeout(session.follow);
  session.follow = setTimeout(run, CONTACTS_AFTER_MSG_MS);
}

async function run() {
  const s = session;
  if (!s || s.busy) return;
  s.busy = true;
  try {
    const rows = await fetchChatContacts(s.branchId, s.userId, { fresh: true });
    if (session !== s) return;   // ERP band ho chuka / dusra user login
    const now = new Map(rows.map(r => [r.userId, Number(r.unread) || 0]));
    const added = [];
    if (s.prev) {
      rows.forEach(c => {
        const d = (now.get(c.userId) || 0) - (s.prev.get(c.userId) || 0);
        if (d > 0) added.push({ contact: c, added: d });
      });
    }
    s.prev = now;   // pehla run sirf baseline — purane unread par notification nahi
    if (added.length) scheduleAfterMessage();
    listeners.forEach(fn => { try { fn(rows, { added }); } catch (_) { /* ek listener ki galti baqi ko na roke */ } });
  } catch (_) {
    /* agli dafa (2 min ya naye message par) */
  } finally {
    if (session === s) s.busy = false;
  }
}

/** Login par shuru: foran 1 dafa, phir har 2 minute. Dobara call bekaar nahi. */
export function startChatContactsSchedule(branchId, userId) {
  if (!branchId || !userId) return;
  if (session && session.branchId === branchId && session.userId === userId) return;
  stopChatContactsSchedule();
  session = { branchId, userId, prev: null, busy: false, interval: null, follow: null };
  run();
  session.interval = setInterval(run, CONTACTS_EVERY_MS);
}

/** Chat khuli / message bheja → foran 1 dafa, aur aakhri activity ke 30s baad 1 dafa. */
export function noteChatActivity() {
  if (!session) return;
  run();
  scheduleAfterMessage();
}

export function stopChatContactsSchedule() {
  if (!session) return;
  clearInterval(session.interval);
  clearTimeout(session.follow);
  session = null;
}
