/* Tech Notifications service — Release → Support handoff (TECH_TICKETS_API_README.md §9).

   The server creates the Support notification when a ticket is released, so
   the client never pushes one. Reads and the acknowledge action only. */
import { ApiError, buildQuery } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken, getSuperAdminIdentity } from '../config';
import EP from '../endpoints';

const url = () => `${SA_ADMIN_API_BASE}${EP.techNotifications.base()}`;
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

/** GET ?action=list&audience=support → notifications, newest first. */
export async function getNotifications(audience = 'support', { unacknowledgedOnly = false } = {}) {
  let res;
  try {
    res = await fetch(`${url()}${buildQuery({ action: 'list', audience, unacknowledgedOnly })}`, {
      headers: { accept: '*/*', ...authHeaders() },
    });
  } catch (e) {
    throw new ApiError(e.message || 'Network error', 0);
  }
  return (await unwrap(res)) || [];
}

/** POST (multipart) action=acknowledge — idempotent on the server. */
export async function acknowledgeNotification(id) {
  const fd = new FormData();
  fd.append('action', 'acknowledge');
  fd.append('id', String(id));
  const actor = Number(getSuperAdminIdentity().userId);
  if (actor) fd.append('actorUserId', String(actor));
  let res;
  try {
    res = await fetch(url(), { method: 'POST', headers: { accept: '*/*', ...authHeaders() }, body: fd });
  } catch (e) {
    throw new ApiError(e.message || 'Network error', 0);
  }
  return unwrap(res);
}
