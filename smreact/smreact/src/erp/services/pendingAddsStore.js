/* ═══════════════════════════════════════════════════════════════════
   PENDING-ADD GHOST ROWS

   Jab koi NAYA record (student / employee / asset / product) add kiya
   jaye aur approval ON ho, to backend sirf ek approval request banata
   hai — asli row list me nahi aati, is liye user ko module me kuch nazar
   nahi aata. Yeh store us naye record ko ek "ghost row" ke taur par yaad
   rakhta hai (wahi data jo user ne form me bhara), taake wo module ki
   list me Pending badge + Withdraw ke saath dikhe — bilkul normal
   insertion ki tarah, bas status "Pending Approval".

   - Per module + branch + user sessionStorage me save hota hai, taake
     page refresh par bhi ghost row nazar aati rahe.
   - getMyRequests() ki live list se reconcile hota hai: jaise hi request
     pending se nikli (approve / reject / withdraw), ghost row khud nikal
     jaati hai. Approve hone par asli row API se aa jaati hai.
   ═══════════════════════════════════════════════════════════════════ */

function storageKey(mod) {
  let b = '0';
  let u = '0';
  try {
    b = sessionStorage.getItem('branchID') || '0';
    u = sessionStorage.getItem('UserID')
      || sessionStorage.getItem('userID')
      || sessionStorage.getItem('userId')
      || sessionStorage.getItem('user_id')
      || '0';
  } catch (e) { /* no session */ }
  return `erpPendingAdds:${mod}:${b}:${u}`;
}

export function getPendingAdds(mod) {
  try {
    const raw = sessionStorage.getItem(storageKey(mod));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function write(mod, arr) {
  const next = Array.isArray(arr) ? arr : [];
  try { sessionStorage.setItem(storageKey(mod), JSON.stringify(next)); }
  catch (e) { /* storage full / unavailable — in-memory list still used */ }
  return next;
}

/* ghost = { rid, requestNo, approvalId, ts, row } — `row` is the module's
   own display-row shape (built from the submitted form). `rid` is the
   synthetic row id used by the list + pending badge. */
export function addPendingAdd(mod, ghost) {
  const g = { ts: Date.now(), ...ghost };
  const arr = getPendingAdds(mod).filter((x) => String(x.rid) !== String(g.rid));
  arr.unshift(g);
  return write(mod, arr);
}

export function removePendingAdd(mod, rid) {
  if (rid == null) return getPendingAdds(mod);
  return write(mod, getPendingAdds(mod).filter((x) => String(x.rid) !== String(rid)));
}

/* Drop ghosts whose approval request is no longer pending. `reqs` is the
   array returned by approvalsService.getMyRequests(). A ghost is kept while
   its requestNo is still present AND pending; if the request isn't found
   yet (backend may not have indexed it on the immediate reload) it's kept
   for a short grace window so a just-added ghost never vanishes. */
export function reconcilePendingAdds(mod, reqs, graceMs = 8000) {
  const byReq = new Map();
  (reqs || []).forEach((r) => { if (r && r.id != null) byReq.set(String(r.id), r); });
  const now = Date.now();
  const kept = getPendingAdds(mod).filter((g) => {
    const r = byReq.get(String(g.requestNo));
    if (r) return String(r.status || '').toLowerCase() === 'pending';
    return (now - (g.ts || 0)) < graceMs;
  });
  return write(mod, kept);
}

/* ─── Pending BADGE links (existing rows) ───────────────────────────
   Ghost adds cover NEW records. Yeh store EXISTING row keys (student id,
   family id, …) ko approvalId/requestNo se jodta hai taake refresh ke baad
   bhi Pending badge wahi row par dikhe — jab entityId challan/ledger id ho
   aur UI student._id se lookup karta ho (Pre-Enrollment reset receiving). */

function linkStorageKey(mod) {
  let b = '0';
  let u = '0';
  try {
    b = sessionStorage.getItem('branchID') || '0';
    u = sessionStorage.getItem('UserID')
      || sessionStorage.getItem('userID')
      || sessionStorage.getItem('userId')
      || sessionStorage.getItem('user_id')
      || '0';
  } catch (e) { /* no session */ }
  return `erpPendingLinks:${mod}:${b}:${u}`;
}

export function getPendingLinks(mod) {
  try {
    const raw = sessionStorage.getItem(linkStorageKey(mod));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function writeLinks(mod, arr) {
  const next = Array.isArray(arr) ? arr : [];
  try { sessionStorage.setItem(linkStorageKey(mod), JSON.stringify(next)); }
  catch (e) { /* ignore */ }
  return next;
}

/* link = { key, approvalId, requestNo, ts } — `key` is the row id the UI uses. */
export function upsertPendingLink(mod, link) {
  if (link == null || link.key == null) return getPendingLinks(mod);
  const g = { ts: Date.now(), ...link, key: String(link.key) };
  const arr = getPendingLinks(mod).filter((x) => String(x.key) !== g.key);
  arr.unshift(g);
  return writeLinks(mod, arr);
}

export function removePendingLink(mod, key) {
  if (key == null) return getPendingLinks(mod);
  return writeLinks(mod, getPendingLinks(mod).filter((x) => String(x.key) !== String(key)));
}

export function reconcilePendingLinks(mod, reqs, graceMs = 15000) {
  const byReq = new Map();
  const byApproval = new Map();
  (reqs || []).forEach((r) => {
    if (!r || String(r.status || '').toLowerCase() !== 'pending') return;
    if (r.id != null) byReq.set(String(r.id), r);
    if (r.apiId != null) byApproval.set(String(r.apiId), r);
  });
  const now = Date.now();
  const kept = getPendingLinks(mod).filter((g) => {
    const r = (g.requestNo != null && byReq.get(String(g.requestNo)))
      || (g.approvalId != null && byApproval.get(String(g.approvalId)));
    if (r) return true;
    return (now - (g.ts || 0)) < graceMs;
  });
  return writeLinks(mod, kept);
}
